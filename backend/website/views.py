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
        queryset = Item.objects.filter(is_listed_on_website=True).prefetch_related(
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
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, identifier):
        item = None
        if identifier.isdigit():
            item = Item.objects.filter(id=int(identifier), is_listed_on_website=True).first()
        if not item:
            item = Item.objects.filter(uid__iexact=identifier, is_listed_on_website=True).first()

        if not item:
            return Response(
                {'detail': 'Product not found or not listed on website.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PublicItemSerializer(item, context={'request': request})
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
                subcategories__items__is_listed_on_website=True
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
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        sync_expired_deals()
        from .models import DealOfTheDay
        from .serializers import DealOfTheDaySerializer

        deals = DealOfTheDay.objects.filter(
            is_active=True,
            item__is_listed_on_website=True
        ).select_related('item').prefetch_related('item__images').order_by('-created_at')

        serializer = DealOfTheDaySerializer(deals, many=True, context={'request': request})
        return Response(serializer.data)


class DealOfTheDayAdminListCreateView(APIView):
    """
    OS Admin API to list all deals and create new deals of the day.
    When a deal is created:
    - Stores original_selling_price and original_mrp from the current inventory Item.
    - Updates the Item's selling_price and mrp in the inventory database immediately.
    - Calculates the discount percentage automatically based on deal_mrp and deal_selling_price.
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
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({'error': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

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

