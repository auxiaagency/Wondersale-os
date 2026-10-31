from django.contrib import admin
from .models import Customer, CustomerOTP, WebsiteOrder, WebsiteOrderItem


class WebsiteOrderItemInline(admin.TabularInline):
    model = WebsiteOrderItem
    extra = 0
    readonly_fields = ['item', 'item_name', 'item_uid', 'quantity', 'unit_price', 'total_price']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['mobile', 'name', 'email', 'is_active', 'created_at']
    search_fields = ['mobile', 'name', 'email']
    list_filter = ['is_active', 'created_at']


@admin.register(CustomerOTP)
class CustomerOTPAdmin(admin.ModelAdmin):
    list_display = ['mobile', 'code', 'is_used', 'expires_at', 'created_at']
    search_fields = ['mobile', 'code']
    list_filter = ['is_used', 'created_at']


@admin.register(WebsiteOrder)
class WebsiteOrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'tracking_id', 'customer', 'status', 'total_amount', 'payment_status', 'created_at']
    search_fields = ['order_number', 'tracking_id', 'customer__mobile', 'customer__name']
    list_filter = ['status', 'payment_status', 'payment_method', 'created_at']
    inlines = [WebsiteOrderItemInline]
