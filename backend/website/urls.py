from django.urls import path
from . import views

urlpatterns = [
    # Public Storefront Endpoints
    path('products/', views.ProductListView.as_view(), name='website-products-list'),
    path('products/<str:identifier>/', views.ProductDetailView.as_view(), name='website-product-detail'),
    path('categories/', views.CategoryListView.as_view(), name='website-categories-list'),
    path('auth/otp/request/', views.OTPRequestView.as_view(), name='website-otp-request'),
    path('auth/otp/verify/', views.OTPVerifyView.as_view(), name='website-otp-verify'),
    path('orders/', views.OrderCreateView.as_view(), name='website-order-create'),
    path('orders/track/<str:tracking_id>/', views.OrderTrackingView.as_view(), name='website-order-track'),

    path('hero-slides/', views.HeroSlidePublicListView.as_view(), name='website-hero-slides-public'),
    path('deals-of-the-day/', views.DealOfTheDayPublicListView.as_view(), name='website-deals-public'),

    # OS Admin / Store Management Endpoints
    path('admin/orders/', views.WebsiteAdminOrdersView.as_view(), name='website-admin-orders'),
    path('admin/orders/<int:order_id>/', views.WebsiteAdminOrderDetailView.as_view(), name='website-admin-order-detail'),
    path('admin/stats/', views.WebsiteAdminStatsView.as_view(), name='website-admin-stats'),
    path('admin/hero-slides/', views.HeroSlideAdminListCreateView.as_view(), name='website-admin-hero-slides-list-create'),
    path('admin/hero-slides/upload/', views.HeroSlideImageUploadView.as_view(), name='website-admin-hero-slides-upload'),
    path('admin/hero-slides/<int:slide_id>/', views.HeroSlideAdminDetailView.as_view(), name='website-admin-hero-slides-detail'),
    path('admin/deals-of-the-day/', views.DealOfTheDayAdminListCreateView.as_view(), name='website-admin-deals-list-create'),
    path('admin/deals-of-the-day/<int:deal_id>/', views.DealOfTheDayAdminDetailView.as_view(), name='website-admin-deals-detail'),
]

