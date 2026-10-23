from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q, Sum, Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from decimal import Decimal


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


from .models import OperatingExpense
from .serializers import OperatingExpenseSerializer
from .services import (
    get_monthly_financial_analysis,
    generate_next_expense_voucher_number,
    parse_store_filter_ids,
    get_store_earliest_record_date,
)


class MonthlyFinancialAnalysisView(APIView):
    """
    API endpoint returning comprehensive Store Monthly Financial & Accounting Intelligence:
    - Executive Financial Summary & Inflow/Outflow Breakdown
    - Dual Profit: Store Net Operating Profit (WITHOUT Stakeholders) vs Final Retained Profit (WITH Stakeholders)
    - Category & SubCategory Sales Performance (Revenue, Profit, Margin %, Units Sold)
    - Supplier Sales Performance (Revenue, Profit, Margin %, Units Sold)
    - Operating Expenses Breakdown by Category
    - Day-by-day Timeline Data for visual charts
    - Payment Inflow/Outflow Breakdown
    - Comprehensive Financial Waterfall
    """
    def get(self, request, *args, **kwargs):
        store_param = request.query_params.get('store') or request.query_params.get('store_id')
        store_list = request.query_params.getlist('store') or request.query_params.getlist('stores')
        target_ids = parse_store_filter_ids(store_param, store_list)
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Fast in-memory cache check (LocMemCache, NO Redis needed)
        from django.core.cache import cache
        store_key_part = f"st_{'_'.join(str(i) for i in sorted(target_ids))}" if target_ids else "st_all"
        cache_key = f"mfa_{store_key_part}_y{year}_m{month}_sd{start_date}_ed{end_date}"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data, status=status.HTTP_200_OK)

        data = get_monthly_financial_analysis(
            store_id=target_ids,
            year=year,
            month=month,
            start_date=start_date,
            end_date=end_date,
        )

        # Cache for 15 seconds to deduplicate simultaneous chart/tab requests while staying fresh for real-time sales
        try:
            cache.set(cache_key, data, timeout=15)
        except Exception:
            pass

        return Response(data, status=status.HTTP_200_OK)


class OperatingExpenseViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing store operating expenses (rent, utilities, maintenance, refreshments, etc.).
    Supports filtering by store, month, year, category, payment method, and text search.
    """
    serializer_class = OperatingExpenseSerializer
    queryset = OperatingExpense.objects.select_related('store', 'recorded_by').all()

    def get_queryset(self):
        qs = super().get_queryset()
        store_param = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        store_list = self.request.query_params.getlist('store') or self.request.query_params.getlist('stores')
        target_ids = parse_store_filter_ids(store_param, store_list)
        if target_ids is not None:
            qs = qs.filter(store_id__in=target_ids)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date or end_date:
            if start_date:
                s_d = parse_date(str(start_date)[:10])
                if s_d:
                    qs = qs.filter(expense_date__gte=s_d)
            if end_date:
                e_d = parse_date(str(end_date)[:10])
                if e_d:
                    qs = qs.filter(expense_date__lte=e_d)
        else:
            year = self.request.query_params.get('year')
            if year:
                try:
                    qs = qs.filter(year=int(year))
                except (ValueError, TypeError):
                    pass

            month = self.request.query_params.get('month')
            if month:
                try:
                    qs = qs.filter(month=int(month))
                except (ValueError, TypeError):
                    pass

        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)

        payment_method = self.request.query_params.get('payment_method')
        if payment_method and payment_method != 'all':
            qs = qs.filter(payment_method=payment_method)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(voucher_number__icontains=search) |
                Q(paid_to__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(notes__icontains=search)
            )

        start_time = parse_filter_datetime(self.request.query_params.get('start_time'))
        end_time = parse_filter_datetime(self.request.query_params.get('end_time'))
        if start_time:
            qs = qs.filter(Q(created_at__gte=start_time) | Q(expense_date__gte=start_time.date()))
        if end_time:
            qs = qs.filter(Q(created_at__lte=end_time) | Q(expense_date__lte=end_time.date()))

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def monthly_summary(self, request):
        """
        Returns aggregated summary of operating expenses for the requested store/month/year.
        """
        qs = self.get_queryset()

        total_amount = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_count = qs.count()

        # Category breakdown
        category_stats = (
            qs.values('category')
            .annotate(cat_total=Sum('amount'), cat_count=Count('id'))
            .order_by('-cat_total')
        )

        categories_map = dict(OperatingExpense.CATEGORY_CHOICES)
        category_breakdown = [
            {
                'category': c['category'],
                'category_name': categories_map.get(c['category'], c['category'].replace('_', ' ').title()),
                'total_amount': float(c['cat_total'] or Decimal('0.00')),
                'count': c['cat_count'],
            }
            for c in category_stats
        ]

        top_category = category_breakdown[0] if category_breakdown else None

        store_param = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        store_list = self.request.query_params.getlist('store') or self.request.query_params.getlist('stores')
        target_ids = parse_store_filter_ids(store_param, store_list)
        earliest_record_date = get_store_earliest_record_date(target_ids)

        return Response({
            'total_amount': float(total_amount),
            'total_count': total_count,
            'top_category': top_category,
            'category_breakdown': category_breakdown,
            'earliest_record_date': earliest_record_date.isoformat(),
        }, status=status.HTTP_200_OK)


from .models import SectionMonthlyGoal
from .serializers import SectionMonthlyGoalSerializer
from staff.services.auth import get_current_staff


class SectionMonthlyGoalViewSet(viewsets.ModelViewSet):
    """
    Phase 4: Section Monthly Sales/Profit Targets & Auto-Lock (3rd of next month).
    Endpoints:
      - GET /api/accounting/section-goals/ (?year=2026&month=10&section=X&store=Y)
      - POST /api/accounting/section-goals/ (Create/Update target revenue & target profit)
      - PATCH /api/accounting/section-goals/<id>/
    """
    serializer_class = SectionMonthlyGoalSerializer
    queryset = SectionMonthlyGoal.objects.select_related('section', 'store', 'created_by').all()
    authentication_classes = []

    def get_queryset(self):
        qs = super().get_queryset()
        for goal in qs:
            goal.check_and_update_lock_status()

        year = self.request.query_params.get('year')
        if year:
            try:
                qs = qs.filter(year=int(year))
            except (ValueError, TypeError):
                pass

        month = self.request.query_params.get('month')
        if month:
            try:
                qs = qs.filter(month=int(month))
            except (ValueError, TypeError):
                pass

        section = self.request.query_params.get('section') or self.request.query_params.get('section_id')
        if section:
            try:
                qs = qs.filter(section_id=int(section))
            except (ValueError, TypeError):
                pass

        store_id = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        if store_id and store_id not in ('all', 'null', 'undefined'):
            try:
                qs = qs.filter(store_id=int(store_id))
            except (ValueError, TypeError):
                pass

        return qs

    def create(self, request, *args, **kwargs):
        staff = get_current_staff(request)
        is_owner = staff and (staff.is_owner or (staff.role and staff.role.can_access_staff))
        if not is_owner:
            return Response({'detail': 'Only store owners or managers can set monthly section targets.'}, status=status.HTTP_403_FORBIDDEN)

        section_id = request.data.get('section')
        year = int(request.data.get('year', timezone.now().year))
        month = int(request.data.get('month', timezone.now().month))
        target_rev = request.data.get('target_revenue', '0.00')
        target_prof = request.data.get('target_profit', '0.00')
        store_id = request.data.get('store')
        notes = request.data.get('notes', '')

        if not section_id:
            return Response({'detail': 'Section is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing goal
        goal = SectionMonthlyGoal.objects.filter(section_id=section_id, year=year, month=month).first()
        if goal:
            goal.check_and_update_lock_status()
            if goal.is_locked:
                return Response({'detail': f'This goal period ({month:02d}/{year}) was permanently auto-locked on {goal.locked_at} and cannot be altered.'}, status=status.HTTP_400_BAD_REQUEST)

            goal.target_revenue = Decimal(str(target_rev))
            goal.target_profit = Decimal(str(target_prof))
            if store_id:
                goal.store_id = store_id
            if notes is not None:
                goal.notes = notes
            goal.save()
            return Response(SectionMonthlyGoalSerializer(goal).data, status=status.HTTP_200_OK)

        # Create new
        goal = SectionMonthlyGoal.objects.create(
            section_id=section_id,
            store_id=store_id,
            year=year,
            month=month,
            target_revenue=Decimal(str(target_rev)),
            target_profit=Decimal(str(target_prof)),
            created_by=staff,
            notes=notes,
        )
        return Response(SectionMonthlyGoalSerializer(goal).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        staff = get_current_staff(request)
        is_owner = staff and (staff.is_owner or (staff.role and staff.role.can_access_staff))
        if not is_owner:
            return Response({'detail': 'Only store owners or managers can edit monthly section targets.'}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        instance.check_and_update_lock_status()
        if instance.is_locked:
            return Response({'detail': f'This goal period is locked and cannot be updated.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


class OwnerExpenseRecordViewSet(viewsets.ModelViewSet):
    """
    Centralized Expense, Purchase & Delivery Tracking ViewSet.
    Accessible to any authenticated staff who has the 'accounting' module permission.
    Supports:
      - Creating expenses/orders with PDF/image bill attachments
      - In-place editing of expenses
      - Quick payment settlement (full or partial)
      - Delivery / arrival confirmation ('delivered', 'in_transit', etc.)
      - Summary KPI counts & amounts
    """
    from .models import OwnerExpenseRecord
    from .serializers import OwnerExpenseRecordSerializer
    queryset = OwnerExpenseRecord.objects.select_related('store', 'recorded_by', 'received_by', 'last_updated_by').all()
    serializer_class = OwnerExpenseRecordSerializer

    def check_permissions(self, request):
        super().check_permissions(request)
        staff = get_current_staff(request)
        if not staff:
            self.permission_denied(request, message="Authentication required.")
        if staff.is_owner:
            return
        allowed = (staff.role.allowed_modules or []) if staff.role else []
        if 'accounting' not in allowed:
            self.permission_denied(request, message="Permission denied. Requires Accounts module access.")

    def get_queryset(self):
        qs = super().get_queryset()

        # Optional Store filtering (if multi-branch user specifies)
        store_param = self.request.query_params.get('store') or self.request.query_params.get('store_id')
        store_list = self.request.query_params.getlist('store') or self.request.query_params.getlist('stores')
        target_ids = parse_store_filter_ids(store_param, store_list)
        if target_ids is not None:
            qs = qs.filter(Q(store_id__in=target_ids) | Q(store__isnull=True))

        # Status filter ('unpaid', 'partial', 'paid')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)

        # Delivery status filter ('pending', 'in_transit', 'delivered', 'not_applicable')
        delivery_status_param = self.request.query_params.get('delivery_status')
        if delivery_status_param and delivery_status_param != 'all':
            qs = qs.filter(delivery_status=delivery_status_param)

        # Category filter
        category_param = self.request.query_params.get('category')
        if category_param and category_param != 'all':
            qs = qs.filter(category=category_param)

        # Overdue filter
        overdue_param = self.request.query_params.get('overdue')
        if overdue_param in ['true', '1', True]:
            qs = qs.filter(due_date__lt=timezone.now().date()).exclude(status='paid')

        # Date range filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            sd = parse_date(str(start_date)[:10])
            if sd:
                qs = qs.filter(expense_date__gte=sd)
        if end_date:
            ed = parse_date(str(end_date)[:10])
            if ed:
                qs = qs.filter(expense_date__lte=ed)

        # Text search (title, vendor_name, record_number, payment_reference)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(vendor_name__icontains=search) |
                Q(record_number__icontains=search) |
                Q(payment_reference__icontains=search) |
                Q(delivery_notes__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        staff = get_current_staff(self.request)
        instance = serializer.save(
            recorded_by=staff,
            recorded_by_name=staff.name if staff else '',
            last_updated_by=staff,
            last_updated_by_name=staff.name if staff else ''
        )
        self._handle_attachments(instance)

    def perform_update(self, serializer):
        staff = get_current_staff(self.request)
        instance = serializer.save(
            last_updated_by=staff,
            last_updated_by_name=staff.name if staff else ''
        )
        self._handle_attachments(instance)

    def _handle_attachments(self, instance):
        from .models import ExpenseAttachment
        uploaded_files = self.request.FILES.getlist('attachments') or self.request.FILES.getlist('attachments[]')
        for f in uploaded_files:
            file_name = f.name
            file_type = getattr(f, 'content_type', '')
            file_size = getattr(f, 'size', 0)
            ExpenseAttachment.objects.create(
                expense_record=instance,
                file=f,
                file_name=file_name,
                file_type=file_type,
                file_size=file_size,
            )


    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns top aggregate statistics for the header KPI cards.
        """
        qs = self.get_queryset()
        from .models import OwnerExpenseRecord

        now = timezone.now()
        current_month = now.month
        current_year = now.year

        # Aggregates across the filtered queryset
        totals = qs.aggregate(
            total_expense=Sum('total_amount'),
            total_paid=Sum('paid_amount'),
            total_records=Count('id'),
        )
        total_exp = totals['total_expense'] or Decimal('0.00')
        total_pd = totals['total_paid'] or Decimal('0.00')
        total_outstanding = max(Decimal('0.00'), total_exp - total_pd)

        # Unpaid count (unpaid or partial)
        unpaid_count = qs.filter(status__in=[OwnerExpenseRecord.STATUS_UNPAID, OwnerExpenseRecord.STATUS_PARTIAL]).count()
        paid_count = qs.filter(status=OwnerExpenseRecord.STATUS_PAID).count()

        # Overdue count
        overdue_count = qs.filter(
            due_date__lt=now.date()
        ).filter(
            status__in=[OwnerExpenseRecord.STATUS_UNPAID, OwnerExpenseRecord.STATUS_PARTIAL]
        ).count()

        # Shipments pending arrival count
        pending_delivery_count = qs.filter(
            delivery_status__in=[OwnerExpenseRecord.DELIVERY_PENDING, OwnerExpenseRecord.DELIVERY_SHIPPED]
        ).count()

        # Paid in current month
        paid_this_month = qs.filter(
            payment_date__year=current_year,
            payment_date__month=current_month
        ).aggregate(sum=Sum('paid_amount'))['sum'] or Decimal('0.00')

        return Response({
            'total_expense': total_exp,
            'total_paid': total_pd,
            'total_outstanding': total_outstanding,
            'unpaid_count': unpaid_count,
            'paid_count': paid_count,
            'overdue_count': overdue_count,
            'pending_delivery_count': pending_delivery_count,
            'paid_this_month': paid_this_month,
            'total_records': totals['total_records'] or 0,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        """
        Settle or add payment for an expense entry in-place.
        Payload:
          paid_amount (Decimal)
          payment_method (str)
          payment_account (str)
          payment_date (date)
          payment_reference (str)
          payment_notes (str)
        """
        instance = self.get_object()
        staff = get_current_staff(request)

        add_amount = request.data.get('amount') or request.data.get('paid_amount')
        is_full = request.data.get('full_payment', False)

        if is_full:
            instance.paid_amount = instance.total_amount
        elif add_amount is not None:
            try:
                amt = Decimal(str(add_amount))
                # Check if payload means 'total new paid amount' or 'increment'
                is_additive = request.data.get('is_additive', False)
                if is_additive:
                    instance.paid_amount = min(instance.total_amount, instance.paid_amount + amt)
                else:
                    instance.paid_amount = min(instance.total_amount, amt)
            except Exception:
                return Response({'detail': 'Invalid payment amount specified.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            instance.paid_amount = instance.total_amount

        if 'payment_method' in request.data:
            instance.payment_method = request.data.get('payment_method')
        if 'payment_account' in request.data:
            instance.payment_account = request.data.get('payment_account', '')
        if 'payment_reference' in request.data:
            instance.payment_reference = request.data.get('payment_reference', '')
        if 'payment_notes' in request.data:
            instance.payment_notes = request.data.get('payment_notes', '')

        p_date = request.data.get('payment_date')
        if p_date:
            pd = parse_date(str(p_date)[:10])
            if pd:
                instance.payment_date = pd
        elif not instance.payment_date:
            instance.payment_date = timezone.now().date()

        instance.last_updated_by = staff
        instance.last_updated_by_name = staff.name if staff else ''
        instance.save()

        from .serializers import OwnerExpenseRecordSerializer
        return Response(OwnerExpenseRecordSerializer(instance, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='update-delivery')
    def update_delivery(self, request, pk=None):
        """
        Update shipment / arrival status (e.g. Employee marks delivered when goods arrive).
        Payload:
          delivery_status ('pending', 'in_transit', 'delivered', 'not_applicable')
          delivery_notes (str)
        """
        instance = self.get_object()
        staff = get_current_staff(request)

        new_status = request.data.get('delivery_status')
        if new_status:
            instance.delivery_status = new_status
            if new_status == 'delivered':
                instance.received_at = timezone.now()
                instance.received_by = staff
                instance.received_by_name = staff.name if staff else ''
            elif new_status in ['pending', 'in_transit']:
                instance.received_at = None
                instance.received_by = None
                instance.received_by_name = ''

        if 'delivery_notes' in request.data:
            instance.delivery_notes = request.data.get('delivery_notes', '')

        instance.last_updated_by = staff
        instance.last_updated_by_name = staff.name if staff else ''
        instance.save()

        from .serializers import OwnerExpenseRecordSerializer
        return Response(OwnerExpenseRecordSerializer(instance, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='attachments/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """
        Delete a single attachment from an expense record.
        """
        instance = self.get_object()
        from .models import ExpenseAttachment
        att = ExpenseAttachment.objects.filter(expense_record=instance, id=attachment_id).first()
        if not att:
            return Response({'detail': 'Attachment not found.'}, status=status.HTTP_404_NOT_FOUND)
        att.delete()
        from .serializers import OwnerExpenseRecordSerializer
        return Response(OwnerExpenseRecordSerializer(instance, context={'request': request}).data, status=status.HTTP_200_OK)



