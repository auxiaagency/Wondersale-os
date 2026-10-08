from django.contrib import admin
from .models import Store, Category, SubCategory, Supplier, Item, StockMovement, ItemImage, ItemPriceHistory


class ItemImageInline(admin.TabularInline):
    model = ItemImage
    extra = 1
    fields = ['image', 'is_primary', 'order']


class StockMovementInline(admin.TabularInline):
    model = StockMovement
    extra = 0
    readonly_fields = ['change', 'reason', 'note', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        # Stock movements should be added via the dedicated adjustment action/service
        return False


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'address', 'created_at']
    search_fields = ['name', 'address']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'created_at']
    search_fields = ['name']


@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'category', 'created_at']
    list_filter = ['category']
    search_fields = ['name', 'category__name']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'contact_person', 'phone', 'city', 'gst_number', 'store', 'is_active', 'created_at']
    list_filter = ['is_active', 'store', 'city']
    search_fields = ['name', 'contact_person', 'phone', 'gst_number', 'city']


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = [
        'uid',
        'name',
        'supplier',
        'quantity',
        'selling_price',
        'mrp_display',
        'store',
        'source',
        'needs_new_barcode_printed',
        'created_at'
    ]
    list_filter = [
        'store',
        'supplier',
        'subcategories',
        'source',
        'needs_new_barcode_printed',
        'created_at'
    ]
    search_fields = ['name', 'uid', 'legacy_uid', 'location_section']
    readonly_fields = ['id', 'quantity', 'created_at', 'updated_at']
    inlines = [ItemImageInline, StockMovementInline]

    def mrp_display(self, obj):
        return f"{obj.effective_mrp} (effective)" if obj.mrp is None else str(obj.mrp)
    mrp_display.short_description = 'MRP'


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ['id', 'item', 'change', 'reason', 'note', 'created_at']
    list_filter = ['reason', 'created_at']
    search_fields = ['item__uid', 'item__name', 'note']
    readonly_fields = ['item', 'change', 'reason', 'note', 'created_at']


@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'item', 'is_primary', 'order', 'created_at']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['item__uid', 'item__name']


@admin.register(ItemPriceHistory)
class ItemPriceHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'item', 'cost_price', 'selling_price', 'mrp', 'reason', 'created_at']
    list_filter = ['reason', 'created_at']
    search_fields = ['item__uid', 'item__name', 'reason', 'note']
    readonly_fields = ['item', 'cost_price', 'selling_price', 'mrp', 'reason', 'note', 'created_at']
