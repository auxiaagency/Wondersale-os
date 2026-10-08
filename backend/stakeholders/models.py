from decimal import Decimal
from django.db import models
from django.utils import timezone


class Stakeholder(models.Model):
    """
    Contractual profit-sharing stakeholder.
    Note: Stakes are NOT equity or corporate ownership.
    Stakeholders invest capital and earn an agreed percentage share of profit
    as agreed at contract signing.
    """
    STATUS_ACTIVE = 'active'
    STATUS_PAUSED = 'paused'
    STATUS_SETTLED = 'settled'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active Partner'),
        (STATUS_PAUSED, 'Paused / On Hold'),
        (STATUS_SETTLED, 'Contract Settled / Ended'),
    ]

    name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    store = models.ForeignKey(
        'inventory.Store',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stakeholders',
        help_text="Optional specific branch location, or null for organization-wide"
    )
    investment_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Capital invested into the organization in Rupees"
    )
    profit_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Agreed contractual percentage share in net profit (e.g. 5.00 for 5%, 10.00 for 10%)"
    )
    contract_date = models.DateField(
        default=timezone.now,
        help_text="Date when agreement was signed"
    )
    contract_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Optional agreement expiration or renewal date"
    )
    total_payout_paid = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total profit disbursements paid up until today"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Contract terms, bank account / UPI details, or notes"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-investment_amount', '-created_at']
        verbose_name = 'Stakeholder'
        verbose_name_plural = 'Stakeholders'

    def __str__(self):
        return f"{self.name} ({self.profit_percentage}% Profit Share)"

    @property
    def store_name(self) -> str:
        return self.store.name if self.store else "Organization-Wide (All Stores)"

    @property
    def payouts_count(self) -> int:
        return self.payouts.count()


class StakeholderPayout(models.Model):
    """
    Log of profit payout disbursements made to a stakeholder.
    """
    METHOD_BANK = 'bank_transfer'
    METHOD_UPI = 'upi'
    METHOD_CHEQUE = 'cheque'
    METHOD_CASH = 'cash'
    METHOD_OTHER = 'other'
    METHOD_CHOICES = [
        (METHOD_BANK, 'Bank Transfer / NEFT'),
        (METHOD_UPI, 'UPI / QR'),
        (METHOD_CHEQUE, 'Cheque'),
        (METHOD_CASH, 'Cash'),
        (METHOD_OTHER, 'Other'),
    ]

    stakeholder = models.ForeignKey(
        Stakeholder,
        on_delete=models.CASCADE,
        related_name='payouts'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payout_date = models.DateField(default=timezone.now, db_index=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=30, choices=METHOD_CHOICES, default=METHOD_BANK)
    reference_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Bank UTR or Transaction reference number"
    )
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payout_date', '-created_at']
        verbose_name = 'Stakeholder Payout'
        verbose_name_plural = 'Stakeholder Payouts'

    def __str__(self):
        return f"{self.stakeholder.name} - ₹{self.amount} ({self.payout_date})"
