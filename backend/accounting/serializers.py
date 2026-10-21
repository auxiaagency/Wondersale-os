from decimal import Decimal
from rest_framework import serializers
from staff.models import StaffMember
from inventory.models import Store
from .models import OperatingExpense
from .services import generate_next_expense_voucher_number


class OperatingExpenseSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    voucher_number = serializers.CharField(required=False, allow_blank=True)
    store = serializers.PrimaryKeyRelatedField(queryset=Store.objects.all(), required=False, allow_null=True)

    class Meta:
        model = OperatingExpense
        fields = [
            'id',
            'voucher_number',
            'store',
            'store_name',
            'title',
            'category',
            'category_display',
            'amount',
            'expense_date',
            'month',
            'year',
            'payment_method',
            'payment_method_display',
            'paid_to',
            'reference_number',
            'notes',
            'recorded_by',
            'recorded_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'month', 'year', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-compute month and year from expense_date
        expense_date = validated_data.get('expense_date')
        if expense_date:
            validated_data['month'] = expense_date.month
            validated_data['year'] = expense_date.year

        if not validated_data.get('voucher_number'):
            year = validated_data.get('year')
            month = validated_data.get('month')
            validated_data['voucher_number'] = generate_next_expense_voucher_number(year=year, month=month)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        expense_date = validated_data.get('expense_date')
        if expense_date:
            instance.month = expense_date.month
            instance.year = expense_date.year
        return super().update(instance, validated_data)


class SectionMonthlyGoalSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    section_color = serializers.CharField(source='section.color', read_only=True)
    section_code = serializers.CharField(source='section.code', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    revenue_achievement_pct = serializers.SerializerMethodField()
    profit_achievement_pct = serializers.SerializerMethodField()

    class Meta:
        from .models import SectionMonthlyGoal
        model = SectionMonthlyGoal
        fields = [
            'id',
            'section',
            'section_name',
            'section_color',
            'section_code',
            'store',
            'store_name',
            'year',
            'month',
            'target_revenue',
            'target_profit',
            'actual_revenue',
            'actual_profit',
            'revenue_achievement_pct',
            'profit_achievement_pct',
            'is_locked',
            'locked_at',
            'created_by',
            'created_by_name',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_locked', 'locked_at', 'created_at', 'updated_at']

    def get_revenue_achievement_pct(self, obj):
        target = float(obj.target_revenue or 0)
        actual = float(obj.actual_revenue or 0)
        if target <= 0:
            return 100.0 if actual > 0 else 0.0
        return round((actual / target) * 100, 1)

    def get_profit_achievement_pct(self, obj):
        target = float(obj.target_profit or 0)
        actual = float(obj.actual_profit or 0)
        if target <= 0:
            return 100.0 if actual > 0 else 0.0
        return round((actual / target) * 100, 1)


class ExpenseAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        from .models import ExpenseAttachment
        model = ExpenseAttachment
        fields = [
            'id',
            'file',
            'file_url',
            'file_name',
            'file_type',
            'file_size',
            'uploaded_at',
        ]
        read_only_fields = ['id', 'file_url', 'file_name', 'file_type', 'file_size', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class OwnerExpenseRecordSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_status_display = serializers.CharField(source='get_delivery_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    outstanding_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    bill_file_url = serializers.SerializerMethodField()
    attachments = ExpenseAttachmentSerializer(many=True, read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        from .models import OwnerExpenseRecord
        model = OwnerExpenseRecord
        fields = [
            'id',
            'record_number',
            'title',
            'category',
            'category_display',
            'vendor_name',
            'total_amount',
            'paid_amount',
            'outstanding_amount',
            'status',
            'status_display',
            'delivery_status',
            'delivery_status_display',
            'received_at',
            'received_by',
            'received_by_name',
            'delivery_notes',
            'payment_method',
            'payment_method_display',
            'payment_account',
            'payment_date',
            'payment_reference',
            'payment_notes',
            'bill_file',
            'bill_file_url',
            'attachments',
            'expense_date',
            'due_date',
            'is_overdue',
            'store',
            'store_name',
            'notes',
            'recorded_by',
            'recorded_by_name',
            'last_updated_by',
            'last_updated_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'record_number',
            'status',
            'outstanding_amount',
            'attachments',
            'created_at',
            'updated_at',
        ]

    def get_bill_file_url(self, obj):
        if obj.bill_file:
            # Return root-relative URL (e.g. /media/...) so frontend proxy handles it transparently
            return obj.bill_file.url
        return None

    def get_is_overdue(self, obj):
        if obj.status != 'paid' and obj.due_date:
            from django.utils import timezone
            return obj.due_date < timezone.now().date()
        return False

    def validate(self, attrs):
        total = attrs.get('total_amount', getattr(self.instance, 'total_amount', Decimal('0.00')))
        paid = attrs.get('paid_amount', getattr(self.instance, 'paid_amount', Decimal('0.00')))

        if total < Decimal('0.00'):
            raise serializers.ValidationError({"total_amount": "Total amount cannot be negative."})
        if paid < Decimal('0.00'):
            raise serializers.ValidationError({"paid_amount": "Paid amount cannot be negative."})
        if paid > total and total > Decimal('0.00'):
            # Allow equal or partial, but prevent accidental overpayment inputs beyond total
            attrs['paid_amount'] = total

        return attrs




