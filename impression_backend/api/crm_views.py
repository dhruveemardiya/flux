import io
import re
import csv
import json
import logging
from datetime import datetime, date, timedelta
from collections import defaultdict

from django.db import transaction
from django.db.models import Q, Count, Sum, Case, When, IntegerField, F
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.core.paginator import Paginator, EmptyPage

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status

from .models import (
    User, Role, Segment, Lead, LeadAssignment, LeadAssignmentHistory,
    CRMUserProfile, CRMRolePermission, CRMUserPermissionOverride, CRMAccessRequest, CRMAccessLog,
    LeadSegmentMap, SegmentMigrationLog, CRMTaskGroup, CRMTaskAssignee, CRMTaskLead,
    LeadTaskActivity, CRMCommunicationLog, LeadImportJob, LeadImportRow, CRMAuditLog,
    FollowupNotification
)

logger = logging.getLogger(__name__)


# =============================================================================
# Helper Utilities & RBAC Permission Helpers
# =============================================================================

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


def _safe_iso_date(val):
    if not val:
        return None
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)[:10]


def _is_crm_superadmin(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').strip().lower().replace(' ', '').replace('_', '')
    return role in ['superadmin', 'techadmin'] or getattr(user, 'is_superuser', False)


def _check_crm_access_permission(user):
    """
    CRM module staff access verification:
    1. Authenticated user required.
    2. SuperAdmin / TechAdmin always have full access.
    3. Inactive staff accounts ('Inactive') are blocked from CRM modules.
    4. NOTE: Login Approval feature is currently suspended per business requirement;
       normal CRM users are NOT blocked due to pending approval.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False, 'Authentication required.'
    if _is_crm_superadmin(user):
        return True, None
    profile = getattr(user, 'crm_profile', None)
    if profile:
        status_val = (getattr(profile, 'account_status', '') or 'Active').strip().lower()
        if status_val == 'inactive':
            return False, 'Your CRM staff account is inactive.'
        # Temporarily suspended per business requirement: Login Approval not required in current release
        # if getattr(profile, 'approval_required', False) and not getattr(profile, 'is_crm_approved', False):
        #     return False, 'CRM module access is pending administrative approval.'
    return True, None


def _is_crm_admin(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    allowed, _ = _check_crm_access_permission(user)
    if not allowed:
        return False
    role = (getattr(user, 'role', '') or '').strip().lower().replace(' ', '').replace('_', '')
    return role in ['superadmin', 'techadmin', 'admin'] or getattr(user, 'is_superuser', False)


def _has_crm_permission(user, module, action):
    """
    Checks effective CRM permissions:
    1. SuperAdmin / TechAdmin / superuser: always True.
    2. User-specific permission override (CRMUserPermissionOverride): highest priority if exists.
    3. Role-based permission (CRMRolePermission): checked if no user override.
    4. Fallback based on default role access.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    allowed, _ = _check_crm_access_permission(user)
    if not allowed:
        return False
    if _is_crm_superadmin(user):
        return True

    # Check user override
    user_override = CRMUserPermissionOverride.objects.filter(user=user, module=module, action=action).first()
    if user_override is not None:
        return user_override.allow

    # Check role permission
    role_name = (getattr(user, 'role', '') or '').strip()
    role_perm = CRMRolePermission.objects.filter(role__iexact=role_name, module=module, action=action).first()
    if role_perm is not None:
        return role_perm.allow

    # Default fallback
    if _is_crm_admin(user):
        return True
    # Staff can view assigned work, quick search, and my work
    if module in ['my_work', 'quick_search', 'dashboard']:
        return action in ['view', 'edit', 'create']
    if module == 'leads':
        return action in ['view', 'edit']
    if module == 'segments':
        return action == 'view'
    return False


def _log_crm_audit(user, action, target_model='', target_id='', details=None, ip=''):
    try:
        CRMAuditLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            action=action,
            target_model=target_model,
            target_id=str(target_id),
            details=details or {},
            ip_address=ip or ''
        )
    except Exception as e:
        logger.warning("Failed to create audit log: %s", e)


def _get_or_create_crm_profile(user):
    """
    Retrieves or initializes a CRMUserProfile for a user without modifying the base User model.
    """
    profile, _ = CRMUserProfile.objects.get_or_create(
        user=user,
        defaults={
            'mobile': '',
            'approval_required': False,
            'is_crm_approved': True,
            'account_status': 'Active',
            'first_login_change_required': False,
        }
    )
    return profile





# =============================================================================
# PART 3: User & Role Management APIs
# =============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_users_api(request):
    """
    GET: List staff/users with reporting manager, approval status, search & filters.
    POST: Create a new staff member with full details, role, reporting manager, approval setting.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        if not _has_crm_permission(request.user, 'users', 'view') and not _is_crm_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        qs = User.objects.select_related('crm_profile', 'crm_profile__reporting_manager', 'created_by').all().order_by('-id')

        # Filters
        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(role__icontains=search) |
                Q(crm_profile__mobile__icontains=search)
            )

        role_filter = request.GET.get('role', '').strip()
        if role_filter:
            qs = qs.filter(role__iexact=role_filter)

        status_filter = request.GET.get('status', '').strip()
        if status_filter:
            if status_filter.lower() == 'active':
                qs = qs.exclude(crm_profile__account_status__iexact='Inactive')
            elif status_filter.lower() == 'inactive':
                qs = qs.filter(crm_profile__account_status__iexact='Inactive')
            else:
                qs = qs.filter(crm_profile__account_status__iexact=status_filter)

        users_data = []
        for u in qs:
            prof = getattr(u, 'crm_profile', None)
            mgr = prof.reporting_manager if prof else None
            users_data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
                'mobile': prof.mobile if prof else '',
                'role': u.role,
                'reporting_manager_id': mgr.id if mgr else None,
                'reporting_manager_name': f"{mgr.first_name} {mgr.last_name}".strip() or mgr.username if mgr else '',
                'approval_required': prof.approval_required if prof else False,
                'is_crm_approved': prof.is_crm_approved if prof else True,
                'account_status': (prof.account_status if prof else 'Active') or 'Active',
                'created_at': u.created_at.isoformat() if u.created_at else None,
            })

        # Also return available roles and managers for dropdowns
        roles = list(Role.objects.values_list('role', flat=True).distinct())
        if not roles:
            roles = ['Super Admin', 'Admin', 'Sales Manager', 'Team Leader', 'Sales Executive', 'Telecaller', 'Read-only User']

        managers = [
            {'id': u['id'], 'name': u['full_name']}
            for u in users_data
            if u['account_status'].lower() == 'active'
        ]

        return Response({
            'users': users_data,
            'total': len(users_data),
            'available_roles': roles,
            'available_managers': managers,
            'can_manage': _is_crm_admin(request.user),
        })

    # POST: Create User
    if not _has_crm_permission(request.user, 'users', 'create') and not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    role = (data.get('role') or 'Sales Executive').strip()
    mobile = (data.get('mobile') or '').strip()
    mgr_id = data.get('reporting_manager_id')
    approval_req = bool(data.get('approval_required', False))
    account_status_val = (data.get('account_status') or 'Active').strip()

    if not username:
        return Response({'error': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    reporting_manager = None
    if mgr_id:
        try:
            reporting_manager = User.objects.get(id=int(mgr_id))
        except (User.DoesNotExist, ValueError):
            pass

    with transaction.atomic():
        user = User(
            username=username,
            first_name=first_name,
            last_name=last_name,
            role=role,
            created_by=request.user,
        )
        user.set_password(password)
        user.save()

        # Isolate CRM staff attributes in separate CRMUserProfile
        profile = _get_or_create_crm_profile(user)
        profile.mobile = mobile
        profile.reporting_manager = reporting_manager
        profile.approval_required = approval_req
        profile.is_crm_approved = not approval_req
        profile.account_status = account_status_val
        profile.save()

    _log_crm_audit(request.user, 'USER_CREATED', 'User', user.id, {'username': username, 'role': role})

    return Response({
        'message': 'User created successfully.',
        'user': {
            'id': user.id,
            'username': user.username,
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'role': user.role,
            'account_status': profile.account_status,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_user_detail_api(request, user_id):
    """
    GET, PUT, PATCH, DELETE for a specific staff member.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        user = User.objects.select_related('crm_profile', 'crm_profile__reporting_manager').get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    prof = getattr(user, 'crm_profile', None)
    mgr = prof.reporting_manager if prof else None

    if request.method == 'GET':
        is_self = (request.user.id == user.id)
        is_admin = _is_crm_admin(request.user)
        has_view_perm = _has_crm_permission(request.user, 'users', 'view')
        if not (is_self or is_admin or has_view_perm):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'mobile': prof.mobile if prof else '',
            'role': user.role,
            'reporting_manager_id': mgr.id if mgr else None,
            'reporting_manager_name': f"{mgr.first_name} {mgr.last_name}".strip() or mgr.username if mgr else '',
            'approval_required': prof.approval_required if prof else False,
            'is_crm_approved': prof.is_crm_approved if prof else True,
            'account_status': prof.account_status if prof else 'Active',
        })

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'users', 'edit'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        # Soft deactivate CRM staff account
        profile = _get_or_create_crm_profile(user)
        profile.account_status = 'Inactive'
        profile.save()
        _log_crm_audit(request.user, 'USER_DEACTIVATED', 'User', user.id, {'username': user.username})
        return Response({'message': 'User marked as inactive successfully.'})

    data = request.data
    profile = _get_or_create_crm_profile(user)

    if 'first_name' in data:
        user.first_name = (data.get('first_name') or '').strip()
    if 'last_name' in data:
        user.last_name = (data.get('last_name') or '').strip()
    if 'role' in data:
        user.role = (data.get('role') or user.role).strip()
    user.save()

    if 'mobile' in data:
        profile.mobile = (data.get('mobile') or '').strip()
    if 'account_status' in data:
        profile.account_status = (data.get('account_status') or profile.account_status).strip()
    if 'approval_required' in data:
        profile.approval_required = bool(data.get('approval_required'))
    if 'reporting_manager_id' in data:
        mgr_val = data.get('reporting_manager_id')
        if mgr_val:
            try:
                profile.reporting_manager = User.objects.get(id=int(mgr_val))
            except (User.DoesNotExist, ValueError):
                profile.reporting_manager = None
        else:
            profile.reporting_manager = None
    profile.save()

    if 'password' in data and data.get('password'):
        user.set_password(str(data.get('password')).strip())
        user.save()

    _log_crm_audit(request.user, 'USER_UPDATED', 'User', user.id, {'username': user.username})

    return Response({'message': 'User updated successfully.'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_roles_api(request):
    """
    CRUD for Custom Roles and permissions matrix.
    """
    if request.method == 'GET':
        roles = list(Role.objects.values('id', 'role').order_by('role'))
        # If railway Role table is empty, provide default CRM roles
        if not roles:
            default_roles = ['Super Admin', 'Admin', 'Sales Manager', 'Team Leader', 'Sales Executive', 'Telecaller', 'Read-only User']
            roles = [{'id': i + 1, 'role': r} for i, r in enumerate(default_roles)]

        # Fetch permissions matrix
        perms_qs = CRMRolePermission.objects.all()
        perm_map = defaultdict(lambda: defaultdict(bool))
        for p in perms_qs:
            perm_map[p.role][f"{p.module}.{p.action}"] = p.allow

        return Response({
            'roles': roles,
            'permissions_matrix': perm_map,
            'modules': [m[0] for m in CRMRolePermission.MODULE_CHOICES],
            'actions': [a[0] for a in CRMRolePermission.ACTION_CHOICES],
        })

    if not _is_crm_superadmin(request.user):
        return Response({'error': 'Only Super Admin can manage roles.'}, status=status.HTTP_403_FORBIDDEN)

    role_name = (request.data.get('role') or '').strip()
    if not role_name:
        return Response({'error': 'Role name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if Role.objects.filter(role__iexact=role_name).exists():
        return Response({'error': 'Role already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    role_obj = Role.objects.create(role=role_name)
    _log_crm_audit(request.user, 'ROLE_CREATED', 'Role', role_obj.id, {'role': role_name})
    return Response({'message': 'Role created successfully.', 'id': role_obj.id, 'role': role_obj.role}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_permissions_save_api(request):
    """
    Save module & action permissions for a role or user override.
    """
    if not _is_crm_superadmin(request.user):
        return Response({'error': 'Only Super Admin can configure permissions.'}, status=status.HTTP_403_FORBIDDEN)

    target_type = request.data.get('target_type', 'role')  # 'role' or 'user'
    target_id = request.data.get('target_id')
    permissions = request.data.get('permissions', {})  # {'leads.view': True, 'leads.delete': False, ...}

    if not target_id:
        return Response({'error': 'target_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        if target_type == 'role':
            role_name = str(target_id).strip()
            for key, allow in permissions.items():
                if '.' in key:
                    mod, act = key.split('.', 1)
                    CRMRolePermission.objects.update_or_create(
                        role=role_name,
                        module=mod,
                        action=act,
                        defaults={'allow': bool(allow)}
                    )
        else:
            user = User.objects.get(id=int(target_id))
            for key, allow in permissions.items():
                if '.' in key:
                    mod, act = key.split('.', 1)
                    CRMUserPermissionOverride.objects.update_or_create(
                        user=user,
                        module=mod,
                        action=act,
                        defaults={'allow': bool(allow)}
                    )

    return Response({'message': 'Permissions updated successfully.'})


# =============================================================================
# PART 4: Login Approval & Access Logs APIs
# =============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_access_requests_api(request):
    """
    Tabs: Pending Requests, Approved Requests, Rejected Requests, Expired Requests, Complete History.
    Super Admin can view, approve, reject requests and review previous logs.
    Non-admin staff can submit an access request (POST) and view their own request status (GET).
    """
    if request.method == 'POST':
        notes = (request.data.get('notes') or '').strip()
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ',' in ip_addr:
            ip_addr = ip_addr.split(',')[0].strip()
        device_info = request.META.get('HTTP_USER_AGENT', '')

        # Check if user already has an active pending request
        pending_req = CRMAccessRequest.objects.filter(user=request.user, status='Pending').first()
        if pending_req:
            return Response({
                'message': 'You already have a pending access request.',
                'request_id': pending_req.id,
                'status': 'Pending'
            }, status=status.HTTP_200_OK)

        req_obj = CRMAccessRequest.objects.create(
            user=request.user,
            ip_address=ip_addr,
            device_info=device_info,
            status='Pending',
            notes=notes
        )
        return Response({
            'message': 'Access request submitted successfully.',
            'request_id': req_obj.id,
            'status': 'Pending'
        }, status=status.HTTP_201_CREATED)

    status_tab = request.GET.get('tab', 'Pending').strip()
    search = request.GET.get('search', '').strip()
    is_admin = _is_crm_admin(request.user)

    if is_admin:
        qs = CRMAccessRequest.objects.select_related('user', 'decided_by').all().order_by('-request_datetime')
    else:
        qs = CRMAccessRequest.objects.select_related('user', 'decided_by').filter(user=request.user).order_by('-request_datetime')

    if status_tab.lower() != 'all' and status_tab != 'Complete History':
        qs = qs.filter(status__iexact=status_tab)

    if search:
        qs = qs.filter(
            Q(user__username__icontains=search) |
            Q(user__first_name__icontains=search) |
            Q(user__last_name__icontains=search) |
            Q(ip_address__icontains=search)
        )

    results = []
    for r in qs:
        decided_by_name = ''
        if r.decided_by:
            decided_by_name = f"{r.decided_by.first_name} {r.decided_by.last_name}".strip() or r.decided_by.username

        results.append({
            'id': r.id,
            'user_id': r.user_id,
            'staff_name': f"{r.user.first_name} {r.user.last_name}".strip() or r.user.username,
            'username': r.user.username,
            'request_datetime': r.request_datetime.isoformat() if r.request_datetime else None,
            'ip_address': r.ip_address,
            'device_info': r.device_info,
            'status': r.status,
            'decided_by': decided_by_name,
            'decision_datetime': r.decision_datetime.isoformat() if r.decision_datetime else None,
            'notes': r.notes,
        })

    # Summary counts for tabs (scoped if non-admin)
    base_counts_qs = CRMAccessRequest.objects.all() if is_admin else CRMAccessRequest.objects.filter(user=request.user)
    counts = {
        'pending': base_counts_qs.filter(status='Pending').count(),
        'approved': base_counts_qs.filter(status='Approved').count(),
        'rejected': base_counts_qs.filter(status='Rejected').count(),
        'expired': base_counts_qs.filter(status='Expired').count(),
        'all': base_counts_qs.count(),
    }

    return Response({
        'requests': results,
        'counts': counts,
        'can_approve': _is_crm_superadmin(request.user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_access_request_decision_api(request, request_id):
    """
    Super Admin decision: Approve or Reject a staff access request.
    """
    if not _is_crm_superadmin(request.user):
        return Response({'error': 'Only Super Admin can approve/reject access requests.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        req_obj = CRMAccessRequest.objects.select_related('user').get(id=request_id)
    except CRMAccessRequest.DoesNotExist:
        return Response({'error': 'Access request not found.'}, status=status.HTTP_404_NOT_FOUND)

    decision = (request.data.get('decision') or '').strip().capitalize()  # 'Approved' or 'Rejected'
    notes = (request.data.get('notes') or '').strip()

    if decision not in ['Approved', 'Rejected', 'Expired']:
        return Response({'error': 'Invalid decision.'}, status=status.HTTP_400_BAD_REQUEST)

    req_obj.status = decision
    req_obj.decided_by = request.user
    req_obj.decision_datetime = timezone.now()
    req_obj.notes = notes
    req_obj.save()

    # Update CRM staff approval flag on CRMUserProfile
    user = req_obj.user
    prof = _get_or_create_crm_profile(user)
    prof.is_crm_approved = (decision == 'Approved')
    prof.save()

    # Record log
    CRMAccessLog.objects.create(
        user=user,
        event_type=f"ACCESS_{decision.upper()}",
        ip_address=req_obj.ip_address,
        device_info=req_obj.device_info,
        actor=request.user,
        details={'decision': decision, 'notes': notes}
    )

    _log_crm_audit(request.user, f'ACCESS_REQUEST_{decision.upper()}', 'CRMAccessRequest', req_obj.id, {'user': user.username})

    return Response({
        'message': f'Access request {decision.lower()} successfully.',
        'status': req_obj.status,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_access_logs_api(request):
    """
    Complete Access History log.
    Restricted to CRM administrators.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)
    if not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied. Only administrators can view access logs.'}, status=status.HTTP_403_FORBIDDEN)

    search = request.GET.get('search', '').strip()
    qs = CRMAccessLog.objects.select_related('user', 'actor').all().order_by('-timestamp')

    if search:
        qs = qs.filter(
            Q(user__username__icontains=search) |
            Q(user__first_name__icontains=search) |
            Q(ip_address__icontains=search) |
            Q(event_type__icontains=search)
        )

    logs = []
    for l in qs[:200]:
        actor_name = f"{l.actor.first_name} {l.actor.last_name}".strip() or l.actor.username if l.actor else 'System'
        logs.append({
            'id': l.id,
            'username': l.user.username,
            'staff_name': f"{l.user.first_name} {l.user.last_name}".strip() or l.user.username,
            'event_type': l.event_type,
            'ip_address': l.ip_address,
            'device_info': l.device_info,
            'actor': actor_name,
            'timestamp': l.timestamp.isoformat() if l.timestamp else None,
            'details': l.details,
        })

    return Response({'logs': logs, 'total': len(logs)})


# =============================================================================
# PART 5: Segment Management with Safe Deletion & Migration
# =============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_segments_api(request):
    """
    GET: List segments with actual lead counts, search, active status, creation date.
    POST: Create a new segment with duplicate active validation (Dhruvi rule).
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        search = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '').strip()

        qs = Segment.objects.all().order_by('-is_active', 'name')

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
        if status_filter:
            is_active_val = status_filter.lower() in ['true', '1', 'active']
            qs = qs.filter(is_active=is_active_val)

        # Count leads associated with each segment
        lead_counts = dict(
            Lead.objects.exclude(segment='')
            .values('segment')
            .annotate(cnt=Count('id'))
            .values_list('segment', 'cnt')
        )

        results = []
        for s in qs:
            # Match case-insensitively
            cnt = 0
            for seg_name, c in lead_counts.items():
                if seg_name and seg_name.strip().lower() == s.name.strip().lower():
                    cnt += c

            results.append({
                'id': s.id,
                'name': s.name,
                'description': s.description or '',
                'is_active': s.is_active,
                'total_leads': cnt,
                'created_at': s.created_at.isoformat() if s.created_at else None,
                'updated_at': s.updated_at.isoformat() if s.updated_at else None,
            })

        return Response({
            'segments': results,
            'total': len(results),
            'can_manage': _is_crm_admin(request.user),
        })

    # POST: Create Segment
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'segments', 'create'):
        return Response({'error': 'Permission denied. Only authorized staff can create segments.'}, status=status.HTTP_403_FORBIDDEN)

    name = (request.data.get('name') or '').strip()
    description = (request.data.get('description') or '').strip()
    is_active_val = request.data.get('is_active', True)
    if isinstance(is_active_val, str):
        is_active = is_active_val.lower() in ['true', '1', 'active']
    else:
        is_active = bool(is_active_val)

    if not name:
        return Response({'error': 'Segment name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        existing = Segment.objects.select_for_update().filter(name__iexact=name)
        if existing.filter(is_active=True).exists():
            return Response({'error': f'Active segment named "{name}" already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        segment = Segment.objects.create(
            name=name,
            description=description,
            is_active=is_active,
            created_by=request.user,
            updated_by=request.user
        )

    _log_crm_audit(request.user, 'SEGMENT_CREATED', 'Segment', segment.id, {'name': name})

    return Response({
        'message': 'Segment created successfully.',
        'segment': {
            'id': segment.id,
            'name': segment.name,
            'description': segment.description,
            'is_active': segment.is_active,
            'total_leads': 0,
            'created_at': segment.created_at.isoformat() if segment.created_at else None,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_segment_safe_delete_api(request, segment_id):
    """
    IMPORTANT SEGMENT DELETION REQUIREMENT:
    When Super Admin deletes a segment:
    Prompt: "What would you like to do with the associated leads?"
    Option 1: Move all leads to another existing segment.
    Option 2: Keep all leads without any segment (Unassigned).
    LEAD RECORDS MUST NEVER BE DELETED BECAUSE OF SEGMENT DELETION.
    """
    if not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied. Only Admin / Super Admin can delete segments.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        segment = Segment.objects.get(id=segment_id)
    except Segment.DoesNotExist:
        return Response({'error': 'Segment not found.'}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get('action', 'UNASSIGNED').strip().upper()  # 'MOVED' or 'UNASSIGNED'
    target_segment_id = request.data.get('target_segment_id')

    target_segment = None
    target_name = ''
    if action == 'MOVED':
        if not target_segment_id:
            return Response({'error': 'Target segment is required when moving leads.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_segment = Segment.objects.get(id=int(target_segment_id))
            target_name = target_segment.name
        except (Segment.DoesNotExist, ValueError):
            return Response({'error': 'Target segment does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        old_name = segment.name
        matching_leads = Lead.objects.filter(segment__iexact=old_name)
        affected_count = matching_leads.count()

        if action == 'MOVED':
            matching_leads.update(segment=target_name)
        else:
            matching_leads.update(segment='Unassigned')

        # Log migration
        SegmentMigrationLog.objects.create(
            old_segment_name=old_name,
            target_segment=target_segment,
            action=action,
            leads_affected=affected_count,
            migrated_by=request.user,
            notes=f"Deleted segment '{old_name}' and {action} {affected_count} leads."
        )

        _log_crm_audit(
            request.user,
            'SEGMENT_DELETED',
            'Segment',
            segment.id,
            {'segment_name': old_name, 'action': action, 'leads_affected': affected_count}
        )

        segment.delete()

    return Response({
        'message': f"Segment '{old_name}' deleted safely. {affected_count} leads were {action.lower()}.",
        'leads_affected': affected_count,
    })


# =============================================================================
# PART 8: Lead Assignment Module
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_lead_assignments_list_api(request):
    """
    List active lead assignments with staff badges, filters, and assignment history.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    search = request.GET.get('search', '').strip()
    segment_filter = request.GET.get('segment', '').strip()
    staff_filter = request.GET.get('staff_id', '').strip()

    qs = Lead.objects.all().prefetch_related('assignments__user').order_by('-id')

    if search:
        qs = qs.filter(
            Q(company_name__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(phone__icontains=search) |
            Q(mobile__icontains=search)
        )
    if segment_filter:
        qs = qs.filter(segment__iexact=segment_filter)
    if staff_filter:
        try:
            staff_id_val = int(staff_filter)
            qs = qs.filter(Q(assignments__user_id=staff_id_val) | Q(assigned_to_id=staff_id_val)).distinct()
        except ValueError:
            pass

    # Pagination
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 25))
    paginator = Paginator(qs, page_size)
    try:
        page_obj = paginator.page(page)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)

    leads_data = []
    for lead in page_obj:
        assignees = [
            {
                'id': a.user.id,
                'username': a.user.username,
                'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username,
                'assigned_at': a.assigned_at.isoformat() if a.assigned_at else None,
            }
            for a in lead.assignments.all()
        ]
        if lead.assigned_to and not any(a['id'] == lead.assigned_to.id for a in assignees):
            assignees.append({
                'id': lead.assigned_to.id,
                'username': lead.assigned_to.username,
                'name': f"{lead.assigned_to.first_name} {lead.assigned_to.last_name}".strip() or lead.assigned_to.username,
                'assigned_at': None,
            })
        leads_data.append({
            'id': lead.id,
            'company_name': lead.company_name,
            'contact_person': f"{lead.first_name} {lead.last_name}".strip() or 'N/A',
            'contact_number': lead.mobile or lead.phone or '',
            'segment': lead.segment or 'Unassigned',
            'assigned_staff': assignees,
            'assigned_count': len(assignees),
            'created_at': lead.created_at.isoformat() if lead.created_at else None,
        })

    # Available staff for assignment dropdown
    staff_list = [
        {'id': u.id, 'name': f"{u.first_name} {u.last_name}".strip() or u.username, 'role': u.role}
        for u in User.objects.exclude(crm_profile__account_status__iexact='Inactive').order_by('first_name')
    ]

    return Response({
        'leads': leads_data,
        'total': paginator.count,
        'page': page,
        'num_pages': paginator.num_pages,
        'staff_list': staff_list,
        'can_assign': _is_crm_admin(request.user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_assign_execute_api(request):
    """
    Assigns individual or bulk-selected leads to multiple staff.
    Supports:
    1. One Lead -> One Staff
    2. Multiple Leads -> One Staff
    3. One Lead -> Multiple Staff
    4. Multiple Leads -> Multiple Staff
    Creates separate assignment records for every staff member.
    Prevents duplicate active assignments.
    Logs history in LeadAssignmentHistory.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'assignments', 'assign'):
        return Response({'error': 'Permission denied. Only authorized staff can assign leads.'}, status=status.HTTP_403_FORBIDDEN)

    raw_leads = request.data.get('lead_ids') or request.data.get('lead_id') or []
    lead_ids = [raw_leads] if isinstance(raw_leads, (int, str)) else list(raw_leads)

    raw_staff = request.data.get('staff_ids') or request.data.get('user_ids') or request.data.get('staff_id') or request.data.get('user_id') or []
    staff_ids = [raw_staff] if isinstance(raw_staff, (int, str)) else list(raw_staff)

    if not lead_ids or not staff_ids:
        return Response({'error': 'Both lead_ids and staff_ids are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        leads = list(Lead.objects.filter(id__in=[int(i) for i in lead_ids]))
        staff_users = list(User.objects.filter(id__in=[int(i) for i in staff_ids]))
    except (ValueError, TypeError):
        return Response({'error': 'Invalid IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

    if not leads or not staff_users:
        return Response({'error': 'No matching leads or staff found.'}, status=status.HTTP_404_NOT_FOUND)

    assignments_created = 0
    with transaction.atomic():
        for lead in leads:
            for staff in staff_users:
                # Prevent duplicate active assignment
                assignment, created = LeadAssignment.objects.get_or_create(
                    lead=lead,
                    user=staff,
                    defaults={'assigned_by': request.user, 'assigned_at': timezone.now()}
                )
                if created:
                    assignments_created += 1
                    # Record history
                    LeadAssignmentHistory.objects.create(
                        lead=lead,
                        assigned_to=staff,
                        assigned_by=request.user,
                        assigned_at=timezone.now(),
                        notes=f"Assigned to {staff.username} by {request.user.username}"
                    )

            # Update legacy assigned_to if single staff assigned
            if len(staff_users) == 1 and not lead.assigned_to:
                lead.assigned_to = staff_users[0]
                lead.save(update_fields=['assigned_to'])

    _log_crm_audit(
        request.user,
        'LEADS_ASSIGNED',
        'LeadAssignment',
        f"{len(leads)} leads",
        {'leads_count': len(leads), 'staff_count': len(staff_users), 'assignments_created': assignments_created}
    )

    return Response({
        'message': f"Successfully assigned {len(leads)} lead(s) to {len(staff_users)} staff member(s).",
        'assignments_created': assignments_created,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_unassign_execute_api(request):
    """
    Unassign specific staff member from a lead.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    raw_leads = request.data.get('lead_ids') or request.data.get('lead_id') or []
    lead_ids = [raw_leads] if isinstance(raw_leads, (int, str)) else list(raw_leads)

    raw_users = request.data.get('user_ids') or request.data.get('staff_ids') or request.data.get('user_id') or request.data.get('staff_id') or []
    user_ids = [raw_users] if isinstance(raw_users, (int, str)) else list(raw_users)

    try:
        LeadAssignment.objects.filter(lead_id__in=[int(i) for i in lead_ids], user_id__in=[int(u) for u in user_ids]).delete()
        for lid in lead_ids:
            lead = Lead.objects.filter(id=int(lid)).first()
            if lead and lead.assigned_to_id in [int(u) for u in user_ids]:
                lead.assigned_to = None
                lead.save(update_fields=['assigned_to'])
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'Lead(s) unassigned from user(s) successfully.'})


# =============================================================================
# PART 9 & 10: Task Management & Independent My Work Dashboard
# =============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_task_groups_api(request):
    """
    GET: List task groups with progress, assignees, lead counts, priority.
    POST: Create task group. If leads are associated, generate N x M independent
          LeadTaskActivity records for each staff member!
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        qs = CRMTaskGroup.objects.prefetch_related('assignees__user', 'associated_leads', 'lead_activities').all()
        if not _is_crm_admin(request.user):
            qs = qs.filter(Q(assignees__user=request.user) | Q(created_by=request.user)).distinct()

        search = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '').strip()
        priority_filter = request.GET.get('priority', '').strip()

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)
        else:
            qs = qs.exclude(status='Archived')
        if priority_filter:
            qs = qs.filter(priority__iexact=priority_filter)

        is_admin = _is_crm_admin(request.user)
        results = []
        for tg in qs:
            assignees = [
                {'id': a.user.id, 'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username}
                for a in tg.assignees.all()
            ]
            staff_ids = [a['id'] for a in assignees]
            associated_lead_ids = list(tg.associated_leads.values_list('lead_id', flat=True))
            lead_count = len(associated_lead_ids)
            total_activities = tg.lead_activities.count()
            completed_activities = tg.lead_activities.filter(status='Completed').count()
            progress = round((completed_activities / total_activities * 100), 1) if total_activities > 0 else 0

            can_manage = is_admin or (tg.created_by_id == request.user.id)
            results.append({
                'id': tg.id,
                'title': tg.title,
                'description': tg.description,
                'attachment': tg.attachment,
                'start_date': _safe_iso_date(tg.start_date),
                'start_time': str(tg.start_time) if tg.start_time else None,
                'end_date': _safe_iso_date(tg.end_date),
                'end_time': str(tg.end_time) if tg.end_time else None,
                'priority': tg.priority,
                'status': tg.status,
                'assignees': assignees,
                'staff_ids': staff_ids,
                'lead_ids': associated_lead_ids,
                'lead_count': lead_count,
                'total_activities': total_activities,
                'completed_activities': completed_activities,
                'progress_percentage': progress,
                'created_at': tg.created_at.isoformat() if tg.created_at else None,
                'created_by_id': tg.created_by_id,
                'can_edit': can_manage,
                'can_delete': can_manage,
            })

        return Response({'task_groups': results, 'total': len(results)})

    # POST: Create Task Group
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'tasks', 'create'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    priority = (data.get('priority') or 'Normal').strip()
    start_date = data.get('start_date') or timezone.now().date().isoformat()
    end_date = data.get('end_date') or timezone.now().date().isoformat()
    start_time = data.get('start_time') or None
    end_time = data.get('end_time') or None
    raw_staff = data.get('staff_ids') or data.get('user_ids') or data.get('staff_id') or data.get('user_id') or []
    staff_ids = [raw_staff] if isinstance(raw_staff, (int, str)) else list(raw_staff)

    raw_leads = data.get('lead_ids') or data.get('lead_id') or []
    lead_ids = [raw_leads] if isinstance(raw_leads, (int, str)) else list(raw_leads)

    attachment = data.get('attachment', '')

    if not title:
        return Response({'error': 'Task Title is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not staff_ids:
        return Response({'error': 'At least one staff member must be assigned.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        task_group = CRMTaskGroup.objects.create(
            title=title,
            description=description,
            attachment=attachment,
            priority=priority,
            start_date=start_date,
            end_date=end_date,
            start_time=start_time,
            end_time=end_time,
            status='Active',
            created_by=request.user,
        )

        # Assign staff idempotently
        staff_users = User.objects.filter(id__in=[int(i) for i in staff_ids])
        for u in staff_users:
            CRMTaskAssignee.objects.get_or_create(task_group=task_group, user=u)

        # Associate leads & generate independent lead-wise activities
        if lead_ids:
            leads = Lead.objects.filter(id__in=[int(i) for i in lead_ids])
            for l in leads:
                CRMTaskLead.objects.get_or_create(task_group=task_group, lead=l)

            # IDEMPOTENT ACTIVITY GENERATION:
            # Query existing (lead, user) pairs for this task group so we only
            # create MISSING activities, never overwriting or duplicating existing ones.
            existing_activities = set(
                LeadTaskActivity.objects.filter(task_group=task_group).values_list('lead_id', 'user_id')
            )
            activities_to_create = []
            for u in staff_users:
                for l in leads:
                    if (l.id, u.id) not in existing_activities:
                        activities_to_create.append(
                            LeadTaskActivity(
                                task_group=task_group,
                                lead=l,
                                user=u,
                                status='Pending',
                                notes='',
                            )
                        )
            if activities_to_create:
                LeadTaskActivity.objects.bulk_create(activities_to_create, ignore_conflicts=True)

    _log_crm_audit(
        request.user,
        'TASK_GROUP_CREATED',
        'CRMTaskGroup',
        task_group.id,
        {'title': title, 'staff_count': len(staff_ids), 'leads_count': len(lead_ids)}
    )

    return Response({
        'message': f"Task group created successfully with {len(staff_ids)} staff and {len(lead_ids)} leads.",
        'task_group_id': task_group.id,
        'id': task_group.id,
        'task_group': {
            'id': task_group.id,
            'title': task_group.title,
            'priority': task_group.priority,
            'status': task_group.status,
            'start_date': _safe_iso_date(task_group.start_date),
            'end_date': _safe_iso_date(task_group.end_date),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_my_work_api(request):
    """
    Dedicated My Work Dashboard for staff.
    Filters by date (Today, Yesterday, Tomorrow, Custom Date).
    Returns tasks and independent lead-wise activities assigned to the logged-in staff member.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    date_param = request.GET.get('date', 'today').strip().lower()
    today = timezone.now().date()

    if date_param == 'today':
        target_date = today
    elif date_param == 'yesterday':
        target_date = today - timedelta(days=1)
    elif date_param == 'tomorrow':
        target_date = today + timedelta(days=1)
    else:
        try:
            target_date = datetime.strptime(date_param[:10], '%Y-%m-%d').date()
        except Exception:
            target_date = today

    # Fetch activities assigned to logged-in user (excluding archived task groups)
    user = request.user
    activities_qs = LeadTaskActivity.objects.select_related('task_group', 'lead').filter(
        user=user
    ).exclude(task_group__status='Archived')

    # Filter activities whose task group or follow-up date matches target date
    # Also include pending activities if target_date == today
    if target_date == today:
        activities_qs = activities_qs.filter(
            Q(task_group__start_date__lte=target_date, task_group__end_date__gte=target_date) |
            Q(next_followup_date=target_date) |
            Q(status='Pending')
        ).distinct()
    else:
        activities_qs = activities_qs.filter(
            Q(task_group__start_date__lte=target_date, task_group__end_date__gte=target_date) |
            Q(next_followup_date=target_date)
        ).distinct()

    # Search & status filter
    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()

    if search:
        activities_qs = activities_qs.filter(
            Q(lead__company_name__icontains=search) |
            Q(lead__first_name__icontains=search) |
            Q(lead__phone__icontains=search) |
            Q(task_group__title__icontains=search)
        )
    if status_filter:
        activities_qs = activities_qs.filter(status__iexact=status_filter)

    activities_data = []
    overdue_count = 0
    for act in activities_qs:
        lead = act.lead
        tg = act.task_group
        is_overdue = False
        if act.next_followup_date and act.next_followup_date < today and act.status != 'Completed':
            is_overdue = True
            overdue_count += 1

        activities_data.append({
            'activity_id': act.id,
            'task_group_id': tg.id,
            'task_title': tg.title,
            'priority': tg.priority,
            'lead_id': lead.id,
            'company_name': lead.company_name or 'N/A',
            'contact_person': f"{lead.first_name} {lead.last_name}".strip() or 'N/A',
            'mobile_number': lead.mobile or lead.phone or '',
            'segment': lead.segment or 'Unassigned',
            'activity_status': act.status,
            'notes': act.notes,
            'action_taken': act.action_taken,
            'next_followup_date': _safe_iso_date(act.next_followup_date),
            'next_followup_time': str(act.next_followup_time) if act.next_followup_time else None,
            'last_updated': act.last_updated_at.isoformat() if act.last_updated_at else None,
            'is_overdue': is_overdue,
        })

    # Summary counts
    total_assigned = activities_qs.count()
    completed_count = activities_qs.filter(status='Completed').count()
    pending_count = activities_qs.filter(status='Pending').count()

    return Response({
        'date': target_date.isoformat(),
        'activities': activities_data,
        'summary': {
            'total': total_assigned,
            'completed': completed_count,
            'pending': pending_count,
            'overdue': overdue_count,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_activity_update_api(request, activity_id):
    """
    Staff independently updates each lead activity:
    - Activity Status ('Pending', 'Completed', 'Rejected', 'No Answer', 'Callback Required', 'Not Interested', 'Follow-up Required')
    - Notes / Action Taken
    - Next Follow-up Date & Time
    - Attachment
    Maintains complete communication history.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        activity = LeadTaskActivity.objects.select_related('lead', 'task_group').get(id=activity_id)
    except LeadTaskActivity.DoesNotExist:
        return Response({'error': 'Activity not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Permission check: staff member owns this activity or is admin
    if activity.user_id != request.user.id and not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied. You can only update your own activities.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    new_status = (data.get('status') or activity.status).strip()
    notes = (data.get('notes') or '').strip()
    action_taken = (data.get('action_taken') or '').strip()
    next_followup_date = data.get('next_followup_date') or None
    next_followup_time = data.get('next_followup_time') or None
    attachment = data.get('attachment', '')

    with transaction.atomic():
        activity.status = new_status
        if notes:
            activity.notes = notes
        if action_taken:
            activity.action_taken = action_taken
        if next_followup_date is not None:
            activity.next_followup_date = next_followup_date or None
        if next_followup_time is not None:
            activity.next_followup_time = next_followup_time or None
        if attachment:
            activity.attachment = attachment
        activity.last_updated_at = timezone.now()
        activity.save()

        # Log to chronological Communication Timeline
        combined_notes = f"{action_taken} - {notes}".strip(' -') or f"Status updated to {new_status}"
        CRMCommunicationLog.objects.create(
            lead=activity.lead,
            user=request.user,
            task_group=activity.task_group,
            channel='Call' if 'call' in new_status.lower() else 'Note',
            notes=combined_notes,
            next_followup_date=activity.next_followup_date,
            next_followup_time=activity.next_followup_time,
        )

    _log_crm_audit(
        request.user,
        'ACTIVITY_UPDATED',
        'LeadTaskActivity',
        activity.id,
        {'status': new_status, 'lead_id': activity.lead_id}
    )

    return Response({
        'message': 'Activity updated successfully.',
        'activity_status': activity.status,
    })


# =============================================================================
# PART 11: Performance Reports Module
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_performance_reports_api(request):
    """
    Dedicated Performance Reports module for Super Admin and managers.
    Actual database calculations:
    Completion Percentage = Completed Activities / Total Assigned Activities * 100.
    Interactive charts data + detailed performance table.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'reports', 'view'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = LeadTaskActivity.objects.select_related('task_group', 'lead', 'user').all()

    # Filters
    task_group_id = request.GET.get('task_group_id')
    if task_group_id:
        qs = qs.filter(task_group_id=int(task_group_id))

    staff_id = request.GET.get('staff_id')
    if staff_id:
        qs = qs.filter(user_id=int(staff_id))

    segment_name = request.GET.get('segment')
    if segment_name:
        qs = qs.filter(lead__segment__iexact=segment_name)

    activity_status = request.GET.get('status')
    if activity_status:
        qs = qs.filter(status__iexact=activity_status)

    priority = request.GET.get('priority')
    if priority:
        qs = qs.filter(task_group__priority__iexact=priority)

    start_date = request.GET.get('start_date')
    if start_date:
        qs = qs.filter(task_group__start_date__gte=start_date)

    end_date = request.GET.get('end_date')
    if end_date:
        qs = qs.filter(task_group__end_date__lte=end_date)

    # Aggregations
    total = qs.count()
    completed = qs.filter(status='Completed').count()
    pending = qs.filter(status='Pending').count()
    rejected = qs.filter(status='Rejected').count()
    no_answer = qs.filter(status='No Answer').count()
    callback = qs.filter(status='Callback Required').count()
    not_interested = qs.filter(status='Not Interested').count()
    followup_req = qs.filter(status='Follow-up Required').count()

    today = timezone.now().date()
    overdue = qs.filter(next_followup_date__lt=today).exclude(status='Completed').count()

    completion_percentage = round((completed / total * 100), 1) if total > 0 else 0

    # Staff-wise breakdown for charts
    staff_breakdown = list(
        qs.values('user_id', 'user__username', 'user__first_name', 'user__last_name')
        .annotate(
            total=Count('id'),
            completed=Count(Case(When(status='Completed', then=1), output_field=IntegerField())),
            pending=Count(Case(When(status='Pending', then=1), output_field=IntegerField())),
            overdue=Count(Case(When(next_followup_date__lt=today, then=1), output_field=IntegerField()))
        )
        .order_by('-total')
    )

    staff_chart = [
        {
            'name': f"{s['user__first_name']} {s['user__last_name']}".strip() or s['user__username'],
            'total': s['total'],
            'completed': s['completed'],
            'pending': s['pending'],
            'overdue': s['overdue'],
        }
        for s in staff_breakdown
    ]

    # Status distribution for Pie chart
    status_distribution = [
        {'name': 'Completed', 'value': completed},
        {'name': 'Pending', 'value': pending},
        {'name': 'Rejected', 'value': rejected},
        {'name': 'No Answer', 'value': no_answer},
        {'name': 'Callback Required', 'value': callback},
        {'name': 'Not Interested', 'value': not_interested},
        {'name': 'Follow-up Required', 'value': followup_req},
    ]

    # Detailed Table rows (limit 100)
    table_rows = []
    for act in qs[:100]:
        staff_name = f"{act.user.first_name} {act.user.last_name}".strip() or act.user.username
        is_over = bool(act.next_followup_date and act.next_followup_date < today and act.status != 'Completed')
        table_rows.append({
            'staff_name': staff_name,
            'task_title': act.task_group.title,
            'company_name': act.lead.company_name or 'N/A',
            'contact_person': f"{act.lead.first_name} {act.lead.last_name}".strip() or 'N/A',
            'assigned_date': act.task_group.start_date.isoformat() if act.task_group.start_date else None,
            'current_status': act.status,
            'last_updated': act.last_updated_at.isoformat() if act.last_updated_at else None,
            'next_followup': act.next_followup_date.isoformat() if act.next_followup_date else None,
            'overdue_status': 'Overdue' if is_over else 'On Track',
        })

    return Response({
        'summary': {
            'total_assigned': total,
            'completed': completed,
            'pending': pending,
            'rejected': rejected,
            'overdue': overdue,
            'completion_percentage': completion_percentage,
        },
        'charts': {
            'status_distribution': status_distribution,
            'staff_performance': staff_chart,
        },
        'table_rows': table_rows,
        'total_rows': total,
    })


# =============================================================================
# PART 12: Quick Lead Search & 360° Communication Timeline
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_quick_search_api(request):
    """
    Persistent fast search accessible throughout the CRM interface:
    Searches by Company Name, Contact Person, Mobile, Alternate Mobile, Email.
    Returns matched snippets with last interaction details.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    q = request.GET.get('q', '').strip()
    if not q or len(q) < 2:
        return Response({'results': []})

    qs = Lead.objects.filter(
        Q(company_name__icontains=q) |
        Q(first_name__icontains=q) |
        Q(last_name__icontains=q) |
        Q(phone__icontains=q) |
        Q(mobile__icontains=q) |
        Q(secondary_phone__icontains=q) |
        Q(secondary_mobile__icontains=q) |
        Q(email__icontains=q)
    )

    if not _is_crm_admin(request.user):
        qs = qs.filter(Q(assignments__user=request.user) | Q(assigned_to=request.user)).distinct()

    qs = qs.order_by('-id')[:20]

    results = []
    for lead in qs:
        last_comm = lead.crm_communication_timeline.order_by('-created_at').first()
        last_interaction = None
        if last_comm:
            last_interaction = f"{last_comm.channel}: {last_comm.notes[:60]}... ({last_comm.created_at.strftime('%d/%m/%Y')})"

        results.append({
            'id': lead.id,
            'company_name': lead.company_name or 'N/A',
            'contact_person': f"{lead.first_name} {lead.last_name}".strip() or 'N/A',
            'mobile_number': lead.mobile or lead.phone or '',
            'alternate_mobile': getattr(lead, 'secondary_mobile', '') or '',
            'email': lead.email or '',
            'segment': lead.segment or 'Unassigned',
            'city': lead.city or '',
            'last_interaction': last_interaction or 'No previous interactions recorded.',
        })

    return Response({'results': results})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_lead_timeline_api(request, lead_id=None):
    """
    GET: Retrieve full 360° chronological communication timeline for a lead:
         Call notes, meeting notes, email notes, WhatsApp notes, task updates, follow-up history.
    POST: Add a new communication note, call discussion, or schedule next follow-up.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if lead_id is None:
        lead_id = (
            request.GET.get('lead_id')
            or request.GET.get('lead')
            or (request.data.get('lead_id') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
            or (request.data.get('lead') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
        )
    if not lead_id:
        return Response({'error': 'lead_id is required either in URL path or in query parameters/request body.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        lead = Lead.objects.prefetch_related('assignments__user').get(id=int(lead_id))
    except (Lead.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_admin = _is_crm_admin(request.user)
    is_assigned = lead.assignments.filter(user=request.user).exists() or (lead.assigned_to_id == request.user.id)
    if not is_admin and not is_assigned:
        return Response({'error': 'Permission denied. You are not assigned to this lead.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        logs_qs = lead.crm_communication_timeline.select_related('user', 'task_group').order_by('-created_at')

        timeline = []
        for log in logs_qs:
            staff_name = f"{log.user.first_name} {log.user.last_name}".strip() or log.user.username
            timeline.append({
                'id': log.id,
                'channel': log.channel,
                'notes': log.notes,
                'staff_name': staff_name,
                'next_followup_date': _safe_iso_date(log.next_followup_date),
                'next_followup_time': str(log.next_followup_time) if log.next_followup_time else None,
                'timestamp': log.created_at.isoformat() if log.created_at else None,
            })

        return Response({
            'lead': {
                'id': lead.id,
                'company_name': lead.company_name,
                'contact_person': f"{lead.first_name} {lead.last_name}".strip(),
                'designation': getattr(lead, 'designation', ''),
                'mobile': lead.mobile or lead.phone,
                'email': lead.email,
                'segment': lead.segment,
                'city': lead.city,
                'state': lead.state,
                'notes': lead.notes,
            },
            'timeline': timeline,
        })

    # POST: Add communication log
    channel = (request.data.get('channel') or 'Call').strip()
    notes = (request.data.get('notes') or '').strip()
    next_followup_date = request.data.get('next_followup_date') or None
    next_followup_time = request.data.get('next_followup_time') or None

    if not notes:
        return Response({'error': 'Discussion/notes are required.'}, status=status.HTTP_400_BAD_REQUEST)

    log_entry = CRMCommunicationLog.objects.create(
        lead=lead,
        user=request.user,
        channel=channel,
        notes=notes,
        next_followup_date=next_followup_date,
        next_followup_time=next_followup_time,
    )

    return Response({
        'message': 'Communication logged successfully.',
        'log_id': log_entry.id,
    }, status=status.HTTP_201_CREATED)


# =============================================================================
# PART 13: CRM Dashboard Summary API
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_dashboard_summary_api(request):
    """
    Returns actual database KPI numbers and feeds for CRM Dashboard:
    - Total Leads, Segments, Staff, Tasks, Completed Activities, Pending Activities,
      Overdue Follow-ups, Pending Access Requests.
    All values come from actual database records.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    # Ensure demonstration test records are present if not already seeded
    try:
        from .crm_seed import seed_crm_testing_data
        if not Lead.objects.filter(company_name__startswith='[TEST]').exists():
            seed_crm_testing_data()
    except Exception as e:
        logger.warning("CRM auto-seed check encountered an issue: %s", e)

    user = request.user
    is_admin = _is_crm_admin(user)
    today = timezone.now().date()

    if is_admin:
        total_leads = Lead.objects.count()
        total_segments = Segment.objects.count()
        total_staff = User.objects.count()
        active_staff = User.objects.exclude(crm_profile__account_status__iexact='Inactive').count()
        total_assigned_leads = Lead.objects.filter(
            Q(assignments__isnull=False) | Q(assigned_to__isnull=False)
        ).distinct().count()
        total_tasks = CRMTaskGroup.objects.exclude(status='Archived').count()
        completed_activities = LeadTaskActivity.objects.exclude(task_group__status='Archived').filter(status='Completed').count()
        pending_activities = LeadTaskActivity.objects.exclude(task_group__status='Archived').filter(status='Pending').count()
        pending_access_requests = CRMAccessRequest.objects.filter(status='Pending').count()
        overdue_followups = LeadTaskActivity.objects.exclude(task_group__status='Archived').filter(
            next_followup_date__lt=today
        ).exclude(status='Completed').count()

        # Recent activities feed
        recent_activities = []
        for a in LeadTaskActivity.objects.exclude(task_group__status='Archived').select_related('lead', 'user').order_by('-last_updated_at')[:8]:
            recent_activities.append({
                'id': a.id,
                'lead_name': a.lead.company_name or a.lead.first_name,
                'staff_name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username,
                'status': a.status,
                'updated_at': a.last_updated_at.isoformat() if a.last_updated_at else None,
            })

        # Segment distribution
        segment_dist = list(
            Segment.objects.filter(is_active=True).values('name').order_by('name')
        )
        lead_counts = dict(
            Lead.objects.exclude(segment='')
            .values('segment')
            .annotate(cnt=Count('id'))
            .values_list('segment', 'cnt')
        )
        segment_chart = [
            {'name': s['name'], 'value': lead_counts.get(s['name'], 0)}
            for s in segment_dist[:8]
        ]

        return Response({
            'is_admin': True,
            'kpis': {
                'total_leads': total_leads,
                'total_segments': total_segments,
                'total_staff': total_staff,
                'active_staff': active_staff,
                'total_assigned_leads': total_assigned_leads,
                'total_tasks': total_tasks,
                'completed_activities': completed_activities,
                'pending_activities': pending_activities,
                'pending_access_requests': pending_access_requests,
                'overdue_followups': overdue_followups,
            },
            'recent_activities': recent_activities,
            'segment_distribution': segment_chart,
        })
    else:
        # Staff scoped view
        my_assigned_leads = Lead.objects.filter(
            Q(assignments__user=user) | Q(assigned_to=user)
        ).distinct().count()
        my_activities = LeadTaskActivity.objects.exclude(task_group__status='Archived').filter(user=user)
        pending_act = my_activities.filter(status='Pending').count()
        completed_act = my_activities.filter(status='Completed').count()
        overdue_act = my_activities.filter(next_followup_date__lt=today).exclude(status='Completed').count()
        today_tasks = my_activities.filter(
            Q(task_group__start_date__lte=today, task_group__end_date__gte=today) |
            Q(next_followup_date=today)
        ).count()

        return Response({
            'is_admin': False,
            'kpis': {
                'my_assigned_leads': my_assigned_leads,
                'my_today_tasks': today_tasks,
                'pending_activities': pending_act,
                'completed_activities': completed_act,
                'overdue_followups': overdue_act,
            }
        })


# =============================================================================
# PART 6 & 7: Lead Management & Advanced 7-Step Dynamic Excel/CSV Importer
# =============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_leads_api(request):
    """
    GET: List leads with column filters, segment filter, assignment filter, date filter, sorting, pagination.
    POST: Create a lead with designation, mobile, alternate mobile, email, segment, source, notes, custom fields.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        if not _has_crm_permission(request.user, 'leads', 'view') and not _is_crm_admin(request.user):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Base queryset scoped by role
        if _is_crm_admin(request.user):
            qs = Lead.objects.all().prefetch_related('assignments__user').order_by('-id')
        else:
            qs = Lead.objects.filter(
                Q(assignments__user=request.user) | Q(assigned_to=request.user)
            ).distinct().prefetch_related('assignments__user').order_by('-id')

        # Global Search
        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(company_name__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(mobile__icontains=search) |
                Q(secondary_mobile__icontains=search) |
                Q(email__icontains=search) |
                Q(city__icontains=search) |
                Q(segment__icontains=search)
            )

        # Column Filters
        company_f = request.GET.get('company_name', '').strip()
        if company_f:
            qs = qs.filter(company_name__icontains=company_f)

        contact_f = request.GET.get('contact_person', '').strip()
        if contact_f:
            qs = qs.filter(Q(first_name__icontains=contact_f) | Q(last_name__icontains=contact_f))

        phone_f = request.GET.get('phone', '').strip()
        if phone_f:
            qs = qs.filter(Q(phone__icontains=phone_f) | Q(mobile__icontains=phone_f))

        email_f = request.GET.get('email', '').strip()
        if email_f:
            qs = qs.filter(email__icontains=email_f)

        segment_f = request.GET.get('segment', '').strip()
        if segment_f:
            if segment_f.lower() == 'unassigned':
                qs = qs.filter(Q(segment='') | Q(segment__isnull=True) | Q(segment__iexact='Unassigned'))
            else:
                qs = qs.filter(segment__iexact=segment_f)

        source_f = request.GET.get('lead_source', '').strip()
        if source_f:
            qs = qs.filter(lead_source__iexact=source_f)

        city_f = request.GET.get('city', '').strip()
        if city_f:
            qs = qs.filter(city__icontains=city_f)

        state_f = request.GET.get('state', '').strip()
        if state_f:
            qs = qs.filter(state__icontains=state_f)

        # Assignment Filter
        staff_f = request.GET.get('staff_id', '').strip()
        if staff_f:
            if staff_f.lower() == 'unassigned':
                qs = qs.filter(assignments__isnull=True, assigned_to__isnull=True)
            else:
                try:
                    qs = qs.filter(Q(assignments__user_id=int(staff_f)) | Q(assigned_to_id=int(staff_f))).distinct()
                except ValueError:
                    pass

        # Date Range Filter
        start_date = request.GET.get('start_date', '').strip()
        end_date = request.GET.get('end_date', '').strip()
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        # Pagination
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        leads_list = []
        for l in page_obj:
            assignees = [
                {'id': a.user.id, 'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username}
                for a in l.assignments.all()
            ]
            leads_list.append({
                'id': l.id,
                'company_name': l.company_name or 'N/A',
                'contact_person': f"{l.first_name} {l.last_name}".strip() or 'N/A',
                'first_name': l.first_name,
                'last_name': l.last_name,
                'designation': getattr(l, 'designation', ''),
                'mobile_number': l.mobile or l.phone or '',
                'phone': l.phone or '',
                'alternate_mobile': getattr(l, 'secondary_mobile', '') or '',
                'email': l.email or '',
                'secondary_email': l.secondary_email or '',
                'website': l.website or '',
                'address_line1': l.address_line1 or '',
                'address_line2': l.address_line2 or '',
                'city': l.city or '',
                'state': l.state or '',
                'country': l.country or '',
                'pincode': l.pincode or '',
                'segment': l.segment or 'Unassigned',
                'lead_source': getattr(l, 'lead_source', '') or 'Direct',
                'status': l.status,
                'notes': l.notes or '',
                'custom_fields': getattr(l, 'custom_fields', {}) or {},
                'assigned_staff': assignees,
                'created_at': l.created_at.isoformat() if l.created_at else None,
            })

        # Available segments & staff for dropdowns
        segments = list(Segment.objects.filter(is_active=True).values_list('name', flat=True).order_by('name'))
        staff_members = [
            {'id': u.id, 'name': f"{u.first_name} {u.last_name}".strip() or u.username}
            for u in User.objects.exclude(crm_profile__account_status__iexact='Inactive').order_by('first_name')
        ]

        return Response({
            'leads': leads_list,
            'total': paginator.count,
            'page': page,
            'num_pages': paginator.num_pages,
            'available_segments': segments,
            'available_staff': staff_members,
            'can_create': _is_crm_admin(request.user) or _has_crm_permission(request.user, 'leads', 'create'),
            'can_delete': _is_crm_admin(request.user) or _has_crm_permission(request.user, 'leads', 'delete'),
        })

    # POST: Create Lead
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'leads', 'create'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    company_name = (data.get('company_name') or '').strip()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    mobile = (data.get('mobile_number') or data.get('mobile') or data.get('phone') or '').strip()
    alt_mobile = (data.get('alternate_mobile') or data.get('secondary_mobile') or '').strip()
    email = (data.get('email') or '').strip()
    sec_email = (data.get('secondary_email') or '').strip()
    designation = (data.get('designation') or '').strip()
    segment = (data.get('segment') or 'Unassigned').strip()
    lead_source = (data.get('lead_source') or 'Direct').strip()
    city = (data.get('city') or '').strip()
    state = (data.get('state') or '').strip()
    country = (data.get('country') or 'India').strip()
    pincode = (data.get('pincode') or '').strip()
    address_line1 = (data.get('address_line1') or '').strip()
    website = (data.get('website') or '').strip()
    notes = (data.get('notes') or '').strip()
    custom_fields = data.get('custom_fields', {})

    if not company_name and not first_name:
        return Response({'error': 'Company Name or Contact Person is required.'}, status=status.HTTP_400_BAD_REQUEST)

    lead = Lead.objects.create(
        company_name=company_name,
        first_name=first_name,
        last_name=last_name,
        designation=designation,
        mobile=mobile,
        phone=mobile,
        secondary_mobile=alt_mobile,
        secondary_phone=alt_mobile,
        email=email,
        secondary_email=sec_email,
        segment=segment,
        lead_source=lead_source,
        city=city,
        state=state,
        country=country,
        pincode=pincode,
        address_line1=address_line1,
        website=website,
        notes=notes,
        custom_fields=custom_fields if isinstance(custom_fields, dict) else {},
        status=Lead.STATUS_LEAD,
        created_by=request.user,
    )

    # If segment exists as a Segment model record, map it in LeadSegmentMap
    seg_obj = Segment.objects.filter(name__iexact=segment).first()
    if seg_obj:
        LeadSegmentMap.objects.get_or_create(lead=lead, segment=seg_obj)

    # Initial communication note
    CRMCommunicationLog.objects.create(
        lead=lead,
        user=request.user,
        channel='Note',
        notes=f"Lead created by {request.user.username}. {notes}".strip()
    )

    _log_crm_audit(request.user, 'LEAD_CREATED', 'Lead', lead.id, {'company_name': company_name, 'contact': first_name})

    return Response({
        'message': 'Lead created successfully.',
        'lead_id': lead.id,
        'id': lead.id,
        'lead': {
            'id': lead.id,
            'company_name': lead.company_name,
            'contact_person': f"{lead.first_name} {lead.last_name}".strip(),
            'mobile': lead.mobile or lead.phone,
            'email': lead.email,
            'segment': lead.segment,
            'status': lead.status,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_lead_detail_api(request, lead_id):
    """
    CRUD on single lead.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        lead = Lead.objects.prefetch_related('assignments__user').get(id=lead_id)
    except Lead.DoesNotExist:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_admin = _is_crm_admin(request.user)
    is_assigned = lead.assignments.filter(user=request.user).exists() or (lead.assigned_to_id == request.user.id)

    if request.method == 'GET':
        if not is_admin and not is_assigned:
            return Response({'error': 'Permission denied. You are not assigned to this lead.'}, status=status.HTTP_403_FORBIDDEN)

        assignees = [
            {'id': a.user.id, 'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username}
            for a in lead.assignments.all()
        ]
        lead_dict = {
            'id': lead.id,
            'company_name': lead.company_name,
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'contact_person': f"{lead.first_name} {lead.last_name}".strip(),
            'designation': getattr(lead, 'designation', ''),
            'mobile': lead.mobile or lead.phone,
            'alternate_mobile': getattr(lead, 'secondary_mobile', ''),
            'email': lead.email,
            'secondary_email': lead.secondary_email,
            'website': lead.website,
            'address_line1': lead.address_line1,
            'address_line2': lead.address_line2,
            'city': lead.city,
            'state': lead.state,
            'country': lead.country,
            'pincode': lead.pincode,
            'segment': lead.segment or 'Unassigned',
            'lead_source': getattr(lead, 'lead_source', '') or 'Direct',
            'status': lead.status,
            'notes': lead.notes,
            'custom_fields': getattr(lead, 'custom_fields', {}) or {},
            'assigned_staff': assignees,
            'created_at': lead.created_at.isoformat() if lead.created_at else None,
        }
        res_data = dict(lead_dict)
        res_data['lead'] = lead_dict
        return Response(res_data)

    if request.method == 'DELETE':
        if not is_admin and not _has_crm_permission(request.user, 'leads', 'delete'):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        _log_crm_audit(request.user, 'LEAD_DELETED', 'Lead', lead.id, {'company_name': lead.company_name})
        lead.delete()
        return Response({'message': 'Lead deleted successfully.'})

    # PUT/PATCH
    if not is_admin:
        if not is_assigned or not _has_crm_permission(request.user, 'leads', 'edit'):
            return Response({'error': 'Permission denied. You can only edit assigned leads.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    for field in [
        'company_name', 'first_name', 'last_name', 'designation', 'email', 'secondary_email',
        'phone', 'mobile', 'secondary_mobile', 'website', 'address_line1', 'address_line2',
        'city', 'state', 'country', 'pincode', 'segment', 'lead_source', 'notes'
    ]:
        if field in data:
            setattr(lead, field, (str(data[field]) if data[field] is not None else '').strip())

    if 'custom_fields' in data and isinstance(data['custom_fields'], dict):
        lead.custom_fields = data['custom_fields']

    lead.save()
    _log_crm_audit(request.user, 'LEAD_UPDATED', 'Lead', lead.id, {'company_name': lead.company_name})
    return Response({'message': 'Lead updated successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_import_validate_duplicates_api(request):
    """
    STEP 4 & 5: Data Validation & Duplicate Detection Engine
    Receives:
    - rows: list of raw row dicts from uploaded file
    - column_mapping: dict of Excel Header -> CRM Database Field
    - file_name: string
    Performs:
    1. Mapping to standard fields.
    2. Exact match detection: normalized phone or normalized email against database.
    3. Partial match detection: company name or contact person against database.
    4. Within-file duplicate check.
    5. Segment detection: identifies unknown segments so user can confirm auto-creation.
    Returns:
    - total_rows
    - new_rows: count & items
    - exact_duplicates: list with side-by-side matching info
    - partial_duplicates: list with side-by-side matching info
    - invalid_rows: count & samples
    - detected_segments: list of segment names with exists: bool
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'leads', 'import'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    rows = request.data.get('rows', [])
    column_mapping = request.data.get('column_mapping', {})

    if not rows:
        return Response({'error': 'No rows provided.'}, status=status.HTTP_400_BAD_REQUEST)

    # Invert mapping: CRM Field -> Excel Column
    field_to_excel = {v: k for k, v in column_mapping.items() if v and v != 'skip'}

    # Build DB lookups in memory for ultra-fast matching
    existing_phones = {}
    existing_emails = {}
    existing_companies = {}

    for l in Lead.objects.all().values('id', 'company_name', 'first_name', 'last_name', 'phone', 'mobile', 'email', 'segment'):
        lid = l['id']
        p1 = _normalize_phone_digits(l['phone'])
        p2 = _normalize_phone_digits(l['mobile'])
        em = _normalize_email(l['email'])
        cname = (l['company_name'] or '').strip().lower()

        if p1:
            existing_phones[p1] = l
        if p2:
            existing_phones[p2] = l
        if em:
            existing_emails[em] = l
        if cname:
            existing_companies[cname] = l

    active_segments = set(Segment.objects.filter(is_active=True).values_list('name', flat=True))
    active_segments_lower = {s.lower(): s for s in active_segments}

    exact_duplicates = []
    partial_duplicates = []
    new_rows = []
    invalid_rows = []
    seen_in_file_phones = set()
    detected_segments = set()

    for idx, raw_row in enumerate(rows):
        mapped = {}
        for crm_field, excel_col in field_to_excel.items():
            mapped[crm_field] = str(raw_row.get(excel_col, '')).strip() if raw_row.get(excel_col) is not None else ''

        c_name = mapped.get('company_name', '')
        c_person = mapped.get('contact_person', '') or f"{mapped.get('first_name', '')} {mapped.get('last_name', '')}".strip()
        phone = mapped.get('mobile_number', '') or mapped.get('phone', '')
        email = mapped.get('email', '')
        seg = mapped.get('segment', '') or 'Unassigned'

        if seg and seg != 'Unassigned':
            detected_segments.add(seg)

        norm_phone = _normalize_phone_digits(phone)
        norm_email = _normalize_email(email)
        norm_company = c_name.strip().lower()

        # Validation: row needs at least company name, contact, or phone
        if not c_name and not c_person and not phone and not email:
            invalid_rows.append({
                'row_index': idx,
                'raw_row': raw_row,
                'reason': 'Empty row or missing all key contact fields.'
            })
            continue

        # Check exact duplicate against DB
        matched_lead = None
        match_type = 'NONE'

        if norm_phone and norm_phone in existing_phones:
            matched_lead = existing_phones[norm_phone]
            match_type = 'EXACT'
        elif norm_email and norm_email in existing_emails:
            matched_lead = existing_emails[norm_email]
            match_type = 'EXACT'
        elif norm_company and norm_company in existing_companies:
            matched_lead = existing_companies[norm_company]
            match_type = 'PARTIAL'

        if match_type == 'EXACT':
            exact_duplicates.append({
                'row_index': idx,
                'uploaded': {
                    'company_name': c_name,
                    'contact_person': c_person,
                    'phone': phone,
                    'email': email,
                    'segment': seg,
                },
                'existing': {
                    'id': matched_lead['id'],
                    'company_name': matched_lead['company_name'] or 'N/A',
                    'contact_person': f"{matched_lead['first_name']} {matched_lead['last_name']}".strip() or 'N/A',
                    'phone': matched_lead['mobile'] or matched_lead['phone'] or '',
                    'email': matched_lead['email'] or '',
                    'segment': matched_lead['segment'] or 'Unassigned',
                },
                'match_type': 'EXACT',
                'reason': 'Phone or Email matches existing record.'
            })
        elif match_type == 'PARTIAL':
            partial_duplicates.append({
                'row_index': idx,
                'uploaded': {
                    'company_name': c_name,
                    'contact_person': c_person,
                    'phone': phone,
                    'email': email,
                    'segment': seg,
                },
                'existing': {
                    'id': matched_lead['id'],
                    'company_name': matched_lead['company_name'] or 'N/A',
                    'contact_person': f"{matched_lead['first_name']} {matched_lead['last_name']}".strip() or 'N/A',
                    'phone': matched_lead['mobile'] or matched_lead['phone'] or '',
                    'email': matched_lead['email'] or '',
                    'segment': matched_lead['segment'] or 'Unassigned',
                },
                'match_type': 'PARTIAL',
                'reason': 'Company Name matches existing record.'
            })
        else:
            new_rows.append(idx)

    # Segment mapping check
    segments_summary = []
    for s in detected_segments:
        exists = s.lower() in active_segments_lower
        segments_summary.append({
            'name': s,
            'exists': exists,
            'matched_name': active_segments_lower.get(s.lower(), s),
        })

    import hashlib
    import_token = hashlib.sha256(f"{request.user.id}_{len(rows)}_{timezone.now().timestamp()}".encode()).hexdigest()[:32]

    return Response({
        'import_token': import_token,
        'total_rows': len(rows),
        'new_records_count': len(new_rows),
        'exact_duplicates_count': len(exact_duplicates),
        'partial_duplicates_count': len(partial_duplicates),
        'invalid_rows_count': len(invalid_rows),
        'exact_duplicates': exact_duplicates[:50],  # Return up to 50 for interactive UI
        'partial_duplicates': partial_duplicates[:50],
        'detected_segments': segments_summary,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_import_commit_api(request):
    """
    STEP 6 & 7: Commit Import & Generate Summary Report
    Receives:
    - rows: list of raw row dicts
    - column_mapping: dict
    - resolutions: dict mapping row_index (str) -> 'SKIP' | 'UPDATE' | 'MERGE' | 'NEW'
    - create_unknown_segments: bool
    - file_name: str
    Executes atomically in transaction.
    Maintains complete import history in LeadImportJob and LeadImportRow.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'leads', 'import'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    rows = request.data.get('rows', [])
    column_mapping = request.data.get('column_mapping', {})
    resolutions = request.data.get('resolutions', {})  # {'0': 'UPDATE', '1': 'SKIP', ...}
    create_unknown_segments = bool(request.data.get('create_unknown_segments', False))
    file_name = request.data.get('file_name', 'Imported_Leads.xlsx')
    import_token = (request.data.get('import_token') or '').strip()

    # Re-import protection: prevent double-committing the exact same import job
    if import_token and LeadImportJob.objects.filter(import_token=import_token, status='Completed').exists():
        return Response({'error': 'This import batch has already been processed and committed. Re-importing duplicate batches is prevented.'}, status=status.HTTP_400_BAD_REQUEST)

    if not rows:
        return Response({'error': 'No rows to import.'}, status=status.HTTP_400_BAD_REQUEST)

    field_to_excel = {v: k for k, v in column_mapping.items() if v and v != 'skip'}

    # Build DB lookups
    existing_by_phone = {}
    existing_by_email = {}
    existing_by_company = {}

    for l in Lead.objects.all():
        p1 = _normalize_phone_digits(l.phone)
        p2 = _normalize_phone_digits(l.mobile)
        em = _normalize_email(l.email)
        cn = (l.company_name or '').strip().lower()
        if p1: existing_by_phone[p1] = l
        if p2: existing_by_phone[p2] = l
        if em: existing_by_email[em] = l
        if cn: existing_by_company[cn] = l

    active_segments_lower = {s.name.lower(): s for s in Segment.objects.all()}

    new_count = 0
    updated_count = 0
    skipped_count = 0
    failed_count = 0
    leads_to_create = []

    with transaction.atomic():
        # Auto-create unknown segments if requested
        if create_unknown_segments:
            for raw_row in rows:
                seg_col = field_to_excel.get('segment')
                if seg_col:
                    raw_seg = str(raw_row.get(seg_col, '')).strip()
                    if raw_seg and raw_seg.lower() not in active_segments_lower and raw_seg != 'Unassigned':
                        new_seg = Segment.objects.create(name=raw_seg, is_active=True, created_by=request.user)
                        active_segments_lower[raw_seg.lower()] = new_seg

        import_job = LeadImportJob.objects.create(
            file_name=file_name,
            import_token=import_token,
            uploaded_by=request.user,
            total_records=len(rows),
            status='Completed'
        )

        for idx, raw_row in enumerate(rows):
            str_idx = str(idx)
            chosen_resolution = resolutions.get(str_idx, 'NEW').upper()

            if chosen_resolution == 'SKIP':
                skipped_count += 1
                LeadImportRow.objects.create(
                    job=import_job,
                    row_index=idx,
                    resolution='SKIP',
                    details={'raw_row': raw_row}
                )
                continue

            mapped = {}
            for crm_field, excel_col in field_to_excel.items():
                mapped[crm_field] = str(raw_row.get(excel_col, '')).strip() if raw_row.get(excel_col) is not None else ''

            c_name = mapped.get('company_name', '')
            c_person = mapped.get('contact_person', '') or f"{mapped.get('first_name', '')} {mapped.get('last_name', '')}".strip()
            phone = mapped.get('mobile_number', '') or mapped.get('phone', '')
            email = mapped.get('email', '')
            seg = mapped.get('segment', '') or 'Unassigned'

            norm_p = _normalize_phone_digits(phone)
            norm_e = _normalize_email(email)
            norm_c = c_name.strip().lower()

            matched = (
                existing_by_phone.get(norm_p) or
                existing_by_email.get(norm_e) or
                existing_by_company.get(norm_c)
            )

            if matched and chosen_resolution in ['UPDATE', 'MERGE']:
                # Update or merge
                if c_name: matched.company_name = c_name
                if c_person:
                    parts = c_person.split(' ', 1)
                    matched.first_name = parts[0]
                    matched.last_name = parts[1] if len(parts) > 1 else ''
                if phone: matched.mobile = phone
                if email: matched.email = email
                if seg and seg != 'Unassigned': matched.segment = seg
                matched.save()

                updated_count += 1
                LeadImportRow.objects.create(
                    job=import_job,
                    row_index=idx,
                    company_name=c_name,
                    contact_person=c_person,
                    phone=phone,
                    email=email,
                    match_type='EXACT' if (norm_p or norm_e) else 'PARTIAL',
                    resolution=chosen_resolution,
                    matched_lead_id=matched.id,
                    details=mapped
                )
            else:
                # Import as NEW
                parts = c_person.split(' ', 1)
                fn = parts[0]
                ln = parts[1] if len(parts) > 1 else ''

                lead = Lead(
                    company_name=c_name,
                    first_name=fn,
                    last_name=ln,
                    mobile=phone,
                    phone=phone,
                    email=email,
                    segment=seg,
                    city=mapped.get('city', ''),
                    state=mapped.get('state', ''),
                    country=mapped.get('country', 'India'),
                    pincode=mapped.get('pincode', ''),
                    address_line1=mapped.get('address_line1', ''),
                    website=mapped.get('website', ''),
                    notes=mapped.get('notes', ''),
                    lead_source='Excel Import',
                    status=Lead.STATUS_LEAD,
                    created_by=request.user,
                )
                leads_to_create.append((lead, idx, mapped))

        # Save new leads individually inside transaction to reliably capture auto-increment id on MariaDB/MySQL
        if leads_to_create:
            for lead_obj, idx, mapped in leads_to_create:
                lead_obj.save()
                new_count += 1
                LeadImportRow.objects.create(
                    job=import_job,
                    row_index=idx,
                    company_name=lead_obj.company_name,
                    contact_person=f"{lead_obj.first_name} {lead_obj.last_name}".strip(),
                    phone=lead_obj.mobile,
                    email=lead_obj.email,
                    match_type='NONE',
                    resolution='NEW',
                    matched_lead_id=lead_obj.id,
                    details=mapped
                )

        # Update job summary
        import_job.new_records = new_count
        import_job.updated_records = updated_count
        import_job.skipped_records = skipped_count
        import_job.failed_records = failed_count
        import_job.summary_json = {
            'total': len(rows),
            'new': new_count,
            'updated': updated_count,
            'skipped': skipped_count,
            'failed': failed_count,
        }
        import_job.save()

    _log_crm_audit(
        request.user,
        'EXCEL_IMPORTED',
        'LeadImportJob',
        import_job.id,
        {'file_name': file_name, 'new': new_count, 'updated': updated_count, 'skipped': skipped_count}
    )

    return Response({
        'message': f"Import completed successfully. {new_count} new, {updated_count} updated, {skipped_count} skipped.",
        'job_id': import_job.id,
        'summary': {
            'total_uploaded': len(rows),
            'new_records': new_count,
            'updated_records': updated_count,
            'skipped_records': skipped_count,
            'failed_records': failed_count,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_import_history_api(request):
    """
    Returns complete import history jobs.
    """
    jobs = LeadImportJob.objects.select_related('uploaded_by').all().order_by('-uploaded_at')[:50]
    results = []
    for j in jobs:
        uploader = f"{j.uploaded_by.first_name} {j.uploaded_by.last_name}".strip() or j.uploaded_by.username if j.uploaded_by else 'System'
        results.append({
            'id': j.id,
            'file_name': j.file_name,
            'uploaded_by': uploader,
            'uploaded_at': j.uploaded_at.isoformat() if j.uploaded_at else None,
            'total_records': j.total_records,
            'new_records': j.new_records,
            'updated_records': j.updated_records,
            'skipped_records': j.skipped_records,
            'status': j.status,
            'summary': j.summary_json,
        })
    return Response({'import_jobs': results})


# =============================================================================
# ADDITIONAL CRM ENDPOINTS (Parts 4-13 Specification)
# =============================================================================

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_role_detail_api(request, role_id):
    """
    GET, PUT, PATCH, DELETE for a specific Role.
    """
    try:
        role_obj = Role.objects.get(id=role_id)
    except Role.DoesNotExist:
        return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        perms = CRMRolePermission.objects.filter(role=role_obj.role)
        perm_map = {f"{p.module}.{p.action}": p.allow for p in perms}
        return Response({
            'id': role_obj.id,
            'role': role_obj.role,
            'permissions': perm_map,
        })

    if not _is_crm_superadmin(request.user):
        return Response({'error': 'Only Super Admin can edit or delete roles.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        if User.objects.filter(role__iexact=role_obj.role).exists():
            return Response({'error': f"Cannot delete role '{role_obj.role}' as it is assigned to existing users."}, status=status.HTTP_400_BAD_REQUEST)
        role_name = role_obj.role
        role_obj.delete()
        CRMRolePermission.objects.filter(role=role_name).delete()
        _log_crm_audit(request.user, 'ROLE_DELETED', 'Role', role_id, {'role': role_name})
        return Response({'message': 'Role deleted successfully.'})

    new_name = (request.data.get('role') or '').strip()
    if not new_name:
        return Response({'error': 'Role name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if Role.objects.filter(role__iexact=new_name).exclude(id=role_obj.id).exists():
        return Response({'error': 'Role with this name already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    old_name = role_obj.role
    role_obj.role = new_name
    role_obj.save()

    CRMRolePermission.objects.filter(role=old_name).update(role=new_name)
    User.objects.filter(role=old_name).update(role=new_name)

    _log_crm_audit(request.user, 'ROLE_UPDATED', 'Role', role_obj.id, {'old': old_name, 'new': new_name})
    return Response({'message': 'Role updated successfully.', 'role': role_obj.role})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_permissions_get_api(request):
    """
    GET /api/crm/permissions/
    Returns full permissions matrix for roles, users, modules, and actions.
    """
    perms_qs = CRMRolePermission.objects.all()
    perm_map = defaultdict(lambda: defaultdict(bool))
    for p in perms_qs:
        perm_map[p.role][f"{p.module}.{p.action}"] = p.allow

    user_overrides = defaultdict(lambda: defaultdict(bool))
    for u in CRMUserPermissionOverride.objects.all():
        user_overrides[str(u.user_id)][f"{u.module}.{u.action}"] = u.allow

    return Response({
        'role_permissions': perm_map,
        'user_overrides': user_overrides,
        'modules': [m[0] for m in CRMRolePermission.MODULE_CHOICES],
        'actions': [a[0] for a in CRMRolePermission.ACTION_CHOICES],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_access_request_approve_api(request, request_id):
    """POST /api/crm/access-requests/<id>/approve/"""
    request.data['decision'] = 'Approved'
    return crm_access_request_decision_api(request, request_id)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_access_request_reject_api(request, request_id):
    """POST /api/crm/access-requests/<id>/reject/"""
    request.data['decision'] = 'Rejected'
    return crm_access_request_decision_api(request, request_id)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_segment_detail_api(request, segment_id):
    """GET, PUT, DELETE for a specific Segment."""
    try:
        segment = Segment.objects.get(id=segment_id)
    except Segment.DoesNotExist:
        return Response({'error': 'Segment not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        cnt = Lead.objects.filter(segment__iexact=segment.name).count()
        return Response({
            'id': segment.id,
            'name': segment.name,
            'description': segment.description or '',
            'is_active': segment.is_active,
            'total_leads': cnt,
            'created_at': segment.created_at.isoformat() if segment.created_at else None,
            'updated_at': segment.updated_at.isoformat() if segment.updated_at else None,
        })

    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'segments', 'edit'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        return crm_segment_safe_delete_api(request, segment_id)

    data = request.data
    name = (data.get('name') or segment.name).strip()
    is_active = data.get('is_active', segment.is_active)
    if isinstance(is_active, str):
        is_active = is_active.lower() in ['true', '1', 'active']

    if is_active:
        if Segment.objects.filter(name__iexact=name, is_active=True).exclude(id=segment.id).exists():
            return Response({'error': f"Active segment named '{name}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

    old_name = segment.name
    segment.name = name
    segment.description = data.get('description', segment.description)
    segment.is_active = bool(is_active)
    segment.updated_by = request.user
    segment.save()

    if old_name != name:
        Lead.objects.filter(segment__iexact=old_name).update(segment=name)

    _log_crm_audit(request.user, 'SEGMENT_UPDATED', 'Segment', segment.id, {'old': old_name, 'new': name})
    return Response({'message': 'Segment updated successfully.', 'segment': {'id': segment.id, 'name': segment.name, 'is_active': segment.is_active}})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_leads_search_api(request):
    """GET /api/crm/leads/search/"""
    return crm_leads_api(getattr(request, '_request', request))


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_assignment_detail_api(request, assignment_id):
    """GET, PUT, DELETE for individual LeadAssignment."""
    try:
        assign = LeadAssignment.objects.select_related('lead', 'user').get(id=assignment_id)
    except LeadAssignment.DoesNotExist:
        return Response({'error': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            'id': assign.id,
            'lead_id': assign.lead_id,
            'lead_name': assign.lead.company_name or f"{assign.lead.first_name} {assign.lead.last_name}".strip(),
            'user_id': assign.user_id,
            'staff_name': f"{assign.user.first_name} {assign.user.last_name}".strip() or assign.user.username,
            'assigned_at': assign.assigned_at.isoformat() if assign.assigned_at else None,
        })

    if not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        assign.delete()
        return Response({'message': 'Assignment removed successfully.'})

    new_user_id = request.data.get('user_id')
    if new_user_id:
        try:
            new_user = User.objects.get(id=int(new_user_id))
            assign.user = new_user
            assign.save()
            return Response({'message': 'Assignment updated.'})
        except User.DoesNotExist:
            return Response({'error': 'Staff user not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'message': 'No changes made.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_reassign_execute_api(request):
    """
    POST /api/crm/assignments/reassign/
    Reassigns leads from one staff member to another with history logging.
    """
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'assignments', 'assign'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    lead_ids = request.data.get('lead_ids', [])
    from_user_id = request.data.get('from_user_id')
    to_user_id = request.data.get('to_user_id')

    if not lead_ids or not to_user_id:
        return Response({'error': 'lead_ids and to_user_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        to_user = User.objects.get(id=int(to_user_id))
        from_user = User.objects.get(id=int(from_user_id)) if from_user_id else None
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    with transaction.atomic():
        reassigned_count = 0
        for lid in lead_ids:
            lead = Lead.objects.filter(id=lid).first()
            if not lead:
                continue
            if from_user:
                LeadAssignment.objects.filter(lead=lead, user=from_user).delete()
            LeadAssignment.objects.get_or_create(
                lead=lead,
                user=to_user,
                defaults={'assigned_by': request.user, 'assigned_at': timezone.now()}
            )
            LeadAssignmentHistory.objects.create(
                lead=lead,
                assigned_to=to_user,
                assigned_by=request.user,
                previous_assignee=from_user,
                notes=f"Reassigned from {from_user.username if from_user else 'None'} to {to_user.username}"
            )
            reassigned_count += 1

    return Response({'message': f"Successfully reassigned {reassigned_count} lead(s) to {to_user.username}."})


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def crm_task_group_detail_api(request, task_group_id):
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        tg = CRMTaskGroup.objects.prefetch_related('assignees__user', 'associated_leads__lead').get(id=task_group_id)
    except CRMTaskGroup.DoesNotExist:
        return Response({'error': 'Task group not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_admin = _is_crm_admin(request.user)
    is_assigned = tg.assignees.filter(user=request.user).exists()
    is_creator = (tg.created_by_id == request.user.id)
    can_manage = is_admin or is_creator

    if request.method == 'GET':
        if not (is_admin or is_assigned or is_creator):
            return Response({'error': 'Permission denied. You are not assigned to this task group.'}, status=status.HTTP_403_FORBIDDEN)

        assignees = [
            {'id': a.user_id, 'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username, 'role': a.user.role}
            for a in tg.assignees.all()
        ]
        staff_ids = [a['id'] for a in assignees]
        leads_list = [
            {'id': tl.lead_id, 'company_name': tl.lead.company_name, 'contact_person': f"{tl.lead.first_name} {tl.lead.last_name}".strip(), 'mobile': tl.lead.mobile or tl.lead.phone}
            for tl in tg.associated_leads.all()
        ]
        lead_ids = [l['id'] for l in leads_list]
        total_act = tg.lead_activities.count()
        comp_act = tg.lead_activities.filter(status='Completed').count()
        return Response({
            'id': tg.id,
            'title': tg.title,
            'description': tg.description,
            'attachment': tg.attachment,
            'start_date': _safe_iso_date(tg.start_date),
            'start_time': str(tg.start_time) if tg.start_time else None,
            'end_date': _safe_iso_date(tg.end_date),
            'end_time': str(tg.end_time) if tg.end_time else None,
            'priority': tg.priority,
            'status': tg.status,
            'assignees': assignees,
            'staff_ids': staff_ids,
            'leads': leads_list,
            'lead_ids': lead_ids,
            'total_activities': total_act,
            'completed_activities': comp_act,
            'can_edit': can_manage,
            'can_delete': can_manage,
        })

    # DELETE: Soft-delete / Archive task group preserving historical activities and notes
    if request.method == 'DELETE':
        if not is_admin:
            if not is_creator or not _has_crm_permission(request.user, 'tasks', 'delete'):
                return Response({'error': 'Permission denied. You cannot delete task groups belonging to other staff without authorization.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            tg.status = CRMTaskGroup.STATUS_ARCHIVED
            tg.save(update_fields=['status'])
            _log_crm_audit(request.user, 'TASK_GROUP_ARCHIVED', 'CRMTaskGroup', tg.id, {'title': tg.title})

        return Response({'message': f'Task group "{tg.title}" deleted successfully.'})

    # PUT / PATCH: Update Task Group
    if not is_admin:
        if not is_creator or not _has_crm_permission(request.user, 'tasks', 'edit'):
            return Response({'error': 'Permission denied. You cannot edit task groups belonging to other staff without authorization.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    title = data.get('title')
    description = data.get('description')
    priority = data.get('priority')
    status_val = data.get('status')
    start_date = data.get('start_date')
    start_time = data.get('start_time')
    end_date = data.get('end_date')
    end_time = data.get('end_time')
    attachment = data.get('attachment')
    staff_ids = data.get('staff_ids')
    lead_ids = data.get('lead_ids')

    if title is not None and not str(title).strip():
        return Response({'error': 'Task title is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if staff_ids is not None and len(staff_ids) == 0:
        return Response({'error': 'At least one staff member must be assigned.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        # 1. Update basic fields
        if title is not None:
            tg.title = str(title).strip()
        if description is not None:
            tg.description = str(description).strip()
        if priority is not None:
            tg.priority = str(priority).strip()
        if status_val is not None:
            tg.status = str(status_val).strip()
        if start_date is not None:
            if isinstance(start_date, str) and start_date.strip():
                try:
                    tg.start_date = datetime.strptime(start_date.strip()[:10], '%Y-%m-%d').date()
                except Exception:
                    tg.start_date = start_date.strip()[:10]
            else:
                tg.start_date = start_date
        if start_time is not None:
            tg.start_time = start_time or None
        if end_date is not None:
            if isinstance(end_date, str) and end_date.strip():
                try:
                    tg.end_date = datetime.strptime(end_date.strip()[:10], '%Y-%m-%d').date()
                except Exception:
                    tg.end_date = end_date.strip()[:10]
            else:
                tg.end_date = end_date
        if end_time is not None:
            tg.end_time = end_time or None
        if attachment is not None:
            tg.attachment = str(attachment)
        tg.save()

        added_staff_ids = set()
        removed_staff_ids = set()
        # 2. Update staff assignees if provided
        if staff_ids is not None:
            new_staff_ids = set(int(i) for i in staff_ids)
            current_staff_ids = set(tg.assignees.values_list('user_id', flat=True))
            added_staff_ids = new_staff_ids - current_staff_ids
            removed_staff_ids = current_staff_ids - new_staff_ids

            if removed_staff_ids:
                CRMTaskAssignee.objects.filter(task_group=tg, user_id__in=removed_staff_ids).delete()
            for uid in added_staff_ids:
                CRMTaskAssignee.objects.get_or_create(task_group=tg, user_id=uid)

        added_lead_ids = set()
        removed_lead_ids = set()
        # 3. Update associated leads if provided
        if lead_ids is not None:
            new_lead_ids = set(int(i) for i in lead_ids)
            current_lead_ids = set(tg.associated_leads.values_list('lead_id', flat=True))
            added_lead_ids = new_lead_ids - current_lead_ids
            removed_lead_ids = current_lead_ids - new_lead_ids

            if removed_lead_ids:
                CRMTaskLead.objects.filter(task_group=tg, lead_id__in=removed_lead_ids).delete()
            for lid in added_lead_ids:
                CRMTaskLead.objects.get_or_create(task_group=tg, lead_id=lid)

        # 4. Safely handle activities:
        # A. Create missing activities for active (staff, lead) pairs
        active_staff = list(tg.assignees.values_list('user_id', flat=True))
        active_leads = list(tg.associated_leads.values_list('lead_id', flat=True))
        if active_staff and active_leads:
            existing_pairs = set(
                LeadTaskActivity.objects.filter(task_group=tg).values_list('lead_id', 'user_id')
            )
            activities_to_create = []
            for uid in active_staff:
                for lid in active_leads:
                    if (lid, uid) not in existing_pairs:
                        activities_to_create.append(
                            LeadTaskActivity(
                                task_group=tg,
                                lead_id=lid,
                                user_id=uid,
                                status='Pending',
                                notes='',
                            )
                        )
            if activities_to_create:
                LeadTaskActivity.objects.bulk_create(activities_to_create, ignore_conflicts=True)

        # B. Handle removed staff and leads safely:
        # PRESERVE all existing activity history (completed, notes, action taken, followup).
        # Only clean uncommenced pending stubs (status='Pending', empty notes, empty action, no followup)
        # for removed staff or removed leads so ghost pending work is not left behind.
        if removed_staff_ids or removed_lead_ids:
            uncommenced_stubs = LeadTaskActivity.objects.filter(task_group=tg).filter(
                Q(user_id__in=removed_staff_ids) | Q(lead_id__in=removed_lead_ids)
            ).filter(
                status='Pending',
                notes='',
                action_taken='',
                next_followup_date__isnull=True
            )
            uncommenced_stubs.delete()

        _log_crm_audit(
            request.user,
            'TASK_GROUP_UPDATED',
            'CRMTaskGroup',
            tg.id,
            {
                'title': tg.title,
                'added_staff': list(added_staff_ids),
                'removed_staff': list(removed_staff_ids),
                'added_leads': list(added_lead_ids),
                'removed_leads': list(removed_lead_ids),
            }
        )

    return Response({
        'message': f'Task group "{tg.title}" updated successfully.',
        'task_group': {
            'id': tg.id,
            'title': tg.title,
            'description': tg.description,
            'priority': tg.priority,
            'status': tg.status,
            'start_date': _safe_iso_date(tg.start_date),
            'end_date': _safe_iso_date(tg.end_date),
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_task_group_assign_api(request, task_group_id):
    """POST /api/crm/task-groups/<id>/assign/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        tg = CRMTaskGroup.objects.get(id=task_group_id)
    except CRMTaskGroup.DoesNotExist:
        return Response({'error': 'Task group not found.'}, status=status.HTTP_404_NOT_FOUND)

    staff_ids = request.data.get('staff_ids', [])
    staff_users = User.objects.filter(id__in=[int(i) for i in staff_ids])
    leads = [tl.lead for tl in tg.associated_leads.select_related('lead').all()]

    with transaction.atomic():
        for u in staff_users:
            CRMTaskAssignee.objects.get_or_create(task_group=tg, user=u)

        existing_activities = set(
            LeadTaskActivity.objects.filter(task_group=tg).values_list('lead_id', 'user_id')
        )
        new_activities = [
            LeadTaskActivity(task_group=tg, lead=l, user=u, status='Pending')
            for u in staff_users
            for l in leads
            if (l.id, u.id) not in existing_activities
        ]
        if new_activities:
            LeadTaskActivity.objects.bulk_create(new_activities, ignore_conflicts=True)

    return Response({'message': f"Assigned {len(staff_users)} staff member(s). Generated {len(new_activities)} new activity record(s)."})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_task_group_associate_leads_api(request, task_group_id):
    """POST /api/crm/task-groups/<id>/associate-leads/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        tg = CRMTaskGroup.objects.get(id=task_group_id)
    except CRMTaskGroup.DoesNotExist:
        return Response({'error': 'Task group not found.'}, status=status.HTTP_404_NOT_FOUND)

    lead_ids = request.data.get('lead_ids', [])
    leads = Lead.objects.filter(id__in=[int(i) for i in lead_ids])
    staff_users = [ta.user for ta in tg.assignees.select_related('user').all()]

    with transaction.atomic():
        for l in leads:
            CRMTaskLead.objects.get_or_create(task_group=tg, lead=l)

        existing_activities = set(
            LeadTaskActivity.objects.filter(task_group=tg).values_list('lead_id', 'user_id')
        )
        new_activities = [
            LeadTaskActivity(task_group=tg, lead=l, user=u, status='Pending')
            for u in staff_users
            for l in leads
            if (l.id, u.id) not in existing_activities
        ]
        if new_activities:
            LeadTaskActivity.objects.bulk_create(new_activities, ignore_conflicts=True)

    return Response({'message': f"Associated {len(leads)} lead(s). Generated {len(new_activities)} new activity record(s)."})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_my_work_activities_api(request):
    """GET /api/crm/my-work/activities/"""
    return crm_my_work_api(getattr(request, '_request', request))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_my_work_activity_detail_api(request, activity_id):
    """GET /api/crm/my-work/activities/<id>/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    try:
        act = LeadTaskActivity.objects.select_related('task_group', 'lead').get(id=activity_id)
    except LeadTaskActivity.DoesNotExist:
        return Response({'error': 'Activity not found.'}, status=status.HTTP_404_NOT_FOUND)

    if act.user_id != request.user.id and not _is_crm_admin(request.user):
        return Response({'error': 'Permission denied. You can only view your own activities.'}, status=status.HTTP_403_FORBIDDEN)

    act_data = {
        'activity_id': act.id,
        'id': act.id,
        'task_group_id': act.task_group_id,
        'task_title': act.task_group.title,
        'priority': act.task_group.priority,
        'lead_id': act.lead_id,
        'company_name': act.lead.company_name,
        'contact_person': f"{act.lead.first_name} {act.lead.last_name}".strip(),
        'mobile_number': act.lead.mobile or act.lead.phone,
        'segment': act.lead.segment,
        'status': act.status,
        'notes': act.notes,
        'action_taken': act.action_taken,
        'next_followup_date': _safe_iso_date(act.next_followup_date),
        'next_followup_time': str(act.next_followup_time) if act.next_followup_time else None,
        'attachment': act.attachment,
    }
    res_data = dict(act_data)
    res_data['activity'] = act_data
    return Response(res_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_my_work_followups_api(request):
    """GET /api/crm/my-work/follow-ups/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()
    qs = LeadTaskActivity.objects.select_related('task_group', 'lead').filter(
        user=request.user,
        next_followup_date__isnull=False
    ).exclude(status='Completed').order_by('next_followup_date')

    followups = [
        {
            'activity_id': act.id,
            'task_title': act.task_group.title,
            'company_name': act.lead.company_name,
            'contact_person': f"{act.lead.first_name} {act.lead.last_name}".strip(),
            'phone': act.lead.mobile or act.lead.phone,
            'followup_date': _safe_iso_date(act.next_followup_date),
            'followup_time': str(act.next_followup_time) if act.next_followup_time else None,
            'is_overdue': act.next_followup_date < today,
            'status': act.status,
            'notes': act.notes,
        }
        for act in qs[:100]
    ]
    return Response({'followups': followups, 'total': len(followups)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_reports_staff_api(request):
    """GET /api/crm/reports/staff/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'reports', 'view'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()
    qs = LeadTaskActivity.objects.select_related('user').all()
    staff_breakdown = list(
        qs.values('user_id', 'user__username', 'user__first_name', 'user__last_name')
        .annotate(
            total=Count('id'),
            completed=Count(Case(When(status='Completed', then=1), output_field=IntegerField())),
            pending=Count(Case(When(status='Pending', then=1), output_field=IntegerField())),
            overdue=Count(Case(When(next_followup_date__lt=today, then=1), output_field=IntegerField()))
        )
        .order_by('-total')
    )
    return Response({'staff_performance': staff_breakdown})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_reports_task_groups_api(request):
    """GET /api/crm/reports/task-groups/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)
    if not _is_crm_admin(request.user) and not _has_crm_permission(request.user, 'reports', 'view'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = CRMTaskGroup.objects.exclude(status='Archived').order_by('-created_at')[:50]
    tasks_data = []
    for tg in qs:
        tot = tg.lead_activities.count()
        comp = tg.lead_activities.filter(status='Completed').count()
        pct = round(comp / tot * 100, 1) if tot > 0 else 0
        tasks_data.append({
            'id': tg.id,
            'title': tg.title,
            'priority': tg.priority,
            'status': tg.status,
            'total_activities': tot,
            'completed_activities': comp,
            'completion_percentage': pct,
            'start_date': _safe_iso_date(tg.start_date),
            'end_date': _safe_iso_date(tg.end_date),
        })
    return Response({'task_groups': tasks_data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_reports_segments_api(request):
    """GET /api/crm/reports/segments/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    segments = Segment.objects.filter(is_active=True).values('name').order_by('name')
    seg_data = []
    for s in segments:
        cnt = Lead.objects.filter(segment__iexact=s['name']).count()
        seg_data.append({'name': s['name'], 'lead_count': cnt})
    return Response({'segments': seg_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_reports_export_api(request):
    """POST /api/crm/reports/export/"""
    return crm_performance_reports_api(getattr(request, '_request', request))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_lead_communications_api(request, lead_id):
    """GET, POST /api/crm/leads/<id>/communications/"""
    return crm_lead_timeline_api(getattr(request, '_request', request), lead_id)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crm_lead_import_upload_api(request):
    """POST /api/crm/leads/import/upload/"""
    return crm_lead_import_validate_duplicates_api(getattr(request, '_request', request))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_lead_import_preview_api(request, job_id):
    """GET /api/crm/leads/import/<job_id>/preview/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    rows = LeadImportRow.objects.filter(job_id=job_id)[:50]
    return Response({'preview_rows': [{'row_index': r.row_index, 'company_name': r.company_name, 'contact_person': r.contact_person, 'phone': r.phone, 'email': r.email, 'match_type': r.match_type, 'resolution': r.resolution} for r in rows]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_lead_import_failed_rows_api(request, job_id):
    """GET /api/crm/leads/import/<job_id>/failed-rows/"""
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    rows = LeadImportRow.objects.filter(job_id=job_id, resolution='SKIP')
    return Response({'failed_rows': [{'row_index': r.row_index, 'details': r.details} for r in rows]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def crm_staff_users_api(request):
    """
    GET /api/crm/staff-users/
    List assignable staff members for Task Group assignment and Lead assignment.
    """
    allowed, err_msg = _check_crm_access_permission(request.user)
    if not allowed:
        return Response({'error': err_msg}, status=status.HTTP_403_FORBIDDEN)

    staff_qs = User.objects.filter(
        Q(role__iexact='staff') | Q(role__iexact='admin') | Q(role__iexact='manager') | Q(role__iexact='sales')
    ).exclude(crm_profile__account_status__iexact='Inactive').order_by('first_name', 'username')

    staff_data = [
        {
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'role': u.role,
            'is_active': True,
        }
        for u in staff_qs
    ]
    return Response(staff_data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def crm_communications_general_api(request):
    """
    GET, POST /api/crm/communications/
    General endpoint for communication history and logging.
    Pass lead_id as query parameter (?lead_id=101) or in JSON request body ({"lead_id": 101, ...}).
    """
    lead_id = (
        request.GET.get('lead_id')
        or request.GET.get('lead')
        or (request.data.get('lead_id') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
        or (request.data.get('lead') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
    )
    if not lead_id:
        return Response(
            {'error': 'lead_id is required either in query parameters (?lead_id=) or in request body.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        lead_id = int(lead_id)
    except (ValueError, TypeError):
        return Response({'error': 'lead_id must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)
    return crm_lead_timeline_api(getattr(request, '_request', request), lead_id)

