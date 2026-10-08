from decimal import Decimal
from rest_framework import serializers
from .models import Stakeholder, StakeholderPayout


class StakeholderPayoutSerializer(serializers.ModelSerializer):
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = StakeholderPayout
        fields = [
            'id',
            'stakeholder',
            'amount',
            'payout_date',
            'period_start',
            'period_end',
            'payment_method',
            'payment_method_display',
            'reference_id',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Payout amount must be greater than zero.")
        return value


class StakeholderSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(read_only=True)
    payouts_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Stakeholder
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'store',
            'store_name',
            'investment_amount',
            'profit_percentage',
            'contract_date',
            'contract_end_date',
            'total_payout_paid',
            'status',
            'notes',
            'payouts_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store_name', 'payouts_count', 'created_at', 'updated_at']

    def validate_profit_percentage(self, value):
        if value <= Decimal('0.00') or value > Decimal('100.00'):
            raise serializers.ValidationError("Profit percentage must be between 0.01% and 100.00%.")
        return value

    def validate_investment_amount(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Investment amount cannot be negative.")
        return value

    def validate(self, data):
        # Validation: Check total allocated profit percentage does not exceed 100% for this store
        target_pct = data.get('profit_percentage')
        if target_pct is not None:
            store = data.get('store', getattr(self.instance, 'store', None))
            existing_qs = Stakeholder.objects.filter(status='active')
            if store:
                from django.db.models import Q
                existing_qs = existing_qs.filter(Q(store=store) | Q(store__isnull=True))
            if self.instance:
                existing_qs = existing_qs.exclude(pk=self.instance.pk)
            total_active = sum((s.profit_percentage for s in existing_qs), Decimal('0.00'))
            if (total_active + target_pct) > Decimal('100.00'):
                store_label = f" for {store.name}" if store else ""
                raise serializers.ValidationError({
                    'profit_percentage': f"Total allocated profit share{store_label} would exceed 100%. Currently allocated: {total_active}%, requested: {target_pct}%."
                })
        return data
