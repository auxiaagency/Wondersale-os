from decimal import Decimal
from rest_framework import serializers
from inventory.models import Item, ItemImage, Category, SubCategory
from .models import Customer, WebsiteOrder, WebsiteOrderItem


class PublicItemImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ItemImage
        fields = ['id', 'url', 'is_primary', 'order']

    def get_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class PublicSubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = ['id', 'name']


class PublicCategorySerializer(serializers.ModelSerializer):
    subcategories = PublicSubCategorySerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'icon', 'display_order', 'subcategories', 'items_count']

    def get_items_count(self, obj):
        return Item.objects.filter(
            subcategories__category=obj,
            is_listed_on_website=True
        ).distinct().count()


class PublicItemSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()
    subcategories = PublicSubCategorySerializer(many=True, read_only=True)
    images = PublicItemImageSerializer(many=True, read_only=True)
    primary_image_url = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id',
            'uid',
            'name',
            'selling_price',
            'mrp',
            'description',
            'quantity',
            'in_stock',
            'categories',
            'subcategories',
            'images',
            'primary_image_url',
            'created_at',
        ]

    def get_in_stock(self, obj):
        return (obj.quantity or 0) > 0

    def get_categories(self, obj):
        categories = obj.parent_categories
        return [{'id': c.id, 'name': c.name} for c in categories]

    def get_primary_image_url(self, obj):
        primary_img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if primary_img and primary_img.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(primary_img.image.url)
            return primary_img.image.url
        return None


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'mobile', 'name', 'email', 'created_at']
        read_only_fields = ['id', 'created_at']


class WebsiteOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsiteOrderItem
        fields = ['id', 'item', 'item_name', 'item_uid', 'quantity', 'unit_price', 'total_price']
        read_only_fields = ['id', 'total_price']


class WebsiteOrderSerializer(serializers.ModelSerializer):
    items = WebsiteOrderItemSerializer(many=True, read_only=True)
    customer_mobile = serializers.CharField(source='customer.mobile', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = WebsiteOrder
        fields = [
            'id',
            'order_number',
            'tracking_id',
            'customer',
            'customer_mobile',
            'customer_name',
            'status',
            'total_amount',
            'delivery_address',
            'payment_method',
            'payment_status',
            'payment_id',
            'notes',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'order_number',
            'tracking_id',
            'customer',
            'created_at',
            'updated_at',
        ]


class HeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import HeroSlide
        model = HeroSlide
        fields = [
            'id',
            'badge',
            'title',
            'subtitle',
            'button_text',
            'button_link',
            'image_url',
            'alt_text',
            'display_order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DealOfTheDaySerializer(serializers.ModelSerializer):
    item_id = serializers.IntegerField(source='item.id', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_uid = serializers.CharField(source='item.uid', read_only=True)
    item_in_stock = serializers.SerializerMethodField()
    item_quantity = serializers.IntegerField(source='item.quantity', read_only=True)
    item_image_url = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        from .models import DealOfTheDay
        model = DealOfTheDay
        fields = [
            'id',
            'item',
            'item_id',
            'item_name',
            'item_uid',
            'item_in_stock',
            'item_quantity',
            'item_image_url',
            'deal_selling_price',
            'deal_mrp',
            'discount_percentage',
            'original_selling_price',
            'original_mrp',
            'starts_at',
            'ends_at',
            'is_active',
            'is_expired',
            'custom_badge',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'discount_percentage',
            'original_selling_price',
            'original_mrp',
            'created_at',
            'updated_at',
        ]

    def get_item_in_stock(self, obj):
        return (obj.item.quantity or 0) > 0

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_item_image_url(self, obj):
        img = obj.item.images.filter(is_primary=True).first() or obj.item.images.first()
        if img and img.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(img.image.url)
            return img.image.url
        return None

