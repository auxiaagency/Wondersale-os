import uuid
import logging

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    """
    Injects a unique X-Request-ID into every incoming request and response,
    enabling end-to-end tracing across application logs and API interactions.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        request.request_id = request_id

        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Ensure X-Content-Type-Options
        if not response.has_header('X-Content-Type-Options'):
            response['X-Content-Type-Options'] = 'nosniff'

        # Strict Referrer-Policy
        if not response.has_header('Referrer-Policy'):
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Cross-Origin-Opener-Policy (COOP)
        if not response.has_header('Cross-Origin-Opener-Policy'):
            response['Cross-Origin-Opener-Policy'] = 'same-origin'

        # Permissions-Policy
        if not response.has_header('Permissions-Policy'):
            response['Permissions-Policy'] = (
                'geolocation=(), '
                'microphone=(), '
                'camera=(), '
                'payment=(), '
                'usb=(), '
                'magnetometer=(), '
                'accelerometer=(), '
                'gyroscope=()'
            )

        return response
