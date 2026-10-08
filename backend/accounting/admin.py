from django.contrib import admin
from .models import OperatingExpense


@admin.register(OperatingExpense)
class OperatingExpenseAdmin(admin.ModelAdmin):
    list_display = ['voucher_number', 'title', 'category', 'amount', 'store', 'expense_date', 'payment_method', 'paid_to', 'reference_number']
    list_filter = ['store', 'category', 'payment_method', 'year', 'month']
    search_fields = ['voucher_number', 'title', 'paid_to', 'reference_number', 'notes', 'recorded_by_name']
