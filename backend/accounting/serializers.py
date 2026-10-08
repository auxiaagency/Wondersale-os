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


