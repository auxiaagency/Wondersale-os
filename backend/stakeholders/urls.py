from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StakeholderViewSet

router = DefaultRouter()
router.register(r'', StakeholderViewSet, basename='stakeholder')

urlpatterns = [
    path('', include(router.urls)),
]
