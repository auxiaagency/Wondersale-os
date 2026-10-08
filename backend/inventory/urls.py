from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StoreViewSet,
    CategoryViewSet,
    SubCategoryViewSet,
    SupplierViewSet,
    SectionViewSet,
    ItemViewSet,
    ItemImageViewSet,
    StockMovementViewSet,
    CustomerViewSet,
    SaleOrderViewSet,
    CounterPayoutViewSet,
    DailyRegisterShiftViewSet,
    DashboardAnalyticsView,
    ExpiryAnalyticsView,
    BrokenItemReportViewSet,
)

router = DefaultRouter()
router.register(r'stores', StoreViewSet, basename='store')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategory')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'images', ItemImageViewSet, basename='item-image')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'broken-items', BrokenItemReportViewSet, basename='broken-item')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'sales', SaleOrderViewSet, basename='sale-order')
router.register(r'counter-payouts', CounterPayoutViewSet, basename='counter-payout')
router.register(r'register-shifts', DailyRegisterShiftViewSet, basename='register-shift')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard-analytics/', DashboardAnalyticsView.as_view(), name='dashboard-analytics'),
    path('expiry-analytics/', ExpiryAnalyticsView.as_view(), name='expiry-analytics'),
]


