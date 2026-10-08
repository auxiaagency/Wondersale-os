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

        data = get_monthly_financial_analysis(
            store_id=target_ids,
            year=year,
            month=month,
            start_date=start_date,
            end_date=end_date,
        )
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

