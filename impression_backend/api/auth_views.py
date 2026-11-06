"""
Authentication & Session Management APIs for Mobile App & Web Clients
Endpoints:
- POST /api/auth/token/         (Obtain JWT Access & Refresh Token Pair)
- POST /api/auth/token/refresh/ (Renew Expired Access Token)
- GET  /api/auth/me/            (Get Authenticated User Profile & RBAC Permissions)
- POST /api/auth/logout/        (Revoke Session & Blacklist Refresh Token)
"""

import base64
import logging
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

logger = logging.getLogger(__name__)
User = get_user_model()


def _get_user_permissions_list(user):
    """
    Computes effective permission strings for the user based on role and overrides.
    Fail-safe: never raises an exception.
    """
    if not user:
        return []

    try:
        role_str = (getattr(user, 'role', '') or '').strip().lower()
        if role_str in ['techadmin', 'superadmin'] or getattr(user, 'is_superuser', False):
            return ['*']  # Full system permissions

        permissions = set()

        # 1. Role-based permissions
        if getattr(user, 'role', None):
            try:
                role_pas = PermissionAssignment.objects.filter(
                    role__role__iexact=user.role,
                    user__isnull=True,
                    allow=True
                ).select_related('permission')
                for pa in role_pas:
                    if pa.permission and getattr(pa.permission, 'code', None):
                        permissions.add(pa.permission.code)
            except Exception as e:
                logger.warning("Could not fetch role permissions: %s", e)

        # 2. User-specific permission overrides
        try:
            user_overrides = PermissionAssignment.objects.filter(user=user).select_related('permission')
            for pa in user_overrides:
                if pa.permission and getattr(pa.permission, 'code', None):
                    if pa.allow:
                        permissions.add(pa.permission.code)
                    else:
                        permissions.discard(pa.permission.code)
        except Exception as e:
            logger.warning("Could not fetch user permission overrides: %s", e)

        return sorted(list(permissions))
    except Exception as exc:
        logger.warning("Error computing user permissions: %s", exc)
        return []


def _serialize_user_profile(user):
    """
    Standard serialized profile dictionary for mobile integration.
    Fail-safe: handles models without email or other optional attributes.
    """
    first_name = getattr(user, 'first_name', '') or ''
    last_name = getattr(user, 'last_name', '') or ''
    username = getattr(user, 'username', '') or ''
    full_name = f"{first_name} {last_name}".strip() or username

    companies = []
    try:
        if hasattr(user, 'companies'):
            companies = list(user.companies.values('id', 'name', 'location'))
    except Exception as e:
        logger.debug("Could not serialize user companies: %s", e)

    try:
        permissions = _get_user_permissions_list(user)
    except Exception:
        permissions = []

    return {
        'id': user.id,
        'username': username,
        'first_name': first_name,
        'last_name': last_name,
        'full_name': full_name,
        'email': getattr(user, 'email', '') or '',
        'role': getattr(user, 'role', '') or '',
        'is_staff': getattr(user, 'is_staff', False),
        'is_superuser': getattr(user, 'is_superuser', False),
        'companies': companies,
        'company_ids': [c['id'] for c in companies if isinstance(c, dict) and 'id' in c],
        'permissions': permissions,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_token_obtain_api(request):
    """
    Authenticates user credentials and returns JWT access and refresh token pair.
    Supports JSON body: {"username": "...", "password": "..."}
    Also supports HTTP Basic Auth for backwards compatibility.
    """
    try:
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

        username = str(username).strip()
        password = str(password)

        user = authenticate(username=username, password=password)

        if not user:
            # Case-insensitive check and helpful password validation
            existing = User.objects.filter(username__iexact=username).first()
            if existing:
                if existing.check_password(password):
                    user = existing
                else:
                    return Response(
                        {'error': 'Incorrect password.'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
            else:
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

    except Exception as exc:
        logger.exception("Login error in auth_token_obtain_api: %s", exc)
        return Response(
            {'error': f'Authentication failed: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_token_refresh_api(request):
    """
    Issues a new access token using a valid, non-blacklisted refresh token.
    Request body: {"refresh": "<refresh_token>"}
    """
    try:
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

    except Exception as exc:
        logger.exception("Error in auth_token_refresh_api: %s", exc)
        return Response(
            {'error': f'Token refresh failed: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_user_me_api(request):
    """
    Returns the authenticated user's profile, role, company memberships, and permissions.
    """
    try:
        profile = _serialize_user_profile(request.user)
        return Response(profile, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Error in auth_user_me_api: %s", exc)
        return Response(
            {'error': f'Failed to retrieve user profile: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout_api(request):
    """
    Signs out the user, invalidates active sessions, and blacklists refresh token if provided.
    Request body (optional): {"refresh": "<refresh_token>"}
    """
    try:
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
    except Exception as exc:
        logger.exception("Error in auth_logout_api: %s", exc)
        return Response(
            {'error': f'Logout failed: {str(exc)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
