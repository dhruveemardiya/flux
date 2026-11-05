"""
Authentication & Session Management APIs for Mobile App & Web Clients
Endpoints:
- POST /api/auth/token/         (Obtain JWT Access & Refresh Token Pair)
- POST /api/auth/token/refresh/ (Renew Expired Access Token)
- GET  /api/auth/me/            (Get Authenticated User Profile & RBAC Permissions)
- POST /api/auth/logout/        (Revoke Session & Blacklist Refresh Token)
"""

import base64
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .jwt_auth import (
    generate_tokens_for_user,
    decode_jwt,
    encode_jwt,
    blacklist_refresh_token,
)
from .models import Role, Permission, PermissionAssignment

User = get_user_model()


def _get_user_permissions_list(user):
    """
    Computes effective permission strings for the user based on role and overrides.
    """
    if not user:
        return []

    role_str = (getattr(user, 'role', '') or '').strip().lower()
    if role_str in ['techadmin', 'superadmin'] or getattr(user, 'is_superuser', False):
        return ['*']  # Full system permissions

    permissions = set()

    # 1. Role-based permissions
    if user.role:
        role_perms = Permission.objects.filter(
            permissionassignment__role__role__iexact=user.role,
            permissionassignment__user__isnull=True,
            permissionassignment__allow=True
        ).values_list('code', flat=True)
        permissions.update(p for p in role_perms if p)

    # 2. User-specific permission overrides
    user_overrides = PermissionAssignment.objects.filter(user=user).select_related('permission')
    for pa in user_overrides:
        if pa.permission and pa.permission.code:
            if pa.allow:
                permissions.add(pa.permission.code)
            else:
                permissions.discard(pa.permission.code)

    return sorted(list(permissions))


def _serialize_user_profile(user):
    """
    Standard serialized profile dictionary for mobile integration.
    """
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    companies = []
    try:
        companies = list(user.companies.values('id', 'name', 'location'))
    except Exception:
        pass

    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'full_name': full_name,
        'email': user.email or '',
        'role': user.role or '',
        'is_staff': getattr(user, 'is_staff', False),
        'is_superuser': getattr(user, 'is_superuser', False),
        'companies': companies,
        'company_ids': [c['id'] for c in companies],
        'permissions': _get_user_permissions_list(user),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_token_obtain_api(request):
    """
    Authenticates user credentials and returns JWT access and refresh token pair.
    Supports JSON body: {"username": "...", "password": "..."}
    Also supports HTTP Basic Auth for backwards compatibility.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    # Basic Auth fallback if JSON body is empty
    if not username or not password:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Basic '):
            try:
                encoded = auth_header.split(' ')[1]
                decoded = base64.b64decode(encoded).decode('utf-8')
                username, password = decoded.split(':', 1)
            except Exception:
                pass

    if not username or not password:
        return Response(
            {'error': 'Both username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username.strip(), password=password)

    if not user:
        # Check if user exists to provide helpful error
        if User.objects.filter(username=username.strip()).exists():
            return Response(
                {'error': 'Incorrect password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        return Response(
            {'error': 'User not found.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not getattr(user, 'is_active', True):
        return Response(
            {'error': 'User account has been disabled.'},
            status=status.HTTP_403_FORBIDDEN
        )

    tokens = generate_tokens_for_user(user)
    user_profile = _serialize_user_profile(user)

    return Response({
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'token_type': tokens['token_type'],
        'expires_in': tokens['expires_in'],
        'user': user_profile,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_token_refresh_api(request):
    """
    Issues a new access token using a valid, non-blacklisted refresh token.
    Request body: {"refresh": "<refresh_token>"}
    """
    refresh_token = request.data.get('refresh', '').strip()

    if not refresh_token:
        return Response(
            {'error': 'Refresh token is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        payload = decode_jwt(refresh_token, verify_exp=True)
    except Exception as e:
        return Response(
            {'error': f'Invalid or expired refresh token: {str(e)}'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if payload.get('token_type') != 'refresh':
        return Response(
            {'error': 'Invalid token type. Expected refresh token.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user_id = payload.get('user_id')
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User belonging to this token no longer exists.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not getattr(user, 'is_active', True):
        return Response(
            {'error': 'User account is deactivated.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Generate new access token
    claims = {
        'user_id': user.id,
        'username': user.username,
        'role': getattr(user, 'role', '') or '',
    }
    new_access_token = encode_jwt(claims, token_type='access', exp_seconds=86400)

    return Response({
        'access': new_access_token,
        'token_type': 'Bearer',
        'expires_in': 86400,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_user_me_api(request):
    """
    Returns the authenticated user's profile, role, company memberships, and permissions.
    """
    profile = _serialize_user_profile(request.user)
    return Response(profile, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout_api(request):
    """
    Signs out the user, invalidates active sessions, and blacklists refresh token if provided.
    Request body (optional): {"refresh": "<refresh_token>"}
    """
    refresh_token = request.data.get('refresh', '').strip()
    if refresh_token:
        blacklist_refresh_token(refresh_token, user=request.user)

    # If DRF auth token exists, delete it as well
    try:
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
    except Exception:
        pass

    return Response({
        'message': 'Logged out successfully.'
    }, status=status.HTTP_200_OK)

