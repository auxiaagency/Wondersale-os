from rest_framework import serializers
from decimal import Decimal

from .models import (
    Store, Category, SubCategory, Supplier, Section, Item, StockMovement, ItemImage,
    Customer, SaleOrder, SaleOrderItem, OrderPaymentTransaction, VIPCardTransaction,
    CounterPayout, DailyRegisterShift, AIDescriptionBatchJob, BrokenItemReport
)
from .services import adjust_stock, generate_next_uid, report_broken_item


class StoreSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    staff_count = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'address',
            'city',
            'state',
            'pincode',
            'phone',
            'email',
            'gst_number',
            'gst_rate',
            'gst_calculation_mode',
            'enable_gst',
            'enable_stakeholders',
            'is_active',
            'allow_manual_uid',
            'items_count',
            'staff_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'items_count', 'staff_count', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_staff_count(self, obj):
        if hasattr(obj, 'staff_members'):
            return obj.staff_members.count()
        return 0


class SectionSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    staff_count = serializers.SerializerMethodField()
    total_units = serializers.SerializerMethodField()
    total_stock_value = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True, allow_null=True)

    class Meta:
        model = Section
        fields = [
            'id',
            'name',
            'code',
            'description',
            'color',
            'store',
            'store_name',
            'is_active',
            'items_count',
            'staff_count',
            'total_units',
            'total_stock_value',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store_name', 'items_count', 'staff_count', 'total_units', 'total_stock_value', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_staff_count(self, obj):
        if hasattr(obj, 'staff_members'):
            return obj.staff_members.count()
        return 0

    def get_total_units(self, obj):
        from django.db.models import Sum
        res = obj.items.aggregate(total=Sum('quantity'))['total']
        return res if res is not None else 0

    def get_total_stock_value(self, obj):
        from decimal import Decimal
        items = obj.items.all()
        return float(sum((it.quantity or 0) * (it.cost_price or Decimal('0.00')) for it in items))


class SupplierSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True, allow_null=True)

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'contact_person',
            'phone',
            'email',
            'address',
            'city',
            'state',
            'pincode',
            'gst_number',
            'notes',
            'store',
            'store_name',
            'is_active',
            'items_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store_name', 'items_count', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()


class SubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'category', 'category_name', 'items_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'category_name', 'items_count', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'subcategories', 'items_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'subcategories', 'items_count', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return Item.objects.filter(subcategories__category=obj).distinct().count()


class ItemImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ItemImage
        fields = ['id', 'item', 'image', 'image_url', 'is_primary', 'order', 'created_at']
        read_only_fields = ['id', 'created_at', 'image_url']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


from staff.services.auth import get_current_staff


class StockMovementSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    item_uid = serializers.CharField(source='item.uid', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    store_id = serializers.IntegerField(source='item.store.id', read_only=True)
    store_name = serializers.CharField(source='item.store.name', read_only=True)
    item_current_quantity = serializers.IntegerField(source='item.quantity', read_only=True)
    performed_by_id = serializers.IntegerField(source='performed_by.id', read_only=True, allow_null=True)
    performed_by_staff_id = serializers.CharField(source='performed_by.staff_id', read_only=True, allow_null=True)
    performed_by_name = serializers.SerializerMethodField()
    performed_by_role = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id',
            'item',
            'item_uid',
            'item_name',
            'store_id',
            'store_name',
            'item_current_quantity',
            'change',
            'reason',
            'reason_display',
            'note',
            'performed_by_id',
            'performed_by_staff_id',
            'performed_by_name',
            'performed_by_role',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'reason_display',
            'item_uid',
            'item_name',
            'store_id',
            'store_name',
            'item_current_quantity',
            'performed_by_id',
            'performed_by_staff_id',
            'performed_by_name',
            'performed_by_role',
        ]

    def get_performed_by_name(self, obj):
        if obj.performed_by and obj.performed_by.name:
            return obj.performed_by.name
        if obj.performed_by_name:
            return obj.performed_by_name
        return "Owner / Admin"

    def get_performed_by_role(self, obj):
        if obj.performed_by and obj.performed_by.role:
            return obj.performed_by.role.name
        if obj.performed_by_role:
            return obj.performed_by_role
        return "Owner"


class BrokenItemReportSerializer(serializers.ModelSerializer):
    item_uid = serializers.CharField(source='item.uid', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_current_stock = serializers.IntegerField(source='item.quantity', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    category_name = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()
    proof_image_url = serializers.SerializerMethodField()
    fined_employee_name = serializers.CharField(source='fined_employee.name', read_only=True, allow_null=True)

    class Meta:
        model = BrokenItemReport
        fields = [
            'id',
            'item',
            'item_uid',
            'item_name',
            'item_current_stock',
            'store',
            'store_name',
            'section',
            'section_name',
            'category_name',
            'supplier_name',
            'quantity',
            'cost_price',
            'total_loss',
            'reason',
            'proof_image',
            'proof_image_url',
            'reported_by',
            'reported_by_name',
            'fined_employee',
            'fined_employee_name',
            'fine_amount',
            'fine_ledger_entry',
            'is_fined',
            'fined_at',
            'is_waived',
            'waived_at',
            'waived_by',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'item_uid',
            'item_name',
            'item_current_stock',
            'store_name',
            'section_name',
            'category_name',
            'supplier_name',
            'cost_price',
            'total_loss',
            'is_fined',
            'fined_at',
            'is_waived',
            'waived_at',
            'waived_by',
            'total_loss',
            'proof_image_url',
            'reported_by_name',
            'fined_employee_name',
            'fine_ledger_entry',
            'created_at',
        ]

    def get_category_name(self, obj):
        if not obj.item:
            return "Uncategorized"
        eff_cat = getattr(obj.item, 'effective_primary_category', None)
        if eff_cat:
            return eff_cat.name
        first_sub = obj.item.subcategories.select_related('category').first()
        if first_sub and first_sub.category:
            return first_sub.category.name
        return "Uncategorized"

    def get_supplier_name(self, obj):
        if obj.item and obj.item.supplier:
            return obj.item.supplier.name
        return "Direct / Unknown"

    def get_proof_image_url(self, obj):
        if obj.proof_image:
            try:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.proof_image.url)
                return obj.proof_image.url
            except Exception:
                return None
        return None




class StoreNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = [
            'id', 'name', 'address', 'city', 'state', 'pincode', 'phone', 'email',
            'gst_number', 'gst_rate', 'gst_calculation_mode', 'enable_gst',
            'enable_stakeholders', 'is_active', 'allow_manual_uid', 'created_at', 'updated_at'
        ]


class SectionNestedSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True, allow_null=True)

    class Meta:
        model = Section
        fields = [
            'id', 'name', 'code', 'description', 'color', 'store', 'store_name', 'is_active',
            'created_at', 'updated_at'
        ]


class SupplierNestedSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True, allow_null=True)

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_person', 'phone', 'email', 'address', 'city',
            'state', 'pincode', 'gst_number', 'notes', 'store', 'store_name', 'is_active',
            'created_at', 'updated_at'
        ]


class SubCategoryNestedSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'category', 'category_name', 'created_at', 'updated_at']


class CategoryNestedSerializer(serializers.ModelSerializer):
    subcategories = SubCategoryNestedSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'subcategories', 'created_at', 'updated_at']


class ItemSerializer(serializers.ModelSerializer):
    effective_mrp = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    subcategories = SubCategoryNestedSerializer(many=True, read_only=True)
    categories = CategoryNestedSerializer(source='parent_categories', many=True, read_only=True)
    primary_subcategory = SubCategoryNestedSerializer(source='effective_primary_subcategory', read_only=True)
    primary_category = CategoryNestedSerializer(source='effective_primary_category', read_only=True)
    primary_subcategory_id = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(),
        source='primary_subcategory',
        required=False,
        allow_null=True
    )
    subcategory_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SubCategory.objects.all(),
        source='subcategories',
        write_only=True,
        required=False
    )
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        required=False,
        allow_null=True
    )
    supplier_details = SupplierNestedSerializer(source='supplier', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True
    )
    section_id = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        source='section',
        required=False,
        allow_null=True
    )
    section_details = SectionNestedSerializer(source='section', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    section_color = serializers.CharField(source='section.color', read_only=True, allow_null=True)
    section_code = serializers.CharField(source='section.code', read_only=True, allow_null=True)
    store_details = StoreNestedSerializer(source='store', read_only=True)
    store = serializers.PrimaryKeyRelatedField(queryset=Store.objects.all())
    images = ItemImageSerializer(many=True, read_only=True)
    primary_image_url = serializers.SerializerMethodField()
    sibling_variants = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id',
            'uid',
            'name',
            'quantity',
            'cost_price',
            'selling_price',
            'mrp',
            'effective_mrp',
            'subcategories',
            'categories',
            'primary_subcategory',
            'primary_category',
            'primary_subcategory_id',
            'subcategory_ids',
            'supplier',
            'supplier_name',
            'supplier_details',
            'section',
            'section_id',
            'section_name',
            'section_color',
            'section_code',
            'section_details',
            'store',
            'store_details',
            'location_section',
            'expiry_date',
            'weight',
            'length',
            'width',
            'height',
            'description',
            'ai_description_draft',
            'ai_description_status',
            'ai_description_error',
            'ai_description_updated_at',
            'volume_cm3',
            'volumetric_weight_kg',
            'dimensions_display',
            'source',
            'legacy_uid',
            'needs_new_barcode_printed',
            'is_listed_on_website',
            'variant_group_id',
            'variant_name',
            'is_master_variant',
            'sibling_variants',
            'variant_count',
            'images',
            'primary_image_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'quantity',
            'effective_mrp',
            'volume_cm3',
            'volumetric_weight_kg',
            'dimensions_display',
            'primary_subcategory',
            'primary_category',
            'supplier_name',
            'supplier_details',
            'section_name',
            'section_color',
            'section_code',
            'section_details',
            'sibling_variants',
            'variant_count',
            'created_at',
            'updated_at',
        ]

    def get_primary_image_url(self, obj):
        request = self.context.get('request')
        primary = obj.primary_image
        if primary and primary.image:
            if request:
                return request.build_absolute_uri(primary.image.url)
            return primary.image.url
        return None

    def get_sibling_variants(self, obj):
        if not obj.variant_group_id:
            return []
        groups_cache = self.context.get('variant_groups_cache')
        if groups_cache is not None and obj.variant_group_id in groups_cache:
            return groups_cache[obj.variant_group_id]

        request = self.context.get('request')
        siblings = Item.objects.filter(variant_group_id=obj.variant_group_id).prefetch_related('images', 'subcategories').select_related('supplier').order_by('-is_master_variant', 'id')
        result = []
        for s in siblings:
            prim_img = s.images.filter(is_primary=True).first() or s.images.first()
            img_url = None
            if prim_img and prim_img.image:
                img_url = request.build_absolute_uri(prim_img.image.url) if request else prim_img.image.url
            result.append({
                'id': s.id,
                'uid': s.uid,
                'name': s.name,
                'variant_name': s.variant_name or ('Original' if s.is_master_variant else f"Batch {s.uid}"),
                'quantity': s.quantity,
                'cost_price': str(s.cost_price),
                'selling_price': str(s.selling_price),
                'mrp': str(s.mrp) if s.mrp else None,
                'effective_mrp': str(s.effective_mrp),
                'expiry_date': str(s.expiry_date) if s.expiry_date else None,
                'weight': str(s.weight) if s.weight is not None else None,
                'length': str(s.length) if s.length is not None else None,
                'width': str(s.width) if s.width is not None else None,
                'height': str(s.height) if s.height is not None else None,
                'location_section': s.location_section,
                'supplier_name': s.supplier.name if s.supplier else None,
                'description': s.description,
                'needs_new_barcode_printed': s.needs_new_barcode_printed,
                'subcategories': [{'id': sc.id, 'name': sc.name} for sc in s.subcategories.all()],
                'is_master_variant': s.is_master_variant,
                'primary_image_url': img_url,
            })
        return result

    def get_variant_count(self, obj):
        if not obj.variant_group_id:
            return 1
        return len(self.get_sibling_variants(obj))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request:
            from staff.services.auth import get_current_staff
            staff = get_current_staff(request)
            # If current staff is Cashier, redact cost price and supplier details
            if staff and not staff.is_owner:
                role_name = (staff.role.name or '').lower() if staff.role else ''
                allowed = staff.role.allowed_modules or []
                if 'cashier' in role_name or (allowed == ['billing']):
                    data.pop('cost_price', None)
                    data.pop('supplier', None)
                    data.pop('supplier_name', None)
                    data.pop('supplier_details', None)
                    # Also redact from siblings
                    if 'sibling_variants' in data and isinstance(data['sibling_variants'], list):
                        for s in data['sibling_variants']:
                            s.pop('cost_price', None)
                            s.pop('supplier_name', None)
        return data


class ItemCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer specifically for item creation and updates.
    Accepts optional custom UID (if enabled / provided), otherwise auto-generates
    the next sequential integer UID starting at 1,000,000.
    Accepts initial_quantity or quantity which records a stock movement ledger entry.
    """
    uid = serializers.CharField(
        max_length=64,
        required=False,
        allow_blank=True,
        help_text="Optional custom/legacy UID. Auto-generated if not supplied."
    )
    initial_quantity = serializers.IntegerField(
        required=False,
        default=0,
        write_only=True,
        help_text="Optional starting inventory quantity."
    )
    quantity = serializers.IntegerField(
        required=False,
        write_only=True,
        help_text="Target inventory quantity for updates or creation."
    )
    subcategories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SubCategory.objects.all(),
        required=False
    )
    primary_subcategory = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(),
        required=False,
        allow_null=True
    )
    primary_subcategory_id = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(),
        source='primary_subcategory',
        required=False,
        allow_null=True
    )
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        required=False,
        allow_null=True
    )
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='supplier',
        required=False,
        allow_null=True
    )
    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True
    )
    section_id = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        source='section',
        required=False,
        allow_null=True
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional product description."
    )
    ai_description_draft = serializers.CharField(
        required=False,
        allow_blank=True,
        default=""
    )
    ai_description_status = serializers.CharField(
        required=False,
        allow_blank=True,
        default="none"
    )

    class Meta:
        model = Item
        fields = [
            'id',
            'uid',
            'name',
            'cost_price',
            'selling_price',
            'mrp',
            'subcategories',
            'primary_subcategory',
            'primary_subcategory_id',
            'supplier',
            'supplier_id',
            'section',
            'section_id',
            'store',
            'location_section',
            'expiry_date',
            'weight',
            'length',
            'width',
            'height',
            'description',
            'ai_description_draft',
            'ai_description_status',
            'source',
            'legacy_uid',
            'needs_new_barcode_printed',
            'initial_quantity',
            'quantity',
        ]
        read_only_fields = ['id']

    def validate_uid(self, value):
        if value:
            cleaned = str(value).strip()
            if cleaned:
                qs = Item.objects.filter(uid__iexact=cleaned)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                if qs.exists():
                    raise serializers.ValidationError(f"Item with UID / Barcode '{cleaned}' already exists in inventory.")
                return cleaned
        return value

    def create(self, validated_data):
        initial_quantity = validated_data.pop('initial_quantity', None)
        target_quantity = validated_data.pop('quantity', None)
        qty = initial_quantity if initial_quantity is not None else (target_quantity or 0)
        subcategories = validated_data.pop('subcategories', [])

        validated_data.setdefault('needs_new_barcode_printed', True)

        custom_uid = validated_data.get('uid')
        if custom_uid and str(custom_uid).strip():
            validated_data['uid'] = str(custom_uid).strip()
            if not validated_data.get('source'):
                validated_data['source'] = Item.SOURCE_LEGACY
            if not validated_data.get('legacy_uid'):
                validated_data['legacy_uid'] = validated_data['uid']
        else:
            # Auto-generate next sequential UID
            validated_data['uid'] = generate_next_uid()
            validated_data['source'] = Item.SOURCE_NEW

        item = Item.objects.create(**validated_data)
        if subcategories:
            item.subcategories.set(subcategories)
            if not item.primary_subcategory:
                item.primary_subcategory = subcategories[0]
                item.save(update_fields=['primary_subcategory'])
            elif item.primary_subcategory not in subcategories:
                item.subcategories.add(item.primary_subcategory)
        elif item.primary_subcategory:
            item.subcategories.add(item.primary_subcategory)

        request = self.context.get('request')
        staff = get_current_staff(request) if request else None
        adjust_stock(
            item=item,
            change=qty,
            reason=StockMovement.REASON_RESTOCK,
            note="Initial stock assigned upon product creation." if qty > 0 else "Product registered with 0 initial stock.",
            performed_by=staff
        )

        return item

    def update(self, instance, validated_data):
        target_quantity = validated_data.pop('quantity', None)
        subcategories = validated_data.pop('subcategories', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if subcategories is not None:
            instance.subcategories.set(subcategories)
            if instance.primary_subcategory and instance.primary_subcategory not in instance.subcategories.all():
                instance.subcategories.add(instance.primary_subcategory)
            elif not instance.primary_subcategory and instance.subcategories.exists():
                instance.primary_subcategory = instance.subcategories.first()
                instance.save(update_fields=['primary_subcategory'])
        elif instance.primary_subcategory and not instance.subcategories.filter(pk=instance.primary_subcategory.pk).exists():
            instance.subcategories.add(instance.primary_subcategory)

        if target_quantity is not None and target_quantity != instance.quantity:
            diff = target_quantity - instance.quantity
            request = self.context.get('request')
            staff = get_current_staff(request) if request else None
            adjust_stock(
                item=instance,
                change=diff,
                reason=StockMovement.REASON_MANUAL_ADJUSTMENT,
                note=f"Stock updated to {target_quantity} via item edit.",
                performed_by=staff
            )

        return instance

    def to_representation(self, instance):
        return ItemSerializer(instance, context=self.context).data


class StockAdjustmentSerializer(serializers.Serializer):
    change = serializers.IntegerField(required=True)
    reason = serializers.ChoiceField(
        choices=StockMovement.REASON_CHOICES,
        default=StockMovement.REASON_MANUAL_ADJUSTMENT
    )
    note = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default=""
    )

    def validate_change(self, value):
        if value == 0:
            raise serializers.ValidationError("Adjustment change cannot be 0.")
        return value


# ----------------- Customer & POS Billing Serializers -----------------

from django.utils import timezone
from .models import Customer, SaleOrder, SaleOrderItem, CounterPayout


def generate_next_payout_number(store=None) -> str:
    """Generates sequential daily payout reference number e.g. PAY-20260908-0001 with collision prevention."""
    from django.db import transaction
    from .models import GlobalSequence

    today_str = timezone.now().strftime('%Y%m%d')
    prefix = f"PAY-{today_str}-"
    seq_name = f"payout_{today_str}"

    with transaction.atomic():
        seq_obj, created = GlobalSequence.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': 0}
        )
        if created or seq_obj.current_value == 0:
            last_payout = CounterPayout.objects.filter(payout_number__startswith=prefix).order_by('-payout_number').first()
            if last_payout and last_payout.payout_number.startswith(prefix):
                try:
                    seq_obj.current_value = int(last_payout.payout_number.split('-')[-1])
                except Exception:
                    seq_obj.current_value = 0

        seq_obj.current_value += 1
        candidate_seq = seq_obj.current_value
        candidate = f"{prefix}{candidate_seq:04d}"
        while CounterPayout.objects.filter(payout_number=candidate).exists():
            candidate_seq += 1
            candidate = f"{prefix}{candidate_seq:04d}"
        seq_obj.current_value = candidate_seq
        seq_obj.save(update_fields=['current_value', 'updated_at'])

    return candidate


class CounterPayoutSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = CounterPayout
        fields = [
            'id',
            'payout_number',
            'store',
            'store_name',
            'paid_by',
            'paid_by_name',
            'paid_to',
            'amount',
            'payment_method',
            'payment_method_display',
            'category',
            'category_display',
            'reason',
            'receipt_number',
            'paid_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'payout_number',
            'store_name',
            'category_display',
            'payment_method_display',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        if not validated_data.get('payout_number'):
            validated_data['payout_number'] = generate_next_payout_number(validated_data.get('store'))
        return super().create(validated_data)


def generate_next_shift_number(store=None) -> str:
    """Generates sequential daily register shift number e.g. REG-20260909-0001 with collision prevention."""
    from django.db import transaction
    from .models import GlobalSequence

    today_str = timezone.now().strftime('%Y%m%d')
    prefix = f"REG-{today_str}-"
    seq_name = f"shift_{today_str}"

    with transaction.atomic():
        seq_obj, created = GlobalSequence.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': 0}
        )
        if created or seq_obj.current_value == 0:
            last_shift = DailyRegisterShift.objects.filter(shift_number__startswith=prefix).order_by('-shift_number').first()
            if last_shift and last_shift.shift_number.startswith(prefix):
                try:
                    seq_obj.current_value = int(last_shift.shift_number.split('-')[-1])
                except Exception:
                    seq_obj.current_value = 0

        seq_obj.current_value += 1
        candidate_seq = seq_obj.current_value
        candidate = f"{prefix}{candidate_seq:04d}"
        while DailyRegisterShift.objects.filter(shift_number=candidate).exists():
            candidate_seq += 1
            candidate = f"{prefix}{candidate_seq:04d}"
        seq_obj.current_value = candidate_seq
        seq_obj.save(update_fields=['current_value', 'updated_at'])

    return candidate


class DailyRegisterShiftSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    cashier_staff_id = serializers.CharField(source='cashier.staff_id', read_only=True)
    opened_by_name = serializers.CharField(source='cashier_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DailyRegisterShift
        fields = [
            'id',
            'shift_number',
            'store',
            'store_name',
            'cashier',
            'cashier_name',
            'opened_by_name',
            'cashier_staff_id',
            'status',
            'status_display',
            'opened_at',
            'opening_cash',
            'opening_notes',
            'closed_at',
            'closing_cash_counted',
            'cash_sales_amount',
            'cash_payouts_amount',
            'expected_cash',
            'cash_difference',
            'closing_notes',
            'closed_by',
            'closed_by_name',
            'is_discrepancy_settled',
            'settled_at',
            'settled_by',
            'settled_by_name',
            'settlement_action',
            'settlement_notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'shift_number',
            'store_name',
            'cashier_staff_id',
            'status_display',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        if not validated_data.get('shift_number'):
            validated_data['shift_number'] = generate_next_shift_number(validated_data.get('store'))
        return super().create(validated_data)



def generate_next_invoice_number(store=None) -> str:
    """Generates sequential daily invoice number e.g. INV-20260907-0001 with collision prevention."""
    from django.db import transaction
    from .models import GlobalSequence

    today_str = timezone.now().strftime('%Y%m%d')
    prefix = f"INV-{today_str}-"
    seq_name = f"invoice_{today_str}"

    with transaction.atomic():
        seq_obj, created = GlobalSequence.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': 0}
        )
        if created or seq_obj.current_value == 0:
            last_order = SaleOrder.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').first()
            if last_order and last_order.invoice_number.startswith(prefix):
                try:
                    seq_obj.current_value = int(last_order.invoice_number.split('-')[-1])
                except Exception:
                    seq_obj.current_value = 0

        seq_obj.current_value += 1
        candidate_seq = seq_obj.current_value
        candidate = f"{prefix}{candidate_seq:04d}"
        while SaleOrder.objects.filter(invoice_number=candidate).exists():
            candidate_seq += 1
            candidate = f"{prefix}{candidate_seq:04d}"
        seq_obj.current_value = candidate_seq
        seq_obj.save(update_fields=['current_value', 'updated_at'])

    return candidate


def generate_next_return_number(store=None) -> str:
    """Generates sequential daily return voucher number e.g. RET-20260911-0001 with collision prevention."""
    from django.db import transaction
    from .models import GlobalSequence

    today_str = timezone.now().strftime('%Y%m%d')
    prefix = f"RET-{today_str}-"
    seq_name = f"return_{today_str}"

    with transaction.atomic():
        seq_obj, created = GlobalSequence.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': 0}
        )
        if created or seq_obj.current_value == 0:
            last_order = SaleOrder.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').first()
            if last_order and last_order.invoice_number.startswith(prefix):
                try:
                    seq_obj.current_value = int(last_order.invoice_number.split('-')[-1])
                except Exception:
                    seq_obj.current_value = 0

        seq_obj.current_value += 1
        candidate_seq = seq_obj.current_value
        candidate = f"{prefix}{candidate_seq:04d}"
        while SaleOrder.objects.filter(invoice_number=candidate).exists():
            candidate_seq += 1
            candidate = f"{prefix}{candidate_seq:04d}"
        seq_obj.current_value = candidate_seq
        seq_obj.save(update_fields=['current_value', 'updated_at'])

    return candidate


class CustomerSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    has_vip_card = serializers.BooleanField(read_only=True)
    total_outstanding_dues = serializers.SerializerMethodField()
    recent_orders = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'store',
            'store_name',
            'phone',
            'name',
            'display_name',
            'email',
            'address',
            'notes',
            'total_purchases_count',
            'total_spent',
            'total_outstanding_dues',
            'last_purchase_date',
            'has_vip_card',
            'vip_card_uid',
            'vip_card_balance',
            'vip_card_issued_at',
            'vip_card_status',
            'total_vip_savings',
            'recent_orders',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'store_name',
            'display_name',
            'has_vip_card',
            'total_outstanding_dues',
            'total_purchases_count',
            'total_spent',
            'last_purchase_date',
            'total_vip_savings',
            'recent_orders',
            'created_at',
            'updated_at',
        ]

    def validate_phone(self, value):
        import re
        clean = re.sub(r'\D', '', str(value).strip())
        if len(clean) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits (no more, no less).")
        qs = Customer.objects.filter(phone=clean)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Customer with phone number '{clean}' already exists.")
        return clean

    def validate_vip_card_uid(self, value):
        if not value:
            return None
        uid = str(value).strip().upper()
        if not uid:
            return None
        qs = Customer.objects.filter(vip_card_uid__iexact=uid)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"VIP Card UID '{uid}' is already assigned to another customer.")
        return uid

    def create(self, validated_data):
        from django.utils import timezone
        if validated_data.get('vip_card_uid') and not validated_data.get('vip_card_issued_at'):
            validated_data['vip_card_issued_at'] = timezone.now()
        customer = super().create(validated_data)
        if customer.vip_card_uid and customer.vip_card_balance > 0:
            request = self.context.get('request')
            staff_member = getattr(request, 'staff_member', None) if request else None
            store = customer.store or (staff_member.store if staff_member else None)
            VIPCardTransaction.objects.create(
                customer=customer,
                store=store,
                card_uid=customer.vip_card_uid,
                transaction_type=VIPCardTransaction.TYPE_ISSUE,
                amount=customer.vip_card_balance,
                balance_after=customer.vip_card_balance,
                notes="VIP Card assigned during customer profile creation"
            )
        return customer

    def update(self, instance, validated_data):
        from django.utils import timezone
        from decimal import Decimal

        old_uid = instance.vip_card_uid
        old_balance = instance.vip_card_balance or Decimal('0.00')

        if 'vip_card_uid' in validated_data and not validated_data['vip_card_uid']:
            validated_data['vip_card_uid'] = None
            if 'vip_card_status' not in validated_data:
                validated_data['vip_card_status'] = 'inactive'
            if 'vip_card_balance' not in validated_data:
                validated_data['vip_card_balance'] = Decimal('0.00')

        new_uid = validated_data.get('vip_card_uid', old_uid)

        if new_uid and not old_uid and not instance.vip_card_issued_at:
            instance.vip_card_issued_at = timezone.now()

        customer = super().update(instance, validated_data)

        # Audit transactions if card detached or balance changed
        if old_uid and not customer.vip_card_uid:
            request = self.context.get('request')
            staff_member = getattr(request, 'staff_member', None) if request else None
            store = customer.store or (staff_member.store if staff_member else None)
            VIPCardTransaction.objects.create(
                customer=customer,
                store=store,
                card_uid=old_uid,
                transaction_type=VIPCardTransaction.TYPE_REFUND,
                amount=old_balance,
                balance_after=customer.vip_card_balance or Decimal('0.00'),
                notes="VIP Card detached via customer profile edit"
            )
        elif 'vip_card_balance' in validated_data and customer.vip_card_uid:
            new_balance = customer.vip_card_balance or Decimal('0.00')
            diff = Decimal(str(new_balance)) - Decimal(str(old_balance))
            if diff != Decimal('0.00'):
                request = self.context.get('request')
                staff_member = getattr(request, 'staff_member', None) if request else None
                store = customer.store or (staff_member.store if staff_member else None)
                tx_type = (
                    VIPCardTransaction.TYPE_ISSUE
                    if (not old_uid and new_uid)
                    else (VIPCardTransaction.TYPE_RECHARGE if diff > 0 else VIPCardTransaction.TYPE_DEBIT)
                )
                VIPCardTransaction.objects.create(
                    customer=customer,
                    store=store,
                    card_uid=customer.vip_card_uid,
                    transaction_type=tx_type,
                    amount=abs(diff),
                    balance_after=new_balance,
                    notes="Balance adjusted via customer profile edit"
                )

        return customer

    def get_total_outstanding_dues(self, obj):
        from decimal import Decimal
        from django.db.models import Sum
        val = obj.sale_orders.filter(balance_due__gt=Decimal('0.00'), is_fully_paid=False).exclude(status='cancelled').aggregate(total=Sum('balance_due'))['total']
        return float(val or Decimal('0.00'))

    def get_recent_orders(self, obj):
        orders = obj.sale_orders.all().order_by('-created_at')[:5]
        return [
            {
                'id': o.id,
                'invoice_number': o.invoice_number,
                'total_amount': str(o.total_amount),
                'amount_paid': str(o.amount_paid),
                'balance_due': str(o.balance_due),
                'is_fully_paid': o.is_fully_paid,
                'payment_method': o.payment_method,
                'status': o.status,
                'items_count': o.items.count(),
                'created_at': o.created_at,
            }
            for o in orders
        ]


class VIPCardTransactionSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = VIPCardTransaction
        fields = [
            'id',
            'card_uid',
            'transaction_type',
            'transaction_type_display',
            'amount',
            'balance_after',
            'store',
            'store_name',
            'sale_order',
            'payment_method',
            'notes',
            'created_at',
        ]
        read_only_fields = fields


class VIPCardAssignSerializer(serializers.Serializer):
    card_uid = serializers.CharField(max_length=100, required=True)
    initial_credit = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('500.00'))
    payment_method = serializers.ChoiceField(choices=['cash', 'upi'], default='cash', required=False)

    def validate_card_uid(self, value):
        from staff.models import RFIDCard
        from inventory.card_service import normalize_card_uid
        clean_uid = normalize_card_uid(value)
        if not clean_uid:
            raise serializers.ValidationError("Card UID cannot be empty.")

        # Check if already assigned to another customer
        customer_id = self.context.get('customer_id')
        existing_cust = Customer.objects.filter(vip_card_uid__iexact=clean_uid).exclude(id=customer_id).first()
        if existing_cust:
            raise serializers.ValidationError(
                f"This RFID Card (UID: {clean_uid}) is already assigned as a VIP Card to Customer {existing_cust.display_name} ({existing_cust.phone})."
            )

        # Check if already actively assigned to an employee as an attendance card
        existing_emp_card = RFIDCard.objects.filter(card_uid__iexact=clean_uid, status=RFIDCard.STATUS_ACTIVE).select_related('employee', 'employee__store').first()
        if existing_emp_card:
            emp = existing_emp_card.employee
            store_name = f" at {emp.store.name}" if emp.store else ""
            raise serializers.ValidationError(
                f"This RFID Card (UID: {clean_uid}) is already assigned as an Attendance Card to Employee {emp.name} ({emp.employee_code}){store_name}. A card cannot be both a Customer VIP Card and an Employee Attendance Card."
            )

        return clean_uid


class VIPCardRechargeSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('1.00'), required=True)
    payment_method = serializers.ChoiceField(choices=['cash', 'upi'], default='cash', required=False)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, default="Card recharge")


class SaleOrderItemSerializer(serializers.ModelSerializer):
    returnable_quantity = serializers.SerializerMethodField()
    effective_unit_price = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrderItem
        fields = [
            'id',
            'item',
            'item_name',
            'item_uid',
            'unit_cost_price',
            'unit_selling_price',
            'effective_unit_price',
            'has_discount',
            'unit_mrp',
            'quantity',
            'returned_quantity',
            'returnable_quantity',
            'total_price',
        ]
        read_only_fields = ['id', 'returned_quantity', 'returnable_quantity', 'effective_unit_price', 'has_discount']

    def get_returnable_quantity(self, obj):
        return max(0, obj.quantity - (obj.returned_quantity or 0))

    def get_effective_unit_price(self, obj):
        if obj.quantity <= 0:
            return float(obj.unit_selling_price)
        order = obj.sale_order
        line_base = obj.total_price or Decimal('0.00')
        if order:
            items_total = sum((it.total_price for it in order.items.all()), Decimal('0.00'))
            if items_total > Decimal('0.00') and order.total_amount < items_total:
                ratio = order.total_amount / items_total
                line_effective = (line_base * ratio).quantize(Decimal('0.01'))
            else:
                line_effective = line_base
        else:
            line_effective = line_base
        unit_price = (line_effective / Decimal(obj.quantity)).quantize(Decimal('0.01'))
        return float(unit_price)

    def get_has_discount(self, obj):
        eff = self.get_effective_unit_price(obj)
        orig = float(obj.unit_selling_price)
        return eff < (orig - 0.001)


class OrderPaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPaymentTransaction
        fields = [
            'id',
            'order',
            'store',
            'amount',
            'payment_method',
            'collected_by',
            'collected_by_name',
            'transaction_reference',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SaleOrderSerializer(serializers.ModelSerializer):
    items = SaleOrderItemSerializer(many=True, read_only=True)
    payments = OrderPaymentTransactionSerializer(many=True, read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_address = serializers.CharField(source='store.address', read_only=True)
    store_city = serializers.CharField(source='store.city', read_only=True)
    store_state = serializers.CharField(source='store.state', read_only=True)
    store_pincode = serializers.CharField(source='store.pincode', read_only=True)
    store_phone = serializers.CharField(source='store.phone', read_only=True)
    store_email = serializers.CharField(source='store.email', read_only=True)
    store_gst_number = serializers.CharField(source='store.gst_number', read_only=True)
    store_details = StoreSerializer(source='store', read_only=True)
    customer_display_name = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()
    is_return = serializers.SerializerMethodField()

    class Meta:
        model = SaleOrder
        fields = [
            'id',
            'invoice_number',
            'return_reference',
            'store',
            'store_name',
            'store_address',
            'store_city',
            'store_state',
            'store_pincode',
            'store_phone',
            'store_email',
            'store_gst_number',
            'store_details',
            'customer',
            'customer_phone',
            'customer_name',
            'customer_display_name',
            'cashier',
            'cashier_name',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'vip_card_uid',
            'vip_discount_amount',
            'split_cash_amount',
            'split_upi_amount',
            'total_amount',
            'payment_method',
            'amount_paid',
            'balance_due',
            'initial_payment_method',
            'is_fully_paid',
            'change_returned',
            'status',
            'notes',
            'items',
            'payments',
            'is_editable',
            'is_return',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'invoice_number',
            'return_reference',
            'created_at',
            'updated_at',
            'store_name',
            'store_address',
            'store_city',
            'store_state',
            'store_pincode',
            'store_phone',
            'store_email',
            'store_gst_number',
            'store_details',
            'customer_display_name',
            'balance_due',
            'is_fully_paid',
            'is_editable',
            'is_return',
        ]

    def get_customer_display_name(self, obj):
        if obj.customer_name and obj.customer_name.strip():
            return obj.customer_name.strip()
        if obj.customer and obj.customer.name and obj.customer.name.strip():
            return obj.customer.name.strip()
        return ""

    def get_is_return(self, obj):
        return bool(
            (obj.invoice_number and obj.invoice_number.startswith('RET-')) or
            obj.return_reference or
            obj.status == 'refunded'
        )

    def get_is_editable(self, obj):
        if (obj.invoice_number and obj.invoice_number.startswith('RET-')) or obj.return_reference or obj.status == 'refunded':
            return False
        from .models import DailyRegisterShift
        open_shift = DailyRegisterShift.objects.filter(
            store=obj.store,
            status=DailyRegisterShift.STATUS_OPEN
        ).order_by('-opened_at').first()
        if not open_shift:
            return False
        # Only orders created on or after the current open shift's opened_at are editable
        return obj.created_at >= open_shift.opened_at

    def update(self, instance, validated_data):
        from django.db import transaction
        from .models import Item, SaleOrderItem, StockMovement, Customer, VIPCardTransaction
        from .services import adjust_stock

        # 1. Enforce Shift Immutability Rule
        if not self.get_is_editable(instance):
            raise serializers.ValidationError({
                "error": "This invoice belongs to a closed register shift and is permanently locked/immutable."
            })

        with transaction.atomic():
            # 2. Handle Item Editing (Adding, removing, or changing item quantities)
            if 'items' in self.initial_data:
                raw_items = self.initial_data.get('items')
                if not isinstance(raw_items, list) or len(raw_items) == 0:
                    raise serializers.ValidationError({"items": "A sale order must contain at least one item."})

                request = self.context.get('request')
                staff = get_current_staff(request) if request else None

                existing_line_items = {soi.item_id: soi for soi in instance.items.select_related('item').all() if soi.item_id}
                incoming_items_map = {}
                for item_data in raw_items:
                    i_id = item_data.get('item_id') or item_data.get('id')
                    qty = int(item_data.get('quantity', 1))
                    if qty <= 0:
                        continue
                    unit_price = item_data.get('unit_selling_price') or item_data.get('unit_price')
                    incoming_items_map[int(i_id)] = {
                        'quantity': qty,
                        'unit_selling_price': Decimal(str(unit_price)) if unit_price is not None else None
                    }

                if not incoming_items_map:
                    raise serializers.ValidationError({"items": "Order must have at least one item with quantity > 0."})

                db_items = {item.id: item for item in Item.objects.select_for_update().filter(id__in=incoming_items_map.keys())}
                missing_ids = set(incoming_items_map.keys()) - set(db_items.keys())
                if missing_ids:
                    raise serializers.ValidationError({"items": f"Items with IDs {missing_ids} do not exist in inventory."})

                from django.db.models import Sum

                # Stock Ledger In-Place Synchronization:
                # 1. Validate stock availability for all increased/new items
                for new_item_id, new_data in incoming_items_map.items():
                    item_obj = db_items[new_item_id]
                    new_qty = new_data['quantity']
                    old_qty = existing_line_items[new_item_id].quantity if new_item_id in existing_line_items else 0
                    if new_qty > old_qty:
                        deduct_qty = new_qty - old_qty
                        item_obj.refresh_from_db()
                        if item_obj.quantity < deduct_qty:
                            raise serializers.ValidationError({
                                "items": f"Insufficient stock for '{item_obj.name}'. Additional required: {deduct_qty}, Available in store: {item_obj.quantity}."
                            })

                # 2. Find existing StockMovement entries for this sale invoice
                existing_movements = list(
                    StockMovement.objects.filter(
                        note__icontains=instance.invoice_number,
                        reason=StockMovement.REASON_SALE
                    )
                )
                movements_by_item = {sm.item_id: sm for sm in existing_movements}

                affected_items = set(db_items.values())
                for old_id, old_soi in existing_line_items.items():
                    if old_id not in incoming_items_map and old_soi.item:
                        affected_items.add(old_soi.item)

                unused_movements = []
                # Removed items: free up their StockMovement entry
                for old_item_id, old_soi in existing_line_items.items():
                    if old_item_id not in incoming_items_map:
                        if old_item_id in movements_by_item:
                            unused_movements.append(movements_by_item.pop(old_item_id))

                items_needing_movement = []
                for item_id, item_data in incoming_items_map.items():
                    new_qty = item_data['quantity']
                    item_obj = db_items[item_id]
                    if item_id in movements_by_item:
                        # Update the existing entry directly in-place; do not modify created_at
                        sm = movements_by_item[item_id]
                        sm.change = -new_qty
                        sm.save(update_fields=['change'])
                    else:
                        items_needing_movement.append((item_obj, new_qty))

                # Re-use any unused movement rows from removed items, or create single initial sale movement
                customer_label = instance.customer_phone or (instance.customer.display_name if instance.customer else "")
                note_text = f"POS Sale #{instance.invoice_number}" + (f" ({customer_label})" if customer_label else "")

                for item_obj, new_qty in items_needing_movement:
                    if unused_movements:
                        sm = unused_movements.pop(0)
                        sm.item = item_obj
                        sm.change = -new_qty
                        sm.note = note_text
                        sm.save(update_fields=['item', 'change', 'note'])
                    else:
                        cashier_name = staff.name if staff else (instance.cashier_name or "Cashier")
                        StockMovement.objects.create(
                            item=item_obj,
                            change=-new_qty,
                            reason=StockMovement.REASON_SALE,
                            note=note_text,
                            performed_by=staff,
                            performed_by_name=cashier_name,
                        )

                # Delete any extra unused movements so no orphan/excess ledger rows remain
                for sm in unused_movements:
                    sm.delete()

                # Recompute Item.quantity for all affected items directly from StockMovement ledger
                for aff_item in affected_items:
                    total_stock = StockMovement.objects.filter(item=aff_item).aggregate(total=Sum('change'))['total'] or 0
                    aff_item.quantity = total_stock
                    aff_item.save(update_fields=['quantity', 'updated_at'])

                # C. Rebuild SaleOrderItems
                instance.items.all().delete()
                new_subtotal = Decimal('0.00')

                for i_id, i_data in incoming_items_map.items():
                    item_obj = db_items[i_id]
                    qty = i_data['quantity']
                    unit_sp = i_data['unit_selling_price'] if i_data['unit_selling_price'] is not None else item_obj.selling_price
                    line_total = (unit_sp * qty).quantize(Decimal('0.01'))
                    new_subtotal += line_total

                    SaleOrderItem.objects.create(
                        sale_order=instance,
                        item=item_obj,
                        item_name=item_obj.name,
                        item_uid=item_obj.uid,
                        unit_cost_price=item_obj.cost_price or Decimal('0.00'),
                        unit_selling_price=unit_sp,
                        unit_mrp=item_obj.effective_mrp,
                        quantity=qty,
                        total_price=line_total,
                    )

                # D. Update Financials
                old_total = instance.total_amount
                instance.subtotal = new_subtotal
                new_total = max(Decimal('0.00'), new_subtotal + (instance.tax_amount or Decimal('0.00')) - (instance.discount_amount or Decimal('0.00'))).quantize(Decimal('0.01'))
                instance.total_amount = new_total
                total_diff = new_total - old_total

                if instance.customer:
                    instance.customer.total_spent = max(Decimal('0.00'), (instance.customer.total_spent or Decimal('0.00')) + total_diff).quantize(Decimal('0.01'))
                    instance.customer.save()

                # VIP Card balance adjustment if paid by VIP card
                if instance.payment_method == SaleOrder.PAYMENT_VIP_CARD and instance.customer:
                    if total_diff > 0:
                        if instance.customer.vip_card_balance < total_diff:
                            raise serializers.ValidationError({
                                "items": f"Customer lacks VIP Card balance for addition. Need ₹{total_diff}, Available: ₹{instance.customer.vip_card_balance}."
                            })
                        instance.customer.vip_card_balance = (instance.customer.vip_card_balance - total_diff).quantize(Decimal('0.01'))
                        instance.customer.save()
                        VIPCardTransaction.objects.create(
                            customer=instance.customer,
                            store=instance.store,
                            card_uid=instance.vip_card_uid or instance.customer.vip_card_uid,
                            transaction_type=VIPCardTransaction.TYPE_DEBIT,
                            amount=total_diff,
                            balance_after=instance.customer.vip_card_balance,
                            sale_order=instance,
                            notes=f"Sale Edit Item Addition #{instance.invoice_number}"
                        )
                    elif total_diff < 0:
                        refund_amt = abs(total_diff)
                        instance.customer.vip_card_balance = (instance.customer.vip_card_balance + refund_amt).quantize(Decimal('0.01'))
                        instance.customer.save()
                        VIPCardTransaction.objects.create(
                            customer=instance.customer,
                            store=instance.store,
                            card_uid=instance.vip_card_uid or instance.customer.vip_card_uid,
                            transaction_type=VIPCardTransaction.TYPE_REFUND,
                            amount=refund_amt,
                            balance_after=instance.customer.vip_card_balance,
                            sale_order=instance,
                            notes=f"Sale Edit Item Reduction Refund #{instance.invoice_number}"
                        )

            # 3. Handle Payment Method Updates
            new_payment_method = validated_data.get('payment_method', instance.payment_method)
            if new_payment_method == SaleOrder.PAYMENT_SPLIT:
                split_cash = validated_data.get('split_cash_amount', instance.split_cash_amount or Decimal('0.00'))
                split_upi = validated_data.get('split_upi_amount', instance.split_upi_amount or Decimal('0.00'))

                if split_cash > 0 and split_upi == Decimal('0.00'):
                    split_upi = max(Decimal('0.00'), instance.total_amount - split_cash).quantize(Decimal('0.01'))
                elif split_upi > 0 and split_cash == Decimal('0.00'):
                    split_cash = max(Decimal('0.00'), instance.total_amount - split_upi).quantize(Decimal('0.01'))
                elif split_cash == Decimal('0.00') and split_upi == Decimal('0.00'):
                    split_cash = instance.total_amount
                    split_upi = Decimal('0.00')

                split_sum = (split_cash + split_upi).quantize(Decimal('0.01'))
                if abs(split_sum - instance.total_amount) > Decimal('0.05'):
                    raise serializers.ValidationError({
                        "payment_method": f"Split amounts (Cash ₹{split_cash} + UPI ₹{split_upi} = ₹{split_sum}) must equal total amount ₹{instance.total_amount}."
                    })
                instance.split_cash_amount = split_cash
                instance.split_upi_amount = split_upi
                instance.amount_paid = split_cash
                instance.change_returned = Decimal('0.00')
            elif new_payment_method in [SaleOrder.PAYMENT_CASH, SaleOrder.PAYMENT_UPI, SaleOrder.PAYMENT_CARD, SaleOrder.PAYMENT_OTHER]:
                instance.split_cash_amount = Decimal('0.00')
                instance.split_upi_amount = Decimal('0.00')
                if new_payment_method == SaleOrder.PAYMENT_CASH:
                    raw_paid = validated_data.get('amount_paid', instance.amount_paid)
                    if raw_paid and Decimal(str(raw_paid)) >= instance.total_amount:
                        instance.amount_paid = Decimal(str(raw_paid)).quantize(Decimal('0.01'))
                        instance.change_returned = (instance.amount_paid - instance.total_amount).quantize(Decimal('0.01'))
                    else:
                        instance.amount_paid = instance.total_amount
                        instance.change_returned = Decimal('0.00')
                else:
                    instance.amount_paid = instance.total_amount
                    instance.change_returned = Decimal('0.00')

            instance.payment_method = new_payment_method

            if 'notes' in validated_data:
                instance.notes = validated_data['notes']
            if 'customer_name' in validated_data and validated_data['customer_name'] is not None:
                instance.customer_name = validated_data['customer_name']
            if 'customer_phone' in validated_data and validated_data['customer_phone']:
                instance.customer_phone = validated_data['customer_phone']

            instance.save()
            return instance


class ProcessReturnItemSerializer(serializers.Serializer):
    sale_order_item_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)


class ProcessReturnSerializer(serializers.Serializer):
    invoice_number = serializers.CharField(required=True)
    items = ProcessReturnItemSerializer(many=True, allow_empty=False)
    refund_payment_method = serializers.ChoiceField(
        choices=SaleOrder.PAYMENT_CHOICES,
        default=SaleOrder.PAYMENT_CASH
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="Customer Return")

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Return items cannot be empty.")
        seen_line_ids = set()
        for item in value:
            lid = item.get('sale_order_item_id')
            if lid in seen_line_ids:
                raise serializers.ValidationError(f"Duplicate line item ID #{lid} in return request. Please combine quantities into a single entry.")
            seen_line_ids.add(lid)
        return value


class CheckoutItemInputSerializer(serializers.Serializer):
    item_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(min_value=1, required=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=Decimal('0.00'))


class CheckoutSerializer(serializers.Serializer):
    store_id = serializers.IntegerField(required=True)
    customer_phone = serializers.CharField(max_length=30, required=True)
    customer_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    customer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    payment_method = serializers.ChoiceField(
        choices=SaleOrder.PAYMENT_CHOICES,
        default=SaleOrder.PAYMENT_CASH
    )
    split_cash_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=Decimal('0.00')
    )
    split_upi_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=Decimal('0.00')
    )
    vip_card_uid = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0.00'))
    initial_payment_method = serializers.CharField(max_length=50, required=False, allow_blank=True, default='cash')
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0.00'))
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0.00'))
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    items = CheckoutItemInputSerializer(many=True, required=True)

    def validate_customer_phone(self, value):
        import re
        clean = re.sub(r'\D', '', str(value).strip())
        if len(clean) != 10:
            raise serializers.ValidationError("Customer phone number must be exactly 10 digits (no more, no less).")
        return clean

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Cart cannot be empty.")
        seen_item_ids = set()
        for ci in value:
            iid = ci.get('item_id')
            if iid in seen_item_ids:
                raise serializers.ValidationError(f"Duplicate item ID #{iid} in cart. Please combine quantities into a single line item.")
            seen_item_ids.add(iid)
        return value

    def create(self, validated_data):
        from django.db import transaction

        store_id = validated_data['store_id']
        try:
            store = Store.objects.get(id=store_id)
        except Store.DoesNotExist:
            raise serializers.ValidationError({"store_id": "Selected store branch does not exist."})

        # Enforce Active Register Shift: Cannot bill anything if register shift is not open
        open_shift = DailyRegisterShift.objects.filter(
            store=store,
            status=DailyRegisterShift.STATUS_OPEN
        ).order_by('-opened_at').first()

        if not open_shift:
            raise serializers.ValidationError({
                "error": "Cannot complete sale: Cash register shift is not open. Please open a shift before billing.",
                "shift": "Register shift is not open for this store."
            })

        raw_phone = validated_data['customer_phone'].strip()
        raw_name = validated_data.get('customer_name', '').strip()
        raw_email = validated_data.get('customer_email', '').strip()
        payment_method = validated_data.get('payment_method', SaleOrder.PAYMENT_CASH)
        initial_pay_method = (validated_data.get('initial_payment_method') or 'cash').strip().lower()
        vip_card_uid_input = validated_data.get('vip_card_uid', '').strip()
        discount_amount = Decimal(str(validated_data.get('discount_amount', 0.00)))
        tax_amount = Decimal(str(validated_data.get('tax_amount', 0.00)))
        notes = validated_data.get('notes', '')
        cart_items = validated_data['items']

        request = self.context.get('request')
        staff = get_current_staff(request) if request else None
        cashier_name = staff.name if staff else "Cashier"

        with transaction.atomic():
            # 1. Validate all items and their stock availability
            item_ids = [ci['item_id'] for ci in cart_items]
            items_by_id = {
                item.id: item
                for item in Item.objects.select_for_update().filter(id__in=item_ids)
            }

            line_items_data = []
            subtotal = Decimal('0.00')

            for ci in cart_items:
                i_id = ci['item_id']
                qty = ci['quantity']
                item = items_by_id.get(i_id)

                if not item:
                    raise serializers.ValidationError(f"Item ID {i_id} not found in inventory.")

                # Strict Out-of-Stock Enforcement (No negative inventory allowed)
                if item.quantity <= 0:
                    raise serializers.ValidationError(
                        f"Item '{item.name}' (UID: {item.uid}) is Out of Stock (0 available in inventory). Cannot complete sale."
                    )
                if item.quantity < qty:
                    raise serializers.ValidationError(
                        f"Insufficient stock for '{item.name}' (UID: {item.uid}). Only {item.quantity} available in inventory, but {qty} requested."
                    )

                custom_unit_price = ci.get('unit_price')
                disc_pct = Decimal(str(ci.get('discount_percent') or 0.00))

                if custom_unit_price is not None and Decimal(str(custom_unit_price)) >= Decimal('0.00'):
                    unit_selling = Decimal(str(custom_unit_price)).quantize(Decimal('0.01'))
                else:
                    unit_selling = Decimal(str(item.selling_price))

                unit_cost = Decimal(str(item.cost_price))
                unit_mrp = Decimal(str(item.effective_mrp)) if item.effective_mrp else unit_selling
                base_line = (unit_selling * qty).quantize(Decimal('0.01'))

                if disc_pct > Decimal('0.00'):
                    disc_pct_clamped = min(Decimal('100.00'), max(Decimal('0.00'), disc_pct))
                    disc_val = (base_line * (disc_pct_clamped / Decimal('100.00'))).quantize(Decimal('0.01'))
                    line_total = max(Decimal('0.00'), base_line - disc_val).quantize(Decimal('0.01'))
                else:
                    line_total = base_line

                subtotal += base_line

                line_items_data.append({
                    'item': item,
                    'item_name': item.name,
                    'item_uid': item.uid,
                    'unit_cost_price': unit_cost,
                    'unit_selling_price': unit_selling,
                    'unit_mrp': unit_mrp,
                    'quantity': qty,
                    'total_price': line_total,
                })

            total_amount = max(Decimal('0.00'), subtotal + tax_amount - discount_amount).quantize(Decimal('0.01'))
            raw_paid = validated_data.get('amount_paid')
            split_cash_amt = Decimal(str(validated_data.get('split_cash_amount', 0.00))).quantize(Decimal('0.01'))
            split_upi_amt = Decimal(str(validated_data.get('split_upi_amount', 0.00))).quantize(Decimal('0.01'))

            order_status = SaleOrder.STATUS_COMPLETED
            balance_due = Decimal('0.00')
            is_fully_paid = True

            if payment_method == SaleOrder.PAYMENT_PARTIAL:
                # Partial / Due Payment (Khata)
                initial_paid = Decimal(str(raw_paid or 0.00)).quantize(Decimal('0.01'))
                if initial_paid < 0:
                    raise serializers.ValidationError({"amount_paid": "Amount paid cannot be negative."})
                if initial_paid > total_amount:
                    raise serializers.ValidationError({"amount_paid": f"Initial paid amount (₹{initial_paid}) cannot exceed total amount (₹{total_amount})."})
                
                amount_paid = initial_paid
                balance_due = (total_amount - amount_paid).quantize(Decimal('0.01'))
                change_returned = Decimal('0.00')
                if balance_due > Decimal('0.00'):
                    order_status = SaleOrder.STATUS_PARTIAL
                    is_fully_paid = False
                else:
                    order_status = SaleOrder.STATUS_COMPLETED
                    is_fully_paid = True

            elif payment_method == SaleOrder.PAYMENT_SPLIT:
                if split_cash_amt < 0 or split_upi_amt < 0:
                    raise serializers.ValidationError({"payment_method": "Split amounts cannot be negative."})

                # If only one was provided, auto-calculate the other
                if split_cash_amt > 0 and split_upi_amt == Decimal('0.00'):
                    split_upi_amt = max(Decimal('0.00'), total_amount - split_cash_amt).quantize(Decimal('0.01'))
                elif split_upi_amt > 0 and split_cash_amt == Decimal('0.00'):
                    split_cash_amt = max(Decimal('0.00'), total_amount - split_upi_amt).quantize(Decimal('0.01'))

                split_sum = (split_cash_amt + split_upi_amt).quantize(Decimal('0.01'))
                if abs(split_sum - total_amount) > Decimal('0.05'):
                    raise serializers.ValidationError({
                        "payment_method": f"Split amounts (Cash ₹{split_cash_amt} + UPI ₹{split_upi_amt} = ₹{split_sum}) must equal total payable amount ₹{total_amount}."
                    })

                # In split payment, raw_paid represents cash tendered for the cash portion
                if raw_paid is not None and Decimal(str(raw_paid)) > 0:
                    tendered = Decimal(str(raw_paid)).quantize(Decimal('0.01'))
                    if tendered >= split_cash_amt:
                        amount_paid = tendered
                        change_returned = (tendered - split_cash_amt).quantize(Decimal('0.01'))
                    else:
                        amount_paid = split_cash_amt
                        change_returned = Decimal('0.00')
                else:
                    amount_paid = split_cash_amt
                    change_returned = Decimal('0.00')
                balance_due = Decimal('0.00')
                is_fully_paid = True

            elif payment_method != SaleOrder.PAYMENT_CASH or raw_paid is None or Decimal(str(raw_paid)) <= 0:
                amount_paid = total_amount
                change_returned = Decimal('0.00')
                balance_due = Decimal('0.00')
                is_fully_paid = True
            else:
                amount_paid = Decimal(str(raw_paid)).quantize(Decimal('0.01'))
                change_returned = max(Decimal('0.00'), amount_paid - total_amount).quantize(Decimal('0.01'))
                balance_due = Decimal('0.00')
                is_fully_paid = True

            # 2. Get or create Customer
            customer, created = Customer.objects.select_for_update().get_or_create(phone=raw_phone)
            if created or not customer.store_id:
                customer.store = store
            if raw_name:
                customer.name = raw_name
            if raw_email and not customer.email:
                customer.email = raw_email

            vip_discount_amt = Decimal('0.00')
            card_uid_to_record = ""

            # 2a. VIP Card Payment Processing & Balance Verification
            if payment_method == SaleOrder.PAYMENT_VIP_CARD:
                if not customer.vip_card_uid or customer.vip_card_status != 'active':
                    raise serializers.ValidationError({
                        "payment_method": f"Customer ({customer.phone}) does not have an active VIP Card. Cannot checkout with VIP Card."
                    })

                if vip_card_uid_input and customer.vip_card_uid.strip().lower() != vip_card_uid_input.strip().lower():
                    raise serializers.ValidationError({
                        "vip_card_uid": f"Tapped Card UID '{vip_card_uid_input}' does not match Customer's assigned Card UID '{customer.vip_card_uid}'."
                    })

                if customer.vip_card_balance < total_amount:
                    raise serializers.ValidationError({
                        "amount_paid": f"Insufficient VIP Card balance. Available: ₹{customer.vip_card_balance}, Required: ₹{total_amount}. Please recharge the card."
                    })

                card_uid_to_record = customer.vip_card_uid
                vip_discount_amt = discount_amount
                customer.vip_card_balance = (customer.vip_card_balance - total_amount).quantize(Decimal('0.01'))
                customer.total_vip_savings = ((customer.total_vip_savings or Decimal('0.00')) + vip_discount_amt).quantize(Decimal('0.01'))

            customer.total_purchases_count = (customer.total_purchases_count or 0) + 1
            current_spent = customer.total_spent if customer.total_spent is not None else Decimal('0.00')
            customer.total_spent = (current_spent + total_amount).quantize(Decimal('0.01'))
            customer.last_purchase_date = timezone.now()
            customer.save()

            # 3. Create SaleOrder
            invoice_num = generate_next_invoice_number(store)
            sale_order = SaleOrder.objects.create(
                invoice_number=invoice_num,
                store=store,
                customer=customer,
                customer_phone=raw_phone,
                customer_name=customer.name or raw_name,
                cashier=staff,
                cashier_name=cashier_name,
                subtotal=subtotal,
                tax_amount=tax_amount,
                discount_amount=discount_amount,
                vip_card_uid=card_uid_to_record,
                vip_discount_amount=vip_discount_amt,
                split_cash_amount=split_cash_amt if payment_method == SaleOrder.PAYMENT_SPLIT else Decimal('0.00'),
                split_upi_amount=split_upi_amt if payment_method == SaleOrder.PAYMENT_SPLIT else Decimal('0.00'),
                total_amount=total_amount,
                payment_method=payment_method,
                amount_paid=amount_paid,
                balance_due=balance_due,
                initial_payment_method=initial_pay_method if payment_method == SaleOrder.PAYMENT_PARTIAL else payment_method,
                is_fully_paid=is_fully_paid,
                change_returned=change_returned,
                status=order_status,
                notes=notes,
            )

            # Record initial OrderPaymentTransaction if any amount was collected on checkout
            initial_tx_method = initial_pay_method if payment_method == SaleOrder.PAYMENT_PARTIAL else (
                'cash' if payment_method == SaleOrder.PAYMENT_CASH else
                'upi' if payment_method == SaleOrder.PAYMENT_UPI else
                'card' if payment_method == SaleOrder.PAYMENT_CARD else
                'vip_card' if payment_method == SaleOrder.PAYMENT_VIP_CARD else
                'split' if payment_method == SaleOrder.PAYMENT_SPLIT else 'other'
            )

            if payment_method == SaleOrder.PAYMENT_SPLIT:
                if split_cash_amt > Decimal('0.00'):
                    OrderPaymentTransaction.objects.create(
                        order=sale_order,
                        store=store,
                        amount=split_cash_amt,
                        payment_method='cash',
                        collected_by=staff,
                        collected_by_name=cashier_name,
                        notes=f"Initial Split Payment (Cash) on Checkout #{invoice_num}"
                    )
                if split_upi_amt > Decimal('0.00'):
                    OrderPaymentTransaction.objects.create(
                        order=sale_order,
                        store=store,
                        amount=split_upi_amt,
                        payment_method='upi',
                        collected_by=staff,
                        collected_by_name=cashier_name,
                        notes=f"Initial Split Payment (UPI) on Checkout #{invoice_num}"
                    )
            elif amount_paid > Decimal('0.00'):
                effective_recorded_amt = total_amount if payment_method == SaleOrder.PAYMENT_CASH and change_returned > 0 else amount_paid
                OrderPaymentTransaction.objects.create(
                    order=sale_order,
                    store=store,
                    amount=effective_recorded_amt,
                    payment_method=initial_tx_method,
                    collected_by=staff,
                    collected_by_name=cashier_name,
                    notes=f"Initial Payment on Checkout #{invoice_num}" + (f" (Due: ₹{balance_due})" if balance_due > 0 else "")
                )

            # Record VIP Card Debit Transaction
            if payment_method == SaleOrder.PAYMENT_VIP_CARD:
                VIPCardTransaction.objects.create(
                    customer=customer,
                    store=store,
                    card_uid=card_uid_to_record,
                    transaction_type=VIPCardTransaction.TYPE_DEBIT,
                    amount=total_amount,
                    balance_after=customer.vip_card_balance,
                    sale_order=sale_order,
                    notes=f"POS Payment Invoice #{invoice_num}"
                )

            # 4. Create SaleOrderItems and deduct stock with StockMovement
            for line in line_items_data:
                item = line['item']
                qty = line['quantity']

                SaleOrderItem.objects.create(
                    sale_order=sale_order,
                    item=item,
                    item_name=line['item_name'],
                    item_uid=line['item_uid'],
                    unit_cost_price=line['unit_cost_price'],
                    unit_selling_price=line['unit_selling_price'],
                    unit_mrp=line['unit_mrp'],
                    quantity=qty,
                    total_price=line['total_price'],
                )

                # Deduct inventory stock
                adjust_stock(
                    item=item,
                    change=-qty,
                    reason=StockMovement.REASON_SALE,
                    note=f"POS Sale #{invoice_num} ({customer.display_name})",
                    performed_by=staff
                )

            return sale_order


class AIDescriptionBatchJobSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    progress_percentage = serializers.SerializerMethodField()
    ready_items = serializers.SerializerMethodField()
    applied_items = serializers.SerializerMethodField()
    generating_items = serializers.SerializerMethodField()

    class Meta:
        model = AIDescriptionBatchJob
        fields = [
            'id',
            'store',
            'store_name',
            'status',
            'status_message',
            'total_items',
            'completed_items',
            'failed_items',
            'skipped_items',
            'ready_items',
            'applied_items',
            'generating_items',
            'progress_percentage',
            'item_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'store_name', 'status_message', 'progress_percentage',
            'ready_items', 'applied_items', 'generating_items',
            'created_at', 'updated_at'
        ]

    def get_progress_percentage(self, obj):
        if not obj.total_items or obj.total_items == 0:
            return 100 if obj.status == AIDescriptionBatchJob.STATUS_COMPLETED else 0
        processed = obj.completed_items + obj.failed_items + obj.skipped_items
        return min(100, int((processed / obj.total_items) * 100))

    def get_ready_items(self, obj):
        if not obj.item_ids:
            return 0
        return Item.objects.filter(id__in=obj.item_ids, ai_description_status='ready').count()

    def get_applied_items(self, obj):
        if not obj.item_ids:
            return 0
        return Item.objects.filter(id__in=obj.item_ids, ai_description_status='applied').count()

    def get_generating_items(self, obj):
        if not obj.item_ids:
            return 0
        return Item.objects.filter(id__in=obj.item_ids, ai_description_status='generating').count()

