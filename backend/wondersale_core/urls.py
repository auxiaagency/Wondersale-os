"""
URL configuration for wondersale_core project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Configurable admin prefix (defaults to 'admin/')
admin_path = getattr(settings, 'ADMIN_URL_PREFIX', 'admin/').strip('/') + '/'

from wondersale_core.error_views import health_check_view

urlpatterns = [
    path('health/', health_check_view, name='health-check'),
    path('api/health/', health_check_view, name='api-health-check'),
    path(admin_path, admin.site.urls),
    path('api/inventory/', include('inventory.urls')),
    path('api/staff/', include('staff.urls')),
    path('api/stakeholders/', include('stakeholders.urls')),
    path('api/accounting/', include('accounting.urls')),
]

# Custom generic error handlers that leak no system information
handler400 = 'wondersale_core.error_views.custom_bad_request_view'
handler403 = 'wondersale_core.error_views.custom_permission_denied_view'
handler404 = 'wondersale_core.error_views.custom_page_not_found_view'
handler500 = 'wondersale_core.error_views.custom_server_error_view'

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
