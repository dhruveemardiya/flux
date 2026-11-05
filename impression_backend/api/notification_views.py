"""
Mobile Device Push Notification Token APIs
Endpoints:
- POST   /api/notifications/device-token/ (Register FCM / APNS device token)
- DELETE /api/notifications/device-token/ (Unregister device token on logout)
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MobileDeviceToken


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def notification_device_token_api(request):
    """
    POST: Register or update mobile push device token (FCM / APNS) for background follow-up notifications.
    DELETE: Unregister device token when user logs out.
    """
    if request.method == 'POST':
        token = request.data.get('token', '').strip()
        platform = request.data.get('platform', 'android').strip().lower()

        if not token:
            return Response(
                {'error': 'Device token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if platform not in ['android', 'ios', 'web']:
            platform = 'android'

        device, created = MobileDeviceToken.objects.update_or_create(
            user=request.user,
            token=token,
            defaults={
                'platform': platform,
                'is_active': True
            }
        )

        return Response({
            'message': 'Device token registered successfully.',
            'id': device.id,
            'token': device.token,
            'platform': device.platform,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    elif request.method == 'DELETE':
        token = (request.data.get('token') or request.query_params.get('token') or '').strip()

        if token:
            deleted_count, _ = MobileDeviceToken.objects.filter(
                user=request.user,
                token=token
            ).delete()
        else:
            # If no token specified, deactivate all device tokens for this user on logout
            deleted_count, _ = MobileDeviceToken.objects.filter(
                user=request.user
            ).delete()

        return Response({
            'message': 'Device token unregistered successfully.',
            'unregistered_count': deleted_count
        }, status=status.HTTP_200_OK)

