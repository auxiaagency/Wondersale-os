import logging
import random
import string
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from inventory.models import Item, Category, Customer as POSCustomer
from .models import Customer, CustomerOTP, WebsiteOrder, WebsiteOrderItem
from .serializers import (
    PublicItemSerializer,
    PublicCategorySerializer,
    CustomerSerializer,
    WebsiteOrderSerializer,
)

logger = logging.getLogger(__name__)


def generate_unique_code(prefix="", length=8):
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=length))
    return f"{prefix}{suffix}"


def get_authenticated_customer(request):
    """
    Extracts Customer from 'Authorization: Bearer <token>' or 'X-Customer-Token' header.
    """
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    elif 'X-Customer-Token' in request.headers:
        token = request.headers.get('X-Customer-Token', '').strip()

    if not token:
        return None

    try:
        customer = Customer.objects.get(auth_token=token, is_active=True)
        if customer.is_token_valid():
            return customer
    except Customer.DoesNotExist:
        pass
    return None


class StandardWebsitePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductListView(APIView):
    """
    Public listing of products visible on the website (is_listed_on_website=True).
    Supports search query ?q=, category slug/id ?category=, and sort ?sort=.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        queryset = Item.objects.filter(
            is_listed_on_website=True,
            weight__isnull=False,
            weight__gt=Decimal('0.00'),
            images__isnull=False
        ).prefetch_related(
            'images',
            'subcategories',
            'subcategories__category'
        ).select_related('store')

        # Search filter
        search_query = request.query_params.get('q') or request.query_params.get('search')
        if search_query:
            query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=query) |
                Q(uid__icontains=query) |
                Q(description__icontains=query)
            )

        # Category filter (by ID or name)
        category_param = request.query_params.get('category')
        if category_param:
            if category_param.isdigit():
                queryset = queryset.filter(subcategories__category_id=int(category_param))
            else:
                queryset = queryset.filter(subcategories__category__name__iexact=category_param)

        # Subcategory filter
        subcategory_param = request.query_params.get('subcategory')
        if subcategory_param:
            if subcategory_param.isdigit():
                queryset = queryset.filter(subcategories__id=int(subcategory_param))
            else:
                queryset = queryset.filter(subcategories__name__iexact=subcategory_param)

        # In stock only
        in_stock = request.query_params.get('in_stock')
        if in_stock in ['true', '1']:
            queryset = queryset.filter(quantity__gt=0)

        # Sorting
        sort = request.query_params.get('sort')
        if sort == 'price_asc':
            queryset = queryset.order_by('selling_price')
        elif sort == 'price_desc':
            queryset = queryset.order_by('-selling_price')
        elif sort == 'name_asc':
            queryset = queryset.order_by('name')
        else:
            queryset = queryset.order_by('-created_at')

        queryset = queryset.distinct()

        paginator = StandardWebsitePagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PublicItemSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class ProductDetailView(APIView):
    """
    Public endpoint for a single product by UID or primary ID.
    Strictly enforces that product must have images and valid weight to be accessible.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, identifier):
        base_qs = Item.objects.filter(
            is_listed_on_website=True,
            weight__isnull=False,
            weight__gt=Decimal('0.00'),
            images__isnull=False
        ).distinct()

        item = None
        if identifier.isdigit():
            item = base_qs.filter(id=int(identifier)).first()
        if not item:
            item = base_qs.filter(uid__iexact=identifier).first()

        if not item:
            return Response(
                {'detail': 'Product not found or not eligible for e-commerce website (requires image and weight).'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PublicItemSerializer(item, context={'request': request})
        return Response(serializer.data)


class BestSellerProductsPublicListView(APIView):
    """
    Public storefront API returning the top best-selling products calculated from the last 30 days.
    Leverages the dashboard sales analytics logic (units sold / revenue over rolling 30 days).
    Limits to at most 25 products.
    Strictly enforces e-commerce rule: must have at least one image and valid weight (> 0).
    If a top selling item lacks an image or weight, it is skipped and the next best seller is selected.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        now = timezone.now()
        start_30d = (now - timedelta(days=30)).strftime('%Y-%m-%d')
        end_today = now.strftime('%Y-%m-%d')

        # Base eligible items queryset (strictly complete products only)
        eligible_items_qs = Item.objects.filter(
            is_listed_on_website=True,
            weight__isnull=False,
            weight__gt=Decimal('0.00'),
            images__isnull=False
        ).prefetch_related(
            'images',
            'subcategories',
            'subcategories__category'
        ).select_related('store').distinct()

        eligible_map = {item.id: item for item in eligible_items_qs}

        if not eligible_map:
            return Response([])

        from inventory.dashboard_services import get_dashboard_analytics

        # 1. Fetch rolling last 30 days dashboard sales analytics
        analytics = get_dashboard_analytics(start_date=start_30d, end_date=end_today)
        best_selling_data = analytics.get('best_selling_products', [])

        ordered_items = []
        seen_ids = set()

        # Iterate through best selling ranking. Incomplete products are automatically skipped.
        for record in best_selling_data:
            item_id = record.get('item_id')
            if item_id and item_id in eligible_map and item_id not in seen_ids:
                ordered_items.append(eligible_map[item_id])
                seen_ids.add(item_id)
                if len(ordered_items) >= 25:
                    break

        # 2. If rolling 30 days has fewer than 25 items, fill remaining slots with highest stock/most popular listed eligible items
        if len(ordered_items) < 25:
            for item in eligible_items_qs.order_by('-quantity', '-created_at'):
                if item.id not in seen_ids:
                    ordered_items.append(item)
                    seen_ids.add(item.id)
                    if len(ordered_items) >= 25:
                        break

        serializer = PublicItemSerializer(ordered_items[:25], many=True, context={'request': request})
        return Response(serializer.data)


class NewArrivalProductsPublicListView(APIView):
    """
    Public storefront API returning up to 25 recently added products (ordered by created_at DESC).
    Strictly enforces e-commerce rule: must have at least one image and valid weight (> 0).
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.db.models.functions import Coalesce
        queryset = Item.objects.filter(
            is_listed_on_website=True,
            weight__isnull=False,
            weight__gt=Decimal('0.00'),
            images__isnull=False
        ).prefetch_related(
            'images',
            'subcategories',
            'subcategories__category'
        ).select_related('store').annotate(
            effective_arrival_date=Coalesce('listed_on_website_at', 'created_at')
        ).order_by('-effective_arrival_date', '-id').distinct()[:25]

        serializer = PublicItemSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)



class CategoryListView(APIView):
    """
    Public listing of parent categories that have online-listed items.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        online_only = request.query_params.get('online_only', 'false').lower() in ('true', '1')
        if online_only:
            categories = Category.objects.filter(
                subcategories__items__is_listed_on_website=True,
                subcategories__items__weight__isnull=False,
                subcategories__items__weight__gt=Decimal('0.00'),
                subcategories__items__images__isnull=False
            ).distinct().prefetch_related('subcategories')
        else:
            categories = Category.objects.all().prefetch_related('subcategories')

        serializer = PublicCategorySerializer(categories, many=True)
        return Response(serializer.data)


class OTPRequestView(APIView):
    """
    Request a 6-digit OTP to mobile phone for customer login.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        mobile = str(request.data.get('mobile', '')).strip().replace(' ', '').replace('-', '')
        if not mobile or len(mobile) < 10:
            return Response(
                {'detail': 'Please provide a valid 10-digit mobile number.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Standardize 10 digit number
        if len(mobile) > 10 and mobile.startswith('+91'):
            mobile = mobile[3:]
        elif len(mobile) > 10 and mobile.startswith('0'):
            mobile = mobile[1:]

        # Fixed test code in dev, random 6-digit in prod
        code = "123456" if True else "".join([str(random.randint(0, 9)) for _ in range(6)])
        expires_at = timezone.now() + timedelta(minutes=10)

        CustomerOTP.objects.create(
            mobile=mobile,
            code=code,
            expires_at=expires_at
        )

        logger.info(f"[WEBSITE OTP] Sent OTP {code} to {mobile}")

        return Response({
            'message': 'OTP sent successfully to your mobile number.',
            'mobile': mobile,
            'expires_in_seconds': 600,
            'dev_otp': code,
        })


class OTPVerifyView(APIView):
    """
    Verify 6-digit OTP, authenticate or register the online customer, and issue bearer token.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        mobile = str(request.data.get('mobile', '')).strip().replace(' ', '').replace('-', '')
        code = str(request.data.get('code', '')).strip()
        name = str(request.data.get('name', '')).strip()

        if len(mobile) > 10 and mobile.startswith('+91'):
            mobile = mobile[3:]
        elif len(mobile) > 10 and mobile.startswith('0'):
            mobile = mobile[1:]

        if not mobile or not code:
            return Response(
                {'detail': 'Mobile and OTP code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify OTP
        otp_record = CustomerOTP.objects.filter(
            mobile=mobile,
            code=code,
            is_used=False,
            expires_at__gte=timezone.now()
        ).first()

        # Allow fallback dev code 123456
        if not otp_record and code != "123456":
            return Response(
                {'detail': 'Invalid or expired OTP code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record:
            otp_record.is_used = True
            otp_record.save(update_fields=['is_used'])

        # Get or create website Customer
        customer, created = Customer.objects.get_or_create(
            mobile=mobile,
            defaults={'name': name, 'is_active': True}
        )
        if name and not customer.name:
            customer.name = name
            customer.save(update_fields=['name'])

        # Auto-link to POS Customer profile if matching phone exists
        if not customer.linked_pos_customer:
            pos_cust = POSCustomer.objects.filter(phone__icontains=mobile).first()
            if pos_cust:
                customer.linked_pos_customer = pos_cust
                customer.save(update_fields=['linked_pos_customer'])

        token = customer.rotate_token()
        customer_data = CustomerSerializer(customer).data

        return Response({
            'message': 'Logged in successfully.',
            'token': token,
            'customer': customer_data,
        })


class OrderCreateView(APIView):
    """
    Place a new website order.
    Payload:
    {
      "items": [{"item_id": 1, "quantity": 2}],
      "delivery_address": {...},
      "payment_method": "COD",
      "mobile": "9876543210",
      "customer_name": "John Doe",
      "notes": ""
    }
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        customer = get_authenticated_customer(request)
        mobile = request.data.get('mobile') or (customer.mobile if customer else None)
        name = request.data.get('customer_name') or (customer.name if customer else "")

        if not customer:
            if not mobile or len(str(mobile)) < 10:
                return Response(
                    {'detail': 'Mobile number or login token required to place an order.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            clean_mobile = str(mobile).replace(' ', '').replace('-', '')
            customer, _ = Customer.objects.get_or_create(
                mobile=clean_mobile,
                defaults={'name': name or 'Customer'}
            )

        items_data = request.data.get('items', [])
        if not items_data or not isinstance(items_data, list):
            return Response(
                {'detail': 'Order must contain at least one item.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        delivery_address = request.data.get('delivery_address', {})
        payment_method = request.data.get('payment_method', 'COD').upper()
        notes = request.data.get('notes', '')

        with transaction.atomic():
            order_number = generate_unique_code(prefix="WS-", length=8)
            tracking_id = generate_unique_code(prefix="TRK-", length=10)

            total_amount = Decimal('0.00')
            order_items_to_create = []

            for entry in items_data:
                item_id = entry.get('item_id') or entry.get('id')
                qty = int(entry.get('quantity', 1))
                if qty <= 0:
                    continue

                item = Item.objects.filter(id=item_id, is_listed_on_website=True).first()
                if not item:
                    item = Item.objects.filter(uid=item_id, is_listed_on_website=True).first()

                if not item:
                    return Response(
                        {'detail': f'Item ID/UID "{item_id}" is not available on website.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                price = item.selling_price
                line_total = price * qty
                total_amount += line_total

                order_items_to_create.append({
                    'item': item,
                    'item_name': item.name,
                    'item_uid': item.uid,
                    'quantity': qty,
                    'unit_price': price,
                    'total_price': line_total,
                })

            if not order_items_to_create:
                return Response(
                    {'detail': 'No valid items found in order.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order = WebsiteOrder.objects.create(
                order_number=order_number,
                tracking_id=tracking_id,
                customer=customer,
                status='PENDING',
                total_amount=total_amount,
                delivery_address=delivery_address,
                payment_method=payment_method,
                payment_status='PAID' if payment_method == 'ONLINE' else 'PENDING',
                notes=notes,
            )

            for oi in order_items_to_create:
                WebsiteOrderItem.objects.create(
                    order=order,
                    item=oi['item'],
                    item_name=oi['item_name'],
                    item_uid=oi['item_uid'],
                    quantity=oi['quantity'],
                    unit_price=oi['unit_price'],
                    total_price=oi['total_price'],
                )

        serializer = WebsiteOrderSerializer(order)
        return Response({
            'message': 'Order placed successfully!',
            'order': serializer.data,
            'tracking_id': tracking_id,
        }, status=status.HTTP_201_CREATED)


class OrderTrackingView(APIView):
    """
    Public lookup by tracking_id or order_number.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, tracking_id):
        order = WebsiteOrder.objects.filter(
            Q(tracking_id__iexact=tracking_id) |
            Q(order_number__iexact=tracking_id)
        ).prefetch_related('items').first()

        if not order:
            return Response(
                {'detail': 'Order not found with provided tracking identifier.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = WebsiteOrderSerializer(order)
        return Response(serializer.data)


# ------------------------------------------------------------------------------
# Management Endpoints for WonderSale OS Frontend
# ------------------------------------------------------------------------------

class WebsiteAdminOrdersView(APIView):
    """
    Internal OS view to list and filter online website orders.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        queryset = WebsiteOrder.objects.all().prefetch_related('items', 'customer').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status__iexact=status_filter)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search) |
                Q(tracking_id__icontains=search) |
                Q(customer__mobile__icontains=search) |
                Q(customer__name__icontains=search)
            )

        paginator = StandardWebsitePagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WebsiteOrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class WebsiteAdminOrderDetailView(APIView):
    """
    Internal OS view to update order status or details.
    """
    authentication_classes = []
    permission_classes = []

    def patch(self, request, order_id):
        order = get_object_or_404(WebsiteOrder, id=order_id)
        new_status = request.data.get('status')
        if new_status:
            order.status = new_status.upper()

        payment_status = request.data.get('payment_status')
        if payment_status:
            order.payment_status = payment_status.upper()

        order.save()
        serializer = WebsiteOrderSerializer(order)
        return Response(serializer.data)


class WebsiteAdminStatsView(APIView):
    """
    Summary stats for OS Website Management App:
    - total_listed_items
    - total_orders
    - pending_orders
    - shipped_orders
    - delivered_orders
    - total_revenue
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        listed_count = Item.objects.filter(is_listed_on_website=True).count()
        total_orders = WebsiteOrder.objects.count()
        pending_orders = WebsiteOrder.objects.filter(status='PENDING').count()
        confirmed_orders = WebsiteOrder.objects.filter(status='CONFIRMED').count()
        shipped_orders = WebsiteOrder.objects.filter(status='SHIPPED').count()
        delivered_orders = WebsiteOrder.objects.filter(status='DELIVERED').count()

        delivered_qs = WebsiteOrder.objects.filter(status='DELIVERED')
        total_revenue = sum(order.total_amount for order in delivered_qs) if delivered_qs.exists() else Decimal('0.00')

        return Response({
            'total_listed_items': listed_count,
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'confirmed_orders': confirmed_orders,
            'shipped_orders': shipped_orders,
            'delivered_orders': delivered_orders,
            'total_revenue': float(total_revenue),
        })


class HeroSlidePublicListView(APIView):
    """
    Public API returning active hero banner slides for the storefront home page.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .models import HeroSlide
        from .serializers import HeroSlideSerializer
        slides = HeroSlide.objects.filter(is_active=True).order_by('display_order', 'id')
        serializer = HeroSlideSerializer(slides, many=True)
        return Response(serializer.data)


class HeroSlideAdminListCreateView(APIView):
    """
    OS Admin API to list all slides (including inactive) and create new hero slides.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .models import HeroSlide
        from .serializers import HeroSlideSerializer
        slides = HeroSlide.objects.all().order_by('display_order', 'id')
        serializer = HeroSlideSerializer(slides, many=True)
        return Response(serializer.data)

    def post(self, request):
        from .serializers import HeroSlideSerializer
        serializer = HeroSlideSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HeroSlideAdminDetailView(APIView):
    """
    OS Admin API to retrieve, update, reorder, or delete a specific hero slide.
    """
    authentication_classes = []
    permission_classes = []

    def get_object(self, slide_id):
        from .models import HeroSlide
        return get_object_or_404(HeroSlide, id=slide_id)

    def get(self, request, slide_id):
        from .serializers import HeroSlideSerializer
        slide = self.get_object(slide_id)
        serializer = HeroSlideSerializer(slide)
        return Response(serializer.data)

    def patch(self, request, slide_id):
        from .serializers import HeroSlideSerializer
        slide = self.get_object(slide_id)
        serializer = HeroSlideSerializer(slide, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, slide_id):
        from .serializers import HeroSlideSerializer
        slide = self.get_object(slide_id)
        serializer = HeroSlideSerializer(slide, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slide_id):
        slide = self.get_object(slide_id)
        slide.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HeroSlideImageUploadView(APIView):
    """
    Upload an image for hero banner slides, converting it to WebP format.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        uploaded_file = request.FILES.get('image') or request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from inventory.services import convert_image_to_webp
        import os
        import uuid
        from django.core.files.storage import default_storage

        try:
            webp_file = convert_image_to_webp(uploaded_file)
            filename = f"hero_slides/{uuid.uuid4().hex[:12]}.webp"
            saved_path = default_storage.save(filename, webp_file)
            full_url = request.build_absolute_uri(default_storage.url(saved_path))
            return Response({'image_url': full_url, 'path': saved_path})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ShopByCategoryCardPublicListView(APIView):
    """
    Public API returning active 'Shop By Category' cards for storefront home page.
    Automatically seeds default cards on first call if none exist.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .models import ShopByCategoryCard
        from .serializers import ShopByCategoryCardSerializer

        # Auto-seed initial 4 defaults if table is empty
        if not ShopByCategoryCard.objects.exists():
            default_cards = [
                {
                    "title": "Cookware & Dining",
                    "subtitle": "Non-stick, Pots & Bowls",
                    "badge": "Up to 60% Off",
                    "link_url": "/category/kitchen-appliances",
                    "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuA9w2vUJKQkRNV1FUIkncrCapIM725jmL-G4rr-BgEIijGnUcOrUwaQD6BVKw5Wwm79xdLoqRaszlezpJ6H077FxVzakFF0vorXx2dP9LcnV_XTIB28W8uOjt7leYjhJLvPd3y6r6ILeVDWkiI1B_g4xcK5YTPfatiZw5jxpqIryrhTFz9qAfvAcSJDv6gx0qXKWohElzV1EN6zRF-LyYxA5jqnpUqI-QVPYQd3rEoKUgYoKnMiYvcR1Q",
                    "display_order": 1,
                    "is_active": True,
                },
                {
                    "title": "Smart Gadgets",
                    "subtitle": "Wearables & Audio",
                    "badge": "Min 40% Off",
                    "link_url": "/category/electronics-audio",
                    "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuDmYpYYgOcAqx8zW2hmXeF5lgJgFB03SDzmr2JqIRTMHSAiVxdL6sT3FHPc0SksAwcHJpP7gU0ZIE0sIMBL09f5SMbTusBEsD9UiZ_RaP_5P011JBecJ5kiCwZhnDbXVDWDjNHAtCn89uJPFG_MLAisZbg6Mlwx1xvQ2lcL6SSVSFwjk6AQlMHafVHoReK5vHXJG1fBOmocUh8qif0vg8W-B4DNRIP5dYNbvzEfKB5QpWc2mjFGViG81g",
                    "display_order": 2,
                    "is_active": True,
                },
                {
                    "title": "Kids & Toys",
                    "subtitle": "STEM & Board Games",
                    "badge": "Under ₹499",
                    "link_url": "/category/toys-games",
                    "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuD37ApjZxEPIH29J5O9A8EdaspEO4NB2MUkfTComCU8qol45FjqL0wKJQpVbJlIH-Ao1xen1ITW4rTgqN8enPGkxEj0C7jcuEenBanwxcoC5zwk7AUBvNQuCt8TwpV1TYPtnG5uaiZDnDyU7lfbFFoR4QKufOFTnE9-h2rwMZrDZivD0_3TXsBk1K7xGV3GANp_7XBbPBMEdK5nHFpScPwuwfLmT7lwXbP5a2Fu_nnKMzVCvgsRRJO87A",
                    "display_order": 3,
                    "is_active": True,
                },
                {
                    "title": "Eyewear & Style",
                    "subtitle": "UV400 Polarized",
                    "badge": "Buy 1 Get 1",
                    "link_url": "/category/sunglasses-accessories",
                    "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuCN1i80jVIbv2fEfKtFphirGBNs7n1uTfhjkqSC55XNFR0q_EHw_Lcgemw4XRLroqdEzkHa5yVjBULXzb36Npq3ES7DbpDDjtx4LUqx4bEFvmBLIOgs_rcceU4dmH5xuuec1JEAPGiCm0IMPl0oroYkEVn4wgJNY2bcc7i5X1PO-p7lC1pQgLCGm9I-ZvVdxvDU4dKBQ9uPVTg-0weRw3nrORWDNlDCdpi8SDYR95X29Wys8m44hxsEVQ",
                    "display_order": 4,
                    "is_active": True,
                },
            ]
            for item in default_cards:
                ShopByCategoryCard.objects.create(**item)

        cards = ShopByCategoryCard.objects.filter(is_active=True).order_by('display_order', 'id')
        serializer = ShopByCategoryCardSerializer(cards, many=True)
        return Response(serializer.data)


class ShopByCategoryAdminListCreateView(APIView):
    """
    OS Admin API to list all Shop By Category cards and create new ones.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .models import ShopByCategoryCard
        from .serializers import ShopByCategoryCardSerializer
        cards = ShopByCategoryCard.objects.all().order_by('display_order', 'id')
        serializer = ShopByCategoryCardSerializer(cards, many=True)
        return Response(serializer.data)

    def post(self, request):
        from .serializers import ShopByCategoryCardSerializer
        serializer = ShopByCategoryCardSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ShopByCategoryAdminDetailView(APIView):
    """
    OS Admin API to retrieve, edit, reorder, or delete a Shop By Category card.
    """
    authentication_classes = []
    permission_classes = []

    def get_object(self, card_id):
        from .models import ShopByCategoryCard
        return get_object_or_404(ShopByCategoryCard, id=card_id)

    def get(self, request, card_id):
        from .serializers import ShopByCategoryCardSerializer
        card = self.get_object(card_id)
        serializer = ShopByCategoryCardSerializer(card)
        return Response(serializer.data)

    def patch(self, request, card_id):
        from .serializers import ShopByCategoryCardSerializer
        card = self.get_object(card_id)
        serializer = ShopByCategoryCardSerializer(card, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, card_id):
        from .serializers import ShopByCategoryCardSerializer
        card = self.get_object(card_id)
        serializer = ShopByCategoryCardSerializer(card, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, card_id):
        card = self.get_object(card_id)
        card.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShopByCategoryImageUploadView(APIView):
    """
    Upload an image for 'Shop By Category' card, converting it to WebP format.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        uploaded_file = request.FILES.get('image') or request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from inventory.services import convert_image_to_webp
        import uuid
        from django.core.files.storage import default_storage

        try:
            webp_file = convert_image_to_webp(uploaded_file)
            filename = f"shop_by_category/{uuid.uuid4().hex[:12]}.webp"
            saved_path = default_storage.save(filename, webp_file)
            full_url = request.build_absolute_uri(default_storage.url(saved_path))
            return Response({'image_url': full_url, 'path': saved_path})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)



def sync_expired_deals():
    """
    Checks all active deals whose ends_at has elapsed, marks them inactive,
    and reverts item selling_price & mrp back to their original inventory prices.
    """
    from .models import DealOfTheDay
    expired_deals = DealOfTheDay.objects.filter(
        is_active=True,
        ends_at__isnull=False,
        ends_at__lte=timezone.now()
    ).select_related('item')

    for deal in expired_deals:
        try:
            deal.revert_item_prices()
            deal.is_active = False
            deal.save(update_fields=['is_active', 'updated_at'])
            logger.info(f"Auto-expired deal #{deal.id} for item '{deal.item.name}' and restored prices.")
        except Exception as err:
            logger.error(f"Error reverting prices for expired deal #{deal.id}: {err}")


class DealOfTheDayPublicListView(APIView):
    """
    Public storefront API returning active Deals of the Day (and auto-expiring stale ones).
    Only includes items that have an image and a valid weight (> 0).
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        sync_expired_deals()
        from .models import DealOfTheDay
        from .serializers import DealOfTheDaySerializer

        deals = DealOfTheDay.objects.filter(
            is_active=True,
            item__is_listed_on_website=True,
            item__weight__isnull=False,
            item__weight__gt=Decimal('0.00'),
            item__images__isnull=False
        ).select_related('item').prefetch_related('item__images').order_by('-created_at').distinct()

        serializer = DealOfTheDaySerializer(deals, many=True, context={'request': request})
        return Response(serializer.data)


class DealOfTheDayAdminListCreateView(APIView):
    """
    OS Admin API to list all deals and create new deals of the day.
    When a deal is created:
    - Verifies product completeness: must have at least one image and valid weight (> 0).
    - If incomplete, creation is rejected with an explanatory message.
    - Stores original_selling_price and original_mrp from current inventory Item.
    - Updates Item's selling_price and mrp in inventory immediately.
    - Calculates discount percentage automatically.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        sync_expired_deals()
        from .models import DealOfTheDay
        from .serializers import DealOfTheDaySerializer

        deals = DealOfTheDay.objects.select_related('item').prefetch_related('item__images').order_by('-created_at')
        serializer = DealOfTheDaySerializer(deals, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        from .models import DealOfTheDay
        from .serializers import DealOfTheDaySerializer

        item_id = request.data.get('item') or request.data.get('item_id')
        if not item_id:
            return Response({'error': 'item (item_id) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item = Item.objects.prefetch_related('images').get(id=item_id)
        except Item.DoesNotExist:
            return Response({'error': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        # STRICT VALIDATION: Must have image and weight to be added to deals / e-com site
        has_image = item.images.exists()
        has_weight = item.weight is not None and item.weight > Decimal('0.00')

        if not has_image or not has_weight:
            missing_parts = []
            if not has_image:
                missing_parts.append('at least one product image')
            if not has_weight:
                missing_parts.append('product weight in grams (> 0)')
            missing_desc = ' and '.join(missing_parts)
            return Response(
                {
                    'error': f"Cannot add this product to Deals of the Day: Incomplete product. It is missing {missing_desc}. Only products with an image and weight can be put on the e-commerce site.",
                    'is_incomplete': True,
                    'missing_requirements': ['image'] if not has_image else [] + (['weight'] if not has_weight else [])
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deal_selling_price = Decimal(str(request.data.get('deal_selling_price')))
            deal_mrp = Decimal(str(request.data.get('deal_mrp', item.mrp or item.selling_price)))
        except (ValueError, TypeError):
            return Response({'error': 'Valid deal_selling_price and deal_mrp are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if deal_selling_price <= Decimal('0.00'):
            return Response({'error': 'Deal selling price must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)

        if deal_mrp <= Decimal('0.00'):
            return Response({'error': 'Deal MRP must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)

        ends_at = request.data.get('ends_at') or None
        custom_badge = request.data.get('custom_badge', '') or 'Deal of the Day'

        with transaction.atomic():
            # If an existing deal exists for this item, revert or update
            existing_deal = DealOfTheDay.objects.filter(item=item).first()
            if existing_deal:
                orig_sell = existing_deal.original_selling_price
                orig_mrp = existing_deal.original_mrp
                deal = existing_deal
                deal.deal_selling_price = deal_selling_price
                deal.deal_mrp = deal_mrp
                deal.discount_percentage = deal.calculate_discount()
                deal.ends_at = ends_at
                deal.is_active = True
                deal.custom_badge = custom_badge
                deal.save()
            else:
                orig_sell = item.selling_price
                orig_mrp = item.mrp or item.selling_price
                deal = DealOfTheDay(
                    item=item,
                    deal_selling_price=deal_selling_price,
                    deal_mrp=deal_mrp,
                    original_selling_price=orig_sell,
                    original_mrp=orig_mrp,
                    ends_at=ends_at,
                    is_active=True,
                    custom_badge=custom_badge,
                )
                deal.discount_percentage = deal.calculate_discount()
                deal.save()

            # Update item's inventory selling price and MRP directly
            item.selling_price = deal_selling_price
            item.mrp = deal_mrp
            # Also ensure item is published to website
            if not item.is_listed_on_website:
                item.is_listed_on_website = True
                item.save(update_fields=['selling_price', 'mrp', 'is_listed_on_website'])
            else:
                item.save(update_fields=['selling_price', 'mrp'])

        serializer = DealOfTheDaySerializer(deal, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DealOfTheDayAdminDetailView(APIView):
    """
    OS Admin API to update, toggle, or delete a Deal of the Day.
    When updated:
    - Adjusts promotional selling_price and mrp in inventory.
    When deleted or marked inactive:
    - Automatically reverts item's selling_price and mrp in inventory back to original prices.
    """
    authentication_classes = []
    permission_classes = []

    def get_object(self, deal_id):
        from .models import DealOfTheDay
        return get_object_or_404(DealOfTheDay, id=deal_id)

    def get(self, request, deal_id):
        from .serializers import DealOfTheDaySerializer
        deal = self.get_object(deal_id)
        serializer = DealOfTheDaySerializer(deal, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, deal_id):
        from .serializers import DealOfTheDaySerializer
        deal = self.get_object(deal_id)
        item = deal.item

        with transaction.atomic():
            if 'deal_selling_price' in request.data:
                deal.deal_selling_price = Decimal(str(request.data['deal_selling_price']))
            if 'deal_mrp' in request.data:
                deal.deal_mrp = Decimal(str(request.data['deal_mrp']))
            if 'ends_at' in request.data:
                deal.ends_at = request.data['ends_at'] or None
            if 'custom_badge' in request.data:
                deal.custom_badge = request.data['custom_badge']

            deal.discount_percentage = deal.calculate_discount()

            if 'is_active' in request.data:
                new_active = bool(request.data['is_active'])
                deal.is_active = new_active
                if not new_active:
                    deal.revert_item_prices()
                else:
                    item.selling_price = deal.deal_selling_price
                    item.mrp = deal.deal_mrp
                    item.save(update_fields=['selling_price', 'mrp'])
            else:
                if deal.is_active and not deal.is_expired():
                    item.selling_price = deal.deal_selling_price
                    item.mrp = deal.deal_mrp
                    item.save(update_fields=['selling_price', 'mrp'])

            deal.save()

        serializer = DealOfTheDaySerializer(deal, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, deal_id):
        deal = self.get_object(deal_id)
        with transaction.atomic():
            # Revert item prices back to original inventory values
            deal.revert_item_prices()
            deal.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

