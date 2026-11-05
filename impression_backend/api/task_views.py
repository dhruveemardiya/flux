from datetime import datetime, date, timedelta
from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Lead, LeadTask, TaskCallHistory, User


def _safe_date(val, default=None):
    if not val:
        return default
    if hasattr(val, 'date'):
        try:
            return val.date()
        except Exception:
            pass
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
    except Exception:
        return default


def _is_admin_user(user):
    role = (getattr(user, 'role', '') or '').strip().lower().replace(' ', '').replace('_', '')
    return role in ['admin', 'superadmin', 'techadmin']


def _serialize_task(task, include_history=False):
    lead = task.lead
    today = timezone.now().date()
    company_name = lead.company_name if lead else ''
    contact_person = f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else ''
    phone = lead.phone if lead else ''
    mobile = lead.mobile if lead else ''
    email = lead.email if lead else ''
    city = lead.city if lead else ''

    is_due_today = False
    is_overdue = False
    is_reminder_active = False

    if task.status == LeadTask.STATUS_PENDING and task.next_followup_date:
        is_due_today = task.next_followup_date == today
        is_overdue = task.next_followup_date < today

    if task.status == LeadTask.STATUS_PENDING and task.reminder_date:
        is_reminder_active = task.reminder_date <= today

    data = {
        'id': task.id,
        'lead_id': lead.id if lead else None,
        'company_name': company_name,
        'contact_person': contact_person,
        'first_name': lead.first_name if lead else '',
        'last_name': lead.last_name if lead else '',
        'email': email,
        'phone': phone,
        'mobile': mobile,
        'city': city,
        'address': f"{lead.address_line1 or ''} {lead.address_line2 or ''}".strip() if lead else '',
        'description': task.description or '',
        'assigned_date': task.assigned_date.isoformat() if task.assigned_date else None,
        'next_followup_date': task.next_followup_date.isoformat() if task.next_followup_date else None,
        'reminder_date': task.reminder_date.isoformat() if task.reminder_date else None,
        'future_discussion': task.future_discussion or '',
        'status': task.status,
        'completed_at': task.completed_at.isoformat() if task.completed_at else None,
        'assigned_to_id': task.assigned_to_id,
        'assigned_to_name': f"{task.assigned_to.first_name or ''} {task.assigned_to.last_name or ''}".strip() or task.assigned_to.username if task.assigned_to else '',
        'is_due_today': is_due_today,
        'is_overdue': is_overdue,
        'is_reminder_active': is_reminder_active,
        'call_count': task.call_history.count(),
        'created_at': task.created_at.isoformat() if task.created_at else None,
        'updated_at': task.updated_at.isoformat() if task.updated_at else None,
    }

    if include_history:
        calls = []
        for c in task.call_history.all().order_by('-call_date', '-id'):
            user_display = f"{c.user.first_name or ''} {c.user.last_name or ''}".strip() or c.user.username if c.user else ''
            interaction_type = getattr(c, 'interaction_type', 'Call') or 'Call'
            calls.append({
                'id': c.id,
                'interaction_type': interaction_type,
                'call_date': c.call_date.isoformat() if c.call_date else None,
                'interaction_date': c.call_date.isoformat() if c.call_date else None,
                'discussion': c.discussion,
                'communication_notes': c.discussion,
                'next_followup_date': c.next_followup_date.isoformat() if c.next_followup_date else None,
                'future_discussion': c.future_discussion,
                'next_followup_notes': c.future_discussion,
                'user_id': c.user_id,
                'user_name': user_display,
                'created_at': c.created_at.isoformat() if c.created_at else None,
            })
        data['call_history'] = calls

    return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks_list_create_api(request):
    """
    List tasks or create a new task.
    - Regular Users see ONLY their assigned tasks.
    - Automatically syncs tasks for any leads assigned to the user.
    """
    is_admin = _is_admin_user(request.user)

    if request.method == 'GET':
        # Automatic sync: Ensure any lead assigned to this user has a task
        if not is_admin:
            assigned_leads = Lead.objects.filter(
                Q(assignments__user=request.user) | Q(assigned_to=request.user)
            ).distinct()
            existing_lead_ids = set(LeadTask.objects.filter(assigned_to=request.user, is_deleted=False).values_list('lead_id', flat=True))
            today = timezone.now().date()
            to_create = []
            for lead in assigned_leads:
                if lead.id not in existing_lead_ids:
                    # Check if there is an inactive/soft-deleted task to reactivate
                    deleted_task = LeadTask.objects.filter(lead=lead, assigned_to=request.user, is_deleted=True).first()
                    if deleted_task:
                        deleted_task.is_deleted = False
                        deleted_task.status = LeadTask.STATUS_PENDING
                        deleted_task.save()
                    else:
                        to_create.append(LeadTask(
                            lead=lead,
                            assigned_to=request.user,
                            assigned_date=_safe_date(lead.assigned_at, default=today),
                            description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                            status=LeadTask.STATUS_PENDING
                        ))
            if to_create:
                LeadTask.objects.bulk_create(to_create)

            # Deactivate tasks for leads no longer assigned to this user
            assigned_lead_ids = set(assigned_leads.values_list('id', flat=True))
            LeadTask.objects.filter(
                assigned_to=request.user,
                is_deleted=False
            ).exclude(lead_id__in=assigned_lead_ids).update(is_deleted=True)

        # Base queryset
        if is_admin:
            user_filter = request.GET.get('user_id')
            if user_filter:
                try:
                    queryset = LeadTask.objects.filter(assigned_to_id=int(user_filter), is_deleted=False)
                except (ValueError, TypeError):
                    queryset = LeadTask.objects.filter(is_deleted=False)
            else:
                queryset = LeadTask.objects.filter(is_deleted=False)
        else:
            queryset = LeadTask.objects.filter(assigned_to=request.user, is_deleted=False)

        # Filter by status
        status_filter = request.GET.get('status', '').strip()
        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status__iexact=status_filter)

        # Search filter
        search_term = request.GET.get('search', '').strip()
        if search_term:
            queryset = queryset.filter(
                Q(lead__company_name__icontains=search_term) |
                Q(lead__first_name__icontains=search_term) |
                Q(lead__last_name__icontains=search_term) |
                Q(lead__phone__icontains=search_term) |
                Q(lead__mobile__icontains=search_term) |
                Q(lead__email__icontains=search_term) |
                Q(lead__city__icontains=search_term) |
                Q(description__icontains=search_term) |
                Q(future_discussion__icontains=search_term)
            )

        # Ordering
        queryset = queryset.select_related('lead', 'assigned_to').prefetch_related('call_history').order_by('-id')

        # Compute dynamic counts
        if is_admin:
            base_counts_qs = LeadTask.objects.filter(is_deleted=False)
        else:
            base_counts_qs = LeadTask.objects.filter(assigned_to=request.user, is_deleted=False)

        pending_count = base_counts_qs.filter(status=LeadTask.STATUS_PENDING).count()
        completed_count = base_counts_qs.filter(status=LeadTask.STATUS_COMPLETED).count()

        tasks_data = [_serialize_task(task) for task in queryset]

        return Response({
            'tasks': tasks_data,
            'counts': {
                'all': pending_count + completed_count,
                'pending': pending_count,
                'completed': completed_count,
            }
        })

    elif request.method == 'POST':
        # Create a new task manually
        data = request.data
        lead_id = data.get('lead_id')
        if not lead_id:
            return Response({'error': 'lead_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lead = Lead.objects.get(id=int(lead_id))
        except (Lead.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Lead does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        # Permissions: regular users can only create tasks for their assigned leads
        lead_is_assigned = Lead.objects.filter(
            Q(assignments__user=request.user) | Q(assigned_to=request.user),
            id=lead.id
        ).exists()
        if not is_admin and not lead_is_assigned:
            return Response({'error': 'You can only create tasks for leads assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        target_user = request.user
        if is_admin and data.get('assigned_to_id'):
            try:
                target_user = User.objects.get(id=int(data.get('assigned_to_id')))
            except (User.DoesNotExist, ValueError, TypeError):
                target_user = request.user

        # Prevent accidental duplicate active task creation for the same lead
        existing_task = LeadTask.objects.filter(lead=lead, assigned_to=target_user, is_deleted=False, status=LeadTask.STATUS_PENDING).first()
        if existing_task:
            return Response({
                'error': f'A pending task already exists for {lead.company_name or "this lead"}.',
                'task_id': existing_task.id
            }, status=status.HTTP_400_BAD_REQUEST)

        # Dates
        assigned_date_str = data.get('assigned_date')
        assigned_date = timezone.now().date()
        if assigned_date_str:
            try:
                assigned_date = datetime.strptime(assigned_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        next_followup_date = None
        next_followup_str = data.get('next_followup_date')
        if next_followup_str:
            try:
                next_followup_date = datetime.strptime(next_followup_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        task = LeadTask(
            lead=lead,
            assigned_to=target_user,
            description=data.get('description', '').strip() or (lead.notes or f"Follow up with {lead.company_name or 'Lead'}"),
            assigned_date=assigned_date,
            next_followup_date=next_followup_date,
            future_discussion=data.get('future_discussion', '').strip(),
            status=LeadTask.STATUS_PENDING
        )
        task.save()

        return Response({
            'message': 'Task created successfully.',
            'task': _serialize_task(task, include_history=True)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail_api(request, task_id):
    """
    Retrieve, update or delete a task.
    """
    is_admin = _is_admin_user(request.user)
    try:
        if is_admin:
            task = LeadTask.objects.get(id=task_id, is_deleted=False)
        else:
            task = LeadTask.objects.get(id=task_id, assigned_to=request.user, is_deleted=False)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'task': _serialize_task(task, include_history=True)})

    elif request.method == 'PATCH':
        data = request.data
        if 'description' in data:
            task.description = data['description']

        if 'future_discussion' in data:
            task.future_discussion = data['future_discussion']

        if 'assigned_date' in data:
            val = data['assigned_date']
            if val:
                try:
                    task.assigned_date = datetime.strptime(val, '%Y-%m-%d').date()
                except ValueError:
                    pass

        if 'next_followup_date' in data:
            val = data['next_followup_date']
            if val:
                try:
                    task.next_followup_date = datetime.strptime(val, '%Y-%m-%d').date()
                except ValueError:
                    pass
            else:
                task.next_followup_date = None

        if 'status' in data:
            new_status = data['status']
            if new_status in [LeadTask.STATUS_PENDING, LeadTask.STATUS_COMPLETED]:
                task.status = new_status
                if new_status == LeadTask.STATUS_COMPLETED:
                    task.completed_at = timezone.now()
                else:
                    task.completed_at = None

        task.save()
        return Response({
            'message': 'Task updated successfully.',
            'task': _serialize_task(task, include_history=True)
        })

    elif request.method == 'DELETE':
        task.is_deleted = True
        task.save()
        return Response({'message': 'Task deleted successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_record_call_api(request, task_id):
    """
    Record a new interaction (Call, WhatsApp, Email) and update the next follow-up date and future notes.
    Preserves all previous communication history records.
    """
    is_admin = _is_admin_user(request.user)
    try:
        if is_admin:
            task = LeadTask.objects.get(id=task_id, is_deleted=False)
        else:
            task = LeadTask.objects.get(id=task_id, assigned_to=request.user, is_deleted=False)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    raw_type = data.get('interaction_type', TaskCallHistory.INTERACTION_CALL) or TaskCallHistory.INTERACTION_CALL
    interaction_type = str(raw_type).strip()
    type_lower = interaction_type.lower()
    if 'whatsapp' in type_lower:
        interaction_type = TaskCallHistory.INTERACTION_WHATSAPP
    elif 'email' in type_lower:
        interaction_type = TaskCallHistory.INTERACTION_EMAIL
    else:
        interaction_type = TaskCallHistory.INTERACTION_CALL

    discussion = (data.get('communication_notes') or data.get('discussion') or '').strip()
    if not discussion:
        return Response({'error': 'Communication notes are required.'}, status=status.HTTP_400_BAD_REQUEST)

    call_date = timezone.now().date()
    call_date_str = data.get('interaction_date') or data.get('call_date')
    if call_date_str:
        try:
            call_date = datetime.strptime(str(call_date_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            pass

    next_followup_date = None
    next_followup_str = data.get('next_followup_date')
    if next_followup_str:
        try:
            next_followup_date = datetime.strptime(str(next_followup_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            pass

    future_discussion = (data.get('next_followup_notes') or data.get('future_discussion') or '').strip()

    # Create the interaction record
    call = TaskCallHistory.objects.create(
        task=task,
        lead=task.lead,
        user=request.user,
        interaction_type=interaction_type,
        call_date=call_date,
        discussion=discussion,
        next_followup_date=next_followup_date,
        future_discussion=future_discussion
    )

    # Update the parent task with latest follow-up schedule and future discussion
    if next_followup_date:
        task.next_followup_date = next_followup_date
    if future_discussion:
        task.future_discussion = future_discussion

    task.save()

    return Response({
        'message': f'{interaction_type} interaction recorded and follow-up scheduled successfully.',
        'task': _serialize_task(task, include_history=True)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_status_toggle_api(request, task_id):
    """
    Toggle task status between Pending and Completed.
    """
    is_admin = _is_admin_user(request.user)
    try:
        if is_admin:
            task = LeadTask.objects.get(id=task_id, is_deleted=False)
        else:
            task = LeadTask.objects.get(id=task_id, assigned_to=request.user, is_deleted=False)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    target_status = request.data.get('status')
    if not target_status:
        # Toggle if not specified
        target_status = LeadTask.STATUS_COMPLETED if task.status == LeadTask.STATUS_PENDING else LeadTask.STATUS_PENDING

    if target_status not in [LeadTask.STATUS_PENDING, LeadTask.STATUS_COMPLETED]:
        return Response({'error': "Invalid status. Must be 'Pending' or 'Completed'."}, status=status.HTTP_400_BAD_REQUEST)

    task.status = target_status
    if target_status == LeadTask.STATUS_COMPLETED:
        task.completed_at = timezone.now()
    else:
        task.completed_at = None

    task.save()

    return Response({
        'message': f'Task marked as {target_status}.',
        'task': _serialize_task(task, include_history=True)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_available_leads_api(request):
    """
    Return leads assigned to the user that do not have an active pending task,
    allowing the user to create a task for them.
    """
    is_admin = _is_admin_user(request.user)
    if is_admin:
        assigned_leads = Lead.objects.all()
    else:
        assigned_leads = Lead.objects.filter(
            Q(assignments__user=request.user) | Q(assigned_to=request.user)
        ).distinct()

    task_filter = {'is_deleted': False, 'status': LeadTask.STATUS_PENDING}
    if not is_admin:
        task_filter['assigned_to'] = request.user
    existing_task_lead_ids = set(LeadTask.objects.filter(**task_filter).values_list('lead_id', flat=True))

    available = []
    for lead in assigned_leads.exclude(id__in=existing_task_lead_ids).order_by('company_name')[:100]:
        display_name = lead.company_name or f"{lead.first_name} {lead.last_name}".strip() or f"Lead #{lead.id}"
        available.append({
            'id': lead.id,
            'company_name': lead.company_name or '',
            'contact_person': f"{lead.first_name} {lead.last_name}".strip(),
            'phone': lead.phone or lead.mobile or '',
            'email': lead.email or '',
            'city': lead.city or '',
            'display_name': display_name
        })

    return Response({'available_leads': available})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_notifications_api(request):
    """
    Header Notification Reminders:
    Returns pending tasks for the user where reminder_date <= today.
    (Follow-up reminders show 1 day prior to their scheduled follow-up dates).
    Excludes completed or deleted tasks.
    """
    today = timezone.now().date()
    is_admin = _is_admin_user(request.user)

    if is_admin:
        tasks = LeadTask.objects.filter(
            is_deleted=False,
            status=LeadTask.STATUS_PENDING,
            reminder_date__isnull=False,
            reminder_date__lte=today
        )
    else:
        tasks = LeadTask.objects.filter(
            assigned_to=request.user,
            is_deleted=False,
            status=LeadTask.STATUS_PENDING,
            reminder_date__isnull=False,
            reminder_date__lte=today
        )

    tasks = tasks.select_related('lead', 'assigned_to').order_by('next_followup_date')

    notifications = []
    for task in tasks:
        lead = task.lead
        company_name = lead.company_name if lead else ''
        contact_person = f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else ''
        phone = lead.phone or lead.mobile if lead else ''

        is_due_today = task.next_followup_date == today if task.next_followup_date else False
        is_overdue = task.next_followup_date < today if task.next_followup_date else False

        notifications.append({
            'id': f"rem-{task.id}",
            'task_id': task.id,
            'lead_id': lead.id if lead else None,
            'company_name': company_name or f"Lead #{task.lead_id}",
            'contact_person': contact_person,
            'phone': phone,
            'email': lead.email if lead else '',
            'next_followup_date': task.next_followup_date.isoformat() if task.next_followup_date else None,
            'reminder_date': task.reminder_date.isoformat() if task.reminder_date else None,
            'future_discussion': task.future_discussion or task.description or '',
            'is_due_today': is_due_today,
            'is_overdue': is_overdue,
        })

    return Response({
        'count': len(notifications),
        'notifications': notifications
    })



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_communication_history_api(request, task_id):
    """
    GET /api/tasks/{id}/history/
    Returns complete chronological interaction history for this user's task.
    """
    is_admin = _is_admin_user(request.user)
    try:
        if is_admin:
            task = LeadTask.objects.select_related('lead', 'assigned_to').get(id=task_id, is_deleted=False)
        else:
            task = LeadTask.objects.select_related('lead', 'assigned_to').get(id=task_id, assigned_to=request.user, is_deleted=False)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    records = task.call_history.all().order_by('-call_date', '-id')

    history_list = []
    for c in records:
        user_display = f"{c.user.first_name or ''} {c.user.last_name or ''}".strip() or c.user.username if c.user else ''
        interaction_type = getattr(c, 'interaction_type', 'Call') or 'Call'
        history_list.append({
            'id': c.id,
            'task_id': task.id,
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
            'created_at': c.created_at.isoformat() if c.created_at else None,
        })

    lead = task.lead
    return Response({
        'task_id': task.id,
        'lead_id': lead.id if lead else None,
        'company_name': lead.company_name if lead else '',
        'contact_person': f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else '',
        'count': len(history_list),
        'history': history_list
    }, status=status.HTTP_200_OK)
