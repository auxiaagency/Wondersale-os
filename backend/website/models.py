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


class HeroSlide(models.Model):
    """
    Hero banner slides displayed on the public storefront home page.
    Fully editable from the Website Management module in Wondersale OS.
    """
    badge = models.CharField(max_length=100, default="Special Offer", help_text="Small pill badge text")
    title = models.CharField(max_length=255, help_text="Primary bold heading")
    subtitle = models.CharField(max_length=255, blank=True, default="", help_text="Subheading or discount promo text")
    button_text = models.CharField(max_length=100, default="Shop Now")
    button_link = models.CharField(max_length=255, default="/categories", help_text="Target URL or category path")
    image_url = models.TextField(help_text="Direct URL to product or banner image")
    alt_text = models.CharField(max_length=255, blank=True, default="", help_text="Accessibility alt description")
    display_order = models.PositiveIntegerField(default=0, help_text="Slide display order sequence")
    is_active = models.BooleanField(default=True, help_text="Whether this slide is shown on website")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'Hero Slide'
        verbose_name_plural = 'Hero Slides'

    def __str__(self):
        return f"Slide #{self.display_order}: {self.title} ({'Active' if self.is_active else 'Hidden'})"


class DealOfTheDay(models.Model):
    """
    Deals of the Day promotions with temporary promotional MRP and Selling Price.
    When active:
    - Item's selling_price and mrp in Inventory are set to promotional values.
    - Previous selling_price and mrp are preserved in original_selling_price and original_mrp.
    - When deleted or when ends_at passes, the item's original prices are restored to inventory.
    """
    item = models.OneToOneField(
        'inventory.Item',
        on_delete=models.CASCADE,
        related_name='deal_of_the_day',
        help_text="Inventory item on promotion."
    )
    deal_selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Special promotional selling price during the deal."
    )
    deal_mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Promotional reference MRP during the deal."
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Calculated discount percentage based on deal_mrp and deal_selling_price."
    )
    original_selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Normal inventory selling price to revert to when deal ends."
    )
    original_mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Normal inventory MRP to revert to when deal ends."
    )
    starts_at = models.DateTimeField(
        default=timezone.now,
        help_text="Deal start timestamp."
    )
    ends_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Deal expiry timestamp. If reached, deal automatically expires and prices revert."
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this deal is currently active on the store."
    )
    custom_badge = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional custom badge like 'Deal of the Day' or 'Flash Sale'."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Deal of the Day'
        verbose_name_plural = 'Deals of the Day'

    def __str__(self):
        return f"Deal: {self.item.name} @ ₹{self.deal_selling_price} (MRP: ₹{self.deal_mrp})"

    def calculate_discount(self):
        """Calculates percentage discount: round(((deal_mrp - deal_selling_price) / deal_mrp) * 100)."""
        if self.deal_mrp and self.deal_mrp > 0 and self.deal_selling_price is not None:
            diff = self.deal_mrp - self.deal_selling_price
            if diff > 0:
                pct = (diff / self.deal_mrp) * Decimal('100.00')
                return round(pct, 2)
        return Decimal('0.00')

    def is_expired(self):
        if self.ends_at and timezone.now() >= self.ends_at:
            return True
        return False

    def revert_item_prices(self):
        """Restores the associated Item's selling_price and mrp back to normal inventory values."""
        item = self.item
        updated = False
        if item.selling_price != self.original_selling_price:
            item.selling_price = self.original_selling_price
            updated = True
        if item.mrp != self.original_mrp:
            item.mrp = self.original_mrp
            updated = True
        if updated:
            item.save(update_fields=['selling_price', 'mrp'])


class ShopByCategoryCard(models.Model):
    """
    Cards featured in the 'Shop By Category' grid on the e-commerce home page.
    Fully configurable from Wondersale OS Website Management:
    - title: Main bold title (e.g., 'Cookware & Dining')
    - subtitle: Short subtitle description (e.g., 'Non-stick, Pots & Bowls')
    - badge: Top promotional pill tag (e.g., 'Up to 60% Off', 'Min 40% Off')
    - image_url: Image URL for the category banner card
    - category: Optional foreign key to inventory Category
    - link_url: Target URL on the storefront (e.g., '/category/kitchen-appliances' or '/category/1')
    - display_order: Sorting sequence on storefront grid
    - is_active: Whether card is rendered on storefront
    """
    title = models.CharField(max_length=200, help_text="Category card main title (e.g. Cookware & Dining)")
    subtitle = models.CharField(max_length=255, blank=True, default="", help_text="Subtitle or subtext description")
    badge = models.CharField(max_length=100, blank=True, default="Special Offer", help_text="Promo pill badge text (e.g. Up to 60% Off)")
    image_url = models.TextField(help_text="URL or path to category feature image")
    category = models.ForeignKey(
        'inventory.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shop_by_category_cards',
        help_text="Linked inventory category"
    )
    link_url = models.CharField(
        max_length=255,
        default="/categories",
        help_text="Target URL or slug path when clicked"
    )
    display_order = models.PositiveIntegerField(default=0, help_text="Display order sequence (lower comes first)")
    is_active = models.BooleanField(default=True, help_text="Whether this category card is active and visible")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'Shop By Category Card'
        verbose_name_plural = 'Shop By Category Cards'

    def __str__(self):
        return f"ShopByCategory #{self.display_order}: {self.title} ({'Active' if self.is_active else 'Hidden'})"


