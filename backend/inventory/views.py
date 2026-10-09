import json
from decimal import Decimal
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from django.http import HttpResponse, Http404
from django.db import transaction
from django.db.models import Q, Sum


def parse_filter_datetime(val_str):
    if not val_str:
        return None
    try:
        val_str = str(val_str).strip()
        dt = parse_datetime(val_str)
        if dt:
            if timezone.is_naive(dt):
                return timezone.make_aware(dt, timezone.get_current_timezone())
            return dt
        d = parse_date(val_str)
        if d:
            naive_dt = timezone.datetime.combine(d, timezone.datetime.min.time())
            return timezone.make_aware(naive_dt, timezone.get_current_timezone())
    except Exception:
        pass
    return None



from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .dashboard_services import get_dashboard_analytics, get_product_analytics, get_expiry_analytics

from .models import (
    Store,
    Category,
    SubCategory,
    Item,
    StockMovement,
    ItemImage,
    Customer,
    SaleOrder,
    SaleOrderItem,
    OrderPaymentTransaction,
    VIPCardTransaction,
    CounterPayout,
    DailyRegisterShift,
    Supplier,
    Section,
    AIDescriptionBatchJob,
    BrokenItemReport,
)
from .serializers import (
    StoreSerializer,
    CategorySerializer,
    SubCategorySerializer,
    SupplierSerializer,
    SectionSerializer,
    ItemSerializer,
    ItemCreateUpdateSerializer,
    ItemImageSerializer,
    StockMovementSerializer,
    StockAdjustmentSerializer,
    CustomerSerializer,
    SaleOrderSerializer,
    SaleOrderItemSerializer,
    CheckoutSerializer,
    VIPCardAssignSerializer,
    VIPCardRechargeSerializer,
    VIPCardTransactionSerializer,
    CounterPayoutSerializer,
    DailyRegisterShiftSerializer,
    ProcessReturnSerializer,
    AIDescriptionBatchJobSerializer,
    BrokenItemReportSerializer,
    generate_next_return_number,
    generate_next_payout_number,
)
from .services import (
    adjust_stock,
    generate_barcode_image,
    convert_image_to_webp,
    create_product_variant,
    get_item_variants,
    preview_expired_stock,
    write_off_expired_stock,
    report_broken_item,
)
from .ai_service import (
    extract_products_from_bill,
    test_gemini_api_key,
    generate_product_description,
    start_background_batch_description_job,
    get_configured_gemini_api_keys,
    GeminiRateLimitError,
)
from staff.services.auth import get_current_staff, ensure_default_store


class StoreViewSet(viewsets.ModelViewSet):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer

    def get_queryset(self):
        # Auto-seed default store if database has no stores yet
        if not Store.objects.exists():
            ensure_default_store()
        return Store.objects.all()

    @action(detail=False, methods=['get', 'post'], url_path='toggle-stakeholders')
    def toggle_stakeholders(self, request):
        """
        Global & store-level toggle for the Stakeholders profit-sharing system.
        GET: returns {'enable_stakeholders': bool, 'stores_count': int}
        POST: toggles enable_stakeholders across all stores (or specific store_id).
              Accepts optional {'enable_stakeholders': bool, 'store_id': int}
        """
        store_id = request.data.get('store_id') or request.query_params.get('store_id')
        target_qs = Store.objects.all()
        if store_id and str(store_id).lower() not in ('all', '', 'null', 'none'):
            try:
                target_qs = target_qs.filter(id=int(store_id))
            except (ValueError, TypeError):
                pass

        if request.method == 'GET':
            first_store = target_qs.filter(is_active=True).first() or target_qs.first()
            is_enabled = getattr(first_store, 'enable_stakeholders', True) if first_store else True
            return Response({
                'enable_stakeholders': is_enabled,
                'stores_count': target_qs.count()
            })

        # POST: Toggle or set explicitly
        req_val = request.data.get('enable_stakeholders')
        if req_val is None:
            req_val = request.data.get('enabled')
        if req_val is None:
            req_val = request.query_params.get('enable_stakeholders') or request.query_params.get('enabled')

        if req_val is not None:
            if isinstance(req_val, str):
                new_val = req_val.strip().lower() in ('true', '1', 'yes', 'on')
            else:
                new_val = bool(req_val)
        else:
            first_store = target_qs.filter(is_active=True).first() or target_qs.first()
            current_val = getattr(first_store, 'enable_stakeholders', True) if first_store else True
            new_val = not current_val

        updated_count = target_qs.update(enable_stakeholders=new_val)
        return Response({
            'success': True,
            'enabled': new_val,
            'enable_stakeholders': new_val,
            'message': f"Stakeholders module {'enabled' if new_val else 'disabled'} successfully across {updated_count} store(s)."
        })



class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.prefetch_related('subcategories').all()
    serializer_class = CategorySerializer


class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.select_related('category').all()
    serializer_class = SubCategorySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.select_related('store').prefetch_related('items').all()
    serializer_class = SupplierSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store')
        if store_id:
            qs = qs.filter(Q(store_id=store_id) | Q(store__isnull=True))
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(phone__icontains=search) |
                Q(city__icontains=search) |
                Q(gst_number__icontains=search)
            )
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        return qs


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related('store').prefetch_related('items', 'staff_members').all()
    serializer_class = SectionSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            member = get_current_staff(request)
            if member and not member.is_owner:
                # If member is section-bound or lacks administrative privilege, deny modification
                if member.effective_inventory_scope == 'assigned_section' or not getattr(member.role, 'can_access_staff', False):
                    raise PermissionDenied("Creating, updating, or deleting store sections is restricted to Store Owners and Administrators.")

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(Q(store_id=store_id) | Q(store__isnull=True))
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(description__icontains=search)
            )
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        return qs


from rest_framework.exceptions import PermissionDenied



class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('store', 'supplier', 'section').prefetch_related('subcategories', 'subcategories__category', 'images').all()
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        member = get_current_staff(request)
        if member and not member.role.is_owner:
            allowed = member.role.allowed_modules or []
            # Access to inventory requires inventory or billing modules
            if self.action in ['list', 'retrieve', 'by_uid', 'check_uid', 'barcode_action', 'report_broken']:
                if 'inventory' not in allowed and 'billing' not in allowed:
                    raise PermissionDenied("Your role does not have permission to access the Inventory module.")
            else:
                if 'inventory' not in allowed:
                    raise PermissionDenied("Your role does not have permission to access the Inventory module.")
            if self.action == 'adjust_stock' and not member.role.can_adjust_stock:
                raise PermissionDenied("Your role does not have permission to perform stock adjustments.")

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ItemCreateUpdateSerializer
        return ItemSerializer

    def perform_create(self, serializer):
        member = get_current_staff(self.request)
        extra = {}
        if member and not member.is_owner:
            if member.store is not None:
                extra['store'] = member.store
            # Enforce Section Inventory Access Control (Phase 3)
            if member.effective_inventory_scope == 'assigned_section':
                if not member.section_id:
                    raise PermissionDenied("Your account is restricted to your assigned section, but no section is currently assigned to you.")
                extra['section'] = member.section
        serializer.save(**extra)

    def perform_update(self, serializer):
        member = get_current_staff(self.request)
        extra = {}
        if member and not member.is_owner:
            if member.store is not None:
                extra['store'] = member.store
            # Enforce Section Inventory Access Control (Phase 3)
            if member.effective_inventory_scope == 'assigned_section':
                if not member.section_id:
                    raise PermissionDenied("Your account is restricted to your assigned section, but no section is currently assigned to you.")
                extra['section'] = member.section
        serializer.save(**extra)

    def get_queryset(self):
        qs = super().get_queryset()
        member = get_current_staff(self.request)

        # Enforce store location data isolation:
        # If staff is not an owner and has an assigned store, STRICTLY lock queryset to their store!
        if member and not member.is_owner and member.store is not None:
            qs = qs.filter(store=member.store)
        else:
            # Filter by store if requested (for owners or multi-store managers)
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(store_id=store_id)

        # Enforce Section Inventory Access Control (Phase 3):
        # If staff has assigned_section scope, strictly isolate queryset to items in their assigned section.
        # If no section is assigned yet, return no items to prevent data leaks.
        if member and not member.is_owner:
            if member.effective_inventory_scope == 'assigned_section':
                if member.section_id:
                    qs = qs.filter(section_id=member.section_id)
                else:
                    qs = qs.none()

        # Search parameter (matches name, UID, or section)
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            qs = qs.filter(
                Q(name__icontains=search_query) |
                Q(uid__icontains=search_query) |
                Q(section__name__icontains=search_query) |
                Q(section__code__icontains=search_query) |
                Q(location_section__icontains=search_query)
            )

        # Filter by section
        section_id = self.request.query_params.get('section') or self.request.query_params.get('section_id')
        if section_id:
            if section_id in ('unassigned', 'none', 'null'):
                qs = qs.filter(section__isnull=True)
            else:
                qs = qs.filter(section_id=section_id)

        # Filter by parent category (returns all items in any subcategory under this category)
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(subcategories__category_id=category_id)

        # Filter by specific subcategories (supports single ID, comma-separated IDs, or multiple query params)
        subcategory_param = self.request.query_params.get('subcategories') or self.request.query_params.get('subcategory')
        subcat_list = self.request.query_params.getlist('subcategory') or self.request.query_params.getlist('subcategories')
        all_subcat_ids = set()
        if subcategory_param:
            for s in str(subcategory_param).split(','):
                s_clean = s.strip()
                if s_clean:
                    all_subcat_ids.add(s_clean)
        for s in subcat_list:
            for sub_s in str(s).split(','):
                sub_s_clean = sub_s.strip()
                if sub_s_clean:
                    all_subcat_ids.add(sub_s_clean)

        if all_subcat_ids:
            qs = qs.filter(subcategories__id__in=list(all_subcat_ids)).distinct()

        # Filter by source (new / legacy)
        source = self.request.query_params.get('source')
        if source:
            qs = qs.filter(source=source)

        # Filter by needs_new_barcode_printed
        needs_barcode = self.request.query_params.get('needs_new_barcode_printed')
        if needs_barcode is not None:
            val = needs_barcode.lower() in ('true', '1')
            qs = qs.filter(needs_new_barcode_printed=val)

        # Filter by stock status / level (custom operators or preset)
        stock_status = self.request.query_params.get('stock_status')
        if stock_status == 'out':
            qs = qs.filter(quantity__lte=0)
        elif stock_status == 'low':
            qs = qs.filter(quantity__gt=0, quantity__lte=5)
        elif stock_status == 'in_stock':
            qs = qs.filter(quantity__gt=0)

        min_stock = self.request.query_params.get('min_stock')
        max_stock = self.request.query_params.get('max_stock')
        if min_stock is not None and min_stock.strip() != '':
            try:
                qs = qs.filter(quantity__gte=int(min_stock))
            except (ValueError, TypeError):
                pass
        if max_stock is not None and max_stock.strip() != '':
            try:
                qs = qs.filter(quantity__lte=int(max_stock))
            except (ValueError, TypeError):
                pass

        # Filter by has_no_image
        has_no_image = self.request.query_params.get('has_no_image')
        if has_no_image is not None and has_no_image.lower() in ('true', '1'):
            qs = qs.filter(images__isnull=True)

        # Filter by has_no_subcategory
        has_no_subcategory = self.request.query_params.get('has_no_subcategory')
        if has_no_subcategory is not None and has_no_subcategory.lower() in ('true', '1'):
            qs = qs.filter(subcategories__isnull=True)

        # Filter by supplier
        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        # Filter by has_no_supplier
        has_no_supplier = self.request.query_params.get('has_no_supplier')
        if has_no_supplier is not None and has_no_supplier.lower() in ('true', '1'):
            qs = qs.filter(supplier__isnull=True)

        # Filter by has_no_weight
        has_no_weight = self.request.query_params.get('has_no_weight')
        if has_no_weight is not None and has_no_weight.lower() in ('true', '1'):
            qs = qs.filter(Q(weight__isnull=True) | Q(weight__lte=0))

        # Filter by has_no_volume
        has_no_volume = self.request.query_params.get('has_no_volume')
        if has_no_volume is not None and has_no_volume.lower() in ('true', '1'):
            qs = qs.filter(
                Q(length__isnull=True) | Q(length__lte=0) |
                Q(width__isnull=True) | Q(width__lte=0) |
                Q(height__isnull=True) | Q(height__lte=0)
            )

        return qs.distinct()

    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock_action(self, request, pk=None):
        """Perform a stock addition or deduction through the ledger."""
        item = self.get_object()
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        change = serializer.validated_data['change']
        reason = serializer.validated_data['reason']
        note = serializer.validated_data.get('note', '')

        staff = get_current_staff(request)

        movement = adjust_stock(
            item=item,
            change=change,
            reason=reason,
            note=note,
            performed_by=staff
        )
        item.refresh_from_db()

        return Response({
            'message': f"Stock adjusted by {change:+d} successfully.",
            'item': ItemSerializer(item, context={'request': request}).data,
            'movement': StockMovementSerializer(movement).data
        })

    @action(detail=True, methods=['get'], url_path='barcode')
    def barcode_action(self, request, pk=None):
        """Generates and serves a Code128 barcode image (PNG) for printing/display."""
        item = self.get_object()
        buffer = generate_barcode_image(item.uid)

        download = request.query_params.get('download') == '1'
        response = HttpResponse(buffer.getvalue(), content_type='image/png')
        response['Cache-Control'] = 'no-cache, must-revalidate'
        if download:
            response['Content-Disposition'] = f'attachment; filename="barcode_{item.uid}.png"'
        else:
            response['Content-Disposition'] = f'inline; filename="barcode_{item.uid}.png"'
        return response

    @action(detail=True, methods=['post'], url_path='upload-images', parser_classes=[MultiPartParser, FormParser])
    def upload_images(self, request, pk=None):
        """
        Accepts multiple images in one request, converts each to WebP server-side,
        and saves them. Original files are never permanently persisted.
        """
        item = self.get_object()
        files = request.FILES.getlist('images')

        if not files:
            return Response(
                {'error': 'No image files provided under "images" key.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        has_existing_images = item.images.exists()
        created_images = []

        for idx, uploaded_file in enumerate(files):
            # Convert to WebP in-memory ContentFile
            webp_content_file = convert_image_to_webp(uploaded_file)
            is_primary = (not has_existing_images and idx == 0)

            image_instance = ItemImage.objects.create(
                item=item,
                image=webp_content_file,
                is_primary=is_primary,
                order=item.images.count() + idx
            )
            created_images.append(image_instance)

        return Response(
            ItemImageSerializer(created_images, many=True, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'], url_path='stock-movements')
    def stock_movements(self, request, pk=None):
        """Fetches the audit history ledger of stock movements for this item."""
        item = self.get_object()
        qs = item.stock_movements.all()
        start_time = parse_filter_datetime(request.query_params.get('start_time'))
        end_time = parse_filter_datetime(request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(created_at__gte=start_time)
        if end_time:
            qs = qs.filter(created_at__lte=end_time)
        serializer = StockMovementSerializer(qs.order_by('-created_at'), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser, JSONParser], url_path='report-broken')
    def report_broken(self, request, pk=None):
        """Action endpoint to report and write off broken units directly on a specific item."""
        item = self.get_object()
        quantity = request.data.get('quantity')
        reason = request.data.get('reason')
        proof_image = request.FILES.get('proof_image') or request.data.get('proof_image')
        member = get_current_staff(request)

        try:
            report = report_broken_item(
                item_id=item.id,
                quantity=quantity,
                reason=reason,
                proof_image=proof_image,
                performed_by=member,
                user_display=getattr(member, 'name', '') or str(request.user)
            )
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BrokenItemReportSerializer(report, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='product-analytics')
    def product_analytics(self, request, pk=None):
        """
        Comprehensive product detail analytics endpoint:
        Provides lifetime cost/selling price histories, sales KPIs,
        best/lowest selling month/week/day, subcategory comparative analysis,
        and continuous multi-granularity time-series from item.created_at to current day.
        """
        item = self.get_object()
        data = get_product_analytics(item, request=request)
        return Response(data)

    @action(detail=False, methods=['get'], url_path='check-uid')
    def check_uid(self, request):
        """
        Fast lookup endpoint to check if a UID / Barcode already exists in inventory.
        Query params:
        - uid: string to check (required)
        - exclude_id: optional integer item ID to exclude (for edit scenarios)
        """
        uid = request.query_params.get('uid', '').strip()
        if not uid:
            return Response({'exists': False, 'uid': ''})

        exclude_id = request.query_params.get('exclude_id')
        qs = Item.objects.filter(uid__iexact=uid)
        if exclude_id:
            try:
                qs = qs.exclude(pk=int(exclude_id))
            except (ValueError, TypeError):
                pass

        exists = qs.exists()
        if exists:
            item = qs.select_related('store').first()
            return Response({
                'exists': True,
                'uid': uid,
                'item_id': item.id,
                'item_name': item.name,
                'store_id': item.store.id if item.store else None,
                'store_name': item.store.name if item.store else 'Unknown Store',
            })

        return Response({
            'exists': False,
            'uid': uid,
        })

    @action(detail=False, methods=['get'], url_path='by-uid/(?P<uid>[^/.]+)')
    def by_uid(self, request, uid=None):
        """
        Instant lookup endpoint for barcode scanner input.
        Jumps directly to item matching the scanned UID or legacy UID.
        Gracefully handles scanner symbology prefixes, control characters, leading zeroes, and zero-padding.
        """
        raw_uid = (uid or '').strip()
        import re
        # Strip control characters & common scanner symbology prefixes (e.g. ]C1, ]e0, \r, \n)
        clean_uid = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', raw_uid)
        clean_uid = re.sub(r'^\][A-Za-z0-9]{2}', '', clean_uid).strip().strip("'\" \t\r\n")

        qs = self.get_queryset()
        member = get_current_staff(request)

        # 1. Exact match on uid or legacy_uid
        item = qs.filter(Q(uid__iexact=clean_uid) | Q(legacy_uid__iexact=clean_uid)).first()

        # 2. Padded 7-digit fallback if numeric string
        if not item and clean_uid.isdigit() and len(clean_uid) < 7:
            padded = clean_uid.zfill(7)
            item = qs.filter(Q(uid__iexact=padded) | Q(legacy_uid__iexact=padded)).first()

        # 3. Stripped leading zeroes fallback
        if not item and clean_uid.startswith('0') and len(clean_uid) > 1:
            stripped = clean_uid.lstrip('0')
            item = qs.filter(Q(uid__iexact=stripped) | Q(legacy_uid__iexact=stripped)).first()

        # 4. Alphanumeric match (ignore special characters/spaces)
        if not item:
            clean_alpha = re.sub(r'[^a-zA-Z0-9]', '', clean_uid)
            if clean_alpha and len(clean_alpha) >= 3:
                item = qs.filter(Q(uid__iexact=clean_alpha) | Q(legacy_uid__iexact=clean_alpha)).first()

        # 5. Global fallback across stores if user is owner and item wasn't in currently filtered store
        if not item and member and getattr(member, 'is_owner', False):
            item = Item.objects.filter(Q(uid__iexact=clean_uid) | Q(legacy_uid__iexact=clean_uid)).first()
            if not item and clean_uid.isdigit() and len(clean_uid) < 7:
                item = Item.objects.filter(Q(uid__iexact=clean_uid.zfill(7)) | Q(legacy_uid__iexact=clean_uid.zfill(7))).first()

        if not item:
            raise Http404(f"Item with barcode/UID '{uid}' was not found.")

        serializer = ItemSerializer(item, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='extract-from-bill')
    def extract_from_bill(self, request):
        """
        AI Multimodal OCR Endpoint: Reads handwritten / printed bills & invoices,
        extracts product details with per-field confidence scores, and supports multi-key rotation.
        """
        files = request.FILES.getlist('files') or request.FILES.getlist('images')
        single_file = request.FILES.get('file') or request.FILES.get('image')
        if single_file and single_file not in files:
            files.append(single_file)

        if not files:
            return Response(
                {'error': 'No bill image or document files provided. Please upload at least one image or PDF file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse optional custom API keys passed by the client
        api_keys = []
        raw_keys = request.data.get('api_keys')
        if raw_keys:
            if isinstance(raw_keys, list):
                api_keys = raw_keys
            elif isinstance(raw_keys, str):
                try:
                    parsed_keys = json.loads(raw_keys)
                    if isinstance(parsed_keys, list):
                        api_keys = parsed_keys
                    else:
                        api_keys = [raw_keys]
                except Exception:
                    api_keys = [k.strip() for k in raw_keys.split(',') if k.strip()]

        # Custom Special Instructions / Override prompt
        custom_request = request.data.get('custom_request', '')
        if not isinstance(custom_request, str):
            custom_request = ''
        else:
            custom_request = custom_request.strip()

        # Prepare files data
        files_data = []
        for f in files:
            files_data.append({
                'name': f.name,
                'bytes': f.read(),
                'mime_type': getattr(f, 'content_type', 'image/jpeg') or 'image/jpeg'
            })

        # Fetch available store subcategories and suppliers
        subcats_qs = SubCategory.objects.all()
        subcategories_list = [{'id': sc.id, 'name': sc.name} for sc in subcats_qs]

        suppliers_qs = Supplier.objects.filter(is_active=True)
        suppliers_list = [{'id': s.id, 'name': s.name} for s in suppliers_qs]

        try:
            result = extract_products_from_bill(
                files_data=files_data,
                custom_api_keys=api_keys,
                available_subcategories=subcategories_list,
                available_suppliers=suppliers_list,
                custom_request=custom_request
            )
            return Response(result, status=status.HTTP_200_OK)
        except RuntimeError as r_err:
            try:
                err_data = json.loads(str(r_err))
                return Response(
                    err_data,
                    status=status.HTTP_429_TOO_MANY_REQUESTS if err_data.get('quota_exhausted') else status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception:
                return Response({'error': str(r_err)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as ex:
            return Response({'error': str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create_items(self, request):
        """
        High-performance bulk item registration endpoint.
        Creates hundreds or thousands of products in one transactional request,
        preventing rate-limiting (429) errors and eliminating single-item network overhead.
        """
        items_data = request.data.get('items', [])
        if not items_data or not isinstance(items_data, list):
            return Response({'error': 'A non-empty "items" list is required.'}, status=status.HTTP_400_BAD_REQUEST)

        member = get_current_staff(request)
        default_store = None
        if member and member.store:
            default_store = member.store
        else:
            first_store_id = request.data.get('store') or (items_data[0].get('store') if items_data else None)
            if first_store_id:
                default_store = Store.objects.filter(pk=first_store_id).first()
            if not default_store:
                default_store = Store.objects.first()

        if not default_store:
            return Response({'error': 'No active store found to associate items with.'}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce section restriction if user has assigned_section scope
        forced_section = None
        if member and not member.is_owner and member.effective_inventory_scope == 'assigned_section':
            if not member.section:
                return Response({'error': 'Your account is restricted to your assigned section, but none is set.'}, status=status.HTTP_403_FORBIDDEN)
            forced_section = member.section

        # Fetch known existing UIDs in one query to prevent duplicate clashes
        existing_uids_set = set(
            Item.objects.values_list('uid', flat=True)
        )
        existing_uids_lower = {u.lower() for u in existing_uids_set if u}

        # Cache existing lookup entities for maximum query speed
        all_subcategories = {s.id: s for s in SubCategory.objects.all()}
        all_suppliers = {s.id: s for s in Supplier.objects.all()}
        all_sections = {s.id: s for s in Section.objects.all()}

        from .models import GlobalSequence
        from decimal import Decimal

        created_items = []
        created_movements = []
        m2m_subcategories_map = []  # list of (item, subcat_ids)
        errors = []

        with transaction.atomic():
            # Reserve sequential UIDs for all items needing an auto-generated UID
            items_needing_uid = [item for item in items_data if not (item.get('uid') and str(item.get('uid')).strip())]
            
            allocated_uids = []
            if items_needing_uid:
                base_start = 1000000
                seq_obj, _ = GlobalSequence.objects.select_for_update().get_or_create(
                    name="item_uid",
                    defaults={'current_value': base_start - 1}
                )
                if seq_obj.current_value < (base_start - 1):
                    existing_nums = [
                        int(u) for u in existing_uids_set if u and u.isdigit() and base_start <= int(u) < 100000000
                    ]
                    seq_obj.current_value = max(existing_nums) if existing_nums else (base_start - 1)

                curr_num = seq_obj.current_value
                for _ in items_needing_uid:
                    curr_num += 1
                    while str(curr_num).lower() in existing_uids_lower:
                        curr_num += 1
                    allocated_uids.append(str(curr_num))
                    existing_uids_lower.add(str(curr_num).lower())

                seq_obj.current_value = curr_num
                seq_obj.save(update_fields=['current_value', 'updated_at'])

            allocated_uid_idx = 0
            staff_name = member.name if member else 'Owner / Admin'
            staff_role = getattr(member.role, 'name', 'Owner') if (member and member.role) else 'Owner'

            for idx, raw in enumerate(items_data):
                item_name = str(raw.get('name', '')).strip()
                if not item_name:
                    errors.append({'index': idx, 'error': 'Product name is required.'})
                    continue

                custom_uid = str(raw.get('uid', '')).strip() if raw.get('uid') else ''
                if custom_uid:
                    if custom_uid.lower() in existing_uids_lower:
                        errors.append({'index': idx, 'name': item_name, 'error': f"UID/Barcode '{custom_uid}' already exists."})
                        continue
                    final_uid = custom_uid
                    final_source = Item.SOURCE_LEGACY
                    final_legacy_uid = custom_uid
                    existing_uids_lower.add(custom_uid.lower())
                else:
                    final_uid = allocated_uids[allocated_uid_idx]
                    allocated_uid_idx += 1
                    final_source = Item.SOURCE_NEW
                    final_legacy_uid = None

                # Store resolution
                raw_store_id = raw.get('store')
                item_store = default_store
                if not (member and member.store) and raw_store_id:
                    s_found = Store.objects.filter(pk=raw_store_id).first()
                    if s_found:
                        item_store = s_found

                # Section resolution
                item_section = forced_section
                if not item_section:
                    sec_id = raw.get('sectionId') or raw.get('section')
                    if sec_id:
                        item_section = all_sections.get(int(sec_id) if str(sec_id).isdigit() else sec_id)

                # Supplier resolution
                sup_id = raw.get('supplierId') or raw.get('supplier')
                item_supplier = all_suppliers.get(int(sup_id) if str(sup_id).isdigit() else sup_id) if sup_id else None

                # Prices and Stock
                try:
                    c_price = Decimal(str(raw.get('cost_price', 0) or 0))
                except Exception:
                    c_price = Decimal('0.00')

                try:
                    s_price = Decimal(str(raw.get('selling_price', 0) or 0))
                except Exception:
                    s_price = Decimal('0.00')

                raw_mrp = raw.get('mrp_val') if raw.get('mrp_val') is not None else raw.get('mrp')
                try:
                    mrp_dec = Decimal(str(raw_mrp)) if (raw_mrp is not None and str(raw_mrp).strip() != '') else None
                except Exception:
                    mrp_dec = None

                # Quantities
                init_qty = raw.get('initialQuantity')
                if init_qty is None or str(init_qty).strip() == '':
                    init_qty = raw.get('initial_quantity')
                if init_qty is None or str(init_qty).strip() == '':
                    init_qty = raw.get('quantity', 0)
                try:
                    qty_int = int(init_qty)
                except Exception:
                    qty_int = 0

                # Subcategories
                subcat_ids = raw.get('subcategories') or []
                primary_sub = None
                valid_subcat_ids = []
                for sc_id in subcat_ids:
                    num_sc_id = int(sc_id) if str(sc_id).isdigit() else sc_id
                    if num_sc_id in all_subcategories:
                        valid_subcat_ids.append(num_sc_id)
                        if not primary_sub:
                            primary_sub = all_subcategories[num_sc_id]

                item_obj = Item(
                    uid=final_uid,
                    name=item_name,
                    quantity=qty_int,
                    cost_price=c_price,
                    selling_price=s_price,
                    mrp=mrp_dec,
                    store=item_store,
                    supplier=item_supplier,
                    section=item_section,
                    primary_subcategory=primary_sub,
                    location_section=str(raw.get('location_section') or raw.get('locationSection') or '').strip(),
                    expiry_date=raw.get('expiry_date') or raw.get('expiryDate') or None,
                    weight=Decimal(str(raw.get('weight'))) if raw.get('weight') else None,
                    length=Decimal(str(raw.get('length'))) if raw.get('length') else None,
                    width=Decimal(str(raw.get('width'))) if raw.get('width') else None,
                    height=Decimal(str(raw.get('height'))) if raw.get('height') else None,
                    description=str(raw.get('description') or '').strip(),
                    source=final_source,
                    legacy_uid=final_legacy_uid,
                    needs_new_barcode_printed=True,
                )
                created_items.append((item_obj, qty_int, valid_subcat_ids))

            if errors and len(created_items) == 0:
                return Response({'error': 'Failed to validate batch items.', 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

            # Bulk save all items in a single query
            to_save_models = [it[0] for it in created_items]
            Item.objects.bulk_create(to_save_models)

            # Re-fetch items to get assigned primary keys for StockMovement and M2M subcategories
            saved_uids = [it.uid for it in to_save_models]
            saved_items_by_uid = {it.uid: it for it in Item.objects.filter(uid__in=saved_uids)}

            # Create immutable ledger records for all products
            for item_obj, qty_int, valid_subcat_ids in created_items:
                persisted = saved_items_by_uid.get(item_obj.uid)
                if not persisted:
                    continue
                created_movements.append(StockMovement(
                    item=persisted,
                    change=qty_int,
                    reason=StockMovement.REASON_RESTOCK,
                    note="Initial stock assigned upon bulk product creation." if qty_int > 0 else "Product registered with 0 initial stock.",
                    performed_by=member if (member and hasattr(member, 'pk')) else None,
                    performed_by_name=staff_name,
                    performed_by_role=staff_role
                ))
                if valid_subcat_ids:
                    m2m_subcategories_map.append((persisted, valid_subcat_ids))

            if created_movements:
                StockMovement.objects.bulk_create(created_movements)

            # Bulk populate subcategories ManyToMany relationships
            ItemSubCategoryThrough = Item.subcategories.through
            through_objects = []
            for persisted, sub_ids in m2m_subcategories_map:
                for sid in sub_ids:
                    through_objects.append(ItemSubCategoryThrough(
                        item_id=persisted.id,
                        subcategory_id=sid
                    ))
            if through_objects:
                ItemSubCategoryThrough.objects.bulk_create(through_objects, ignore_conflicts=True)

        return Response({
            'success': True,
            'created_count': len(created_items),
            'skipped_count': len(errors),
            'errors': errors
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get', 'post'], url_path='test-gemini-key')
    def test_gemini_key(self, request):
        """Validates a Gemini API key connection, or tests configured env keys if none provided."""
        api_key = request.data.get('api_key', '').strip() if request.method == 'POST' else ''
        env_keys = get_configured_gemini_api_keys()

        if not api_key:
            # If no specific key is provided, test the first available environment key
            if env_keys:
                api_key = env_keys[0]
            else:
                return Response({
                    'success': False,
                    'error': 'No API key provided and no GEMINI_API_KEYS configured in backend/.env',
                    'env_keys_count': 0
                }, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = test_gemini_api_key(api_key)
            res['env_keys_count'] = len(env_keys)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as ex:
            return Response({'error': str(ex), 'env_keys_count': len(env_keys)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='bulk-ai-generate-descriptions')
    def bulk_ai_generate_descriptions(self, request):
        """
        Starts an asynchronous server-side background job to generate e-commerce
        descriptions for selected or all eligible items using Gemini Vision.
        """
        item_ids = request.data.get('item_ids', [])
        store_id = request.data.get('store_id')

        member = get_current_staff(request)
        store = None
        if member and member.store:
            store = member.store
        elif store_id:
            store = Store.objects.filter(pk=store_id).first()
        if not store:
            store = Store.objects.first()

        if not store:
            return Response({'error': 'No active store found for batch processing.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build target item queryset
        if item_ids and isinstance(item_ids, list) and len(item_ids) > 0:
            target_items = Item.objects.filter(id__in=item_ids, store=store)
        else:
            # All items in store
            target_items = Item.objects.filter(store=store)

        target_ids = list(target_items.values_list('id', flat=True))
        if not target_ids:
            return Response({'error': 'No eligible products found for description generation.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark target items as pending
        Item.objects.filter(id__in=target_ids).update(
            ai_description_status='pending',
            ai_description_error=''
        )

        # Create batch job record
        job = AIDescriptionBatchJob.objects.create(
            store=store,
            status=AIDescriptionBatchJob.STATUS_RUNNING,
            total_items=len(target_ids),
            completed_items=0,
            failed_items=0,
            skipped_items=0,
            item_ids=target_ids
        )

        # Parse optional custom API keys passed by client
        custom_keys = request.data.get('api_keys')
        if isinstance(custom_keys, str):
            custom_keys = [k.strip() for k in custom_keys.split(',') if k.strip()]
        elif not isinstance(custom_keys, list):
            custom_keys = []

        # Launch background async worker thread
        start_background_batch_description_job(str(job.id), custom_api_keys=custom_keys)

        return Response({
            'success': True,
            'job': AIDescriptionBatchJobSerializer(job).data,
            'message': f"Background description generation started for {len(target_ids)} items."
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], url_path='active-ai-description-job')
    def active_ai_description_job(self, request):
        """
        Polls the status of the current or most recent AI description batch generation job.
        """
        member = get_current_staff(request)
        store = member.store if member and member.store else None
        store_id = request.query_params.get('store') or (store.id if store else None)
        target_store = Store.objects.filter(pk=store_id).first() if store_id else (store or Store.objects.first())

        if not target_store:
            return Response({'active_job': None})

        # Sync/fetch latest job and ensure all items with AI statuses in this store are tracked
        job = AIDescriptionBatchJob.objects.filter(store=target_store).order_by('-created_at').first()
        store_ai_ids = list(Item.objects.filter(store=target_store).exclude(ai_description_status='none').values_list('id', flat=True))

        if not job:
            if store_ai_ids:
                job = AIDescriptionBatchJob.objects.create(
                    store=target_store,
                    status=AIDescriptionBatchJob.STATUS_COMPLETED,
                    total_items=len(store_ai_ids),
                    completed_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status__in=['ready', 'applied']).count(),
                    failed_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status='failed').count(),
                    skipped_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status='skipped_no_image').count(),
                    item_ids=store_ai_ids
                )
            else:
                return Response({'active_job': None})
        else:
            # Sync missing items into job.item_ids if any
            current_ids = list(job.item_ids or [])
            dirty = False
            for sid in store_ai_ids:
                if sid not in current_ids:
                    current_ids.insert(0, sid)
                    dirty = True
            if dirty:
                job.item_ids = current_ids
                job.total_items = len(current_ids)
                all_items = Item.objects.filter(id__in=current_ids)
                job.completed_items = all_items.filter(ai_description_status__in=['ready', 'applied']).count()
                job.failed_items = all_items.filter(ai_description_status='failed').count()
                job.skipped_items = all_items.filter(ai_description_status='skipped_no_image').count()
                job.save()

        return Response({
            'active_job': AIDescriptionBatchJobSerializer(job).data
        })

    @action(detail=False, methods=['get'], url_path=r'ai-description-jobs/(?P<job_id>[^/.]+)')
    def ai_description_job_detail(self, request, job_id=None):
        """
        Fetches detailed report and item list for a specific AI description batch job for review modal.
        """
        member = get_current_staff(request)
        store = member.store if member and member.store else None
        store_id = request.query_params.get('store') or (store.id if store else None)
        target_store = Store.objects.filter(pk=store_id).first() if store_id else (store or Store.objects.first())

        if job_id in ['active', 'latest', 'all', 'virtual'] or not job_id:
            qs = AIDescriptionBatchJob.objects.all()
            if target_store:
                qs = qs.filter(store=target_store)
            job = qs.order_by('-created_at').first()
        else:
            try:
                job = AIDescriptionBatchJob.objects.get(id=job_id)
            except (AIDescriptionBatchJob.DoesNotExist, ValueError):
                job = None

        store_ai_ids = list(Item.objects.filter(store=target_store).exclude(ai_description_status='none').values_list('id', flat=True)) if target_store else []

        if not job:
            if store_ai_ids:
                job = AIDescriptionBatchJob.objects.create(
                    store=target_store,
                    status=AIDescriptionBatchJob.STATUS_COMPLETED,
                    total_items=len(store_ai_ids),
                    completed_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status__in=['ready', 'applied']).count(),
                    failed_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status='failed').count(),
                    skipped_items=Item.objects.filter(id__in=store_ai_ids, ai_description_status='skipped_no_image').count(),
                    item_ids=store_ai_ids
                )
            else:
                return Response({'error': 'AI Description job not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Sync any new or edited items into job.item_ids
            current_ids = list(job.item_ids or [])
            dirty = False
            for sid in store_ai_ids:
                if sid not in current_ids:
                    current_ids.insert(0, sid)
                    dirty = True
            if dirty:
                job.item_ids = current_ids
                job.total_items = len(current_ids)
                all_items = Item.objects.filter(id__in=current_ids)
                job.completed_items = all_items.filter(ai_description_status__in=['ready', 'applied']).count()
                job.failed_items = all_items.filter(ai_description_status='failed').count()
                job.skipped_items = all_items.filter(ai_description_status='skipped_no_image').count()
                job.save()

        item_pks = job.item_ids or []
        items = Item.objects.filter(id__in=item_pks).select_related('store').prefetch_related('subcategories', 'subcategories__category', 'images')
        item_map = {item.id: item for item in items}
        ordered_items = [item_map[pk] for pk in item_pks if pk in item_map]

        return Response({
            'job': AIDescriptionBatchJobSerializer(job).data,
            'items': ItemSerializer(ordered_items, many=True, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='ai-generate-description')
    def single_ai_generate_description(self, request, pk=None):
        """
        Generates an AI description draft for a single item immediately using Gemini Vision,
        and adds it into the store's AI Description Studio review list.
        """
        item = self.get_object()
        primary_img = item.primary_image

        def _sync_item_to_job(item_obj):
            target_store = item_obj.store or Store.objects.first()
            if not target_store:
                return None
            job_obj = AIDescriptionBatchJob.objects.filter(store=target_store).order_by('-created_at').first()
            if not job_obj:
                job_obj = AIDescriptionBatchJob.objects.create(
                    store=target_store,
                    status=AIDescriptionBatchJob.STATUS_COMPLETED,
                    total_items=0,
                    completed_items=0,
                    failed_items=0,
                    skipped_items=0,
                    item_ids=[]
                )
            c_ids = list(job_obj.item_ids or [])
            if item_obj.id not in c_ids:
                c_ids.insert(0, item_obj.id)
            # Sync all non-none items
            store_ids = list(Item.objects.filter(store=target_store).exclude(ai_description_status='none').values_list('id', flat=True))
            for sid in store_ids:
                if sid not in c_ids:
                    c_ids.append(sid)
            job_obj.item_ids = c_ids
            job_obj.total_items = len(c_ids)
            all_i = Item.objects.filter(id__in=c_ids)
            job_obj.completed_items = all_i.filter(ai_description_status__in=['ready', 'applied']).count()
            job_obj.failed_items = all_i.filter(ai_description_status='failed').count()
            job_obj.skipped_items = all_i.filter(ai_description_status='skipped_no_image').count()
            job_obj.save()
            return job_obj

        if not primary_img or not primary_img.image:
            item.ai_description_status = 'skipped_no_image'
            item.ai_description_error = 'No product image uploaded. Please upload a photo first.'
            item.save(update_fields=['ai_description_status', 'ai_description_error'])
            job_synced = _sync_item_to_job(item)
            return Response({
                'error': 'This item has no product image. Please upload a product image first to generate an AI description.',
                'status': 'skipped_no_image',
                'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None,
                'item': ItemSerializer(item, context={'request': request}).data
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            img_file = primary_img.image.open('rb')
            img_bytes = img_file.read()
            img_file.close()
        except Exception as file_err:
            item.ai_description_status = 'failed'
            item.ai_description_error = f"Failed to read image file: {str(file_err)}"
            item.save(update_fields=['ai_description_status', 'ai_description_error'])
            job_synced = _sync_item_to_job(item)
            return Response({
                'error': f"Failed to read product image: {str(file_err)}",
                'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None,
                'item': ItemSerializer(item, context={'request': request}).data
            }, status=status.HTTP_400_BAD_REQUEST)

        cat_name = item.effective_primary_category.name if item.effective_primary_category else ''
        subcat_name = item.effective_primary_subcategory.name if item.effective_primary_subcategory else ''

        item_data = {
            'name': item.name,
            'category_name': cat_name,
            'subcategory_name': subcat_name,
            'selling_price': str(item.selling_price),
            'mrp': str(item.mrp) if item.mrp else ''
        }

        # Parse optional custom API keys passed by client
        custom_keys = request.data.get('api_keys')
        if isinstance(custom_keys, str):
            custom_keys = [k.strip() for k in custom_keys.split(',') if k.strip()]

        try:
            item.ai_description_status = 'generating'
            item.save(update_fields=['ai_description_status'])
            _sync_item_to_job(item)

            gen_res = generate_product_description(
                image_bytes=img_bytes,
                mime_type='image/jpeg',
                item_data=item_data,
                custom_api_keys=custom_keys
            )

            desc = gen_res.get('description', '')
            if desc:
                clean_desc = str(desc).strip()[:1500]
                item.ai_description_draft = clean_desc
                item.ai_description_status = 'ready'
                item.ai_description_error = ''
                item.ai_description_updated_at = timezone.now()
                item.save(update_fields=[
                    'ai_description_draft',
                    'ai_description_status',
                    'ai_description_error',
                    'ai_description_updated_at'
                ])
                job_synced = _sync_item_to_job(item)
                return Response({
                    'success': True,
                    'description': clean_desc,
                    'model_used': gen_res.get('model_used'),
                    'item': ItemSerializer(item, context={'request': request}).data,
                    'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None
                })
            else:
                item.ai_description_status = 'failed'
                item.ai_description_error = 'Gemini returned an empty description.'
                item.save(update_fields=['ai_description_status', 'ai_description_error'])
                job_synced = _sync_item_to_job(item)
                return Response({
                    'error': 'AI returned an empty description.',
                    'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None,
                    'item': ItemSerializer(item, context={'request': request}).data
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except GeminiRateLimitError as rate_err:
            item.ai_description_status = 'failed'
            item.ai_description_error = rate_err.message
            item.save(update_fields=['ai_description_status', 'ai_description_error'])
            job_synced = _sync_item_to_job(item)
            return Response({
                'error': rate_err.message,
                'is_daily': rate_err.is_daily,
                'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None,
                'item': ItemSerializer(item, context={'request': request}).data
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except Exception as ex:
            item.ai_description_status = 'failed'
            item.ai_description_error = str(ex)
            item.save(update_fields=['ai_description_status', 'ai_description_error'])
            job_synced = _sync_item_to_job(item)
            return Response({
                'error': str(ex),
                'job': AIDescriptionBatchJobSerializer(job_synced).data if job_synced else None,
                'item': ItemSerializer(item, context={'request': request}).data
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='apply-ai-description')
    def apply_ai_description(self, request, pk=None):
        """
        Commits the generated or edited AI draft description to the live item.description field,
        overwriting any existing description (enforcing 1500 char maximum).
        """
        item = self.get_object()
        custom_text = request.data.get('description')
        desc_to_apply = custom_text if (custom_text is not None and str(custom_text).strip()) else item.ai_description_draft

        if not desc_to_apply or not str(desc_to_apply).strip():
            return Response({'error': 'No description content provided to apply.'}, status=status.HTTP_400_BAD_REQUEST)

        # Overwrite item.description (enforcing max 1500 chars)
        clean_text = str(desc_to_apply).strip()[:1500]
        item.description = clean_text
        item.ai_description_draft = clean_text
        item.ai_description_status = 'applied'
        item.ai_description_error = ''
        item.save(update_fields=['description', 'ai_description_draft', 'ai_description_status', 'ai_description_error', 'updated_at'])

        return Response({
            'success': True,
            'message': 'Description applied and overwritten successfully.',
            'item': ItemSerializer(item, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='discard-ai-description')
    def discard_ai_description(self, request, pk=None):
        """
        Discards the AI generated draft description for an item, clearing draft and resetting status to 'none'.
        Also updates the batch job tracking so the item is removed from review.
        """
        item = self.get_object()
        item.ai_description_status = 'none'
        item.ai_description_draft = ''
        item.ai_description_error = ''
        item.save(update_fields=['ai_description_status', 'ai_description_draft', 'ai_description_error', 'updated_at'])

        # Update batch job
        target_store = item.store or Store.objects.first()
        job = None
        if target_store:
            job = AIDescriptionBatchJob.objects.filter(store=target_store).order_by('-created_at').first()
            if job and job.item_ids:
                current_ids = [i for i in job.item_ids if i != item.id]
                job.item_ids = current_ids
                job.total_items = len(current_ids)
                all_i = Item.objects.filter(id__in=current_ids)
                job.completed_items = all_i.filter(ai_description_status__in=['ready', 'applied']).count()
                job.failed_items = all_i.filter(ai_description_status='failed').count()
                job.skipped_items = all_i.filter(ai_description_status='skipped_no_image').count()
                job.save()

        return Response({
            'success': True,
            'message': 'AI description draft discarded successfully.',
            'item': ItemSerializer(item, context={'request': request}).data,
            'job': AIDescriptionBatchJobSerializer(job).data if job else None
        })

    @action(detail=False, methods=['post'], url_path='bulk-apply-ai-descriptions')
    def bulk_apply_ai_descriptions(self, request):
        """
        Bulk commits all approved/ready AI draft descriptions to their live item.description fields,
        overwriting existing descriptions (enforcing 1500 char maximum).
        """
        item_ids = request.data.get('item_ids', [])
        member = get_current_staff(request)
        store = member.store if member and member.store else None

        if item_ids and isinstance(item_ids, list) and len(item_ids) > 0:
            qs = Item.objects.filter(id__in=item_ids).exclude(ai_description_draft='')
        else:
            qs = Item.objects.filter(ai_description_status='ready').exclude(ai_description_draft='')

        if store:
            qs = qs.filter(store=store)

        applied_count = 0
        for item in qs:
            if item.ai_description_draft and str(item.ai_description_draft).strip():
                clean_text = str(item.ai_description_draft).strip()[:1500]
                item.description = clean_text
                item.ai_description_draft = clean_text
                item.ai_description_status = 'applied'
                item.ai_description_error = ''
                item.save(update_fields=['description', 'ai_description_draft', 'ai_description_status', 'ai_description_error', 'updated_at'])
                applied_count += 1

        return Response({
            'success': True,
            'applied_count': applied_count,
            'message': f"Successfully applied and overwritten descriptions for {applied_count} items."
        })

    @action(detail=True, methods=['post'], url_path='retry-ai-description')
    def retry_ai_description(self, request, pk=None):
        """
        Retries AI description generation for a failed or skipped item.
        """
        return self.single_ai_generate_description(request, pk=pk)

    # ─── Variant & Batch Management Actions ──────────────────────────────────

    @action(detail=True, methods=['get'], url_path='variants')
    def list_variants(self, request, pk=None):
        """
        Returns all Items in the same variant/batch family as this item,
        including the item itself. If the item has no siblings, returns [item].
        """
        item = self.get_object()
        variants = get_item_variants(item)
        return Response({
            'variant_group_id': item.variant_group_id,
            'total_variants': len(variants),
            'variants': ItemSerializer(variants, many=True, context={'request': request}).data,
        })

    @action(detail=False, methods=['get'], url_path='next-uid')
    def get_next_uid(self, request):
        """
        Returns the next sequential unique UID for items/variants.
        """
        return Response({'next_uid': generate_next_uid()})

    @action(detail=True, methods=['post'], url_path='create-variant')
    def create_variant(self, request, pk=None):
        """
        Branches a new product variant/batch from this item.
        Requires at least one differing attribute vs the source item.
        Auto-generates a new uid/barcode unless one is explicitly provided.
        """
        source_item = self.get_object()
        staff = get_current_staff(request)
        variant_data = dict(request.data)

        # Handle uploaded image if present
        if request.FILES.get('image'):
            variant_data['_has_new_image'] = True

        try:
            new_item = create_product_variant(
                source_item=source_item,
                variant_data=variant_data,
                actor=staff,
            )
            # If user uploaded a new image for this variant, apply it as primary
            if request.FILES.get('image'):
                from .models import ItemImage
                webp_file = convert_image_to_webp(request.FILES['image'])
                ItemImage.objects.create(
                    item=new_item,
                    image=webp_file,
                    is_primary=True,
                    order=0,
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to create variant: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        source_item.refresh_from_db()
        return Response(
            {
                'message': f"Variant '{new_item.uid}' created successfully.",
                'variant': ItemSerializer(new_item, context={'request': request}).data,
                'source_item': ItemSerializer(source_item, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED
        )

    # ─── Expired Stock Write-Off Actions ─────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='expired-preview')
    def expired_preview(self, request):
        """
        Read-only preview: returns all items past their expiry date with stock > 0,
        along with total units and total potential financial loss (at cost price).
        Does NOT write off anything — safe confirmation step.
        """
        store_id = request.query_params.get('store')
        if not store_id:
            member = get_current_staff(request)
            if member and member.store:
                store_id = member.store.id
        result = preview_expired_stock(store_id=store_id)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='write-off-expired')
    def write_off_expired(self, request):
        """
        Executes the expired stock write-off for all items past their expiry date
        with stock > 0. Creates StockMovement entries with reason='expired' and
        sets each item's quantity to 0.

        Accepts:
        - store (query param or body): restrict to specific store
        - item_id (body): restrict to a single item
        """
        store_id = request.data.get('store') or request.query_params.get('store')
        item_id = request.data.get('item_id')

        if not store_id:
            member = get_current_staff(request)
            if member and member.store:
                store_id = member.store.id

        staff = get_current_staff(request)
        try:
            result = write_off_expired_stock(
                store_id=store_id,
                item_id=item_id,
                actor=staff,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'success': True,
            'message': (
                f"Write-off complete. {result['items_written_off_count']} item(s), "
                f"{result['total_units_written_off']} unit(s) written off. "
                f"Total financial loss recorded: ₹{result['total_financial_loss']:,.2f}"
            ),
            **result,
        })


class ItemImageViewSet(viewsets.ModelViewSet):
    queryset = ItemImage.objects.all()
    serializer_class = ItemImageSerializer

    @action(detail=True, methods=['post'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        image = self.get_object()
        image.is_primary = True
        image.save()
        return Response({'message': f"Image {image.id} is now primary."})


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Store-wide read-only viewset for auditing immutable Stock Movements.
    Enforces store location data isolation for staff members and exposes performed_by staff info.
    """
    queryset = StockMovement.objects.select_related('item', 'item__store', 'performed_by', 'performed_by__role').all()
    serializer_class = StockMovementSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        member = get_current_staff(request)
        if member and not member.role.is_owner:
            allowed = member.role.allowed_modules or []
            if 'inventory' not in allowed:
                raise PermissionDenied("Your role does not have permission to access the Inventory module.")

    def get_queryset(self):
        qs = super().get_queryset()
        member = get_current_staff(self.request)

        # Enforce store location data isolation:
        if member and not member.is_owner and member.store is not None:
            qs = qs.filter(item__store=member.store)
        else:
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(item__store_id=store_id)

        item_id = self.request.query_params.get('item')
        if item_id:
            qs = qs.filter(item_id=item_id)

        reason = self.request.query_params.get('reason')
        if reason:
            qs = qs.filter(reason=reason)

        staff_id = self.request.query_params.get('staff')
        if staff_id:
            qs = qs.filter(
                Q(performed_by_id=staff_id) |
                Q(performed_by__staff_id__iexact=staff_id) |
                Q(performed_by_name__icontains=staff_id)
            )

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(item__name__icontains=search) |
                Q(item__uid__icontains=search) |
                Q(note__icontains=search) |
                Q(performed_by_name__icontains=search) |
                Q(performed_by_role__icontains=search) |
                Q(performed_by__name__icontains=search) |
                Q(performed_by__staff_id__icontains=search)
            )

        start_time = parse_filter_datetime(self.request.query_params.get('start_time'))
        end_time = parse_filter_datetime(self.request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(created_at__gte=start_time)
        if end_time:
            qs = qs.filter(created_at__lte=end_time)

        return qs.order_by('-created_at')


class BrokenItemReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing and auditing broken/damaged inventory reports.
    Provides bulletproof stock deduction, photo proof compliance, and section access filtering.
    """
    queryset = BrokenItemReport.objects.select_related('item', 'store', 'section', 'reported_by', 'stock_movement').all()
    serializer_class = BrokenItemReportSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        member = get_current_staff(self.request)
        if member and not getattr(getattr(member, 'role', None), 'is_owner', False):
            scope = getattr(member, 'inventory_scope', None) or getattr(member.role, 'inventory_scope', 'full')
            if scope == 'assigned_section' and getattr(member, 'section_id', None):
                qs = qs.filter(section_id=member.section_id)
            if getattr(member, 'store_id', None):
                qs = qs.filter(store_id=member.store_id)

        store_id = self.request.query_params.get('store')
        if store_id:
            qs = qs.filter(store_id=store_id)
        section_id = self.request.query_params.get('section')
        if section_id:
            qs = qs.filter(section_id=section_id)
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            qs = qs.filter(created_at__year=year)
        if month:
            qs = qs.filter(created_at__month=month)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(item__name__icontains=search) |
                Q(item__uid__icontains=search) |
                Q(reason__icontains=search) |
                Q(reported_by_name__icontains=search)
            )
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        item_id = request.data.get('item') or request.data.get('item_id')
        if not item_id:
            return Response({'error': 'Item ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        quantity = request.data.get('quantity')
        reason = request.data.get('reason')
        proof_image = request.FILES.get('proof_image') or request.data.get('proof_image')

        member = get_current_staff(request)

        try:
            report = report_broken_item(
                item_id=item_id,
                quantity=quantity,
                reason=reason,
                proof_image=proof_image,
                performed_by=member,
                user_display=getattr(member, 'name', '') or str(request.user)
            )
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(report, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='fine-employee')
    def fine_employee(self, request, pk=None):
        """
        Fines an employee for damaged/broken stock and posts a negative FINE entry to their Employee Ledger.
        Calculations default to 100% of cost price (report.total_loss = quantity * cost_price).
        Validates employee exists, prevents duplicate fining, handles concurrency, and returns updated balance.
        """
        report = self.get_object()

        if report.is_fined:
            emp_name = report.fined_employee.name if report.fined_employee else "an employee"
            return Response(
                {
                    'error': f'This broken item report has already been fined to {emp_name} for ₹{report.fine_amount}.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response({'error': 'Employee ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from staff.models import Employee, EmployeeLedgerEntry
        from staff.services.ledger import add_entry, get_employee_balance

        try:
            employee = Employee.objects.get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': f'Employee with ID {employee_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Default to report total_loss if not specified
        raw_fine_amount = request.data.get('fine_amount')
        if raw_fine_amount is not None and str(raw_fine_amount).strip() != '':
            try:
                fine_amount = Decimal(str(raw_fine_amount))
            except Exception:
                return Response({'error': 'Invalid fine amount provided.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            fine_amount = report.total_loss

        if fine_amount <= Decimal('0.00'):
            return Response({'error': 'Fine amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', '').strip()
        custom_note = f"Fine for damaged/broken stock: {report.item.name} ({report.quantity} units @ ₹{report.cost_price})."
        if notes:
            custom_note += f" Reason/Notes: {notes}"

        member = get_current_staff(request)

        with transaction.atomic():
            locked_report = BrokenItemReport.objects.select_for_update().get(pk=report.pk)
            if locked_report.is_fined:
                return Response({'error': 'This report was already fined by another session.'}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct from employee ledger with negative amount
            ledger_entry = add_entry(
                employee=employee,
                store=locked_report.store,
                entry_type=EmployeeLedgerEntry.ENTRY_FINE,
                amount=-abs(fine_amount),
                reference_no=f"BROKEN-FINE-{locked_report.id}",
                note=custom_note,
                actor=member,
            )

            locked_report.is_fined = True
            locked_report.fined_employee = employee
            locked_report.fine_amount = fine_amount
            locked_report.fine_ledger_entry = ledger_entry
            locked_report.fined_at = timezone.now()
            locked_report.save()

        updated_balance = get_employee_balance(employee)

        serializer = self.get_serializer(locked_report, context={'request': request})
        return Response({
            'message': f'Successfully fined {employee.name} ₹{fine_amount} for damaged stock.',
            'report': serializer.data,
            'employee_balance': str(updated_balance),
            'ledger_entry_id': ledger_entry.id,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='no-fine')
    def no_fine(self, request, pk=None):
        """
        Marks this broken item incident as 'No Fine' (Store Loss).
        The financial cost is 100% absorbed as an operational write-off loss by the store
        without charging or deducting anything from employee payroll/ledger.
        """
        report = self.get_object()

        if report.is_fined:
            emp_name = report.fined_employee.name if report.fined_employee else "an employee"
            return Response(
                {
                    'error': f'Cannot mark as No Fine: this incident has already been fined to {emp_name} for ₹{report.fine_amount}.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        member = get_current_staff(request)
        actor_name = getattr(member, 'name', '') or str(request.user)

        with transaction.atomic():
            locked_report = BrokenItemReport.objects.select_for_update().get(pk=report.pk)
            if locked_report.is_fined:
                return Response({'error': 'This report was already fined by another session.'}, status=status.HTTP_400_BAD_REQUEST)

            locked_report.is_waived = True
            locked_report.waived_at = timezone.now()
            locked_report.waived_by = actor_name
            locked_report.save()

        serializer = self.get_serializer(locked_report, context={'request': request})
        return Response({
            'message': f'Marked as Store Loss. No fine charged to employees for {locked_report.item.name}.',
            'report': serializer.data,
        }, status=status.HTTP_200_OK)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    Customer profiles directory and purchase history tracking.
    Enforces store branch location filtering so each branch only accesses its own customers.
    """
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # 1. Location / Branch Filter
        staff_member = getattr(self.request, 'staff_member', None)
        store_param = (
            self.request.query_params.get('store') or
            self.request.query_params.get('store_id') or
            ''
        ).strip()

        effective_store_id = None
        if staff_member and not staff_member.is_owner and staff_member.store_id:
            effective_store_id = staff_member.store_id
        elif store_param and store_param.lower() not in ('all', 'all_stores', '0', ''):
            effective_store_id = store_param

        if effective_store_id:
            qs = qs.filter(
                Q(store_id=effective_store_id) |
                Q(sale_orders__store_id=effective_store_id)
            ).distinct()

        # 2. Text Search Filter
        search = (
            self.request.query_params.get('search') or
            self.request.query_params.get('q') or
            ''
        ).strip()

        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search)
            )

        # 3. Sorting
        sort = (
            self.request.query_params.get('sort') or
            self.request.query_params.get('ordering') or
            ''
        ).strip()

        if sort in ('most_purchases', 'total_spent', '-total_spent'):
            qs = qs.order_by('-total_spent', '-total_purchases_count')
        elif sort in ('frequently_bought', 'orders_count', '-total_purchases_count'):
            qs = qs.order_by('-total_purchases_count', '-total_spent')
        elif sort in ('recent', 'last_purchase', '-last_purchase_date'):
            qs = qs.order_by('-last_purchase_date', '-created_at')
        elif sort in ('name', 'name_asc'):
            qs = qs.order_by('name', 'phone')
        elif sort in ('name_desc', '-name'):
            qs = qs.order_by('-name')
        elif sort in ('newest', '-created_at'):
            qs = qs.order_by('-created_at')
        else:
            qs = qs.order_by('-created_at')

        return qs

    def perform_create(self, serializer):
        # Auto-bind store if not explicitly given
        staff_member = getattr(self.request, 'staff_member', None)
        store_param = (
            self.request.query_params.get('store') or
            self.request.query_params.get('store_id') or
            ''
        ).strip()

        store = serializer.validated_data.get('store')
        if not store:
            if staff_member and staff_member.store:
                serializer.save(store=staff_member.store)
                return
            elif store_param and store_param.isdigit():
                from .models import Store
                target_store = Store.objects.filter(id=int(store_param)).first()
                if target_store:
                    serializer.save(store=target_store)
                    return
        serializer.save()

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Returns full list of sales orders and line items for this customer."""
        customer = self.get_object()
        orders = customer.sale_orders.prefetch_related('items', 'payments').all()
        start_time = parse_filter_datetime(request.query_params.get('start_time'))
        end_time = parse_filter_datetime(request.query_params.get('end_time'))
        if start_time:
            orders = orders.filter(created_at__gte=start_time)
        if end_time:
            orders = orders.filter(created_at__lte=end_time)
        orders = orders.order_by('-created_at')
        serializer = SaleOrderSerializer(orders, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """Fast lookup endpoint for cashier phone / name autocomplete in POS filtered by branch location."""
        q = request.query_params.get('q', '').strip()
        phone = request.query_params.get('phone', '').strip()
        store_param = (
            request.query_params.get('store') or
            request.query_params.get('store_id') or
            ''
        ).strip()

        staff_member = getattr(request, 'staff_member', None)
        effective_store_id = None
        if staff_member and not staff_member.is_owner and staff_member.store_id:
            effective_store_id = staff_member.store_id
        elif store_param and store_param.lower() not in ('all', 'all_stores', '0', ''):
            effective_store_id = store_param

        qs = Customer.objects.all()
        if effective_store_id:
            qs = qs.filter(
                Q(store_id=effective_store_id) |
                Q(sale_orders__store_id=effective_store_id)
            ).distinct()

        if phone:
            qs = qs.filter(phone__icontains=phone)
        elif q:
            qs = qs.filter(Q(phone__icontains=q) | Q(name__icontains=q))
        else:
            return Response([])

        serializer = CustomerSerializer(qs[:10], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def assign_card(self, request, pk=None):
        """Assign RFID VIP Card to customer with initial credit loaded."""
        from django.utils import timezone
        from decimal import Decimal
        from django.db import transaction

        serializer = VIPCardAssignSerializer(data=request.data, context={'customer_id': pk})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        card_uid = serializer.validated_data['card_uid']
        initial_credit = Decimal(str(serializer.validated_data.get('initial_credit', 500.00)))
        payment_method = serializer.validated_data.get('payment_method', 'cash')
        staff_member = getattr(request, 'staff_member', None)

        with transaction.atomic():
            customer = Customer.objects.select_for_update().get(pk=pk)
            customer.vip_card_uid = card_uid
            customer.vip_card_balance = initial_credit
            customer.vip_card_issued_at = timezone.now()
            customer.vip_card_status = 'active'
            customer.save()

            effective_store = customer.store or (staff_member.store if staff_member else None)

            VIPCardTransaction.objects.create(
                customer=customer,
                store=effective_store,
                card_uid=card_uid,
                transaction_type=VIPCardTransaction.TYPE_ISSUE,
                amount=initial_credit,
                balance_after=initial_credit,
                payment_method=payment_method,
                notes=f"VIP Card Issued with initial ₹{initial_credit} credits ({payment_method.upper()})"
            )

        return Response(CustomerSerializer(customer, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def detach_card(self, request, pk=None):
        """Detach / remove RFID VIP Card from customer."""
        from decimal import Decimal
        from django.db import transaction

        with transaction.atomic():
            customer = Customer.objects.select_for_update().get(pk=pk)
            old_card_uid = customer.vip_card_uid
            old_balance = customer.vip_card_balance or Decimal('0.00')

            customer.vip_card_uid = None
            customer.vip_card_balance = Decimal('0.00')
            customer.vip_card_status = 'inactive'
            customer.save()

            if old_card_uid:
                staff_member = getattr(request, 'staff_member', None)
                effective_store = customer.store or (staff_member.store if staff_member else None)
                VIPCardTransaction.objects.create(
                    customer=customer,
                    store=effective_store,
                    card_uid=old_card_uid,
                    transaction_type=VIPCardTransaction.TYPE_REFUND,
                    amount=old_balance,
                    balance_after=Decimal('0.00'),
                    notes=f"VIP Card ({old_card_uid}) detached from customer"
                )

        return Response(CustomerSerializer(customer, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def recharge_card(self, request, pk=None):
        """Recharge customer VIP Card balance with specified credit amount."""
        from decimal import Decimal
        from django.db import transaction

        serializer = VIPCardRechargeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = Decimal(str(serializer.validated_data['amount']))
        payment_method = serializer.validated_data.get('payment_method', 'cash')
        notes = serializer.validated_data.get('notes', 'Card recharge')

        with transaction.atomic():
            customer = Customer.objects.select_for_update().get(pk=pk)
            if not customer.vip_card_uid or customer.vip_card_status != 'active':
                return Response(
                    {"error": "Customer does not have an active VIP Card to recharge."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            customer.vip_card_balance = (customer.vip_card_balance + amount).quantize(Decimal('0.01'))
            customer.save(update_fields=['vip_card_balance'])

            staff_member = getattr(request, 'staff_member', None)
            effective_store = customer.store or (staff_member.store if staff_member else None)

            VIPCardTransaction.objects.create(
                customer=customer,
                store=effective_store,
                card_uid=customer.vip_card_uid,
                transaction_type=VIPCardTransaction.TYPE_RECHARGE,
                amount=amount,
                balance_after=customer.vip_card_balance,
                payment_method=payment_method,
                notes=notes
            )

        return Response(CustomerSerializer(customer, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='inspect-card')
    def inspect_card(self, request):
        """Universal Card Inspection endpoint: checks ownership across both Employees and Customers."""
        from .card_service import inspect_card_ownership
        card_uid = request.query_params.get('card_uid', '').strip()
        data = inspect_card_ownership(card_uid)
        return Response(data, status=status.HTTP_200_OK if data.get('success') else status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def lookup_card(self, request):
        """Lookup customer by RFID Card UID."""
        card_uid = request.query_params.get('card_uid', '').strip()
        if not card_uid:
            return Response({"error": "card_uid query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        customer = Customer.objects.filter(vip_card_uid__iexact=card_uid).first()
        if not customer:
            return Response({"error": f"No customer found with RFID Card UID '{card_uid}'."}, status=status.HTTP_404_NOT_FOUND)

        return Response(CustomerSerializer(customer, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def vip_transactions(self, request, pk=None):
        """Audit history of VIP card issuance, recharges, debits for this customer."""
        customer = self.get_object()
        transactions = customer.vip_transactions.all()
        start_time = parse_filter_datetime(request.query_params.get('start_time'))
        end_time = parse_filter_datetime(request.query_params.get('end_time'))
        if start_time:
            transactions = transactions.filter(created_at__gte=start_time)
        if end_time:
            transactions = transactions.filter(created_at__lte=end_time)
        transactions = transactions.order_by('-created_at')
        serializer = VIPCardTransactionSerializer(transactions, many=True, context={'request': request})
        return Response(serializer.data)


class SaleOrderViewSet(viewsets.ModelViewSet):
    """
    Point of Sale sales orders and billing checkout endpoint.
    """
    queryset = SaleOrder.objects.prefetch_related('items', 'items__item').select_related('store', 'customer', 'cashier').all()
    serializer_class = SaleOrderSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        from accounting.services import parse_store_filter_ids
        store_param = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        store_list = self.request.query_params.getlist('store') or self.request.query_params.getlist('stores')
        target_store_ids = parse_store_filter_ids(store_param, store_list)
        if target_store_ids is not None:
            qs = qs.filter(store_id__in=target_store_ids)

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        cashier_id = self.request.query_params.get('cashier') or self.request.query_params.get('cashier_id')
        if cashier_id:
            qs = qs.filter(cashier_id=cashier_id)

        since = self.request.query_params.get('since') or self.request.query_params.get('created_at__gte')
        if since:
            qs = qs.filter(created_at__gte=since)

        phone = self.request.query_params.get('phone')
        if phone:
            qs = qs.filter(customer_phone__icontains=phone)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(customer_phone__icontains=search) |
                Q(customer_name__icontains=search)
            )

        current_shift = self.request.query_params.get('current_shift')
        if current_shift in ['true', 'True', '1']:
            shift_store_id = target_store_ids[0] if (target_store_ids and len(target_store_ids) == 1) else None
            if not shift_store_id:
                staff_member = getattr(self.request, 'staff_member', None)
                if staff_member and staff_member.store:
                    shift_store_id = staff_member.store.id
                else:
                    first_store = Store.objects.first()
                    shift_store_id = first_store.id if first_store else None

            if not shift_store_id:
                return qs.none()

            open_shift = DailyRegisterShift.objects.filter(
                store_id=shift_store_id,
                status=DailyRegisterShift.STATUS_OPEN
            ).order_by('-opened_at').first()

            if not open_shift:
                return qs.none()

            qs = qs.filter(created_at__gte=open_shift.opened_at)
            if open_shift.cashier_id:
                qs = qs.filter(cashier_id=open_shift.cashier_id)

        start_time = parse_filter_datetime(self.request.query_params.get('start_time'))
        end_time = parse_filter_datetime(self.request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(created_at__gte=start_time)
        if end_time:
            qs = qs.filter(created_at__lte=end_time)

        is_due = self.request.query_params.get('is_due')
        if is_due in ['true', 'True', '1']:
            qs = qs.filter(balance_due__gt=Decimal('0.00'), is_fully_paid=False)

        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='checkout')
    def checkout(self, request):
        """
        Executes an atomic POS checkout:
        - Validates sufficient stock for all line items.
        - Enforces strictly non-negative stock (rejects if 0 or insufficient stock).
        - Automatically creates/updates customer profile.
        - Decrements inventory stock and creates immutable StockMovement records.
        """
        serializer = CheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        sale_order = serializer.save()
        output_serializer = SaleOrderSerializer(sale_order, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """
        Records a partial payment settlement for an existing SaleOrder.
        Reduces balance_due, increments amount_paid, and logs an OrderPaymentTransaction.
        """
        from django.db import transaction
        order = self.get_object()

        raw_amt = request.data.get('amount')
        if raw_amt is None:
            return Response({'error': 'Payment amount is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            pay_amount = Decimal(str(raw_amt)).quantize(Decimal('0.01'))
        except Exception:
            return Response({'error': 'Invalid payment amount specified.'}, status=status.HTTP_400_BAD_REQUEST)

        if pay_amount <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        if pay_amount > order.balance_due:
            return Response(
                {'error': f"Amount ₹{pay_amount} exceeds current outstanding due of ₹{order.balance_due}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        pay_method = (request.data.get('payment_method') or 'cash').strip().lower()
        if pay_method not in ['cash', 'upi', 'card', 'bank_transfer', 'other']:
            pay_method = 'cash'

        notes = request.data.get('notes', '').strip()
        ref = request.data.get('transaction_reference', '').strip()

        staff_member = get_current_staff(request)
        collected_by_name = staff_member.name if staff_member else (request.data.get('collected_by_name') or 'Staff')

        with transaction.atomic():
            tx = OrderPaymentTransaction.objects.create(
                order=order,
                store=order.store,
                amount=pay_amount,
                payment_method=pay_method,
                collected_by=staff_member,
                collected_by_name=collected_by_name,
                transaction_reference=ref,
                notes=notes or f"Due settlement for Invoice #{order.invoice_number}"
            )

            new_amount_paid = (order.amount_paid + pay_amount).quantize(Decimal('0.01'))
            new_balance_due = max(Decimal('0.00'), order.total_amount - new_amount_paid).quantize(Decimal('0.01'))
            order.amount_paid = new_amount_paid
            order.balance_due = new_balance_due

            if new_balance_due <= Decimal('0.00'):
                order.is_fully_paid = True
                order.status = SaleOrder.STATUS_COMPLETED
            else:
                order.is_fully_paid = False
                order.status = SaleOrder.STATUS_PARTIAL

            order.save(update_fields=['amount_paid', 'balance_due', 'is_fully_paid', 'status', 'updated_at'])

        return Response({
            'message': f"Payment of ₹{pay_amount} recorded successfully.",
            'order': SaleOrderSerializer(order, context={'request': request}).data,
            'payment_transaction': {
                'id': tx.id,
                'amount': str(tx.amount),
                'payment_method': tx.payment_method,
                'collected_by_name': tx.collected_by_name,
                'created_at': tx.created_at,
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='dues-summary')
    def dues_summary(self, request):
        """
        Returns an aggregated summary of outstanding customer dues/khata across store(s).
        """
        from accounting.services import parse_store_filter_ids
        store_param = request.query_params.get('store') or request.query_params.get('store_id')
        store_list = request.query_params.getlist('store') or request.query_params.getlist('stores')
        target_store_ids = parse_store_filter_ids(store_param, store_list)

        qs = SaleOrder.objects.filter(balance_due__gt=Decimal('0.00'), is_fully_paid=False).exclude(status='cancelled')
        if target_store_ids is not None:
            qs = qs.filter(store_id__in=target_store_ids)

        total_due_amt = qs.aggregate(total=Sum('balance_due'))['total'] or Decimal('0.00')
        pending_orders_count = qs.count()
        unique_debtors_count = qs.values('customer_phone').distinct().count()

        recent_due_orders = SaleOrderSerializer(qs.order_by('-created_at')[:25], many=True, context={'request': request}).data

        return Response({
            'total_due_amount': float(total_due_amt),
            'pending_orders_count': pending_orders_count,
            'unique_debtors_count': unique_debtors_count,
            'recent_due_orders': recent_due_orders
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='lookup-for-return')
    def lookup_for_return(self, request):
        """
        Fast lookup of an invoice/bill by number to prepare for return processing.
        Returns original bill metadata, cashier, customer, line items with sold prices,
        and available returnable quantities.
        """
        inv_num = request.query_params.get('invoice_number', '').strip()
        if not inv_num:
            return Response({'error': 'Invoice / Bill number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = SaleOrder.objects.filter(invoice_number__iexact=inv_num).first()
        if not order:
            return Response({'error': f"Bill #{inv_num} was not found in the system."}, status=status.HTTP_404_NOT_FOUND)

        if order.invoice_number.startswith('RET-'):
            return Response({'error': f"Bill #{inv_num} is a return voucher and cannot be returned."}, status=status.HTTP_400_BAD_REQUEST)

        data = SaleOrderSerializer(order, context={'request': request}).data
        total_returnable = sum(item.get('returnable_quantity', 0) for item in data['items'])
        data['total_returnable_units'] = total_returnable
        data['is_fully_returned'] = (total_returnable <= 0)
        cust_obj = order.customer
        data['customer_has_vip_card'] = bool(cust_obj and cust_obj.vip_card_uid)
        data['customer_vip_card_uid'] = cust_obj.vip_card_uid if cust_obj else ""
        data['customer_vip_card_balance'] = str(cust_obj.vip_card_balance) if cust_obj else "0.00"
        data['original_payment_method'] = order.payment_method

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='process-return')
    def process_return(self, request):
        """
        Processes an atomic product return against an existing bill:
        - Validates return quantities against original bill's returnable quantities.
        - Restores inventory stock with new StockMovement entries (reason='return') with timestamp=now.
        - Deducts refund from current shift cash drawer if payment method is cash (via CounterPayout).
        - Generates a new Return Order (RET-YYYYMMDD-XXXX, status='refunded').
        - Updates original line items returned_quantity and sets original bill status to 'refunded' if fully returned.
        """
        serializer = ProcessReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        val_data = serializer.validated_data

        inv_num = val_data['invoice_number'].strip()
        refund_method = val_data['refund_payment_method']
        return_notes = val_data.get('notes', '').strip()

        # Consolidate return quantities by sale_order_item_id to prevent multi-entry payload bypass
        consolidated_items = {}
        for r_item in val_data['items']:
            lid = r_item['sale_order_item_id']
            consolidated_items[lid] = consolidated_items.get(lid, 0) + r_item['quantity']

        with transaction.atomic():
            # Concurrency row-locking: lock the original sale order
            order = SaleOrder.objects.select_for_update().filter(invoice_number__iexact=inv_num).first()
            if not order:
                return Response({'error': f"Bill #{inv_num} was not found."}, status=status.HTTP_404_NOT_FOUND)

            if order.invoice_number.startswith('RET-'):
                return Response({'error': "Cannot return items from a return voucher."}, status=status.HTTP_400_BAD_REQUEST)

            # Strict validation of refund payment method:
            if refund_method == SaleOrder.PAYMENT_VIP_CARD:
                if not order.customer or not order.customer.vip_card_uid:
                    return Response(
                        {'error': 'Customer does not have a registered VIP Card to receive a credit refund. Please select Cash or UPI.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif refund_method == SaleOrder.PAYMENT_CARD:
                if order.payment_method != SaleOrder.PAYMENT_CARD:
                    orig_mode = order.get_payment_method_display()
                    return Response(
                        {'error': f'Original bill #{order.invoice_number} was paid via {orig_mode}. Cannot issue a Card refund to a customer who did not pay with card.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            staff_member = get_current_staff(request)
            store = order.store
            cashier_name = staff_member.name if staff_member else "Cashier"
            cashier_role = staff_member.role.name if staff_member and staff_member.role else "Cashier"

            # 1. Validate all line items with row-level locks
            prepared_returns = []
            total_refund = Decimal('0.00')

            # Calculate total already refunded on this order across previous returns
            prev_return_orders = SaleOrder.objects.filter(return_reference=order.invoice_number, status=SaleOrder.STATUS_REFUNDED)
            total_already_refunded = prev_return_orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
            remaining_bill_refundable = max(Decimal('0.00'), (order.total_amount or Decimal('0.00')) - total_already_refunded)

            all_order_items = {it.id: it for it in order.items.select_for_update().all()}
            order_total = order.total_amount or Decimal('0.00')
            items_total = sum((it.total_price for it in all_order_items.values()), Decimal('0.00'))

            for line_id, qty in consolidated_items.items():
                line_obj = all_order_items.get(line_id)
                if not line_obj:
                    return Response(
                        {'error': f"Line item ID #{line_id} does not belong to bill #{order.invoice_number}."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                avail_qty = max(0, line_obj.quantity - (line_obj.returned_quantity or 0))
                if qty > avail_qty:
                    return Response(
                        {'error': f"Cannot return {qty} units of '{line_obj.item_name}'. Only {avail_qty} unit(s) available to return."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Calculate the exact effective unit price paid on this bill after line and order discounts
                line_total = line_obj.total_price or Decimal('0.00')
                if items_total > Decimal('0.00') and order_total < items_total:
                    line_effective_total = (line_total * (order_total / items_total)).quantize(Decimal('0.01'))
                else:
                    line_effective_total = line_total

                effective_unit_price = (line_effective_total / Decimal(line_obj.quantity)).quantize(Decimal('0.01'))
                prev_line_refunded = (effective_unit_price * Decimal(line_obj.returned_quantity or 0)).quantize(Decimal('0.01'))

                # If returning all remaining units of this line item, take exact remaining effective total to avoid fractional cent rounding
                if qty == avail_qty:
                    refund_for_line = max(Decimal('0.00'), line_effective_total - prev_line_refunded)
                else:
                    refund_for_line = (effective_unit_price * Decimal(qty)).quantize(Decimal('0.01'))

                total_refund += refund_for_line
                prepared_returns.append((line_obj, qty, refund_for_line, effective_unit_price))

            # If this return completes 100% of all returnable units on the entire bill,
            # guarantee that total refund exactly zeroes out the remaining bill balance down to the last paisa
            total_remaining_after_this = sum(
                max(0, it.quantity - (it.returned_quantity or 0) - consolidated_items.get(it.id, 0))
                for it in all_order_items.values()
            )
            if total_remaining_after_this == 0 and prepared_returns and remaining_bill_refundable > Decimal('0.00'):
                diff = remaining_bill_refundable - total_refund
                if abs(diff) <= Decimal('0.05') and diff != Decimal('0.00'):
                    last_item, last_qty, last_refund, last_eff = prepared_returns[-1]
                    adjusted_refund = last_refund + diff
                    prepared_returns[-1] = (last_item, last_qty, adjusted_refund, last_eff)
                    total_refund = remaining_bill_refundable

            if total_refund <= Decimal('0.00'):
                return Response({'error': "Refund total must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

            now_dt = timezone.now()

            # 2. Restore Stock with new StockMovement entries and update line item counts
            for line_obj, qty, refund_line, _ in prepared_returns:
                if line_obj.item:
                    StockMovement.objects.create(
                        item=line_obj.item,
                        change=qty,
                        reason=StockMovement.REASON_RETURN,
                        performed_by=staff_member,
                        performed_by_name=cashier_name,
                        performed_by_role=cashier_role,
                        note=f"Return from #{order.invoice_number} ({line_obj.item_name} x{qty}) - Refund ₹{refund_line}"
                    )
                    # Sync Item.quantity directly from ledger
                    total_stock = StockMovement.objects.filter(item=line_obj.item).aggregate(total=Sum('change'))['total'] or 0
                    Item.objects.filter(id=line_obj.item.id).update(quantity=max(0, total_stock))

                # Update returned_quantity on the original line item
                line_obj.returned_quantity = (line_obj.returned_quantity or 0) + qty
                line_obj.save(update_fields=['returned_quantity'])

            # 3. Create Return SaleOrder
            ret_number = generate_next_return_number(store)
            ret_order = SaleOrder.objects.create(
                invoice_number=ret_number,
                return_reference=order.invoice_number,
                store=store,
                cashier=staff_member,
                cashier_name=cashier_name,
                customer=order.customer,
                customer_phone=order.customer_phone,
                customer_name=order.customer_name,
                customer_email=order.customer_email,
                subtotal=total_refund,
                tax_amount=Decimal('0.00'),
                discount_amount=Decimal('0.00'),
                vip_card_uid=order.vip_card_uid if refund_method == SaleOrder.PAYMENT_VIP_CARD else "",
                total_amount=total_refund,
                payment_method=refund_method,
                amount_paid=total_refund,
                change_returned=Decimal('0.00'),
                status=SaleOrder.STATUS_REFUNDED,
                notes=f"Return for Bill #{order.invoice_number}. {return_notes}".strip(),
            )

            # 4. Create SaleOrderItems for the return voucher
            for line_obj, qty, refund_line, eff_unit_price in prepared_returns:
                SaleOrderItem.objects.create(
                    sale_order=ret_order,
                    item=line_obj.item,
                    item_name=line_obj.item_name,
                    item_uid=line_obj.item_uid,
                    unit_cost_price=line_obj.unit_cost_price,
                    unit_selling_price=eff_unit_price,
                    unit_mrp=line_obj.unit_mrp,
                    quantity=qty,
                    returned_quantity=qty,
                    total_price=refund_line,
                )

            # 5. Shift Register Drawer Deduction (if refund is in cash)
            if refund_method == SaleOrder.PAYMENT_CASH:
                payout_num = generate_next_payout_number(store)
                CounterPayout.objects.create(
                    payout_number=payout_num,
                    store=store,
                    amount=total_refund,
                    category=CounterPayout.CATEGORY_REFUND,
                    payment_method=CounterPayout.PAYMENT_CASH,
                    paid_to=order.customer_name or "Customer Return",
                    paid_by=staff_member,
                    paid_by_name=cashier_name,
                    reason=f"Cash Refund for Return #{ret_number} (Bill #{order.invoice_number})",
                    receipt_number=ret_number,
                    paid_at=now_dt,
                )

            # 6. Customer Statistics & VIP Card Balance Update
            if order.customer:
                cust = Customer.objects.select_for_update().filter(id=order.customer.id).first()
                if cust:
                    cust.total_spent = max(Decimal('0.00'), cust.total_spent - total_refund)
                    # Adjust VIP Card balance and log transaction if refund method is vip_card
                    if refund_method == SaleOrder.PAYMENT_VIP_CARD and cust.vip_card_uid:
                        cust.vip_card_balance = (cust.vip_card_balance + total_refund).quantize(Decimal('0.01'))
                        VIPCardTransaction.objects.create(
                            customer=cust,
                            store=store,
                            card_uid=cust.vip_card_uid,
                            transaction_type=VIPCardTransaction.TYPE_REFUND,
                            amount=total_refund,
                            balance_after=cust.vip_card_balance,
                            sale_order=ret_order,
                            notes=f"Refund to VIP card from Return #{ret_number} (Bill #{order.invoice_number})"
                        )

                    # Adjust VIP savings proportionally if original bill had a VIP discount
                    if order.vip_discount_amount > Decimal('0.00') and order_total > Decimal('0.00'):
                        savings_reduction = (order.vip_discount_amount * (total_refund / order_total)).quantize(Decimal('0.01'))
                        cust.total_vip_savings = max(Decimal('0.00'), (cust.total_vip_savings or Decimal('0.00')) - savings_reduction)

                    # If this return exhausts all items on the bill, decrement purchases count
                    if total_remaining_after_this == 0:
                        cust.total_purchases_count = max(0, (cust.total_purchases_count or 1) - 1)

                    cust.save()

            # 7. Update original order status if fully refunded
            if total_remaining_after_this == 0:
                order.status = SaleOrder.STATUS_REFUNDED
            stamp = now_dt.strftime('%Y-%m-%d %H:%M')
            order.notes = (order.notes + f"\n[Returned ₹{total_refund} via #{ret_number} on {stamp}]").strip()
            order.save(update_fields=['status', 'notes', 'updated_at'])

            out_data = SaleOrderSerializer(ret_order, context={'request': request}).data

            return Response({
                'message': f"Return #{ret_number} processed successfully.",
                'return_order': out_data,
                'refund_amount': float(total_refund),
                'refund_payment_method': refund_method,
                'original_invoice_number': order.invoice_number,
            }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='send-whatsapp')
    def send_whatsapp(self, request, pk=None):
        """
        Generates and sends invoice PDF via Meta WhatsApp Cloud API directly to the customer.
        Supports uploading the exact visual rendered receipt PDF from the frontend.
        """
        order = self.get_object()
        phone_override = request.data.get('phone')
        force_resend = str(request.data.get('force', request.data.get('force_resend', ''))).lower() in ('1', 'true', 'yes')

        uploaded_pdf_file = request.FILES.get('pdf_file')
        pdf_bytes = uploaded_pdf_file.read() if uploaded_pdf_file else None

        from inventory.whatsapp_service import send_whatsapp_bill_for_order
        success, res_data, error_msg = send_whatsapp_bill_for_order(
            order,
            recipient_phone=phone_override,
            pdf_bytes=pdf_bytes,
            force_resend=force_resend
        )

        if success:
            is_return = bool(
                getattr(order, 'is_return', False) or
                (order.invoice_number and str(order.invoice_number).startswith('RET-')) or
                getattr(order, 'return_reference', None) or
                getattr(order, 'status', '') == 'refunded'
            )
            item_type = "Return voucher" if is_return else "Bill"
            return Response({
                'success': True,
                'message': f"{item_type} #{order.invoice_number} sent successfully via WhatsApp Cloud API.",
                'data': res_data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': error_msg or 'Failed to send WhatsApp message.',
                'data': res_data
            }, status=status.HTTP_400_BAD_REQUEST)




class CounterPayoutViewSet(viewsets.ModelViewSet):
    """
    On-counter Cash / Expense Payout ViewSet.
    Records and audits cash or digital payments made directly from the store register
    for incoming stock deliveries, logistics/freight, utilities, repairs, or staff expenses.
    """
    queryset = CounterPayout.objects.select_related('store', 'paid_by').all()
    serializer_class = CounterPayoutSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        payment_method = self.request.query_params.get('payment_method')
        if payment_method:
            qs = qs.filter(payment_method=payment_method)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(payout_number__icontains=search) |
                Q(paid_to__icontains=search) |
                Q(paid_by_name__icontains=search) |
                Q(reason__icontains=search) |
                Q(receipt_number__icontains=search)
            )

        start_time = parse_filter_datetime(self.request.query_params.get('start_time'))
        end_time = parse_filter_datetime(self.request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(paid_at__gte=start_time)
        if end_time:
            qs = qs.filter(paid_at__lte=end_time)

        return qs.order_by('-paid_at', '-created_at')

    def perform_create(self, serializer):
        request = self.request
        staff_member = getattr(request, 'staff_member', None)
        paid_by_name = serializer.validated_data.get('paid_by_name')
        if not paid_by_name:
            paid_by_name = (
                staff_member.name
                if staff_member
                else (request.user.get_full_name() or request.user.username or "Cashier")
            )

        store = serializer.validated_data.get('store')
        if not store:
            if staff_member and staff_member.store:
                store = staff_member.store
            else:
                from .models import Store
                store_param = request.data.get('store_id') or request.query_params.get('store')
                if store_param:
                    store = Store.objects.filter(id=store_param).first()
                if not store:
                    store = Store.objects.first()

        serializer.save(
            paid_by=staff_member,
            paid_by_name=paid_by_name,
            store=store
        )


class DailyRegisterShiftViewSet(viewsets.ModelViewSet):
    """
    Cash Register Drawer Shift Management ViewSet.
    Handles Day-Start opening cash float entry and Day-End closing cash reconciliation.
    """
    queryset = DailyRegisterShift.objects.select_related('store', 'cashier', 'closed_by').all()
    serializer_class = DailyRegisterShiftSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        date_param = self.request.query_params.get('date')
        if date_param:
            qs = qs.filter(Q(closed_at__date=date_param) | Q(closed_at__isnull=True, opened_at__date=date_param))

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(Q(closed_at__date__gte=start_date) | Q(closed_at__isnull=True, opened_at__date__gte=start_date))
        if end_date:
            qs = qs.filter(Q(closed_at__date__lte=end_date) | Q(closed_at__isnull=True, opened_at__date__lte=end_date))

        start_time = parse_filter_datetime(self.request.query_params.get('start_time'))
        end_time = parse_filter_datetime(self.request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(Q(closed_at__gte=start_time) | Q(closed_at__isnull=True, opened_at__gte=start_time))
        if end_time:
            qs = qs.filter(Q(closed_at__lte=end_time) | Q(closed_at__isnull=True, opened_at__lte=end_time))

        has_discrepancy = self.request.query_params.get('has_discrepancy')
        if has_discrepancy in ['true', 'True', '1']:
            qs = qs.filter(status=DailyRegisterShift.STATUS_CLOSED).exclude(cash_difference=Decimal('0.00'))

        is_settled = self.request.query_params.get('is_discrepancy_settled')
        if is_settled in ['true', 'True', '1']:
            qs = qs.filter(is_discrepancy_settled=True)
        elif is_settled in ['false', 'False', '0']:
            qs = qs.filter(is_discrepancy_settled=False)

        return qs.order_by('-opened_at', '-id')

    @action(detail=False, methods=['get'], url_path='current-shift')
    def current_shift(self, request):
        """
        Fetches the current active/open register shift for the store,
        along with live cash sales and payout calculations since opening.
        """
        store_id = request.query_params.get('store') or request.query_params.get('store_id')
        staff_member = getattr(request, 'staff_member', None)
        if not store_id and staff_member and staff_member.store:
            store_id = staff_member.store.id

        if not store_id:
            store_obj = Store.objects.first()
            store_id = store_obj.id if store_obj else None

        if not store_id:
            return Response({'error': 'No active store found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find latest open shift for this store
        open_shift = DailyRegisterShift.objects.filter(
            store_id=store_id,
            status=DailyRegisterShift.STATUS_OPEN
        ).order_by('-opened_at').first()

        if not open_shift:
            # Check most recent closed shift today
            last_closed = DailyRegisterShift.objects.filter(
                store_id=store_id,
                status=DailyRegisterShift.STATUS_CLOSED
            ).order_by('-closed_at').first()

            return Response({
                'has_open_shift': False,
                'shift': None,
                'active_shift': None,
                'last_closed_shift': DailyRegisterShiftSerializer(last_closed).data if last_closed else None
            }, status=status.HTTP_200_OK)

        # Compute live cash flow since shift opened
        # Guard: if opened_at is accidentally ahead of current time due to client timezone mismatch, clamp to timezone.now()
        effective_opened_at = open_shift.opened_at
        if effective_opened_at > timezone.now():
            effective_opened_at = timezone.now()

        shift_cash_sales_qs = SaleOrder.objects.filter(
            Q(store_id=store_id, created_at__gte=effective_opened_at) &
            ~Q(status='cancelled') &
            ~Q(invoice_number__startswith='RET-')
        )
        cash_sales_pure = shift_cash_sales_qs.filter(
            payment_method__iexact='cash'
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')

        cash_sales_split = shift_cash_sales_qs.filter(
            payment_method__iexact='split'
        ).aggregate(total=Sum('split_cash_amount'))['total'] or Decimal('0.00')

        # Cash collected from partial / due orders at the time of checkout
        cash_sales_partial_initial = shift_cash_sales_qs.filter(
            payment_method__iexact='partial',
            initial_payment_method__iexact='cash'
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')

        # Cash collected from subsequent due settlements during this shift (for older or current orders)
        shift_settlement_cash = OrderPaymentTransaction.objects.filter(
            store_id=store_id,
            payment_method='cash',
            created_at__gte=effective_opened_at
        ).exclude(notes__startswith='Initial').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        cash_sales = cash_sales_pure + cash_sales_split + cash_sales_partial_initial + shift_settlement_cash

        # Cash collected from VIP Card recharges & initial issue during this shift
        shift_card_recharges_cash = VIPCardTransaction.objects.filter(
            store_id=store_id,
            payment_method='cash',
            transaction_type__in=[VIPCardTransaction.TYPE_RECHARGE, VIPCardTransaction.TYPE_ISSUE],
            created_at__gte=effective_opened_at
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Cash refunded from VIP cards during this shift (if any)
        shift_card_refunds_cash = VIPCardTransaction.objects.filter(
            store_id=store_id,
            payment_method='cash',
            transaction_type=VIPCardTransaction.TYPE_REFUND,
            created_at__gte=effective_opened_at
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        net_card_cash = shift_card_recharges_cash - shift_card_refunds_cash

        cash_payouts = CounterPayout.objects.filter(
            store_id=store_id,
            payment_method__iexact='cash',
            paid_at__gte=effective_opened_at
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        expected_cash = (open_shift.opening_cash + cash_sales + net_card_cash - cash_payouts).quantize(Decimal('0.01'))

        # Count total cash transactions
        cash_orders_count = shift_cash_sales_qs.filter(
            payment_method__in=['cash', 'split']
        ).count()

        cash_payouts_count = CounterPayout.objects.filter(
            store_id=store_id,
            payment_method__iexact='cash',
            paid_at__gte=effective_opened_at
        ).count()

        data = DailyRegisterShiftSerializer(open_shift).data
        data['live_cash_sales'] = float(cash_sales)
        data['live_card_recharge_cash'] = float(shift_card_recharges_cash)
        data['live_card_refund_cash'] = float(shift_card_refunds_cash)
        data['live_cash_payouts'] = float(cash_payouts)
        data['live_expected_cash'] = float(expected_cash)
        data['cash_sales_amount'] = float(cash_sales)
        data['card_recharge_cash_amount'] = float(shift_card_recharges_cash)
        data['cash_payouts_amount'] = float(cash_payouts)
        data['expected_cash'] = float(expected_cash)
        data['cash_orders_count'] = cash_orders_count
        data['cash_payouts_count'] = cash_payouts_count

        return Response({
            'has_open_shift': True,
            'shift': data,
            'active_shift': data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='open-shift')
    def open_shift(self, request):
        """
        Starts the day / opens the cash counter register by recording Day-Start opening cash float.
        """
        store_id = request.data.get('store') or request.data.get('store_id')
        staff_member = getattr(request, 'staff_member', None)
        if not store_id and staff_member and staff_member.store:
            store_id = staff_member.store.id

        if not store_id:
            store_obj = Store.objects.first()
            store_id = store_obj.id if store_obj else None

        if not store_id:
            return Response({'error': 'Store ID is required to open a register shift.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if an open shift already exists with atomic lock
        with transaction.atomic():
            existing_open = DailyRegisterShift.objects.select_for_update().filter(
                store_id=store_id,
                status=DailyRegisterShift.STATUS_OPEN
            ).first()

            if existing_open:
                return Response({
                    'error': f'Register is already open with Shift #{existing_open.shift_number}. Please close it before opening a new shift.',
                    'shift': DailyRegisterShiftSerializer(existing_open).data
                }, status=status.HTTP_400_BAD_REQUEST)

            opening_cash_raw = request.data.get('opening_cash', 0)
            try:
                opening_cash = Decimal(str(opening_cash_raw)).quantize(Decimal('0.01'))
                if opening_cash < Decimal('0.00'):
                    raise ValueError()
            except Exception:
                return Response({'error': 'Invalid opening cash amount.'}, status=status.HTTP_400_BAD_REQUEST)

            cashier_name = request.data.get('cashier_name') or request.data.get('opened_by_name') or (staff_member.name if staff_member else "Cashier")
            opening_notes = request.data.get('opening_notes', '')

            opened_at_raw = request.data.get('opened_at') or request.data.get('date_time')
            opened_at = timezone.now()
            if opened_at_raw:
                try:
                    dt = parse_datetime(str(opened_at_raw))
                    if dt:
                        if timezone.is_naive(dt):
                            dt = timezone.make_aware(dt, timezone.get_current_timezone())
                        # Ensure newly started shift timestamp is not set in the future
                        if dt <= timezone.now() + timedelta(minutes=1):
                            opened_at = dt
                except Exception:
                    pass

            shift = DailyRegisterShift.objects.create(
                store_id=store_id,
                cashier=staff_member,
                cashier_name=cashier_name,
                opening_cash=opening_cash,
                expected_cash=opening_cash,
                opening_notes=opening_notes,
                status=DailyRegisterShift.STATUS_OPEN,
                opened_at=opened_at
            )

        return Response(DailyRegisterShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='close-shift')
    def close_shift(self, request, pk=None):
        """
        Ends the day / closes the cash register shift by reconciling counted cash vs expected cash.
        """
        closing_cash_raw = request.data.get('closing_cash_counted')
        if closing_cash_raw is None:
            return Response({'error': 'closing_cash_counted is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            closing_cash = Decimal(str(closing_cash_raw)).quantize(Decimal('0.01'))
            if closing_cash < Decimal('0.00'):
                raise ValueError()
        except Exception:
            return Response({'error': 'Invalid closing cash counted amount.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            shift_obj = self.get_object()
            shift = DailyRegisterShift.objects.select_for_update().get(pk=shift_obj.pk)
            if shift.status == DailyRegisterShift.STATUS_CLOSED:
                return Response({'error': f'Shift #{shift.shift_number} is already closed and reconciled.'}, status=status.HTTP_400_BAD_REQUEST)

            closed_at_raw = request.data.get('closed_at') or request.data.get('date_time')
            close_time = timezone.now()
            if closed_at_raw:
                try:
                    dt = parse_datetime(str(closed_at_raw))
                    if dt:
                        if timezone.is_naive(dt):
                            dt = timezone.make_aware(dt, timezone.get_current_timezone())
                        close_time = dt
                except Exception:
                    pass

            effective_opened_at = shift.opened_at
            if effective_opened_at > close_time:
                effective_opened_at = close_time

            # Compute final sales and payouts during this exact shift
            shift_cash_sales_qs = SaleOrder.objects.filter(
                Q(store=shift.store, created_at__gte=effective_opened_at, created_at__lte=close_time) &
                ~Q(status='cancelled') &
                ~Q(invoice_number__startswith='RET-')
            )
            cash_sales_pure = shift_cash_sales_qs.filter(
                payment_method__iexact='cash'
            ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')

            cash_sales_split = shift_cash_sales_qs.filter(
                payment_method__iexact='split'
            ).aggregate(total=Sum('split_cash_amount'))['total'] or Decimal('0.00')

            # Cash collected from partial / due orders at the time of checkout
            cash_sales_partial_initial = shift_cash_sales_qs.filter(
                payment_method__iexact='partial',
                initial_payment_method__iexact='cash'
            ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')

            # Cash collected from subsequent due settlements during this shift
            shift_settlement_cash = OrderPaymentTransaction.objects.filter(
                store=shift.store,
                payment_method='cash',
                created_at__gte=effective_opened_at,
                created_at__lte=close_time
            ).exclude(notes__startswith='Initial').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            cash_sales = cash_sales_pure + cash_sales_split + cash_sales_partial_initial + shift_settlement_cash

            # Cash collected from VIP Card recharges & initial issue during this shift
            shift_card_recharges_cash = VIPCardTransaction.objects.filter(
                store=shift.store,
                payment_method='cash',
                transaction_type__in=[VIPCardTransaction.TYPE_RECHARGE, VIPCardTransaction.TYPE_ISSUE],
                created_at__gte=effective_opened_at,
                created_at__lte=close_time
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            # Cash refunded from VIP cards during this shift (if any)
            shift_card_refunds_cash = VIPCardTransaction.objects.filter(
                store=shift.store,
                payment_method='cash',
                transaction_type=VIPCardTransaction.TYPE_REFUND,
                created_at__gte=effective_opened_at,
                created_at__lte=close_time
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            net_card_cash = shift_card_recharges_cash - shift_card_refunds_cash

            cash_payouts = CounterPayout.objects.filter(
                store=shift.store,
                payment_method__iexact='cash',
                paid_at__gte=effective_opened_at,
                paid_at__lte=close_time
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            expected_cash = (shift.opening_cash + cash_sales + net_card_cash - cash_payouts).quantize(Decimal('0.01'))
            cash_diff = (closing_cash - expected_cash).quantize(Decimal('0.01'))

            staff_member = getattr(request, 'staff_member', None)
            closed_by_name = request.data.get('closed_by_name') or (staff_member.name if staff_member else "Cashier")
            closing_notes = request.data.get('closing_notes', '')

            shift.closing_cash_counted = closing_cash
            shift.cash_sales_amount = cash_sales
            shift.cash_payouts_amount = cash_payouts
            shift.expected_cash = expected_cash
            shift.cash_difference = cash_diff
            shift.closing_notes = closing_notes
            shift.closed_by = staff_member
            shift.closed_by_name = closed_by_name
            shift.closed_at = close_time
            shift.status = DailyRegisterShift.STATUS_CLOSED
            shift.save()

        return Response(DailyRegisterShiftSerializer(shift).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='settle-discrepancy')
    def settle_discrepancy(self, request, pk=None):
        """
        Verify and settle or clear a register shift cash discrepancy.
        Updates settlement status, action taken, settlement notes, and manager/staff info.
        Supports 'reopen': true to reverse/reopen the discrepancy for reinvestigation.
        """
        shift = self.get_object()
        reopen = request.data.get('reopen', False)

        if reopen:
            shift.is_discrepancy_settled = False
            shift.settled_at = None
            shift.settled_by = None
            shift.settled_by_name = ""
            shift.settlement_action = ""
            shift.settlement_notes = f"Re-opened: {request.data.get('notes', '')}".strip()
            shift.save()
            return Response(DailyRegisterShiftSerializer(shift).data, status=status.HTTP_200_OK)

        staff_member = getattr(request, 'staff_member', None)
        settled_by_name = request.data.get('settled_by_name') or (staff_member.name if staff_member else "Manager")
        settlement_action = request.data.get('settlement_action', 'approved_loss')
        settlement_notes = request.data.get('settlement_notes', '')

        shift.is_discrepancy_settled = True
        shift.settled_at = timezone.now()
        shift.settled_by = staff_member
        shift.settled_by_name = settled_by_name
        shift.settlement_action = settlement_action
        shift.settlement_notes = settlement_notes
        shift.save()

        return Response(DailyRegisterShiftSerializer(shift).data, status=status.HTTP_200_OK)


class DashboardAnalyticsView(APIView):
    """
    API endpoint to retrieve retail dashboard analytics for a given date range.
    Accepts start_date/end_date (YYYY-MM-DD) as primary params; falls back to year/month.
    """
    def get(self, request, *args, **kwargs):
        store_id = request.query_params.get('store_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        data = get_dashboard_analytics(
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
            year=year,
            month=month,
        )
        return Response(data, status=status.HTTP_200_OK)


class ExpiryAnalyticsView(APIView):
    """
    API endpoint for current inventory expiry intelligence.
    Returns items with expiry dates categorised by urgency: expired, critical,
    warning, notice, and ok — sorted most urgent first.
    """
    def get(self, request, *args, **kwargs):
        store_id = request.query_params.get('store_id')
        data = get_expiry_analytics(store_id=store_id)
        return Response(data, status=status.HTTP_200_OK)
