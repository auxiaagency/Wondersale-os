import secrets
from datetime import timedelta
from decimal import Decimal
from django.db import models
from django.utils import timezone


class Customer(models.Model):
    """
    Online customer profile registered via Mobile OTP on wonder.sale.
    Optionally links to the in-store POS customer record.
    """
    mobile = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    auth_token = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)

    linked_pos_customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='website_accounts',
        help_text="Corresponding POS customer profile if unified."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Website Customer'
        verbose_name_plural = 'Website Customers'

    def __str__(self):
        return f"{self.name or 'Customer'} ({self.mobile})"

    def rotate_token(self, days_valid=30):
        """Generates a secure bearer token for API sessions."""
        self.auth_token = secrets.token_hex(32)
        self.token_expires_at = timezone.now() + timedelta(days=days_valid)
        self.save(update_fields=['auth_token', 'token_expires_at', 'updated_at'])
        return self.auth_token

    def is_token_valid(self):
        if not self.auth_token or not self.token_expires_at:
            return False
        return timezone.now() < self.token_expires_at


class CustomerOTP(models.Model):
    """
    6-digit one-time password records for customer phone verification.
    """
    mobile = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Customer OTP'
        verbose_name_plural = 'Customer OTPs'

    def __str__(self):
        return f"OTP for {self.mobile} ({'Used' if self.is_used else 'Active'})"

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at


class WebsiteOrder(models.Model):
    """
    Online order placed by a customer via the website.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    tracking_id = models.CharField(max_length=32, unique=True, db_index=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    delivery_address = models.JSONField(default=dict, blank=True)
    payment_method = models.CharField(max_length=50, default='COD')
    payment_status = models.CharField(max_length=30, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    payment_id = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Website Order'
        verbose_name_plural = 'Website Orders'

    def __str__(self):
        return f"Order #{self.order_number} - {self.customer.mobile} ({self.status})"


class WebsiteOrderItem(models.Model):
    """
    Line items within a WebsiteOrder, linked to physical inventory Item.
    """
    order = models.ForeignKey(WebsiteOrder, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(
        'inventory.Item',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='website_order_items'
    )
    item_name = models.CharField(max_length=255)
    item_uid = models.CharField(max_length=64, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['id']
        verbose_name = 'Website Order Item'
        verbose_name_plural = 'Website Order Items'

    def __str__(self):
        return f"{self.quantity}x {self.item_name} @ {self.unit_price}"
