import re
import logging

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Lead, Segment

logger = logging.getLogger(__name__)


def _is_segment_admin(user):
    """
    Segment Creation/Modification Permission:
    ONLY users whose role is 'Admin' or 'Super Admin' (case-insensitive)
    are permitted to create, edit, or delete segments.
    Tech Admin, User, Staff, and all other roles are strictly denied.
    """
    if not user or not getattr(user, 'is_authenticated', False) or not getattr(user, 'is_active', True):
        return False
    raw_role = (getattr(user, 'role', '') or '').strip().lower()
    normalized = re.sub(r'[\s_-]+', '', raw_role)
    return normalized in ('admin', 'superadmin')


def _format_user_display(user):
    if not user:
        return ''
    full_name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return full_name or getattr(user, 'username', '') or ''


def _serialize_segment(segment, lead_counts_map=None):
    key = (segment.name or '').strip().lower()
    lead_count = (lead_counts_map or {}).get(key, 0)
    return {
        'id': segment.id,
        'name': segment.name,
        'description': segment.description or '',
        'is_active': segment.is_active,
        'lead_count': lead_count,
        'created_by': segment.created_by_id,
        'created_by_name': _format_user_display(segment.created_by),
        'updated_by': segment.updated_by_id,
        'updated_by_name': _format_user_display(segment.updated_by),
        'created_at': segment.created_at.isoformat() if segment.created_at else None,
        'updated_at': segment.updated_at.isoformat() if segment.updated_at else None,
    }


def _get_lead_counts_by_segment():
    counts_map = {}
    rows = (
        Lead.objects.exclude(segment='')
        .exclude(segment__isnull=True)
        .values('segment')
        .annotate(count=Count('id'))
    )
    for row in rows:
        seg_name = (row.get('segment') or '').strip().lower()
        if seg_name:
            counts_map[seg_name] = counts_map.get(seg_name, 0) + row['count']
    return counts_map


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def segments_list_create_api(request):
    """
    GET  /api/segments/  -> All authenticated users can list/view segments.
    POST /api/segments/  -> Strictly ONLY Admin and Super Admin roles can create a segment.
    """
    if request.method == 'GET':
        qs = Segment.objects.select_related('created_by', 'updated_by').all()

        active_only = str(request.GET.get('active_only', '')).strip().lower()
        if active_only in ('1', 'true', 'yes'):
            qs = qs.filter(is_active=True)

        search = (request.GET.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        qs = qs.order_by('name', '-id')
        counts_map = _get_lead_counts_by_segment()
        serialized = [_serialize_segment(seg, counts_map) for seg in qs]

        return Response({
            'segments': serialized,
            'total': len(serialized),
            'can_manage': _is_segment_admin(request.user),
        })

    # POST: Strict Admin-only enforcement
    if not _is_segment_admin(request.user):
        return Response(
            {'error': 'Permission denied. Only Admin and Super Admin can create, edit, or delete segments.'},
            status=status.HTTP_403_FORBIDDEN
        )

    raw_name = request.data.get('name')
    raw_desc = request.data.get('description')
    name = (str(raw_name) if raw_name is not None else '').strip()
    description = (str(raw_desc) if raw_desc is not None else '').strip()
    is_active = request.data.get('is_active', True)
    if isinstance(is_active, str):
        is_active = is_active.strip().lower() not in ('false', '0', 'no')
    else:
        is_active = bool(is_active)

    if not name:
        return Response({'error': 'Segment name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(name) > 255:
        return Response({'error': 'Segment name cannot exceed 255 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        existing_qs = Segment.objects.select_for_update().filter(name__iexact=name)
        if existing_qs.filter(is_active=True).exists():
            return Response(
                {'error': f'Segment "{name}" already exists and is Active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Preserve existing inactive record(s) untouched; new segment is created as Active
        if existing_qs.filter(is_active=False).exists():
            is_active = True

        segment = Segment.objects.create(
            name=name,
            description=description,
            is_active=is_active,
            created_by=request.user,
            updated_by=request.user,
        )
    counts_map = _get_lead_counts_by_segment()
    return Response({
        'message': 'Segment created successfully.',
        'segment': _serialize_segment(segment, counts_map),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def segment_detail_api(request, segment_id):
    """
    GET           /api/segments/<id>/ -> All authenticated users can view segment details.
    PUT / PATCH   /api/segments/<id>/ -> Strictly ONLY Admin and Super Admin roles can edit a segment.
    DELETE        /api/segments/<id>/ -> Strictly ONLY Admin and Super Admin roles can delete a segment.
    """
    segment = Segment.objects.select_related('created_by', 'updated_by').filter(id=segment_id).first()
    if not segment:
        return Response({'error': 'Segment not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        counts_map = _get_lead_counts_by_segment()
        return Response({
            'segment': _serialize_segment(segment, counts_map),
            'can_manage': _is_segment_admin(request.user),
        })

    # PUT / PATCH / DELETE: Strict Admin-only enforcement
    if not _is_segment_admin(request.user):
        return Response(
            {'error': 'Permission denied. Only Admin and Super Admin can create, edit, or delete segments.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'DELETE':
        deleted_name = segment.name
        segment.delete()
        return Response({
            'message': f'Segment "{deleted_name}" deleted successfully.',
            'deleted_id': segment_id,
        })

    # PUT / PATCH
    old_name = segment.name
    if 'name' in request.data:
        raw_new_name = request.data.get('name')
        new_name = (str(raw_new_name) if raw_new_name is not None else '').strip()
    else:
        new_name = old_name

    if not new_name:
        return Response({'error': 'Segment name cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_name) > 255:
        return Response({'error': 'Segment name cannot exceed 255 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    target_is_active = segment.is_active
    if 'is_active' in request.data:
        raw_active = request.data.get('is_active')
        if isinstance(raw_active, str):
            target_is_active = raw_active.strip().lower() not in ('false', '0', 'no')
        else:
            target_is_active = bool(raw_active)

    with transaction.atomic():
        if target_is_active and Segment.objects.select_for_update().filter(name__iexact=new_name, is_active=True).exclude(id=segment.id).exists():
            return Response(
                {'error': f'An active segment named "{new_name}" already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        segment.name = new_name
        if 'description' in request.data:
            raw_desc = request.data.get('description')
            segment.description = (str(raw_desc) if raw_desc is not None else '').strip()
        segment.is_active = target_is_active
        segment.updated_by = request.user
        segment.save()

        if old_name != new_name:
            Lead.objects.filter(segment__iexact=old_name).update(segment=new_name)

    counts_map = _get_lead_counts_by_segment()
    return Response({
        'message': 'Segment updated successfully.',
        'segment': _serialize_segment(segment, counts_map),
    })
