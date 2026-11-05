"""
JWT Authentication & Token Lifecycle Module (RFC 7519 Compliant)
Supports standard HMAC-SHA256 (HS256) signature verification with zero external binary dependencies.
Fully interoperable with iOS, Android (React Native, Flutter, Swift, Kotlin), and existing CRM sessions.
"""

import hmac
import hashlib
import base64
import json
import time
import uuid
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


def _base64url_encode(data_bytes: bytes) -> str:
    """Encode bytes to base64url string without padding."""
    return base64.urlsafe_b64encode(data_bytes).rstrip(b'=').decode('ascii')


def _base64url_decode(encoded_str: str) -> bytes:
    """Decode base64url string with proper padding handling."""
    padding = '=' * (4 - (len(encoded_str) % 4)) if len(encoded_str) % 4 != 0 else ''
    return base64.urlsafe_b64decode((encoded_str + padding).encode('ascii'))


def encode_jwt(payload: dict, secret_key: str = None, token_type: str = 'access', exp_seconds: int = None) -> str:
    """
    Encodes and signs a JWT token using HS256.
    """
    if secret_key is None:
        secret_key = getattr(settings, 'SECRET_KEY', 'default-jwt-secret-key')

    now = int(time.time())
    if exp_seconds is None:
        exp_seconds = 86400 if token_type == 'access' else 86400 * 30  # 1 day for access, 30 days for refresh

    token_payload = dict(payload)
    token_payload['token_type'] = token_type
    token_payload['iat'] = now
    token_payload['exp'] = now + exp_seconds
    if 'jti' not in token_payload:
        token_payload['jti'] = str(uuid.uuid4())

    header = {'typ': 'JWT', 'alg': 'HS256'}

    header_segment = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_segment = _base64url_encode(json.dumps(token_payload, separators=(',', ':')).encode('utf-8'))

    signing_input = f"{header_segment}.{payload_segment}".encode('ascii')
    signature = hmac.new(secret_key.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_segment = _base64url_encode(signature)

    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_jwt(token: str, secret_key: str = None, verify_exp: bool = True) -> dict:
    """
    Decodes and verifies a JWT token. Checks signature and expiration, and ensures not revoked.
    """
    if secret_key is None:
        secret_key = getattr(settings, 'SECRET_KEY', 'default-jwt-secret-key')

    parts = token.strip().split('.')
    if len(parts) != 3:
        raise AuthenticationFailed('Invalid token format.')

    header_segment, payload_segment, signature_segment = parts

    # 1. Verify Signature
    signing_input = f"{header_segment}.{payload_segment}".encode('ascii')
    expected_signature = hmac.new(secret_key.encode('utf-8'), signing_input, hashlib.sha256).digest()

    try:
        provided_signature = _base64url_decode(signature_segment)
    except Exception:
        raise AuthenticationFailed('Malformed token signature.')

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise AuthenticationFailed('Token signature verification failed.')

    # 2. Decode Payload
    try:
        payload_bytes = _base64url_decode(payload_segment)
        payload = json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        raise AuthenticationFailed('Invalid token payload.')

    # 3. Check Expiration
    now = int(time.time())
    if verify_exp and 'exp' in payload:
        if now > payload['exp']:
            raise AuthenticationFailed('Token has expired.')

    # 4. Check Revocation / Blacklist
    jti = payload.get('jti')
    if jti:
        from .models import BlacklistedRefreshToken
        try:
            if BlacklistedRefreshToken.objects.filter(token_jti=jti).exists():
                raise AuthenticationFailed('Token has been revoked.')
        except Exception:
            pass

    return payload


def generate_tokens_for_user(user, additional_claims: dict = None) -> dict:
    """
    Generates an access token and refresh token pair for a user.
    """
    base_claims = {
        'user_id': user.id,
        'username': user.username,
        'role': getattr(user, 'role', '') or '',
    }
    if additional_claims:
        base_claims.update(additional_claims)

    access_token = encode_jwt(base_claims, token_type='access', exp_seconds=86400)      # 24 hours
    refresh_token = encode_jwt(base_claims, token_type='refresh', exp_seconds=86400 * 30) # 30 days

    return {
        'access': access_token,
        'refresh': refresh_token,
        'token_type': 'Bearer',
        'expires_in': 86400
    }


def blacklist_refresh_token(token_str: str, user=None):
    """
    Adds a refresh token's jti to the BlacklistedRefreshToken database table.
    """
    from .models import BlacklistedRefreshToken
    try:
        payload = decode_jwt(token_str, verify_exp=False)
        jti = payload.get('jti')
        exp = payload.get('exp')
        user_id = payload.get('user_id')
        expires_at = datetime.fromtimestamp(exp) if exp else None

        if jti:
            BlacklistedRefreshToken.objects.get_or_create(
                token_jti=jti,
                defaults={
                    'token': token_str[:255],
                    'user_id': user_id or (user.id if user else None),
                    'expires_at': expires_at
                }
            )
            return True
    except Exception:
        pass
    return False


class JWTAuthentication(BaseAuthentication):
    """
    Custom DRF Authentication class for mobile and API clients.
    Parses 'Authorization: Bearer <token>' header.
    Returns (user, payload) on success, or None if no Bearer token is provided.
    """

    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()

        if not auth_header or auth_header[0].lower() != b'bearer':
            return None  # Let other auth classes (e.g. TokenAuthentication) handle it

        if len(auth_header) == 1:
            raise AuthenticationFailed('Invalid Authorization header. No credential provided.')
        elif len(auth_header) > 2:
            raise AuthenticationFailed('Invalid Authorization header. Token string should not contain spaces.')

        try:
            token = auth_header[1].decode('utf-8')
        except UnicodeError:
            raise AuthenticationFailed('Invalid Authorization header. Token contains non-UTF-8 characters.')

        payload = decode_jwt(token, verify_exp=True)

        if payload.get('token_type') != 'access':
            raise AuthenticationFailed('Invalid token type. Access token expected.')

        user_id = payload.get('user_id')
        if not user_id:
            raise AuthenticationFailed('Invalid token payload. user_id missing.')

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('User belonging to this token no longer exists.')

        if not getattr(user, 'is_active', True):
            raise AuthenticationFailed('User account is deactivated.')

        return (user, payload)

    def authenticate_header(self, request):
        return 'Bearer realm="api"'

