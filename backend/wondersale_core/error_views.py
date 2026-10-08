"""
Custom Generic Error Views for Wondersale API.

Returns standardized, safe JSON responses that conceal sensitive stack traces,
database state, and server internal architectures.
"""
from django.http import JsonResponse


def custom_bad_request_view(request, exception=None):
    return JsonResponse({
        'error': 'bad_request',
        'message': 'The request could not be processed due to invalid parameters.',
        'status_code': 400
    }, status=400)


def custom_permission_denied_view(request, exception=None):
    return JsonResponse({
        'error': 'forbidden',
        'message': 'You do not have permission to access this resource.',
        'status_code': 403
    }, status=403)


def custom_page_not_found_view(request, exception=None):
    return JsonResponse({
        'error': 'not_found',
        'message': 'The requested resource was not found.',
        'status_code': 404
    }, status=404)


def custom_server_error_view(request):
    return JsonResponse({
        'error': 'internal_server_error',
        'message': 'An internal error occurred. Please contact the system administrator.',
        'status_code': 500
    }, status=500)


def health_check_view(request):
    """
    Unprivileged, clean health check endpoint.
    Verifies service liveness and database reachability without exposing
    system internals, connection strings, or sensitive configurations.
    """
    from django.db import connection
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_ok = False

    status_code = 200 if db_ok else 503
    return JsonResponse({
        'status': 'healthy' if db_ok else 'unhealthy',
        'database': 'connected' if db_ok else 'disconnected'
    }, status=status_code)
