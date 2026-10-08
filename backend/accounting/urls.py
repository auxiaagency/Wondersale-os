from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OperatingExpenseViewSet,
    MonthlyFinancialAnalysisView,
    SectionMonthlyGoalViewSet,
)

router = DefaultRouter()
router.register(r'operating-expenses', OperatingExpenseViewSet, basename='operating-expense')
router.register(r'section-goals', SectionMonthlyGoalViewSet, basename='section-goal')

urlpatterns = [
    path('', include(router.urls)),
    path('financial-analysis/', MonthlyFinancialAnalysisView.as_view(), name='monthly-financial-analysis'),
]
