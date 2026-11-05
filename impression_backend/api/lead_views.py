import re
import csv
import io
import json
import logging
from datetime import datetime
from collections import defaultdict

from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from django.core.paginator import Paginator, EmptyPage

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status

from .models import Lead, LeadAssignment, LeadAssignmentHistory, LeadStatusHistory, LeadTask, User, Company
from .serializers import LeadSerializer, LeadAssignmentHistorySerializer, LeadStatusHistorySerializer

logger = logging.getLogger(__name__)


def _normalize_phone_digits(raw):
    if not raw:
        return ""
    digits = re.sub(r'\D', '', str(raw))
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    return digits


def _normalize_email(raw):
    if not raw:
        return ""
    return str(raw).strip().lower()


def _is_lead_admin(user):
    """
    Checks if the user has administrative privileges for Lead Management:
    Admin, Super Admin, Tech Admin, Staff.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    role = (getattr(user, 'role', '') or '').strip().lower().replace(' ', '').replace('_', '').replace('-', '')
    return role in ['superadmin', 'techadmin', 'admin', 'staff']


def _is_lead_authorized(user):
    """
    Check if the user is authenticated and authorized to access lead data.
    - Admin, Super Admin, Tech Admin see all leads.
    - Regular Users (e.g., Dhruvi) see only leads assigned to them.
    """
    return bool(user and getattr(user, 'is_authenticated', False))


def _is_admin_or_superadmin(user):
    return _is_lead_admin(user)


def _can_assign_leads(user):
    return _is_lead_admin(user)


def _lead_queryset_for_user(user):
    """
    Backend Security:
    - Admin, Super Admin, Tech Admin: can view all leads from the database, including assigned and unassigned leads.
    - Regular User (e.g., Dhruvi): strictly see only leads where assigned_to matches their logged-in user ID.
      Must not see leads assigned to other users or unassigned leads.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return Lead.objects.none()

    role = (getattr(user, 'role', '') or '').strip().lower()
    if role in ['superadmin', 'techadmin']:
        return Lead.objects.all()
    elif role == 'admin':
        user_companies = user.companies.all()
        if user_companies.exists():
            return Lead.objects.filter(Q(company__in=user_companies) | Q(company__isnull=True))
        return Lead.objects.all()
    else:
        # Regular User (e.g. Dhruvi): filter strictly by authenticated user ID (M2M assignments or legacy assigned_to)
        return Lead.objects.filter(Q(assignments__user=user) | Q(assigned_to=user)).distinct()


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def leads_list_create_api(request):
    """
    GET: List leads with search, multi-filter, pagination, and status counts.
         - Admin, Super Admin, Tech Admin: see all leads (assigned and unassigned).
         - Regular User (e.g., Dhruvi): see only leads specifically assigned to their own account.
    POST: Create a single lead manually (Admin, Super Admin, Tech Admin only).
    """
    is_admin = _is_lead_admin(request.user)

    if request.method == 'GET':
        queryset = _lead_queryset_for_user(request.user)

        # 1. Company Filter (if provided from frontend header)
        company_id = request.GET.get('company_id')
        if company_id and is_admin:
            try:
                queryset = queryset.filter(company_id=int(company_id))
            except (ValueError, TypeError):
                pass

        # 2. Search Filter (name, company, phone, email, city)
        search_query = request.GET.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(company_name__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(mobile__icontains=search_query) |
                Q(secondary_phone__icontains=search_query) |
                Q(secondary_mobile__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(city__icontains=search_query)
            )

        # 3. City Filter
        city_filter = request.GET.get('city', '').strip()
        if city_filter:
            cities = [c.strip() for c in city_filter.split(',') if c.strip()]
            if len(cities) == 1:
                queryset = queryset.filter(city__iexact=cities[0])
            elif len(cities) > 1:
                queryset = queryset.filter(city__in=cities)

        # 4. Status Filter
        status_filter = request.GET.get('status', '').strip()
        if status_filter and status_filter.lower() != 'all':
            if status_filter.lower() == 'unassigned':
                if is_admin:
                    queryset = queryset.filter(assignments__isnull=True, assigned_to__isnull=True)
                else:
                    queryset = Lead.objects.none()
            else:
                queryset = queryset.filter(status__iexact=status_filter)

        # 5. Assignment Filter
        is_unassigned = request.GET.get('is_unassigned', '').lower() in ('true', '1', 'yes')
        assigned_to_id = request.GET.get('assigned_to', '').strip()

        if is_unassigned or (assigned_to_id and assigned_to_id.lower() == 'unassigned'):
            queryset = queryset.filter(assignments__isnull=True, assigned_to__isnull=True)
        elif assigned_to_id and assigned_to_id.lower() not in ('all', '', 'none'):
            try:
                target_uid = int(assigned_to_id)
                queryset = queryset.filter(Q(assignments__user_id=target_uid) | Q(assigned_to_id=target_uid)).distinct()
            except (ValueError, TypeError):
                pass

        # 6. Date Filter
        date_from = request.GET.get('date_from', '').strip()
        date_to = request.GET.get('date_to', '').strip()
        if date_from:
            try:
                queryset = queryset.filter(created_at__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date())
            except ValueError:
                pass
        if date_to:
            try:
                queryset = queryset.filter(created_at__date__lte=datetime.strptime(date_to, '%Y-%m-%d').date())
            except ValueError:
                pass

        # 7. Excel Name Filter
        excel_name = request.GET.get('excel_name', '').strip()
        if excel_name and is_admin:
            queryset = queryset.filter(excel_name__icontains=excel_name)

        # 8. Segment Filter
        segment_filter = request.GET.get('segment', '').strip()
        if segment_filter and segment_filter.lower() != 'all':
            if segment_filter.lower() in ('unsegmented', 'no segment', 'none'):
                queryset = queryset.filter(Q(segment='') | Q(segment__isnull=True))
            else:
                queryset = queryset.filter(segment__iexact=segment_filter)

        # Calculate Summary Counts before pagination
        base_qs = _lead_queryset_for_user(request.user)
        if company_id and is_admin:
            try:
                base_qs = base_qs.filter(company_id=int(company_id))
            except (ValueError, TypeError):
                pass

        # Calculate Segment breakdown dynamically
        segment_group = list(
            base_qs.exclude(segment='')
            .values('segment')
            .annotate(count=Count('id'))
            .order_by('segment')
        )
        unsegmented_count = base_qs.filter(Q(segment='') | Q(segment__isnull=True)).count()
        segments_list = [{'name': s['segment'], 'count': s['count']} for s in segment_group]
        if unsegmented_count > 0:
            segments_list.append({'name': 'Unsegmented', 'count': unsegmented_count})

        # Calculate Assignable Users with Dynamic Counts
        assignable_users = []
        if _can_assign_leads(request.user):
            users_qs = User.objects.all().order_by('first_name', 'username')
            assignee_counts = dict(
                base_qs.filter(Q(assignments__user__isnull=False) | Q(assigned_to__isnull=False))
                .values('assignments__user_id')
                .annotate(count=Count('id', distinct=True))
                .values_list('assignments__user_id', 'count')
            )
            for u in users_qs:
                full_name = f"{u.first_name} {u.last_name}".strip()
                assignable_users.append({
                    'id': u.id,
                    'username': u.username,
                    'name': full_name or u.username,
                    'role': u.role,
                    'count': assignee_counts.get(u.id, 0),
                })

        counts = {
            'all': base_qs.count(),
            'lead': base_qs.filter(status__iexact=Lead.STATUS_LEAD).count(),
            'hostlead': base_qs.filter(status__iexact=Lead.STATUS_HOSTLEAD).count(),
            'converted': base_qs.filter(status__iexact=Lead.STATUS_CONVERTED).count(),
            'unassigned': base_qs.filter(assignments__isnull=True, assigned_to__isnull=True).distinct().count() if is_admin else 0,
            'segments': segments_list,
            'assignable_users': assignable_users,
        }

        # Pagination
        try:
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', request.GET.get('per_page', 25)))
        except (ValueError, TypeError):
            page = 1
            page_size = 25

        total = queryset.count()
        queryset = queryset.select_related('company', 'assigned_to', 'assigned_by').prefetch_related('assignments__user')
        paginator = Paginator(queryset, page_size)

        try:
            paginated_leads = paginator.page(page)
        except EmptyPage:
            paginated_leads = []

        serializer = LeadSerializer(paginated_leads, many=True)

        return Response({
            'leads': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': paginator.num_pages if total > 0 else 1,
            'counts': counts,
        })

    elif request.method == 'POST':
        if not is_admin:
            return Response(
                {'error': 'You do not have permission to create leads.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Create lead manually
        data = request.data.copy()

        # Check for duplicates before creation
        phone = _normalize_phone_digits(data.get('phone') or data.get('mobile') or data.get('secondary_phone') or data.get('secondary_mobile'))
        email = _normalize_email(data.get('email') or data.get('secondary_email'))
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        company_name = data.get('company_name', '').strip()
        city = data.get('city', '').strip()

        if not (phone or email or company_name or first_name):
            return Response(
                {'error': 'At least a name, company, phone, or email is required to create a lead.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        dup_query = Q()
        if phone and len(phone) >= 7:
            dup_query |= (
                Q(phone__icontains=phone) |
                Q(mobile__icontains=phone) |
                Q(secondary_phone__icontains=phone) |
                Q(secondary_mobile__icontains=phone)
            )
        if email:
            dup_query |= Q(email__iexact=email) | Q(secondary_email__iexact=email)

        if dup_query:
            existing = Lead.objects.filter(dup_query).first()
            if existing:
                matched_num = existing.phone or existing.mobile or existing.secondary_phone or existing.secondary_mobile
                return Response(
                    {'error': f'A lead with this phone ({matched_num}) or email ({existing.email}) already exists (Lead ID: {existing.id}).'},
                    status=status.HTTP_409_CONFLICT
                )

        raw_assignees = data.get('assigned_to')
        if raw_assignees is None:
            raw_assignees = data.get('assigned_user_ids')

        target_uids = []
        if isinstance(raw_assignees, list):
            for val in raw_assignees:
                if val is not None and str(val).strip().isdigit():
                    target_uids.append(int(val))
        elif raw_assignees is not None and str(raw_assignees).strip().isdigit():
            target_uids.append(int(raw_assignees))

        if not target_uids and request.user and request.user.is_authenticated:
            target_uids = [request.user.id]

        target_uids = list(dict.fromkeys(target_uids))
        assigned_users = list(User.objects.filter(id__in=target_uids))
        assigned_user = assigned_users[0] if assigned_users else None

        company = None
        company_id = data.get('company') or data.get('company_id')
        if company_id:
            try:
                company = Company.objects.get(id=int(company_id))
            except (Company.DoesNotExist, ValueError, TypeError):
                company = None

        lead_status = data.get('status', Lead.STATUS_LEAD)
        if lead_status not in [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED]:
            lead_status = Lead.STATUS_LEAD

        lead = Lead.objects.create(
            company_name=company_name,
            first_name=first_name,
            last_name=last_name,
            email=email,
            secondary_email=_normalize_email(data.get('secondary_email')),
            phone=data.get('phone', '').strip(),
            secondary_phone=data.get('secondary_phone', '').strip(),
            mobile=data.get('mobile', '').strip(),
            secondary_mobile=data.get('secondary_mobile', '').strip(),
            address_line1=data.get('address_line1', '').strip(),
            address_line2=data.get('address_line2', '').strip(),
            city=city,
            state=data.get('state', '').strip(),
            country=data.get('country', '').strip(),
            pincode=data.get('pincode', '').strip(),
            website=data.get('website', '').strip(),
            segment=data.get('segment', '').strip(),
            category=data.get('category', '').strip(),
            rating=data.get('rating', '').strip(),
            notes=data.get('notes', '').strip(),
            raw_data=data.get('raw_data', {}),
            status=lead_status,
            status_updated_by=None,
            status_updated_at=None,
            company=company,
            assigned_to=assigned_user,
            assigned_by=request.user if assigned_user else None,
            assigned_at=timezone.now() if assigned_user else None,
            created_by=request.user,
            excel_name=data.get('excel_name', ''),
        )

        for u in assigned_users:
            LeadAssignment.objects.get_or_create(
                lead=lead,
                user=u,
                defaults={
                    'assigned_by': request.user,
                    'assigned_at': timezone.now()
                }
            )
            task = LeadTask.objects.filter(lead=lead, assigned_to=u).first()
            if not task:
                LeadTask.objects.create(
                    lead=lead,
                    assigned_to=u,
                    description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                    assigned_date=timezone.now().date(),
                    status=LeadTask.STATUS_PENDING,
                    is_deleted=False
                )
            else:
                task.is_deleted = False
                task.save()

        if assigned_users:
            user_names = ", ".join([f"{u.first_name} {u.last_name}".strip() or u.username for u in assigned_users])
            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_to=assigned_user,
                assigned_by=request.user,
                notes=f'Initial assignment on creation: {user_names}'
            )

        serializer = LeadSerializer(lead)
        return Response({
            'message': 'Lead created successfully.',
            'lead': serializer.data
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def lead_detail_api(request, lead_id):
    """
    GET: Retrieve lead details with assignment history.
    PUT / PATCH: Update lead fields.
    DELETE: Delete a lead (admins/superadmins only).
    """
    if not _is_lead_authorized(request.user):
        return Response(
            {'error': 'You do not have permission to access Lead Generation.'},
            status=status.HTTP_403_FORBIDDEN
        )

    queryset = _lead_queryset_for_user(request.user)
    lead = queryset.filter(id=lead_id).first()

    if not lead:
        return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = LeadSerializer(lead)
        return Response({'lead': serializer.data})

    elif request.method in ['PUT', 'PATCH']:
        data = request.data
        prev_assignee = lead.assigned_to

        # Check if reassigning (supports multiple assignees and unassigning)
        if ('assigned_to' in data or 'assigned_user_ids' in data) and _can_assign_leads(request.user):
            raw_assignees = data.get('assigned_to') if 'assigned_to' in data else data.get('assigned_user_ids')
            target_user_ids = []
            if isinstance(raw_assignees, list):
                for val in raw_assignees:
                    if val is not None and str(val).strip().isdigit():
                        target_user_ids.append(int(val))
            elif raw_assignees is not None and str(raw_assignees).strip() != '' and str(raw_assignees).strip().lower() != 'unassigned':
                if str(raw_assignees).strip().isdigit():
                    target_user_ids.append(int(raw_assignees))
            target_user_ids = list(dict.fromkeys(target_user_ids))

            current_user_ids = set(lead.assignments.values_list('user_id', flat=True))
            if lead.assigned_to_id:
                current_user_ids.add(lead.assigned_to_id)

            new_user_ids = set(target_user_ids)
            users_to_add = new_user_ids - current_user_ids
            users_to_remove = current_user_ids - new_user_ids

            if users_to_remove:
                lead.assignments.filter(user_id__in=users_to_remove).delete()
                # Remove or soft-delete task for removed users only
                LeadTask.objects.filter(lead=lead, assigned_to_id__in=users_to_remove).update(is_deleted=True)

            for uid in users_to_add:
                try:
                    u = User.objects.get(id=uid)
                    LeadAssignment.objects.get_or_create(
                        lead=lead,
                        user=u,
                        defaults={
                            'assigned_by': request.user,
                            'assigned_at': timezone.now()
                        }
                    )
                    task = LeadTask.objects.filter(lead=lead, assigned_to=u).first()
                    if not task:
                        task = LeadTask.objects.create(
                            lead=lead,
                            assigned_to=u,
                            assigned_date=timezone.now().date(),
                            description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                            status=LeadTask.STATUS_PENDING,
                            is_deleted=False
                        )
                    elif task.is_deleted:
                        task.is_deleted = False
                        task.save()
                except User.DoesNotExist:
                    pass

            active_assignments = list(lead.assignments.select_related('user').all())
            if active_assignments:
                lead.assigned_to = active_assignments[0].user
                lead.assigned_by = request.user
                lead.assigned_at = timezone.now()
            else:
                lead.assigned_to = None
                lead.assigned_by = None
                lead.assigned_at = None

            if users_to_add or users_to_remove:
                assigned_names = ", ".join([a.user.username for a in active_assignments]) if active_assignments else "Unassigned"
                LeadAssignmentHistory.objects.create(
                    lead=lead,
                    assigned_to=lead.assigned_to,
                    assigned_by=request.user,
                    previous_assignee=prev_assignee,
                    notes=data.get('assignment_notes') or f"Assignments updated to: {assigned_names}"
                )

        # Update other fields
        status_changed = False
        old_status = lead.status
        for field in [
            'company_name', 'first_name', 'last_name', 'email', 'secondary_email',
            'phone', 'secondary_phone', 'mobile', 'secondary_mobile', 'address_line1', 'address_line2',
            'city', 'state', 'country', 'pincode', 'website', 'segment',
            'category', 'rating', 'notes'
        ]:
            if field in data:
                setattr(lead, field, data[field])

        if 'status' in data:
            val = data['status']
            if val in [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED] and val != old_status:
                lead.status = val
                lead.status_updated_by = request.user
                lead.status_updated_at = timezone.now()
                status_changed = True

        lead.save()

        if status_changed:
            LeadStatusHistory.objects.create(
                lead=lead,
                old_status=old_status,
                new_status=lead.status,
                changed_by=request.user,
                changed_at=lead.status_updated_at,
                notes=data.get('status_notes', 'Status updated via detail view')
            )

        serializer = LeadSerializer(lead)
        return Response({
            'message': 'Lead updated successfully.',
            'lead': serializer.data
        })

    elif request.method == 'DELETE':
        if not _is_admin_or_superadmin(request.user):
            return Response({'error': 'Only Admins and Superadmins can delete leads.'}, status=status.HTTP_403_FORBIDDEN)

        lead.delete()
        return Response({'message': 'Lead deleted successfully.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lead_status_update_api(request, lead_id):
    """
    Quick status update endpoint: Lead, HostLead, Converted, Unassigned.
    - If status == 'Unassigned': clears assigned_to (unassigns the lead) while preserving original business status (Admins only).
    - If status in ['Lead', 'HostLead', 'Converted']: updates lead.status and captures status_updated_by.
      If the lead was unassigned and updater is an admin, also assigns it to request.user.
      If the lead already has an assigned representative (e.g. Dhruvi), that representative is preserved!
    """
    queryset = _lead_queryset_for_user(request.user)
    lead = queryset.filter(id=lead_id).first()

    if not lead:
        return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = str(request.data.get('status', '')).strip()

    if new_status.lower() == 'unassigned':
        if not _can_assign_leads(request.user):
            return Response({'error': 'You do not have permission to unassign leads.'}, status=status.HTTP_403_FORBIDDEN)

        prev_assignee = lead.assigned_to
        lead.assignments.all().delete()
        LeadTask.objects.filter(lead=lead).update(is_deleted=True)
        lead.assigned_to = None
        lead.assigned_by = None
        lead.assigned_at = None
        lead.status_updated_by = None
        lead.status_updated_at = None
        lead.save()

        if prev_assignee:
            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_to=None,
                assigned_by=request.user,
                previous_assignee=prev_assignee,
                notes='Unassigned via status dropdown'
            )

        return Response({
            'message': 'Lead unassigned successfully.',
            'lead_id': lead.id,
            'status': lead.status,  # Original business status PRESERVED in DB!
            'assigned_to': None,
            'assigned_to_name': 'Unassigned',
            'assigned_to_display': 'Unassigned',
            'status_updated_by': None,
            'status_updated_by_name': '',
        })

    elif new_status in [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED]:
        old_status = lead.status
        prev_assignee = lead.assigned_to
        now = timezone.now()
        lead.status = new_status
        lead.status_updated_by = request.user
        lead.status_updated_at = now

        # Only assign if the lead was unassigned and updater can assign leads
        if not lead.assigned_to and _can_assign_leads(request.user):
            lead.assigned_to = request.user
            lead.assigned_by = request.user
            lead.assigned_at = now
            LeadAssignment.objects.get_or_create(
                lead=lead,
                user=request.user,
                defaults={'assigned_by': request.user, 'assigned_at': now}
            )
            task = LeadTask.objects.filter(lead=lead, assigned_to=request.user).first()
            if not task:
                LeadTask.objects.create(
                    lead=lead,
                    assigned_to=request.user,
                    description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                    assigned_date=now.date(),
                    status=LeadTask.STATUS_PENDING,
                    is_deleted=False
                )
            elif task.is_deleted:
                task.is_deleted = False
                task.save()

            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_to=request.user,
                assigned_by=request.user,
                previous_assignee=prev_assignee,
                assigned_at=now,
                notes=f'Assigned to {request.user.username} via status change to {new_status}'
            )

        lead.save()

        LeadStatusHistory.objects.create(
            lead=lead,
            old_status=old_status,
            new_status=new_status,
            changed_by=request.user,
            changed_at=now,
            notes=request.data.get('notes', 'Status updated via quick status dropdown')
        )

        assigned_name = (
            f"{lead.assigned_to.first_name} {lead.assigned_to.last_name}".strip() or lead.assigned_to.username
            if lead.assigned_to else "Unassigned"
        )
        updater_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        return Response({
            'message': f'Lead status updated to {new_status}.',
            'lead_id': lead.id,
            'status': lead.status,
            'assigned_to': lead.assigned_to.id if lead.assigned_to else None,
            'assigned_to_name': assigned_name,
            'assigned_to_display': assigned_name,
            'status_updated_by': request.user.id,
            'status_updated_by_name': updater_name,
        })

    else:
        return Response(
            {'error': f"Invalid status. Must be one of: '{Lead.STATUS_LEAD}', '{Lead.STATUS_HOSTLEAD}', '{Lead.STATUS_CONVERTED}', 'Unassigned'."},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lead_bulk_status_api(request):
    """
    Bulk update status for selected leads.
    Supports: Lead, HostLead, Converted, Unassigned.
    Only Admin, Super Admin, Tech Admin can perform bulk updates.
    """
    if not _is_lead_admin(request.user):
        return Response(
            {'error': 'You do not have permission to bulk update lead status.'},
            status=status.HTTP_403_FORBIDDEN
        )

    lead_ids = request.data.get('lead_ids', [])
    new_status = str(request.data.get('status', '')).strip()
    status_notes = request.data.get('notes', 'Bulk status update')

    if not lead_ids or not isinstance(lead_ids, list):
        return Response({'error': 'lead_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_status.lower() == 'unassigned':
        queryset = _lead_queryset_for_user(request.user).filter(id__in=lead_ids)
        history_entries = []
        now = timezone.now()

        with transaction.atomic():
            for lead in queryset:
                prev_user = lead.assigned_to
                lead.assignments.all().delete()
                LeadTask.objects.filter(lead=lead).update(is_deleted=True)
                lead.assigned_to = None
                lead.assigned_by = None
                lead.assigned_at = None
                lead.status_updated_by = None
                lead.status_updated_at = None
                lead.save()

                if prev_user:
                    history_entries.append(
                        LeadAssignmentHistory(
                            lead=lead,
                            assigned_to=None,
                            assigned_by=request.user,
                            previous_assignee=prev_user,
                            assigned_at=now,
                            notes=status_notes
                        )
                    )

            if history_entries:
                LeadAssignmentHistory.objects.bulk_create(history_entries)

        return Response({
            'message': f'Successfully unassigned {queryset.count()} leads while preserving their business status.',
            'updated_count': queryset.count(),
            'status': 'Unassigned',
        })

    elif new_status in [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED]:
        queryset = _lead_queryset_for_user(request.user).filter(id__in=lead_ids)
        now = timezone.now()
        history_entries = []
        assign_entries = []

        with transaction.atomic():
            for lead in queryset:
                old_st = lead.status
                prev_user = lead.assigned_to
                lead.status = new_status
                # Preserve existing assignee if lead was already assigned!
                if not lead.assigned_to:
                    lead.assigned_to = request.user
                    lead.assigned_by = request.user
                    lead.assigned_at = now
                    LeadAssignment.objects.get_or_create(
                        lead=lead,
                        user=request.user,
                        defaults={'assigned_by': request.user, 'assigned_at': now}
                    )
                    task = LeadTask.objects.filter(lead=lead, assigned_to=request.user).first()
                    if not task:
                        LeadTask.objects.create(
                            lead=lead,
                            assigned_to=request.user,
                            assigned_date=now.date(),
                            description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                            status=LeadTask.STATUS_PENDING,
                            is_deleted=False
                        )
                    elif task.is_deleted:
                        task.is_deleted = False
                        task.save()
                    assign_entries.append(
                        LeadAssignmentHistory(
                            lead=lead,
                            assigned_to=request.user,
                            assigned_by=request.user,
                            previous_assignee=prev_user,
                            assigned_at=now,
                            notes=f'Assigned via bulk status change to {new_status}'
                        )
                    )

                lead.status_updated_by = request.user
                lead.status_updated_at = now
                lead.save()

                history_entries.append(
                    LeadStatusHistory(
                        lead=lead,
                        old_status=old_st,
                        new_status=new_status,
                        changed_by=request.user,
                        changed_at=now,
                        notes=status_notes
                    )
                )

            if history_entries:
                LeadStatusHistory.objects.bulk_create(history_entries)
            if assign_entries:
                LeadAssignmentHistory.objects.bulk_create(assign_entries)

        user_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        return Response({
            'message': f'Successfully updated status for {len(history_entries)} leads to {new_status}.',
            'updated_count': len(history_entries),
            'status': new_status,
            'status_updated_by': request.user.id,
            'status_updated_by_name': user_name,
        })
    else:
        return Response(
            {'error': f"Invalid status. Must be one of: '{Lead.STATUS_LEAD}', '{Lead.STATUS_HOSTLEAD}', '{Lead.STATUS_CONVERTED}', 'Unassigned'."},
            status=status.HTTP_400_BAD_REQUEST
        )



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lead_bulk_assign_api(request):
    """
    Bulk or single assignment of leads to one or multiple authorized users.
    Supports 'assigned_to_ids' (list) or 'assigned_to_id' (single / 'unassign').
    """
    if not _can_assign_leads(request.user):
        return Response({'error': 'You do not have permission to assign leads.'}, status=status.HTTP_403_FORBIDDEN)

    lead_ids = request.data.get('lead_ids', [])
    raw_ids = request.data.get('assigned_to_ids')
    if raw_ids is None:
        single_id = request.data.get('assigned_to_id')
        if single_id is not None:
            raw_ids = [single_id] if single_id != 'unassign' else 'unassign'

    assignment_notes = request.data.get('notes', 'Bulk assignment')

    if not lead_ids or not isinstance(lead_ids, list):
        return Response({'error': 'lead_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)

    is_unassigning = False
    target_users = []

    if raw_ids == 'unassign' or (isinstance(raw_ids, list) and 'unassign' in raw_ids):
        is_unassigning = True
    elif isinstance(raw_ids, list):
        parsed_uids = []
        for val in raw_ids:
            if val is not None and str(val).strip().isdigit():
                parsed_uids.append(int(val))
        parsed_uids = list(dict.fromkeys(parsed_uids))
        if parsed_uids:
            target_users = list(User.objects.filter(id__in=parsed_uids))
            if not target_users:
                return Response({'error': 'Selected assignee user(s) do not exist.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            is_unassigning = True

    queryset = _lead_queryset_for_user(request.user).filter(id__in=lead_ids)
    now = timezone.now()
    today = now.date()
    history_entries = []

    with transaction.atomic():
        for lead in queryset:
            prev_user = lead.assigned_to
            if is_unassigning:
                lead.assignments.all().delete()
                LeadTask.objects.filter(lead=lead).update(is_deleted=True)
                lead.assigned_to = None
                lead.assigned_by = None
                lead.assigned_at = None
                lead.save()

                history_entries.append(
                    LeadAssignmentHistory(
                        lead=lead,
                        assigned_to=None,
                        assigned_by=request.user,
                        previous_assignee=prev_user,
                        assigned_at=now,
                        notes=f"{assignment_notes} (Unassigned)"
                    )
                )
            else:
                lead.assigned_to = target_users[0]
                lead.assigned_by = request.user
                lead.assigned_at = now
                lead.save()

                for u in target_users:
                    LeadAssignment.objects.get_or_create(
                        lead=lead,
                        user=u,
                        defaults={'assigned_by': request.user, 'assigned_at': now}
                    )
                    task = LeadTask.objects.filter(lead=lead, assigned_to=u).first()
                    if not task:
                        task = LeadTask.objects.create(
                            lead=lead,
                            assigned_to=u,
                            assigned_date=today,
                            description=lead.notes or f"Follow up with {lead.company_name or 'Lead'}",
                            status=LeadTask.STATUS_PENDING,
                            is_deleted=False
                        )
                    elif task.is_deleted:
                        task.is_deleted = False
                        task.save()

                user_names = ", ".join([u.username for u in target_users])
                history_entries.append(
                    LeadAssignmentHistory(
                        lead=lead,
                        assigned_to=target_users[0],
                        assigned_by=request.user,
                        previous_assignee=prev_user,
                        assigned_at=now,
                        notes=f"{assignment_notes} (Assigned to {user_names})"
                    )
                )

        if history_entries:
            LeadAssignmentHistory.objects.bulk_create(history_entries)

    assignee_name = ", ".join([f"{u.first_name} {u.last_name}".strip() or u.username for u in target_users]) if target_users else "Unassigned"
    return Response({
        'message': f'Successfully updated assignment for {len(history_entries)} leads to {assignee_name}.',
        'updated_count': len(history_entries)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def lead_upload_parse_or_import_api(request):
    """
    Handles two modes:
    1. Parse mode: Upload Excel/CSV file to inspect headers, columns, and sample preview rows.
    2. Import mode: Receives mapped rows, validates, prevents duplicates, and saves into 'lead' table.
    """
    if not _is_lead_admin(request.user):
        return Response(
            {'error': 'You do not have permission to import leads.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Mode 1: File provided in multipart/form-data for preview and header extraction
    if 'file' in request.FILES:
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name

        try:
            if file_name.endswith('.csv'):
                decoded = uploaded_file.read().decode('utf-8', errors='ignore')
                reader = csv.reader(io.StringIO(decoded))
                rows = list(reader)
                if not rows:
                    return Response({'error': 'CSV file is empty.'}, status=status.HTTP_400_BAD_REQUEST)

                raw_headers = [h.strip() for h in rows[0]]
                headers = [
                    h for h in raw_headers
                    if h and h.lower() not in ('file_column_header', 'file column header', '__parsed_extra')
                ]
                sample_data = []
                for r in rows[1:11]:  # First 10 preview rows
                    if any(r):
                        row_dict = {}
                        for i, h in enumerate(raw_headers):
                            if h and h.lower() not in ('file_column_header', 'file column header', '__parsed_extra'):
                                val = r[i].strip() if i < len(r) else ""
                                row_dict[h] = val
                        sample_data.append(row_dict)

                total_rows = sum(1 for r in rows[1:] if any(r))
                return Response({
                    'file_name': file_name,
                    'headers': headers,
                    'preview_rows': sample_data,
                    'total_rows': total_rows
                })

            elif file_name.endswith(('.xlsx', '.xls')):
                import openpyxl
                wb = openpyxl.load_workbook(uploaded_file, data_only=True)
                sheet = wb.active
                sheet_rows = list(sheet.iter_rows(values_only=True))
                if not sheet_rows:
                    return Response({'error': 'Excel file is empty.'}, status=status.HTTP_400_BAD_REQUEST)

                raw_headers = [str(h).strip() for h in sheet_rows[0] if h is not None]
                headers = [
                    h for h in raw_headers
                    if h and h.lower() not in ('file_column_header', 'file column header', '__parsed_extra') and not h.startswith('__EMPTY')
                ]
                sample_data = []
                for r in sheet_rows[1:11]:
                    if any(r):
                        row_dict = {}
                        for i, h in enumerate(raw_headers):
                            if h and h.lower() not in ('file_column_header', 'file column header', '__parsed_extra') and not h.startswith('__EMPTY'):
                                val = r[i] if i < len(r) else ""
                                row_dict[h] = str(val).strip() if val is not None else ""
                        sample_data.append(row_dict)

                total_rows = sum(1 for r in sheet_rows[1:] if any(r))
                return Response({
                    'file_name': file_name,
                    'headers': headers,
                    'preview_rows': sample_data,
                    'total_rows': total_rows
                })
            else:
                return Response({'error': 'Unsupported file format. Please upload a .csv, .xlsx, or .xls file.'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Error parsing lead file: %s", e)
            return Response({'error': f'Failed to parse file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    # Mode 2: JSON Import mode with column_mapping and rows
    data = request.data
    rows = data.get('rows', [])
    column_mapping = data.get('column_mapping', {})
    file_name = data.get('file_name', '')
    company_id = data.get('company_id')
    default_status = data.get('status', Lead.STATUS_LEAD)

    if not rows:
        return Response({'error': 'No rows provided for import.'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Validation: Do not allow multiple source columns to map to the same destination field (except 'skip')
    target_counts = defaultdict(list)
    for file_col, db_field in column_mapping.items():
        if db_field and db_field != 'skip':
            target_counts[db_field].append(file_col)

    duplicates = {field: cols for field, cols in target_counts.items() if len(cols) > 1}
    if duplicates:
        dup_msgs = [f"'{field}' mapped by columns: {', '.join(cols)}" for field, cols in duplicates.items()]
        return Response({
            'error': f"Cannot import: Multiple columns are mapped to the same field ({'; '.join(dup_msgs)}). Please assign unique fields."
        }, status=status.HTTP_400_BAD_REQUEST)

    company = None
    if company_id:
        try:
            company = Company.objects.get(id=int(company_id))
        except (Company.DoesNotExist, ValueError, TypeError):
            pass

    imported_count = 0
    duplicate_rows = []
    invalid_rows = []
    created_leads = []

    # Pre-fetch existing identifiers to efficiently deduplicate in-memory
    existing_phones = set()
    existing_emails = set()
    existing_names = set()
    existing_company_city = set()

    for p, m, sp, sm in Lead.objects.values_list('phone', 'mobile', 'secondary_phone', 'secondary_mobile'):
        for num in (p, m, sp, sm):
            if num:
                digits = _normalize_phone_digits(num)
                if digits and len(digits) >= 7:
                    existing_phones.add(digits)

    for em, sem in Lead.objects.values_list('email', 'secondary_email'):
        for e in (em, sem):
            if e:
                norm = _normalize_email(e)
                if norm:
                    existing_emails.add(norm)

    for comp, fn, ln, c in Lead.objects.values_list('company_name', 'first_name', 'last_name', 'city'):
        key = f"{comp.strip().lower()}|{fn.strip().lower()}|{ln.strip().lower()}|{c.strip().lower()}"
        if key != "|||":
            existing_names.add(key)
        if comp and c:
            existing_company_city.add(f"{comp.strip().lower()}|{c.strip().lower()}")

    seen_in_batch = set()

    with transaction.atomic():
        for idx, row in enumerate(rows):
            if not isinstance(row, dict) or not any(row.values()):
                continue

            lead_fields = {}
            raw_unmapped = {}

            if column_mapping:
                for file_col, db_field in column_mapping.items():
                    if db_field and db_field != 'skip':
                        val = row.get(file_col)
                        val_str = str(val).strip() if val is not None else ""
                        lead_fields[db_field] = val_str
                    else:
                        val = row.get(file_col)
                        if val is not None and str(val).strip():
                            raw_unmapped[file_col] = str(val).strip()
            else:
                for k, v in row.items():
                    lead_fields[k] = str(v).strip() if v is not None else ""

            # Standardize company and contact names strictly based on mapping
            comp_name = lead_fields.get('company_name', '').strip()
            first_name = lead_fields.get('first_name', '').strip()
            last_name = lead_fields.get('last_name', '').strip()

            # If contact_person is explicitly mapped by the user
            contact_person_raw = lead_fields.get('contact_person', '').strip()
            if contact_person_raw and not first_name and not last_name:
                if '@' not in contact_person_raw:
                    parts = contact_person_raw.split(None, 1)
                    first_name = parts[0]
                    if len(parts) > 1:
                        last_name = parts[1]

            # Only fallback if NO column_mapping was provided at all
            if not column_mapping:
                if not comp_name:
                    comp_name = lead_fields.get('Company') or lead_fields.get('company') or ''
                if not first_name and not last_name:
                    first_name = lead_fields.get('Fname') or lead_fields.get('fname') or ''
                    last_name = lead_fields.get('Lname') or lead_fields.get('lname') or ''
                if not first_name and not last_name:
                    contact_candidate = (
                        row.get('Contact Person') or row.get('contact person') or
                        row.get('Contact Name') or row.get('contact name') or
                        row.get('Contact') or row.get('contact') or ''
                    )
                    if contact_candidate and str(contact_candidate).strip() and '@' not in str(contact_candidate):
                        parts = str(contact_candidate).strip().split(None, 1)
                        first_name = parts[0]
                        if len(parts) > 1:
                            last_name = parts[1]

            # Separate contact-person names from email addresses
            email_raw = lead_fields.get('email', '').strip()
            sec_email_raw = lead_fields.get('secondary_email', '').strip()
            if not column_mapping and not email_raw:
                email_raw = lead_fields.get('Email1') or lead_fields.get('email1') or ''
            if '@' in first_name:
                if not email_raw:
                    email_raw = first_name
                first_name = ''
            if '@' in last_name:
                if not email_raw:
                    email_raw = last_name
                last_name = ''

            # Clean dummy zero strings ('0', '00', '-', 'None', 'null')
            def _clean_phone(v):
                val = str(v).strip() if v is not None else ""
                return "" if val.lower() in ('0', '00', '-', 'none', 'null') else val

            phone_clean = _clean_phone(lead_fields.get('phone'))
            sec_phone_clean = _clean_phone(lead_fields.get('secondary_phone'))
            mobile_clean = _clean_phone(lead_fields.get('mobile'))
            sec_mobile_clean = _clean_phone(lead_fields.get('secondary_mobile'))

            city = lead_fields.get('city') or lead_fields.get('City') or ''
            address1 = lead_fields.get('address_line1') or lead_fields.get('Address1') or ''
            address2 = lead_fields.get('address_line2') or lead_fields.get('Address2') or ''
            state = lead_fields.get('state') or lead_fields.get('State') or ''
            country = lead_fields.get('country') or lead_fields.get('Country') or ''
            pincode = lead_fields.get('pincode') or lead_fields.get('Pincode') or ''
            website = lead_fields.get('website') or lead_fields.get('Website') or ''
            segment = lead_fields.get('segment') or lead_fields.get('Segment') or ''
            category = lead_fields.get('category') or lead_fields.get('Category') or ''
            rating = lead_fields.get('rating') or lead_fields.get('Rating') or ''
            notes = lead_fields.get('notes') or lead_fields.get('Notes') or ''

            # Store the 100% complete original Excel/CSV row dictionary into raw_data, filtering internal labels
            complete_raw_row = {}
            for col_k, col_v in row.items():
                if col_k is not None:
                    k_str = str(col_k).strip()
                    if k_str and k_str.lower() not in ('file_column_header', 'file column header', '__parsed_extra'):
                        complete_raw_row[k_str] = str(col_v).strip() if col_v is not None else ""

            # Normalize all phone numbers from this row
            row_norm_phones = []
            for num in (phone_clean, mobile_clean, sec_phone_clean, sec_mobile_clean):
                nd = _normalize_phone_digits(num)
                if nd and len(nd) >= 7:
                    row_norm_phones.append(nd)

            # Normalize emails
            row_norm_emails = []
            for em in (email_raw, sec_email_raw):
                ne = _normalize_email(em)
                if ne:
                    row_norm_emails.append(ne)

            norm_key = f"{comp_name.strip().lower()}|{first_name.strip().lower()}|{last_name.strip().lower()}|{city.strip().lower()}"
            comp_city_key = f"{comp_name.strip().lower()}|{city.strip().lower()}" if comp_name and city else ""

            # Check if empty record
            if not (comp_name or first_name or last_name or row_norm_phones or row_norm_emails):
                invalid_rows.append({'row_index': idx + 1, 'reason': 'Missing contact name, company, phone, and email'})
                continue

            # Check Duplicates against DB or Batch
            is_duplicate = False
            dup_reason = ""

            # Check phone duplicates
            matched_phone = next((p for p in row_norm_phones if p in existing_phones or p in seen_in_batch), None)
            matched_email = next((e for e in row_norm_emails if e in existing_emails or e in seen_in_batch), None)

            if matched_phone:
                is_duplicate = True
                dup_reason = f"Duplicate Phone/Mobile: {matched_phone}"
            elif matched_email:
                is_duplicate = True
                dup_reason = f"Duplicate Email: {matched_email}"
            elif comp_city_key and (comp_city_key in existing_company_city or comp_city_key in seen_in_batch):
                is_duplicate = True
                dup_reason = f"Duplicate Company & City: {comp_name} ({city})"
            elif norm_key != "|||" and (norm_key in existing_names or norm_key in seen_in_batch):
                is_duplicate = True
                dup_reason = f"Duplicate Name & City: {first_name} {last_name} ({city})"

            if is_duplicate:
                duplicate_rows.append({
                    'row_index': idx + 1,
                    'company_name': comp_name,
                    'name': f"{first_name} {last_name}".strip(),
                    'phone': phone_clean or mobile_clean or sec_phone_clean or sec_mobile_clean,
                    'email': email_raw or sec_email_raw,
                    'city': city,
                    'reason': dup_reason
                })
                continue

            # Record identifier in seen batch
            for p in row_norm_phones:
                seen_in_batch.add(p)
                existing_phones.add(p)
            for e in row_norm_emails:
                seen_in_batch.add(e)
                existing_emails.add(e)
            if comp_city_key:
                seen_in_batch.add(comp_city_key)
                existing_company_city.add(comp_city_key)
            if norm_key != "|||":
                seen_in_batch.add(norm_key)
                existing_names.add(norm_key)

            # Newly imported leads MUST be Unassigned with no assigned_by
            new_lead = Lead(
                company_name=comp_name,
                first_name=first_name,
                last_name=last_name,
                phone=phone_clean,
                secondary_phone=sec_phone_clean,
                mobile=mobile_clean,
                secondary_mobile=sec_mobile_clean,
                email=email_raw,
                secondary_email=sec_email_raw,
                address_line1=address1,
                address_line2=address2,
                city=city,
                state=state,
                country=country,
                pincode=pincode,
                website=website,
                segment=segment,
                category=category,
                rating=rating,
                notes=notes,
                raw_data=complete_raw_row,
                status=default_status if default_status in [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED] else Lead.STATUS_LEAD,
                company=company,
                assigned_to=None,
                assigned_by=None,
                assigned_at=None,
                status_updated_by=None,
                status_updated_at=None,
                created_by=request.user,
                excel_name=file_name
            )
            created_leads.append(new_lead)

        if created_leads:
            Lead.objects.bulk_create(created_leads)
            imported_count = len(created_leads)

    return Response({
        'success': True,
        'message': f"Import finished: {imported_count} leads imported successfully, {len(duplicate_rows)} duplicates skipped.",
        'imported_count': imported_count,
        'duplicate_count': len(duplicate_rows),
        'invalid_count': len(invalid_rows),
        'duplicates': duplicate_rows,
        'invalid_rows': invalid_rows
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lead_filters_options_api(request):
    """
    Returns distinct filter options (cities, statuses, assignees) and dynamic counts for the Lead Generation UI.
    - Admin, Super Admin, Tech Admin: see all cities, assignable users, counts for all leads.
    - Regular User: sees distinct cities and counts only for their own assigned leads.
    """
    is_admin = _is_lead_admin(request.user)
    qs = _lead_queryset_for_user(request.user)

    cities = list(qs.exclude(city='').values_list('city', flat=True).distinct().order_by('city'))
    excel_files = list(qs.exclude(excel_name='').values_list('excel_name', flat=True).distinct().order_by('excel_name')) if is_admin else []

    statuses = [Lead.STATUS_LEAD, Lead.STATUS_HOSTLEAD, Lead.STATUS_CONVERTED]

    # Segments breakdown with dynamic counts
    segment_group = list(
        qs.exclude(segment='')
        .values('segment')
        .annotate(count=Count('id'))
        .order_by('segment')
    )
    unsegmented_count = qs.filter(Q(segment='') | Q(segment__isnull=True)).count()
    segments_list = [{'name': s['segment'], 'count': s['count']} for s in segment_group]
    if unsegmented_count > 0:
        segments_list.append({'name': 'Unsegmented', 'count': unsegmented_count})

    counts = {
        'all': qs.count(),
        'lead': qs.filter(status__iexact=Lead.STATUS_LEAD).count(),
        'hostlead': qs.filter(status__iexact=Lead.STATUS_HOSTLEAD).count(),
        'converted': qs.filter(status__iexact=Lead.STATUS_CONVERTED).count(),
        'unassigned': qs.filter(assignments__isnull=True, assigned_to__isnull=True).distinct().count() if is_admin else 0,
        'segments': segments_list,
    }

    # Available assignees (Only available for Admins who can assign leads)
    assignable_users = []
    if _can_assign_leads(request.user):
        users_qs = User.objects.all().order_by('first_name', 'username')
        assignee_counts = dict(
            qs.filter(Q(assignments__user__isnull=False) | Q(assigned_to__isnull=False))
            .values('assignments__user_id')
            .annotate(count=Count('id', distinct=True))
            .values_list('assignments__user_id', 'count')
        )
        for u in users_qs:
            full_name = f"{u.first_name} {u.last_name}".strip()
            assignable_users.append({
                'id': u.id,
                'username': u.username,
                'name': full_name or u.username,
                'role': u.role,
                'count': assignee_counts.get(u.id, 0),
            })

    counts['assignable_users'] = assignable_users

    return Response({
        'cities': cities,
        'statuses': statuses,
        'excel_files': excel_files,
        'assignable_users': assignable_users,
        'segments': segments_list,
        'counts': counts,
    })



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lead_assignments_api(request, lead_id):
    """
    GET /api/leads/{id}/assignments/
    Returns full list of all active users assigned to this lead,
    including assigned_by and assigned_at timestamps.
    """
    queryset = _lead_queryset_for_user(request.user)
    lead = queryset.filter(id=lead_id).first()
    if not lead:
        return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    assignments_data = []
    assignments = lead.assignments.select_related('user', 'assigned_by').all().order_by('-assigned_at')

    for a in assignments:
        u = a.user
        by = a.assigned_by
        user_name = f"{u.first_name} {u.last_name}".strip() or u.username
        by_name = f"{by.first_name} {by.last_name}".strip() or by.username if by else "System"
        assignments_data.append({
            'user_id': u.id,
            'username': u.username,
            'name': user_name,
            'role': getattr(u, 'role', ''),
            'email': getattr(u, 'email', ''),
            'assigned_by_id': by.id if by else None,
            'assigned_by_name': by_name,
            'assigned_at': a.assigned_at.isoformat() if a.assigned_at else None,
        })

    # If no assignments table entries exist but legacy assigned_to is set
    if not assignments_data and lead.assigned_to:
        u = lead.assigned_to
        by = lead.assigned_by
        user_name = f"{u.first_name} {u.last_name}".strip() or u.username
        by_name = f"{by.first_name} {by.last_name}".strip() or by.username if by else "System"
        assignments_data.append({
            'user_id': u.id,
            'username': u.username,
            'name': user_name,
            'role': getattr(u, 'role', ''),
            'email': getattr(u, 'email', ''),
            'assigned_by_id': by.id if by else None,
            'assigned_by_name': by_name,
            'assigned_at': lead.assigned_at.isoformat() if lead.assigned_at else None,
        })

    return Response({
        'lead_id': lead.id,
        'company_name': lead.company_name or '',
        'total_assigned': len(assignments_data),
        'assignments': assignments_data
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def lead_assignment_remove_user_api(request, lead_id, user_id):
    """
    DELETE /api/leads/{id}/assignments/{uid}/
    Removes specific user from lead assignment.
    The lead disappears from ONLY that user's Task Manager; other assignees retain access.
    """
    if not _can_assign_leads(request.user):
        return Response({'error': 'You do not have permission to remove lead assignments.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Check assignment
    assignment = LeadAssignment.objects.filter(lead=lead, user=target_user).first()
    was_legacy = (lead.assigned_to_id == target_user.id)

    if not assignment and not was_legacy:
        return Response({'error': f'User {target_user.username} is not assigned to this lead.'}, status=status.HTTP_404_NOT_FOUND)

    if assignment:
        assignment.delete()

    # Soft-delete that user's task
    LeadTask.objects.filter(lead=lead, assigned_to=target_user).update(is_deleted=True)

    # Re-evaluate lead.assigned_to
    remaining = list(lead.assignments.select_related('user').all())
    if remaining:
        lead.assigned_to = remaining[0].user
    else:
        lead.assigned_to = None
        lead.assigned_by = None
        lead.assigned_at = None
    lead.save()

    # Log history
    prev_user_name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username
    LeadAssignmentHistory.objects.create(
        lead=lead,
        assigned_to=lead.assigned_to,
        assigned_by=request.user,
        previous_assignee=target_user,
        notes=f"User {prev_user_name} removed from lead assignment by {request.user.username}."
    )

    return Response({
        'message': f'User {prev_user_name} removed from lead assignment successfully.',
        'lead_id': lead.id,
        'removed_user_id': target_user.id,
        'remaining_assigned_count': len(remaining)
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lead_interactions_360_api(request, lead_id):
    """
    GET /api/leads/{id}/interactions/
    Aggregates all interaction history across all assigned representatives for full multi-agent client visibility.
    """
    from .models import TaskCallHistory

    queryset = _lead_queryset_for_user(request.user)
    lead = queryset.filter(id=lead_id).first()
    if not lead:
        return Response({'error': 'Lead not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    records = TaskCallHistory.objects.filter(lead=lead).select_related('user', 'task').order_by('-call_date', '-id')

    interactions = []
    for c in records:
        user_display = f"{c.user.first_name or ''} {c.user.last_name or ''}".strip() or c.user.username if c.user else ''
        interaction_type = getattr(c, 'interaction_type', 'Call') or 'Call'
        interactions.append({
            'id': c.id,
            'task_id': c.task_id,
            'interaction_type': interaction_type,
            'call_date': c.call_date.isoformat() if c.call_date else None,
            'interaction_date': c.call_date.isoformat() if c.call_date else None,
            'communication_notes': c.discussion or '',
            'discussion': c.discussion or '',
            'next_followup_date': c.next_followup_date.isoformat() if c.next_followup_date else None,
            'next_followup_notes': c.future_discussion or '',
            'future_discussion': c.future_discussion or '',
            'user_id': c.user_id,
            'user_name': user_display,
            'user_role': getattr(c.user, 'role', '') if c.user else '',
            'created_at': c.created_at.isoformat() if c.created_at else None,
        })

    contact_person = f"{lead.first_name or ''} {lead.last_name or ''}".strip()
    return Response({
        'lead_id': lead.id,
        'company_name': lead.company_name or '',
        'contact_person': contact_person,
        'phone': lead.phone or lead.mobile or '',
        'email': lead.email or '',
        'total_interactions': len(interactions),
        'interactions': interactions
    }, status=status.HTTP_200_OK)
