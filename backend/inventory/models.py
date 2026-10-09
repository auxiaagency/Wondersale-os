import uuid
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone


class GlobalSequence(models.Model):
    """
    Atomic sequence tracking table designed for high-concurrency PostgreSQL & SQLite environments.
    Guarantees unique, non-colliding sequential numbers across concurrent cashiers,
    APIs, e-commerce webhooks, and multiple devices using SELECT FOR UPDATE row-locks.
    """
    name = models.CharField(max_length=64, unique=True, db_index=True)
    current_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Global Sequence'
        verbose_name_plural = 'Global Sequences'

    def __str__(self):
        return f"{self.name} -> {self.current_value}"

    @classmethod
    def get_next_val(cls, seq_name: str) -> int:
        """
        Atomically increments and returns the next integer in the named sequence.
        Must be called inside an active transaction (e.g. transaction.atomic).
        """
        seq_obj, _ = cls.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': 0}
        )
        seq_obj.current_value += 1
        seq_obj.save(update_fields=['current_value', 'updated_at'])
        return seq_obj.current_value


class Store(models.Model):
    """Store entity to support multi-store physical locations."""
    name = models.CharField(max_length=255, unique=True)
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    pincode = models.CharField(max_length=20, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    gst_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="GSTIN / GST Tax Registration number for this branch (e.g. 23ANGPK5446D2Z8)."
    )
    is_active = models.BooleanField(default=True)
    allow_manual_uid = models.BooleanField(
        default=False,
        help_text="Allow manual editing/entry of UIDs when adding items for this store."
    )
    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('18.00'),
        help_text="GST Tax Rate percentage (e.g. 18.00%)"
    )
    gst_calculation_mode = models.CharField(
        max_length=20,
        default='all',
        choices=[
            ('all', 'All Revenue (Cash + UPI)'),
            ('upi_only', 'UPI Payments Only')
        ],
        help_text="Calculate GST on total gross sales or restrict to UPI payments only"
    )
    enable_gst = models.BooleanField(
        default=True,
        help_text="Enable or disable GST deduction across financial reports"
    )
    enable_stakeholders = models.BooleanField(
        default=True,
        help_text="Enable or disable the Stakeholders profit-sharing module and calculations"
    )
    timezone = models.CharField(
        max_length=64,
        default='Asia/Kolkata',
        help_text="IANA Timezone for store operations (e.g. Asia/Kolkata)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Store'
        verbose_name_plural = 'Stores'

    def __str__(self):
        return self.name


class Category(models.Model):
    """Parent Category classification (e.g. Apparel, Electronics, Groceries)."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class SubCategory(models.Model):
    """
    SubCategory classification belonging to a parent Category.
    Items have a many-to-many relationship with SubCategories.
    """
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='subcategories'
    )
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__name', 'name']
        unique_together = ('category', 'name')
        verbose_name = 'SubCategory'
        verbose_name_plural = 'SubCategories'

    def __str__(self):
        return f"{self.category.name} > {self.name}"


class Supplier(models.Model):
    """
    Distributor / Wholesaler / Vendor entity from which inventory is procured.
    """
    name = models.CharField(max_length=255, db_index=True)
    contact_person = models.CharField(max_length=255, blank=True, default="", help_text="Representative / agent name")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    pincode = models.CharField(max_length=20, blank=True, default="")
    gst_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="GSTIN / Tax ID of the supplier"
    )
    notes = models.TextField(blank=True, default="", help_text="Payment terms, delivery schedules, credit days, etc.")
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suppliers',
        help_text="Optional specific branch attribution. If null, available across all stores."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'

    def __str__(self):
        return self.name


class Section(models.Model):
    """
    Store Section / Department / Aisle classification (e.g. Menswear, Electronics, Shelf A1, Ground Floor).
    Can be attributed to a specific store or available across branches.
    """
    name = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=50, blank=True, default="", help_text="Short code / aisle identifier (e.g. SEC-01, MENS, FL-1).")
    description = models.TextField(blank=True, default="")
    color = models.CharField(max_length=30, blank=True, default="#3B82F6", help_text="Hex color code for badges & charts.")
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sections',
        help_text="Optional specific store attribution. If null, available across all stores."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Section'
        verbose_name_plural = 'Sections'

    def __str__(self):
        if self.code:
            return f"[{self.code}] {self.name}"
        return self.name


class Item(models.Model):
    """
    Inventory Item representing physical merchandise.
    - id: Internal DB surrogate key, never exposed as product code/barcode.
    - uid: Unifying single field for product code & printed Code128 barcode value.
    - quantity: Cached derived total maintained strictly via StockMovement ledger.
    """
    SOURCE_NEW = 'new'
    SOURCE_LEGACY = 'legacy'
    SOURCE_CHOICES = [
        (SOURCE_NEW, 'New System Item'),
        (SOURCE_LEGACY, 'Legacy System Import'),
    ]

    uid = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unified product code & printed barcode value."
    )
    name = models.CharField(max_length=255, db_index=True)
    quantity = models.IntegerField(
        default=0,
        help_text="Derived cached stock level calculated from StockMovement ledger."
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Purchase/cost price per unit."
    )
    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Retail selling price."
    )
    mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum Retail Price. If null, treated as selling_price at read time."
    )
    subcategories = models.ManyToManyField(
        SubCategory,
        blank=True,
        related_name='items'
    )
    primary_subcategory = models.ForeignKey(
        SubCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='primary_items',
        help_text="Primary financial anchor used for 100% consistent, single-category P&L attribution and pie charts."
    )
    supplier = models.ForeignKey(
        Supplier,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='items',
        help_text="Distributor / Supplier from which item was procured."
    )
    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='items',
        help_text="Store section / department / aisle."
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.PROTECT,
        related_name='items'
    )
    location_section = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Aisle, shelf, or store section location."
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text="Product expiration date if applicable."
    )
    weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Weight in grams."
    )
    length = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Length in cm."
    )
    width = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Width in cm."
    )
    height = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Height in cm."
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Optional product description and specifications."
    )
    ai_description_draft = models.TextField(
        blank=True,
        default="",
        help_text="Generated AI description draft pending manager review & approval."
    )
    ai_description_status = models.CharField(
        max_length=30,
        default='none',
        db_index=True,
        choices=[
            ('none', 'None'),
            ('pending', 'Pending Generation'),
            ('generating', 'Generating in Background'),
            ('ready', 'Ready for Review'),
            ('failed', 'Generation Failed'),
            ('skipped_no_image', 'Skipped (No Image)'),
            ('applied', 'Applied to Description'),
        ],
        help_text="Current lifecycle status of AI generated description."
    )
    ai_description_error = models.TextField(
        blank=True,
        default="",
        help_text="Error message or skipping reason if generation failed."
    )
    ai_description_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when AI description was last generated or updated."
    )
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default=SOURCE_NEW,
        db_index=True
    )
    legacy_uid = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        db_index=True,
        help_text="Original code from legacy system if different from UID."
    )
    needs_new_barcode_printed = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Flag indicating staff need to print & affix a fresh barcode label."
    )
    is_listed_on_website = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Flag indicating whether this item is published/listed on the online website."
    )

    # ── Variant / Batch Grouping ─────────────────────────────────────────────
    variant_group_id = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        help_text="UUID string grouping sibling product variants and batches together."
    )
    variant_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Human-friendly variant tag (e.g. 'Batch Exp Nov 2026', 'Vendor ABC', 'Red / L')."
    )
    is_master_variant = models.BooleanField(
        default=False,
        help_text="Indicates whether this was the original anchor item when the variant family was created."
    )
    # ────────────────────────────────────────────────────────────────────────

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Item'
        verbose_name_plural = 'Items'

    def __str__(self):
        return f"{self.name} [{self.uid}]"

    @property
    def volume_cm3(self):
        """Physical Volume in cubic centimeters (cm³ = length × width × height)."""
        if self.length is not None and self.width is not None and self.height is not None:
            return round(float(self.length) * float(self.width) * float(self.height), 2)
        return None

    @property
    def volumetric_weight_kg(self):
        """Volumetric Weight in kg ((length × width × height) / 5000)."""
        if self.length is not None and self.width is not None and self.height is not None:
            return round((float(self.length) * float(self.width) * float(self.height)) / 5000.0, 3)
        return None

    @property
    def dimensions_display(self):
        """Human-readable dimensions string (e.g. 15.0 × 10.0 × 5.0 cm)."""
        if self.length is not None and self.width is not None and self.height is not None:
            return f"{self.length} × {self.width} × {self.height} cm"
        return None

    @property
    def effective_mrp(self) -> Decimal:
        """
        If MRP is null when read/displayed, treat it as equal to selling_price.
        Does not alter or write selling_price into the database.
        """
        if self.mrp is not None:
            return self.mrp
        return self.selling_price

    @property
    def effective_primary_subcategory(self):
        """
        Returns primary_subcategory if explicitly set.
        If null, safely falls back to the first associated subcategory.
        Returns None if the item has no subcategories at all.
        """
        if self.primary_subcategory_id:
            return self.primary_subcategory
        if hasattr(self, '_prefetched_objects_cache') and 'subcategories' in self._prefetched_objects_cache:
            subs = list(self.subcategories.all())
            return subs[0] if subs else None
        return self.subcategories.first()

    @property
    def effective_primary_category(self):
        """
        Returns the parent Category of effective_primary_subcategory, or None.
        """
        sub = self.effective_primary_subcategory
        return sub.category if sub else None

    @property
    def parent_categories(self):
        """Returns distinct parent Category instances for the item's subcategories."""
        if hasattr(self, '_prefetched_objects_cache') and 'subcategories' in self._prefetched_objects_cache:
            cats = []
            seen = set()
            for sub in self.subcategories.all():
                if sub.category and sub.category.id not in seen:
                    seen.add(sub.category.id)
                    cats.append(sub.category)
            return cats
        return Category.objects.filter(subcategories__items=self).distinct()

    @property
    def primary_image(self):
        """Returns primary image or first available image."""
        if hasattr(self, '_prefetched_objects_cache') and 'images' in self._prefetched_objects_cache:
            imgs = list(self.images.all())
            for img in imgs:
                if img.is_primary:
                    return img
            if imgs:
                imgs.sort(key=lambda x: (x.order or 0, x.id or 0))
                return imgs[0]
            return None
        primary = self.images.filter(is_primary=True).first()
        if primary:
            return primary
        return self.images.order_by('order', 'id').first()

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_cost = None
        old_sell = None
        old_mrp = None

        if not is_new:
            try:
                orig = Item.objects.only('cost_price', 'selling_price', 'mrp').get(pk=self.pk)
                old_cost = orig.cost_price
                old_sell = orig.selling_price
                old_mrp = orig.mrp
            except Item.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        if is_new:
            ItemPriceHistory.objects.create(
                item=self,
                cost_price=self.cost_price,
                selling_price=self.selling_price,
                mrp=self.mrp,
                reason="Initial Stocking",
                note="Initial catalog entry",
            )
        elif (
            old_cost is not None and (
                self.cost_price != old_cost or
                self.selling_price != old_sell or
                self.mrp != old_mrp
            )
        ):
            ItemPriceHistory.objects.create(
                item=self,
                cost_price=self.cost_price,
                selling_price=self.selling_price,
                mrp=self.mrp,
                reason="Price Adjustment",
                note=f"Cost: {old_cost} -> {self.cost_price}, Sell: {old_sell} -> {self.selling_price}",
            )


class StockMovement(models.Model):
    """
    Immutable stock ledger recording every addition and reduction.
    Item.quantity is derived from the sum of change values.
    """
    REASON_INITIAL_IMPORT = 'initial_import'
    REASON_MANUAL_ADJUSTMENT = 'manual_adjustment'
    REASON_RESTOCK = 'restock'
    REASON_DAMAGE = 'damage'
    REASON_RETURN = 'return'
    REASON_AUDIT_CORRECTION = 'audit_correction'
    REASON_SALE = 'sale'
    REASON_EXPIRED = 'expired'
    REASON_BROKEN = 'broken'

    REASON_CHOICES = [
        (REASON_INITIAL_IMPORT, 'Initial Import'),
        (REASON_MANUAL_ADJUSTMENT, 'Manual Adjustment'),
        (REASON_RESTOCK, 'Restock'),
        (REASON_DAMAGE, 'Damaged / Discarded Stock'),
        (REASON_RETURN, 'Customer / Supplier Return'),
        (REASON_AUDIT_CORRECTION, 'Inventory Audit Correction'),
        (REASON_SALE, 'POS Customer Sale'),
        (REASON_EXPIRED, 'Expired Stock Write-Off'),
        (REASON_BROKEN, 'Broken / Damaged Write-Off'),
    ]

    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='stock_movements'
    )
    change = models.IntegerField(
        help_text="Positive for stock addition, negative for stock reduction."
    )
    reason = models.CharField(
        max_length=50,
        choices=REASON_CHOICES,
        default=REASON_MANUAL_ADJUSTMENT
    )
    note = models.CharField(max_length=255, blank=True, default="")
    proof_image = models.ImageField(
        upload_to='broken_proofs/',
        null=True,
        blank=True,
        help_text="Optional photo evidence for damaged, expired, or broken stock write-offs."
    )
    performed_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements'
    )
    performed_by_name = models.CharField(max_length=255, blank=True, default="")
    performed_by_role = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Stock Movement'
        verbose_name_plural = 'Stock Movements'

    def __str__(self):
        sign = "+" if self.change > 0 else ""
        return f"{self.item.uid}: {sign}{self.change} ({self.reason})"


class BrokenItemReport(models.Model):
    """
    Audit ledger and financial write-off record for damaged/broken merchandise.
    Linked to a StockMovement reduction and debited against store net operating profits at cost price.
    """
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='broken_reports'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='broken_reports'
    )
    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='broken_reports'
    )
    quantity = models.PositiveIntegerField(
        help_text="Units of physical merchandise broken or damaged."
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Cost price per unit at the time of write-off."
    )
    total_loss = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Total financial loss = quantity * cost_price."
    )
    reason = models.TextField(
        help_text="Mandatory explanation or write-off note describing how the damage occurred."
    )
    proof_image = models.ImageField(
        upload_to='broken_proofs/',
        help_text="Mandatory visual photo evidence of broken merchandise."
    )
    reported_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_broken_items'
    )
    reported_by_name = models.CharField(max_length=255, blank=True, default="")
    stock_movement = models.OneToOneField(
        StockMovement,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='broken_report'
    )
    fined_employee = models.ForeignKey(
        'staff.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='broken_fines',
        help_text="Employee fined for the damaged goods write-off."
    )
    fine_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=0.00,
        help_text="Amount fined to the employee for this incident."
    )
    fine_ledger_entry = models.ForeignKey(
        'staff.EmployeeLedgerEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='broken_reports',
        help_text="Linked staff ledger entry debiting the fine."
    )
    is_fined = models.BooleanField(
        default=False,
        help_text="Flag indicating whether an employee was fined for this write-off."
    )
    fined_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the fine was levied."
    )
    is_waived = models.BooleanField(
        default=False,
        help_text="Flag indicating management decided not to fine any employee (absorbed 100% as store loss)."
    )
    waived_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when fine was waived / accepted as store loss."
    )
    waived_by = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Staff or manager who decided not to fine."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Broken Item Report'
        verbose_name_plural = 'Broken Item Reports'

    def __str__(self):
        return f"Broken: {self.quantity}x {self.item.name} (Loss: {self.total_loss})"


class ItemPriceHistory(models.Model):
    """
    Tracks price modifications over time for an Item, recording cost price,
    selling price, and MRP transitions from item creation to current day.
    """
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='price_history'
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Recorded purchase/cost price per unit."
    )
    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Recorded retail selling price."
    )
    mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Recorded Maximum Retail Price."
    )
    reason = models.CharField(
        max_length=100,
        default="Initial Stocking",
        help_text="Reason for price recording/change (e.g. Initial Stocking, Price Adjustment, Restock Batch)."
    )
    note = models.CharField(max_length=255, blank=True, default="")
    performed_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='price_changes'
    )
    performed_by_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Item Price History'
        verbose_name_plural = 'Item Price Histories'

    def __str__(self):
        return f"{self.item.name} - Cost: {self.cost_price}, Sell: {self.selling_price} ({self.created_at})"


class ItemImage(models.Model):
    """
    Gallery images for an item.
    Always saved permanently as WebP format.
    Enforces a single primary image per item.
    """
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='item_images/')
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Item Image'
        verbose_name_plural = 'Item Images'

    def __str__(self):
        return f"Image for {self.item.uid} (Primary: {self.is_primary})"

    def save(self, *args, **kwargs):
        if self.is_primary:
            # Enforce single primary image per item
            with transaction.atomic():
                ItemImage.objects.filter(
                    item=self.item,
                    is_primary=True
                ).exclude(pk=self.pk).update(is_primary=False)
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)


class AIDescriptionBatchJob(models.Model):
    """
    Tracks asynchronous background AI description generation runs.
    Allows real-time progress polling, recovery after server reboot, and bulk approval.
    """
    STATUS_RUNNING = 'running'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_RUNNING, 'Running'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='ai_description_jobs'
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_RUNNING,
        db_index=True
    )
    total_items = models.PositiveIntegerField(default=0)
    completed_items = models.PositiveIntegerField(default=0)
    failed_items = models.PositiveIntegerField(default=0)
    skipped_items = models.PositiveIntegerField(default=0)
    item_ids = models.JSONField(
        default=list,
        help_text="List of Item PKs included in this generation batch."
    )
    status_message = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Real-time pause / quota status note (e.g. Rate limit paused, Daily limit reached)."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'AI Description Batch Job'
        verbose_name_plural = 'AI Description Batch Jobs'

    def __str__(self):
        return f"AI Job {self.id} ({self.status}) - {self.completed_items}/{self.total_items}"


class Customer(models.Model):
    """
    Customer profile entity.
    - Phone number is the primary lookup identifier.
    - Bound to a registered store / branch location.
    - Tracks aggregate lifetime spend and purchase frequency.
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customers',
        help_text="Store / Branch location where this customer is registered or primarily belongs to."
    )
    phone = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    total_purchases_count = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00')
    )
    last_purchase_date = models.DateTimeField(null=True, blank=True)
    vip_card_uid = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text="Unique RFID Card UID assigned to this customer."
    )
    vip_card_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Active VIP card credit balance in Rupees (1 Credit = 1 Rupee)."
    )
    vip_card_issued_at = models.DateTimeField(null=True, blank=True)
    vip_card_status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('inactive', 'Inactive'),
            ('blocked', 'Blocked'),
        ],
        default='active'
    )
    total_vip_savings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Cumulative discount savings earned by customer via VIP Card."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'

    def __str__(self):
        label = self.name if self.name else "Customer"
        return f"{label} ({self.phone})"

    @property
    def display_name(self) -> str:
        return self.name.strip() if self.name and self.name.strip() else self.phone

    @property
    def has_vip_card(self) -> bool:
        return bool(self.vip_card_uid and self.vip_card_status == 'active')


class VIPCardTransaction(models.Model):
    """
    Audit log of all VIP RFID Card credit activities: card issuance, recharges, checkout debits, and refunds.
    """
    TYPE_ISSUE = 'issue'
    TYPE_RECHARGE = 'recharge'
    TYPE_DEBIT = 'debit'
    TYPE_REFUND = 'refund'
    TYPE_CHOICES = [
        (TYPE_ISSUE, 'Card Issue & Initial Credit'),
        (TYPE_RECHARGE, 'Balance Top-up / Recharge'),
        (TYPE_DEBIT, 'Sale Payment Debit'),
        (TYPE_REFUND, 'Refund / Reversal'),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='vip_transactions'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vip_transactions'
    )
    card_uid = models.CharField(max_length=100, db_index=True)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    sale_order = models.ForeignKey(
        'SaleOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vip_transactions'
    )
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('cash', 'Cash'),
            ('upi', 'UPI'),
        ],
        default='cash',
        help_text="Payment method used for card recharge or initial issue"
    )
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'VIP Card Transaction'
        verbose_name_plural = 'VIP Card Transactions'

    def __str__(self):
        return f"{self.customer.display_name} - {self.get_transaction_type_display()}: ₹{self.amount} (Bal: ₹{self.balance_after})"


class SaleOrder(models.Model):
    """
    Point of Sale customer sale order / invoice record.
    """
    STATUS_COMPLETED = 'completed'
    STATUS_PARTIAL = 'partial'
    STATUS_REFUNDED = 'refunded'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_PARTIAL, 'Partially Paid (Due)'),
        (STATUS_REFUNDED, 'Refunded'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_CARD = 'card'
    PAYMENT_VIP_CARD = 'vip_card'
    PAYMENT_UPI = 'upi'
    PAYMENT_SPLIT = 'split'
    PAYMENT_PARTIAL = 'partial'
    PAYMENT_OTHER = 'other'
    PAYMENT_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_UPI, 'UPI / QR Code'),
        (PAYMENT_VIP_CARD, 'VIP Card'),
        (PAYMENT_CARD, 'Debit / Credit Card'),
        (PAYMENT_SPLIT, 'Split Payment (Cash + UPI)'),
        (PAYMENT_PARTIAL, 'Partial Payment (Due / Khata)'),
        (PAYMENT_OTHER, 'Other'),
    ]

    invoice_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique invoice reference number, e.g. INV-2026-00001."
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='sale_orders'
    )
    cashier = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_processed'
    )
    cashier_name = models.CharField(max_length=255, blank=True, default="Cashier")
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sale_orders'
    )
    customer_phone = models.CharField(max_length=30)
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_email = models.EmailField(blank=True, default="")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    vip_card_uid = models.CharField(max_length=100, blank=True, default="")
    vip_discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    split_cash_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Cash portion paid in split payment (₹)"
    )
    split_upi_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="UPI portion paid in split payment (₹)"
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        choices=PAYMENT_CHOICES,
        default=PAYMENT_CASH
    )
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total sum of all payments received so far (₹)"
    )
    balance_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Remaining balance owed by customer (total_amount - amount_paid)"
    )
    initial_payment_method = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Method used for initial payment when partial checkout occurs (cash, upi, card)"
    )
    is_fully_paid = models.BooleanField(
        default=True,
        db_index=True,
        help_text="True if order balance_due <= 0.00, False if pending dues exist"
    )
    change_returned = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_COMPLETED
    )
    return_reference = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Original invoice number if this order is a return/credit note."
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Sale Order'
        verbose_name_plural = 'Sale Orders'

    def __str__(self):
        return f"{self.invoice_number} - ₹{self.total_amount} ({self.customer_phone})"


class OrderPaymentTransaction(models.Model):
    """
    Audit record of each payment transaction received for a SaleOrder.
    Tracks initial checkout payments as well as subsequent partial due settlements,
    recording the exact date, time, cashier, and payment method (Cash, UPI, Card, etc.).
    """
    order = models.ForeignKey(
        SaleOrder,
        on_delete=models.CASCADE,
        related_name='payments',
        help_text="The sale order / invoice this payment applies to."
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='order_payments'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Amount received in this payment transaction (₹)"
    )
    payment_method = models.CharField(
        max_length=50,
        choices=[
            ('cash', 'Cash'),
            ('upi', 'UPI / QR Code'),
            ('card', 'Debit / Credit Card'),
            ('bank_transfer', 'Bank Transfer'),
            ('other', 'Other'),
        ],
        default='cash'
    )
    collected_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dues_collected'
    )
    collected_by_name = models.CharField(max_length=255, blank=True, default="Staff")
    transaction_reference = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Order Payment Transaction'
        verbose_name_plural = 'Order Payment Transactions'

    def __str__(self):
        return f"Payment #{self.id} for {self.order.invoice_number}: ₹{self.amount} via {self.payment_method}"


class SaleOrderItem(models.Model):
    """
    Line item snapshot within a SaleOrder.
    """
    sale_order = models.ForeignKey(
        SaleOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sale_items'
    )
    item_name = models.CharField(max_length=255)
    item_uid = models.CharField(max_length=64)
    unit_cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    unit_selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit_mrp = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    quantity = models.PositiveIntegerField(default=1)
    returned_quantity = models.PositiveIntegerField(
        default=0,
        help_text="Total units of this line item returned across return transactions."
    )
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['id']
        verbose_name = 'Sale Order Item'
        verbose_name_plural = 'Sale Order Items'

    def __str__(self):
        return f"{self.item_name} x {self.quantity} ({self.sale_order.invoice_number})"


class CounterPayout(models.Model):
    """
    On-counter cash / digital payout audit record.
    Used by cashiers/staff to record payments made from the store counter
    (e.g., incoming stock purchase, courier/freight, repairs, tea/refreshments, etc.).
    """
    CATEGORY_STOCK = 'stock_purchase'
    CATEGORY_FREIGHT = 'freight_delivery'
    CATEGORY_MAINTENANCE = 'store_maintenance'
    CATEGORY_DAILY_EXPENSE = 'daily_expense'
    CATEGORY_UTILITY = 'utility_bill'
    CATEGORY_REFUND = 'customer_refund'
    CATEGORY_STAFF_PAYOUT = 'staff_salary_payout'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_STOCK, 'Stock Delivery / Purchase'),
        (CATEGORY_FREIGHT, 'Freight & Courier / Transport'),
        (CATEGORY_MAINTENANCE, 'Store Repairs & Maintenance'),
        (CATEGORY_DAILY_EXPENSE, 'Tea & Daily Supplies / Refreshments'),
        (CATEGORY_UTILITY, 'Electricity / Internet / Utilities'),
        (CATEGORY_REFUND, 'Customer Return / Bill Refund'),
        (CATEGORY_STAFF_PAYOUT, 'Staff Salary / Wage Payout'),
        (CATEGORY_OTHER, 'Other Counter Expense'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_UPI = 'upi'
    PAYMENT_CARD = 'card'
    PAYMENT_BANK = 'bank_transfer'
    PAYMENT_OTHER = 'other'

    PAYMENT_CHOICES = [
        (PAYMENT_CASH, 'Cash'),
        (PAYMENT_UPI, 'UPI / Online QR'),
        (PAYMENT_CARD, 'Card'),
        (PAYMENT_BANK, 'Bank Transfer / NEFT'),
        (PAYMENT_OTHER, 'Other'),
    ]

    payout_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Sequential reference number, e.g. PAY-20260908-0001."
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='counter_payouts'
    )
    paid_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payouts_recorded'
    )
    paid_by_name = models.CharField(max_length=255, default="Cashier")
    paid_to = models.CharField(
        max_length=255,
        help_text="Name of the person / vendor / driver to whom the payment was made."
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        choices=PAYMENT_CHOICES,
        default=PAYMENT_CASH
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default=CATEGORY_STOCK
    )
    reason = models.TextField(
        blank=True,
        default="",
        help_text="Detailed purpose / reason for this counter payout."
    )
    receipt_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Supplier invoice, bill, LR, or voucher number."
    )
    paid_at = models.DateTimeField(
        default=timezone.now,
        help_text="Date and time when the payment occurred."
    )

    # --- Staff salary payout linkage ---
    employee = models.ForeignKey(
        'staff.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='counter_payouts',
        help_text="Staff employee whose wages are being paid (populated only for staff_salary_payout category)."
    )
    register_shift = models.ForeignKey(
        'DailyRegisterShift',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payouts',
        help_text="Register shift from which this cash payout was made."
    )
    is_post_close = models.BooleanField(
        default=False,
        help_text="True if this payout was made after the register shift was formally closed."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-paid_at', '-created_at']
        verbose_name = 'Counter Payout'
        verbose_name_plural = 'Counter Payouts'

    def __str__(self):
        return f"{self.payout_number} - ₹{self.amount} to {self.paid_to} ({self.get_category_display()})"


class DailyRegisterShift(models.Model):
    """
    Cash Register Shift / Drawer Management session.
    Tracks Day-Start Opening Cash Float and Day-End Closing Cash Reconciliation.
    """
    STATUS_OPEN = 'open'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open / In Progress'),
        (STATUS_CLOSED, 'Closed / Reconciled'),
    ]

    shift_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Sequential register shift reference number, e.g. REG-20260909-0001."
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='register_shifts'
    )
    cashier = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='register_shifts_opened'
    )
    cashier_name = models.CharField(max_length=255, default="Cashier")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_OPEN,
        db_index=True
    )
    opened_at = models.DateTimeField(
        default=timezone.now,
        help_text="Exact timestamp when the register shift was opened for the day"
    )
    opening_cash = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Starting physical cash float in drawer when opening counter (₹)"
    )
    opening_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes / denomination breakdown on Day-Start"
    )

    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Exact timestamp when the register shift was closed for the day"
    )
    closing_cash_counted = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual physical cash counted in drawer at Day-End (₹)"
    )
    cash_sales_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total customer cash sales recorded during this shift"
    )
    cash_payouts_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total cash counter payouts deducted during this shift"
    )
    expected_cash = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Expected drawer total = opening_cash + cash_sales - cash_payouts"
    )
    cash_difference = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Discrepancy amount = closing_cash_counted - expected_cash (0 = match, + = over, - = short)"
    )
    closing_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes / reason for any cash discrepancy on Day-End"
    )
    closed_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='register_shifts_closed'
    )
    closed_by_name = models.CharField(max_length=255, blank=True, default="")

    post_close_payouts_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total cash paid out after this shift was formally closed (e.g. manager paid staff wages from closed drawer). Deducted from net handover."
    )

    # Discrepancy Settlement & Audit Tracking
    is_discrepancy_settled = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if this shift discrepancy has been verified, settled, or cleared"
    )
    settled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when discrepancy was settled or cleared"
    )
    settled_by = models.ForeignKey(
        'staff.StaffMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='register_shifts_settled'
    )
    settled_by_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Name of manager or admin who settled/cleared the discrepancy"
    )
    settlement_action = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Action taken (e.g. approved_loss, recovered_from_cashier, reconciled_counting_error, surplus_deposited, waived, other)"
    )
    settlement_notes = models.TextField(
        blank=True,
        default="",
        help_text="Audit notes explaining verification and settlement/clearance"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-opened_at', '-id']
        verbose_name = 'Daily Register Shift'
        verbose_name_plural = 'Daily Register Shifts'

    def __str__(self):
        status_label = "OPEN" if self.status == self.STATUS_OPEN else f"CLOSED (Diff: ₹{self.cash_difference})"
        return f"{self.shift_number} - {self.store.name} [{status_label}]"

    @property
    def net_handover_cash(self):
        """Cash actually handed over = closing counted minus any post-close payouts."""
        if self.closing_cash_counted is not None:
            return self.closing_cash_counted - self.post_close_payouts_amount
        return None

    def save(self, *args, **kwargs):
        if not self.shift_number:
            today_str = timezone.now().strftime('%Y%m%d')
            prefix = f"REG-{today_str}-"
            last_shift = DailyRegisterShift.objects.filter(shift_number__startswith=prefix).order_by('-shift_number').first()
            if last_shift and last_shift.shift_number.startswith(prefix):
                try:
                    last_seq = int(last_shift.shift_number.split('-')[-1])
                    next_seq = last_seq + 1
                except Exception:
                    next_seq = 1
            else:
                next_seq = 1

            candidate = f"{prefix}{next_seq:04d}"
            while DailyRegisterShift.objects.filter(shift_number=candidate).exists():
                next_seq += 1
                candidate = f"{prefix}{next_seq:04d}"

            self.shift_number = candidate
        super().save(*args, **kwargs)


