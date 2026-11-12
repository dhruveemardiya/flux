from datetime import datetime, date, timedelta
from django.utils import timezone
from django.db import IntegrityError
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Lead, LeadTask, TaskAssignment, TaskActivity, TaskCallHistory, FollowupNotification, User


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


def _serialize_task(task, current_user=None, include_history=False):
    lead = task.lead
    today = timezone.now().date()
    company_name = lead.company_name if lead else ''
    contact_person = f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else ''
    phone = lead.phone if lead else ''
    mobile = lead.mobile if lead else ''
    email = lead.email if lead else ''
    city = lead.city if lead else ''

    # Build assigned users list from TaskAssignment
    assignments = task.assignments.select_related('user').all().order_by('assigned_at')
    assigned_users_list = []
    user_assignment = None
    completed_assignments_count = 0

    for a in assignments:
        u = a.user
        u_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
        if current_user and u.id == current_user.id:
            user_assignment = a
        if a.status == TaskAssignment.STATUS_COMPLETED:
            completed_assignments_count += 1

        assigned_users_list.append({
            'id': u.id,
            'user_id': u.id,
            'username': u.username,
            'name': u_name,
            'status': a.status,
            'completed_at': a.completed_at.isoformat() if a.completed_at else None,
            'next_followup_date': a.next_followup_date.isoformat() if a.next_followup_date else None,
            'reminder_date': a.reminder_date.isoformat() if a.reminder_date else None,
            'future_discussion': a.future_discussion or '',
            'assigned_at': a.assigned_at.isoformat() if a.assigned_at else None,
        })

    # Fallback to task.assigned_to if assignments table is empty
    if not assigned_users_list and task.assigned_to:
        u = task.assigned_to
        u_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
        if task.status == LeadTask.STATUS_COMPLETED:
            completed_assignments_count = 1
        assigned_users_list.append({
            'id': u.id,
            'user_id': u.id,
            'username': u.username,
            'name': u_name,
            'status': task.status,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'next_followup_date': task.next_followup_date.isoformat() if task.next_followup_date else None,
            'reminder_date': task.reminder_date.isoformat() if task.reminder_date else None,
            'future_discussion': task.future_discussion or '',
            'assigned_at': task.created_at.isoformat() if task.created_at else None,
        })

    is_admin = _is_admin_user(current_user) if current_user else False

    # Status for the viewer
    if user_assignment:
        current_user_status = user_assignment.status
        next_followup = user_assignment.next_followup_date or task.next_followup_date
        reminder = user_assignment.reminder_date or task.reminder_date
        future_disc = user_assignment.future_discussion or task.future_discussion
    else:
        current_user_status = task.status
        next_followup = task.next_followup_date
        reminder = task.reminder_date
        future_disc = task.future_discussion

    total_assigned = len(assigned_users_list)
    if is_admin and total_assigned > 1:
        progress_text = f"{completed_assignments_count}/{total_assigned} Completed"
    elif total_assigned > 1:
        progress_text = f"{current_user_status} ({completed_assignments_count}/{total_assigned} team completed)"
    else:
        progress_text = current_user_status

    is_due_today = False
    is_overdue = False
    is_reminder_active = False

    if current_user_status == LeadTask.STATUS_PENDING and next_followup:
        is_due_today = next_followup == today
        is_overdue = next_followup < today

    if current_user_status == LeadTask.STATUS_PENDING and reminder:
        is_reminder_active = reminder <= today

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
        'next_followup_date': next_followup.isoformat() if next_followup else None,
        'reminder_date': reminder.isoformat() if reminder else None,
        'future_discussion': future_disc or '',
        'status': current_user_status,
        'overall_status': task.status,
        'progress_text': progress_text,
        'completed_assignments_count': completed_assignments_count,
        'total_assigned_count': total_assigned,
        'completed_at': (user_assignment.completed_at if user_assignment else task.completed_at).isoformat() if (user_assignment.completed_at if user_assignment else task.completed_at) else None,
        'assigned_to_id': task.assigned_to_id,
        'assigned_to_name': f"{task.assigned_to.first_name or ''} {task.assigned_to.last_name or ''}".strip() or task.assigned_to.username if task.assigned_to else '',
        'assigned_users': assigned_users_list,
        'is_due_today': is_due_today,
        'is_overdue': is_overdue,
        'is_reminder_active': is_reminder_active,
        'call_count': task.activities.count(),
        'created_at': task.created_at.isoformat() if task.created_at else None,
        'updated_at': task.updated_at.isoformat() if task.updated_at else None,
    }

    if include_history:
        activities = []
        for act in task.activities.select_related('user').all().order_by('-created_at', '-id'):
            user_display = f"{act.user.first_name or ''} {act.user.last_name or ''}".strip() or act.user.username if act.user else ''
            activities.append({
                'id': act.id,
                'activity_type': act.activity_type,
                'interaction_type': act.activity_type,
                'user_id': act.user_id,
                'user_name': user_display,
                'description': act.description,
                'communication_notes': act.description,
                'discussion': act.description,
                'next_followup_date': act.next_followup_date.isoformat() if act.next_followup_date else None,
                'next_followup_notes': act.next_followup_notes,
                'future_discussion': act.next_followup_notes,
                'old_status': act.old_status,
                'new_status': act.new_status,
                'created_at': act.created_at.isoformat() if act.created_at else None,
                'interaction_date': act.created_at.date().isoformat() if act.created_at else None,
                'call_date': act.created_at.date().isoformat() if act.created_at else None,
                'formatted_time': act.created_at.strftime('%d %b %Y, %I:%M %p') if act.created_at else '',
            })
        data['activities'] = activities
        data['call_history'] = activities

    return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks_list_create_api(request):
    """
    List tasks or create a new task with multi-user assignment.
    - Regular Users see tasks assigned to them with their personal status.
    - Admin/SuperAdmin/TechAdmin see all tasks, with all assigned users and progress.
    """
    is_admin = _is_admin_user(request.user)

    if request.method == 'GET':
        # Auto-sync: Ensure any lead assigned to this user via LeadAssignment has a task & TaskAssignment
        if not is_admin:
            assigned_leads = Lead.objects.filter(
                Q(assignments__user=request.user) | Q(assigned_to=request.user)
            ).distinct()

            # Existing task IDs for this user
            user_task_ids = set(TaskAssignment.objects.filter(user=request.user, task__is_deleted=False).values_list('task_id', flat=True))
            legacy_task_ids = set(LeadTask.objects.filter(assigned_to=request.user, is_deleted=False).values_list('id', flat=True))
            all_user_task_ids = user_task_ids.union(legacy_task_ids)

            existing_lead_ids = set(LeadTask.objects.filter(id__in=all_user_task_ids, is_deleted=False).values_list('lead_id', flat=True))
            today = timezone.now().date()

            for lead in assigned_leads:
                if lead.id not in existing_lead_ids:
                    # Look for existing task for this lead or create one
                    task = LeadTask.objects.filter(lead=lead, is_deleted=False).first()
                    if not task:
                        task = LeadTask.objects.create(
                            lead=lead,
                            assigned_to=request.user,
                            assigned_date=_safe_date(lead.assigned_at, default=today),
                            description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                            status=LeadTask.STATUS_PENDING
                        )
                    TaskAssignment.objects.get_or_create(
                        task=task,
                        user=request.user,
                        defaults={
                            'assigned_by': request.user,
                            'status': TaskAssignment.STATUS_PENDING,
                            'assigned_at': timezone.now()
                        }
                    )

        # Base queryset
        if is_admin:
            user_filter = request.GET.get('user_id')
            if user_filter:
                try:
                    queryset = LeadTask.objects.filter(
                        Q(assignments__user_id=int(user_filter)) | Q(assigned_to_id=int(user_filter)),
                        is_deleted=False
                    ).distinct()
                except (ValueError, TypeError):
                    queryset = LeadTask.objects.filter(is_deleted=False)
            else:
                queryset = LeadTask.objects.filter(is_deleted=False)
        else:
            queryset = LeadTask.objects.filter(
                Q(assignments__user=request.user) | Q(assigned_to=request.user),
                is_deleted=False
            ).distinct()

        # Status filter
        status_filter = request.GET.get('status', '').strip()
        if status_filter and status_filter.lower() != 'all':
            if is_admin:
                queryset = queryset.filter(status__iexact=status_filter)
            else:
                # Filter by this user's assignment status
                queryset = queryset.filter(
                    Q(assignments__user=request.user, assignments__status__iexact=status_filter) |
                    (Q(assigned_to=request.user) & ~Q(assignments__user=request.user) & Q(status__iexact=status_filter))
                )

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
                Q(future_discussion__icontains=search_term) |
                Q(assignments__user__username__icontains=search_term) |
                Q(assignments__user__first_name__icontains=search_term) |
                Q(assignments__user__last_name__icontains=search_term)
            ).distinct()

        queryset = queryset.select_related('lead', 'assigned_to').prefetch_related('assignments__user', 'activities__user').order_by('-id')

        # Dynamic counts
        if is_admin:
            base_counts_qs = LeadTask.objects.filter(is_deleted=False)
            pending_count = base_counts_qs.filter(status=LeadTask.STATUS_PENDING).count()
            completed_count = base_counts_qs.filter(status=LeadTask.STATUS_COMPLETED).count()
        else:
            # Counts based on user's assignments
            user_assignments_qs = TaskAssignment.objects.filter(user=request.user, task__is_deleted=False)
            pending_count = user_assignments_qs.filter(status=TaskAssignment.STATUS_PENDING).count()
            completed_count = user_assignments_qs.filter(status=TaskAssignment.STATUS_COMPLETED).count()

        tasks_data = [_serialize_task(task, current_user=request.user) for task in queryset]

        return Response({
            'tasks': tasks_data,
            'counts': {
                'all': pending_count + completed_count,
                'pending': pending_count,
                'completed': completed_count,
            }
        })

    elif request.method == 'POST':
        # Create a new task with multi-user assignment
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

        # Parse assigned user IDs (support multi-user assignment)
        raw_assigned_ids = data.get('assigned_to_ids')
        target_user_ids = []

        if raw_assigned_ids is not None:
            if isinstance(raw_assigned_ids, (list, tuple)):
                target_user_ids = [int(uid) for uid in raw_assigned_ids if uid]
            elif isinstance(raw_assigned_ids, str):
                target_user_ids = [int(uid.strip()) for uid in raw_assigned_ids.split(',') if uid.strip().isdigit()]
            elif isinstance(raw_assigned_ids, (int, float)):
                target_user_ids = [int(raw_assigned_ids)]
        elif data.get('assigned_to_id'):
            try:
                target_user_ids = [int(data.get('assigned_to_id'))]
            except (ValueError, TypeError):
                pass

        # If no users specified, default to lead's assignees or current user
        if not target_user_ids:
            lead_assignees = list(lead.assignments.values_list('user_id', flat=True))
            if lead_assignees:
                target_user_ids = lead_assignees
            elif lead.assigned_to_id:
                target_user_ids = [lead.assigned_to_id]
            else:
                target_user_ids = [request.user.id]

        # Regular non-admin users can only assign to themselves unless authorized
        if not is_admin:
            target_user_ids = [request.user.id]

        target_users = list(User.objects.filter(id__in=target_user_ids))
        if not target_users:
            target_users = [request.user]

        # Dates
        assigned_date_str = data.get('assigned_date')
        assigned_date = timezone.now().date()
        if assigned_date_str:
            try:
                assigned_date = datetime.strptime(str(assigned_date_str)[:10], '%Y-%m-%d').date()
            except ValueError:
                pass

        next_followup_date = None
        next_followup_str = data.get('next_followup_date')
        if next_followup_str:
            try:
                next_followup_date = datetime.strptime(str(next_followup_str)[:10], '%Y-%m-%d').date()
            except ValueError:
                pass

        future_discussion = (data.get('future_discussion') or '').strip()
        description = (data.get('description') or '').strip() or (lead.notes or f"Follow up with {lead.company_name or 'Lead'}")

        # Create the parent task
        task = LeadTask.objects.create(
            lead=lead,
            assigned_to=target_users[0],
            description=description,
            assigned_date=assigned_date,
            next_followup_date=next_followup_date,
            future_discussion=future_discussion,
            status=LeadTask.STATUS_PENDING
        )

        # Create TaskAssignment for each assigned user
        assigned_names = []
        for user in target_users:
            TaskAssignment.objects.get_or_create(
                task=task,
                user=user,
                defaults={
                    'assigned_by': request.user,
                    'assigned_at': timezone.now(),
                    'status': TaskAssignment.STATUS_PENDING,
                    'next_followup_date': next_followup_date,
                    'future_discussion': future_discussion
                }
            )
            u_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
            assigned_names.append(u_name)

        # Record activity: Task Created
        TaskActivity.objects.create(
            task=task,
            user=request.user,
            activity_type=TaskActivity.ACTIVITY_TASK_CREATED,
            description=f"Task created and assigned to: {', '.join(assigned_names)}."
        )

        # Also sync to Lead assignments if needed
        for user in target_users:
            from .models import LeadAssignment
            LeadAssignment.objects.get_or_create(lead=lead, user=user, defaults={'assigned_by': request.user})

        return Response({
            'message': f"Task created and assigned to {len(target_users)} user(s) successfully.",
            'task': _serialize_task(task, current_user=request.user, include_history=True)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail_api(request, task_id):
    """
    Retrieve, update or delete a task.
    Supports updating multiple user assignments and task details.
    """
    is_admin = _is_admin_user(request.user)
    try:
        task = LeadTask.objects.select_related('lead', 'assigned_to').prefetch_related('assignments__user', 'activities__user').get(id=task_id, is_deleted=False)
        if not is_admin and not (task.assigned_to == request.user or task.assignments.filter(user=request.user).exists()):
            return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'task': _serialize_task(task, current_user=request.user, include_history=True)})

    elif request.method == 'PATCH':
        data = request.data
        changes = []

        if 'description' in data:
            task.description = data['description']
            changes.append("Updated description")

        if 'future_discussion' in data:
            task.future_discussion = data['future_discussion']
            changes.append("Updated future discussion agenda")

        if 'assigned_date' in data:
            val = data['assigned_date']
            if val:
                try:
                    task.assigned_date = datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
                except ValueError:
                    pass

        old_task_followup = task.next_followup_date
        followup_date_submitted = 'next_followup_date' in data
        if followup_date_submitted:
            val = data['next_followup_date']
            if val:
                try:
                    task.next_followup_date = datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
                except ValueError:
                    pass
            else:
                task.next_followup_date = None

        # Multi-user assignments update (Admin only)
        if is_admin and ('assigned_to_ids' in data or 'assigned_to_id' in data):
            raw_assigned_ids = data.get('assigned_to_ids')
            target_user_ids = []
            if raw_assigned_ids is not None:
                if isinstance(raw_assigned_ids, (list, tuple)):
                    target_user_ids = [int(uid) for uid in raw_assigned_ids if uid]
                elif isinstance(raw_assigned_ids, str):
                    target_user_ids = [int(uid.strip()) for uid in raw_assigned_ids.split(',') if uid.strip().isdigit()]
                elif isinstance(raw_assigned_ids, (int, float)):
                    target_user_ids = [int(raw_assigned_ids)]
            elif data.get('assigned_to_id'):
                try:
                    target_user_ids = [int(data.get('assigned_to_id'))]
                except (ValueError, TypeError):
                    pass

            if target_user_ids:
                current_assigned_ids = set(task.assignments.values_list('user_id', flat=True))
                new_assigned_ids = set(target_user_ids)

                to_add = new_assigned_ids - current_assigned_ids
                to_remove = current_assigned_ids - new_assigned_ids

                # Add new users
                for uid in to_add:
                    try:
                        u = User.objects.get(id=uid)
                        TaskAssignment.objects.create(
                            task=task,
                            user=u,
                            assigned_by=request.user,
                            status=TaskAssignment.STATUS_PENDING,
                            next_followup_date=task.next_followup_date,
                            future_discussion=task.future_discussion
                        )
                        u_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
                        TaskActivity.objects.create(
                            task=task,
                            user=request.user,
                            activity_type=TaskActivity.ACTIVITY_USER_ASSIGNED,
                            description=f"Assigned user: {u_name}."
                        )
                    except User.DoesNotExist:
                        pass

                # Remove users
                for uid in to_remove:
                    try:
                        u = User.objects.get(id=uid)
                        u_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
                        TaskAssignment.objects.filter(task=task, user_id=uid).delete()
                        FollowupNotification.objects.filter(task=task, user_id=uid, is_cleared=False).delete()
                        TaskActivity.objects.create(
                            task=task,
                            user=request.user,
                            activity_type=TaskActivity.ACTIVITY_USER_REMOVED,
                            description=f"Removed user from task: {u_name}."
                        )
                    except User.DoesNotExist:
                        pass

                # Update primary assigned_to
                if target_user_ids:
                    task.assigned_to_id = target_user_ids[0]

        task.save()
        if followup_date_submitted and task.next_followup_date != old_task_followup:
            for a in task.assignments.filter(status=TaskAssignment.STATUS_PENDING):
                a.next_followup_date = task.next_followup_date
                if 'future_discussion' in data:
                    a.future_discussion = task.future_discussion
                a.save()

        return Response({
            'message': 'Task updated successfully.',
            'task': _serialize_task(task, current_user=request.user, include_history=True)
        })

    elif request.method == 'DELETE':
        task.is_deleted = True
        task.save()
        now = timezone.now()
        FollowupNotification.objects.filter(task=task, is_cleared=False).update(
            is_read=True,
            is_cleared=True,
            read_at=now,
            cleared_at=now,
        )
        return Response({'message': 'Task deleted successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_status_toggle_api(request, task_id):
    """
    Toggle task status between Pending and Completed.
    Maintains individual user task status so one user's completion
    does not mark the task completed for other assigned users!
    """
    is_admin = _is_admin_user(request.user)
    try:
        task = LeadTask.objects.prefetch_related('assignments__user').get(id=task_id, is_deleted=False)
        if not is_admin and not (task.assigned_to == request.user or task.assignments.filter(user=request.user).exists()):
            return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    # Determine target user whose status is being toggled
    target_user = request.user
    if is_admin and request.data.get('user_id'):
        try:
            target_user = User.objects.get(id=int(request.data.get('user_id')))
        except (User.DoesNotExist, ValueError, TypeError):
            target_user = request.user

    assignment, _ = TaskAssignment.objects.get_or_create(
        task=task,
        user=target_user,
        defaults={
            'assigned_by': request.user,
            'status': TaskAssignment.STATUS_PENDING
        }
    )

    old_status = assignment.status
    target_status = request.data.get('status')
    if not target_status:
        target_status = TaskAssignment.STATUS_COMPLETED if old_status == TaskAssignment.STATUS_PENDING else TaskAssignment.STATUS_PENDING

    if target_status not in [TaskAssignment.STATUS_PENDING, TaskAssignment.STATUS_COMPLETED]:
        return Response({'error': "Invalid status. Must be 'Pending' or 'Completed'."}, status=status.HTTP_400_BAD_REQUEST)

    assignment.status = target_status
    if target_status == TaskAssignment.STATUS_COMPLETED:
        assignment.completed_at = timezone.now()
    else:
        assignment.completed_at = None
    assignment.save()

    # Record activity in shared history
    user_name = f"{target_user.first_name or ''} {target_user.last_name or ''}".strip() or target_user.username
    actor_name = f"{request.user.first_name or ''} {request.user.last_name or ''}".strip() or request.user.username
    desc = f"{user_name} marked status as {target_status}."
    if actor_name != user_name:
        desc += f" (Updated by {actor_name})"

    TaskActivity.objects.create(
        task=task,
        user=request.user,
        activity_type=TaskActivity.ACTIVITY_STATUS_CHANGE,
        old_status=old_status,
        new_status=target_status,
        description=desc
    )

    # Update overall task status:
    # If all assigned users are completed, task is Completed; otherwise Pending
    all_assignments = task.assignments.all()
    if all_assignments.exists() and all(a.status == TaskAssignment.STATUS_COMPLETED for a in all_assignments):
        task.status = LeadTask.STATUS_COMPLETED
        task.completed_at = timezone.now()
    else:
        task.status = LeadTask.STATUS_PENDING
        task.completed_at = None
    task.save()

    if target_status == TaskAssignment.STATUS_COMPLETED:
        now = timezone.now()
        FollowupNotification.objects.filter(
            task=task,
            user=target_user,
            is_cleared=False,
        ).update(is_read=True, is_cleared=True, read_at=now, cleared_at=now)
        if task.status == LeadTask.STATUS_COMPLETED:
            FollowupNotification.objects.filter(
                task=task,
                is_cleared=False,
            ).update(is_read=True, is_cleared=True, read_at=now, cleared_at=now)

    return Response({
        'message': f'Status updated to {target_status} for {user_name}.',
        'task': _serialize_task(task, current_user=request.user, include_history=True)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_record_call_api(request, task_id):
    """
    Record a new interaction (Call, WhatsApp, Email, Comment) and update next follow-up.
    Preserves all previous activity history and shares with all assigned users.
    """
    is_admin = _is_admin_user(request.user)
    try:
        task = LeadTask.objects.select_related('lead').get(id=task_id, is_deleted=False)
        if not is_admin and not (task.assigned_to == request.user or task.assignments.filter(user=request.user).exists()):
            return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
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
    elif 'comment' in type_lower or 'note' in type_lower:
        interaction_type = TaskActivity.ACTIVITY_COMMENT
    else:
        interaction_type = TaskCallHistory.INTERACTION_CALL

    discussion = (data.get('communication_notes') or data.get('discussion') or data.get('description') or '').strip()
    if not discussion:
        return Response({'error': 'Communication notes / description are required.'}, status=status.HTTP_400_BAD_REQUEST)

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

    # Record TaskCallHistory (for backward compatibility with mobile apps)
    if interaction_type in [TaskCallHistory.INTERACTION_CALL, TaskCallHistory.INTERACTION_WHATSAPP, TaskCallHistory.INTERACTION_EMAIL]:
        TaskCallHistory.objects.create(
            task=task,
            lead=task.lead,
            user=request.user,
            interaction_type=interaction_type,
            call_date=call_date,
            discussion=discussion,
            next_followup_date=next_followup_date,
            future_discussion=future_discussion
        )

    # Record TaskActivity in shared chronological activity log
    TaskActivity.objects.create(
        task=task,
        user=request.user,
        activity_type=interaction_type,
        description=discussion,
        next_followup_date=next_followup_date,
        next_followup_notes=future_discussion
    )

    # Update this user's TaskAssignment
    assignment, _ = TaskAssignment.objects.get_or_create(
        task=task,
        user=request.user,
        defaults={'assigned_by': request.user, 'status': TaskAssignment.STATUS_PENDING}
    )
    if next_followup_date:
        assignment.next_followup_date = next_followup_date
    if future_discussion:
        assignment.future_discussion = future_discussion
    assignment.save()

    # Update parent task with latest follow-up
    if next_followup_date:
        task.next_followup_date = next_followup_date
    if future_discussion:
        task.future_discussion = future_discussion
    task.save()

    return Response({
        'message': f'{interaction_type} interaction recorded and shared successfully.',
        'task': _serialize_task(task, current_user=request.user, include_history=True)
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def task_activities_api(request, task_id):
    """
    GET: Returns complete chronological activity history for all users assigned to the task.
    POST: Allows any assigned user or admin to add a comment or interaction.
    """
    is_admin = _is_admin_user(request.user)
    try:
        task = LeadTask.objects.select_related('lead').get(id=task_id, is_deleted=False)
        if not is_admin and not (task.assigned_to == request.user or task.assignments.filter(user=request.user).exists()):
            return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
    except LeadTask.DoesNotExist:
        return Response({'error': 'Task not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        records = task.activities.select_related('user').all().order_by('-created_at', '-id')
        history_list = []
        for a in records:
            u_display = f"{a.user.first_name or ''} {a.user.last_name or ''}".strip() or a.user.username if a.user else ''
            history_list.append({
                'id': a.id,
                'task_id': task.id,
                'activity_type': a.activity_type,
                'interaction_type': a.activity_type,
                'user_id': a.user_id,
                'user_name': u_display,
                'description': a.description,
                'communication_notes': a.description,
                'next_followup_date': a.next_followup_date.isoformat() if a.next_followup_date else None,
                'next_followup_notes': a.next_followup_notes,
                'old_status': a.old_status,
                'new_status': a.new_status,
                'created_at': a.created_at.isoformat() if a.created_at else None,
                'interaction_date': a.created_at.date().isoformat() if a.created_at else None,
                'call_date': a.created_at.date().isoformat() if a.created_at else None,
                'formatted_time': a.created_at.strftime('%d %b %Y, %I:%M %p') if a.created_at else '',
            })
        return Response({
            'task_id': task.id,
            'lead_id': task.lead_id,
            'count': len(history_list),
            'activities': history_list,
            'history': history_list
        })

    elif request.method == 'POST':
        data = request.data
        activity_type = data.get('activity_type', TaskActivity.ACTIVITY_COMMENT) or TaskActivity.ACTIVITY_COMMENT
        description = (data.get('description') or data.get('communication_notes') or data.get('discussion') or '').strip()
        if not description:
            return Response({'error': 'Description / notes are required.'}, status=status.HTTP_400_BAD_REQUEST)

        next_followup_date = None
        next_followup_str = data.get('next_followup_date')
        if next_followup_str:
            try:
                next_followup_date = datetime.strptime(str(next_followup_str)[:10], '%Y-%m-%d').date()
            except ValueError:
                pass

        next_followup_notes = (data.get('next_followup_notes') or data.get('future_discussion') or '').strip()

        act = TaskActivity.objects.create(
            task=task,
            user=request.user,
            activity_type=activity_type,
            description=description,
            next_followup_date=next_followup_date,
            next_followup_notes=next_followup_notes
        )

        # Update assignment follow-up (use .save() so reminder_date recalculates cleanly)
        if next_followup_date:
            assignment, _ = TaskAssignment.objects.get_or_create(
                task=task,
                user=request.user,
                defaults={'assigned_by': request.user, 'status': TaskAssignment.STATUS_PENDING},
            )
            assignment.next_followup_date = next_followup_date
            if next_followup_notes:
                assignment.future_discussion = next_followup_notes
            assignment.save()
            task.next_followup_date = next_followup_date
            if next_followup_notes:
                task.future_discussion = next_followup_notes
            task.save()

        return Response({
            'message': 'Activity recorded successfully.',
            'activity_id': act.id,
            'task': _serialize_task(task, current_user=request.user, include_history=True)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_communication_history_api(request, task_id):
    """
    GET /api/tasks/{id}/history/
    Returns complete chronological activity history across all assigned users.
    """
    return task_activities_api(request, task_id)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_available_leads_api(request):
    """
    Return leads assigned to the user (or all leads for Admin) that do not have an active pending task,
    allowing creation of a task.
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
        task_filter['assignments__user'] = request.user
    existing_task_lead_ids = set(LeadTask.objects.filter(**task_filter).values_list('lead_id', flat=True))

    available = []
    for lead in assigned_leads.exclude(id__in=existing_task_lead_ids).order_by('company_name')[:150]:
        display_name = lead.company_name or f"{lead.first_name} {lead.last_name}".strip() or f"Lead #{lead.id}"
        # Include current lead assignees
        lead_assignees = [
            {'id': a.user_id, 'name': f"{a.user.first_name or ''} {a.user.last_name or ''}".strip() or a.user.username}
            for a in lead.assignments.select_related('user').all()
        ]
        available.append({
            'id': lead.id,
            'company_name': lead.company_name or '',
            'contact_person': f"{lead.first_name} {lead.last_name}".strip(),
            'phone': lead.phone or lead.mobile or '',
            'email': lead.email or '',
            'city': lead.city or '',
            'display_name': display_name,
            'assigned_users': lead_assignees
        })

    return Response({'available_leads': available})


def _sync_followup_notifications_for_user(user, today=None):
    """
    Synchronizes persisted per-user FollowupNotification rows for `user`:
    - Triggers 1 day before scheduled follow-up date (reminder_date <= today).
    - Enforces per-(task, user, followup_date) uniqueness (no duplicates).
    - Keeps cleared/read status persisted across refreshes, logins, and subsequent days
      until the follow-up date is changed to a new date.
    - Clears stale unread notifications if the follow-up date changed or task was completed.
    """
    if today is None:
        today = timezone.now().date()
    now = timezone.now()
    is_admin = _is_admin_user(user)
    eligible_map = {}

    if is_admin:
        pending_tasks = (
            LeadTask.objects.filter(is_deleted=False)
            .select_related('lead', 'assigned_to')
        )
        user_assignments = {
            a.task_id: a
            for a in TaskAssignment.objects.filter(user=user, task__is_deleted=False)
        }
        for task in pending_tasks:
            ua = user_assignments.get(task.id)
            if ua:
                if ua.status != TaskAssignment.STATUS_PENDING:
                    continue
                eff_followup = ua.next_followup_date or task.next_followup_date
                eff_discussion = ua.future_discussion or task.future_discussion or task.description or ''
            else:
                if task.status != LeadTask.STATUS_PENDING:
                    continue
                eff_followup = task.next_followup_date
                eff_discussion = task.future_discussion or task.description or ''

            if eff_followup:
                eff_reminder = eff_followup - timedelta(days=1)
                eligible_map[task.id] = (task, eff_followup, eff_reminder, eff_discussion)
    else:
        user_assignments = (
            TaskAssignment.objects.filter(user=user, task__is_deleted=False)
            .select_related('task', 'task__lead')
        )
        seen_task_ids = set()
        for ua in user_assignments:
            seen_task_ids.add(ua.task_id)
            if ua.status != TaskAssignment.STATUS_PENDING:
                continue
            task = ua.task
            eff_followup = ua.next_followup_date or task.next_followup_date
            if eff_followup:
                eff_reminder = eff_followup - timedelta(days=1)
                eff_discussion = ua.future_discussion or task.future_discussion or task.description or ''
                eligible_map[task.id] = (task, eff_followup, eff_reminder, eff_discussion)

        legacy_tasks = (
            LeadTask.objects.filter(assigned_to=user, is_deleted=False, status=LeadTask.STATUS_PENDING)
            .exclude(id__in=seen_task_ids)
            .select_related('lead')
        )
        for task in legacy_tasks:
            if task.next_followup_date:
                eff_reminder = task.next_followup_date - timedelta(days=1)
                eff_discussion = task.future_discussion or task.description or ''
                eligible_map[task.id] = (task, task.next_followup_date, eff_reminder, eff_discussion)

    # Auto-clear any stale unread notifications if task completed/deleted or follow-up date changed
    open_notifications = FollowupNotification.objects.filter(user=user, is_cleared=False)
    stale_ids = []
    for notif in open_notifications:
        target = eligible_map.get(notif.task_id)
        if not target or target[1] != notif.followup_date:
            stale_ids.append(notif.id)
    if stale_ids:
        FollowupNotification.objects.filter(id__in=stale_ids).update(
            is_read=True,
            is_cleared=True,
            read_at=now,
            cleared_at=now,
        )

    # Create notification (at most once) when 1 day before follow-up date is reached (reminder_date <= today)
    active_pairs = []
    for task_id, (task, eff_followup, eff_reminder, eff_discussion) in eligible_map.items():
        if eff_reminder <= today:
            active_pairs.append((task_id, eff_followup))
            try:
                notif, created = FollowupNotification.objects.get_or_create(
                    task=task,
                    user=user,
                    followup_date=eff_followup,
                    defaults={
                        'reminder_date': eff_reminder,
                        'future_discussion': eff_discussion,
                        'is_read': False,
                        'is_cleared': False,
                    },
                )
                if not created and not notif.is_cleared:
                    fields_to_update = []
                    if notif.reminder_date != eff_reminder:
                        notif.reminder_date = eff_reminder
                        fields_to_update.append('reminder_date')
                    if eff_discussion and notif.future_discussion != eff_discussion:
                        notif.future_discussion = eff_discussion
                        fields_to_update.append('future_discussion')
                    if fields_to_update:
                        notif.save(update_fields=fields_to_update + ['updated_at'])
            except IntegrityError:
                pass

    if not active_pairs:
        return []

    pair_q = Q()
    for tid, fdate in active_pairs:
        pair_q |= Q(task_id=tid, followup_date=fdate)

    return list(
        FollowupNotification.objects.filter(user=user, is_cleared=False, is_read=False)
        .filter(pair_q)
        .select_related('task', 'task__lead')
        .order_by('followup_date', 'id')
    )


def _serialize_followup_notifications(notification_objs, today=None):
    if today is None:
        today = timezone.now().date()
    notifications = []
    for notif in notification_objs:
        task = notif.task
        lead = task.lead if task else None
        company_name = lead.company_name if lead else ''
        contact_person = f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else ''
        phone = (lead.phone or lead.mobile) if lead else ''

        is_due_today = notif.followup_date == today if notif.followup_date else False
        is_overdue = notif.followup_date < today if notif.followup_date else False

        notifications.append({
            'id': notif.id,
            'task_id': notif.task_id,
            'lead_id': lead.id if lead else None,
            'company_name': company_name or f"Lead #{task.lead_id}",
            'contact_person': contact_person,
            'phone': phone,
            'email': lead.email if lead else '',
            'next_followup_date': notif.followup_date.isoformat() if notif.followup_date else None,
            'reminder_date': notif.reminder_date.isoformat() if notif.reminder_date else None,
            'future_discussion': notif.future_discussion or task.future_discussion or task.description or '',
            'is_due_today': is_due_today,
            'is_overdue': is_overdue,
            'is_read': notif.is_read,
            'is_cleared': notif.is_cleared,
        })
    return notifications


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_notifications_api(request):
    """
    Header Notification Reminders:
    Returns persisted unread/uncleared follow-up notifications for the authenticated user
    where reminder_date <= today (1 day prior to scheduled follow-up date).
    """
    today = timezone.now().date()
    active_notifs = _sync_followup_notifications_for_user(request.user, today=today)
    notifications = _serialize_followup_notifications(active_notifs, today=today)

    return Response({
        'count': len(notifications),
        'notifications': notifications,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_notification_mark_read_api(request, notification_id=None):
    """
    Marks one (or task-matching) follow-up notification as Read and Cleared in the database
    for the authenticated user only.
    """
    notif_id = notification_id or request.data.get('notification_id')
    task_id = request.data.get('task_id')

    if not notif_id and not task_id:
        return Response(
            {'error': 'notification_id or task_id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    qs = FollowupNotification.objects.filter(user=request.user, is_cleared=False)
    if notif_id and task_id:
        try:
            qs = qs.filter(Q(id=int(notif_id)) | Q(task_id=int(task_id)))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid notification_id or task_id.'}, status=status.HTTP_400_BAD_REQUEST)
    elif notif_id:
        try:
            qs = qs.filter(id=int(notif_id))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid notification_id.'}, status=status.HTTP_400_BAD_REQUEST)
    elif task_id:
        try:
            qs = qs.filter(task_id=int(task_id))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid task_id.'}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    cleared_count = qs.update(
        is_read=True,
        is_cleared=True,
        read_at=now,
        cleared_at=now,
    )

    today = timezone.now().date()
    remaining_notifs = _sync_followup_notifications_for_user(request.user, today=today)
    serialized = _serialize_followup_notifications(remaining_notifs, today=today)

    return Response({
        'message': 'Notification marked as read and cleared.',
        'cleared_count': cleared_count,
        'count': len(serialized),
        'notifications': serialized,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_assignable_users_api(request):
    """
    Returns the list of active users available for task assignment.
    """
    users = User.objects.filter(is_active=True).order_by('username')
    data = []
    for u in users:
        full_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
        data.append({
            'id': u.id,
            'username': u.username,
            'name': full_name,
            'role': getattr(u, 'role', '') or '',
            'email': getattr(u, 'email', '') or '',
        })
    return Response({'users': data})
