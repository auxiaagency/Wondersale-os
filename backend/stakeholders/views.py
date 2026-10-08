from decimal import Decimal
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response


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


from .models import Stakeholder, StakeholderPayout
from .serializers import StakeholderSerializer, StakeholderPayoutSerializer
from .services import get_stakeholders_analytics


class StakeholderViewSet(viewsets.ModelViewSet):
    """
    CRUD directory and profit-sharing management for contractual stakeholders.
    """
    queryset = Stakeholder.objects.all()
    serializer_class = StakeholderSerializer

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
            qs = qs.filter(store_id=effective_store_id)

        # 2. Text Search
        search = (self.request.query_params.get('search') or self.request.query_params.get('q') or '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search) |
                Q(notes__icontains=search)
            )

        # 3. Status filter
        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter and status_filter.lower() != 'all':
            qs = qs.filter(status=status_filter)

        return qs

    def perform_create(self, serializer):
        staff_member = getattr(self.request, 'staff_member', None)
        store_param = (
            self.request.data.get('store') or
            self.request.query_params.get('store') or
            self.request.query_params.get('store_id') or
            ''
        )
        effective_store = serializer.validated_data.get('store')
        if not effective_store:
            if staff_member and not staff_member.is_owner and staff_member.store:
                effective_store = staff_member.store
            elif store_param and str(store_param) not in ('', '0'):
                from inventory.models import Store
                effective_store = Store.objects.filter(id=store_param).first()
        from rest_framework.exceptions import ValidationError
        from inventory.models import Store
        target_check_store = effective_store or Store.objects.filter(is_active=True).first()
        if target_check_store and not getattr(target_check_store, 'enable_stakeholders', True):
            raise ValidationError({'detail': 'Stakeholders module is currently disabled in system settings.'})

        serializer.save()

    def perform_update(self, serializer):
        from rest_framework.exceptions import ValidationError
        from inventory.models import Store
        stakeholder = serializer.instance
        target_check_store = stakeholder.store or Store.objects.filter(is_active=True).first()
        if target_check_store and not getattr(target_check_store, 'enable_stakeholders', True):
            raise ValidationError({'detail': 'Stakeholders module is currently disabled in system settings.'})
        serializer.save()

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Returns profit-sharing analytics:
        - Pie chart profit distribution
        - Revenue and profit performance trends across timeframes:
          current_month, last_month, last_3_months, last_6_months, ytd, all_time
        - Summary KPIs
        """
        timeframe = request.query_params.get('timeframe', 'last_6_months')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        year_month = request.query_params.get('year_month')

        staff_member = getattr(request, 'staff_member', None)
        store_param = (request.query_params.get('store') or request.query_params.get('store_id') or '').strip()

        effective_store_id = None
        if staff_member and not staff_member.is_owner and staff_member.store_id:
            effective_store_id = staff_member.store_id
        elif store_param and store_param.lower() not in ('all', 'all_stores', '0', ''):
            effective_store_id = store_param

        data = get_stakeholders_analytics(
            store_id=effective_store_id,
            timeframe=timeframe,
            year=year,
            month=month,
            year_month=year_month
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def record_payout(self, request, pk=None):
        """
        Record a profit payout disbursement to a stakeholder.
        Automatically updates stakeholder's total_payout_paid.
        """
        stakeholder = self.get_object()
        from inventory.models import Store
        target_check_store = stakeholder.store or Store.objects.filter(is_active=True).first()
        if target_check_store and not getattr(target_check_store, 'enable_stakeholders', True):
            return Response(
                {'detail': 'Stakeholders module is currently disabled in system settings.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data.copy()
        data['stakeholder'] = stakeholder.id

        serializer = StakeholderPayoutSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payout = serializer.save()

        # Update total payout paid on stakeholder
        stakeholder.total_payout_paid = (stakeholder.total_payout_paid + payout.amount).quantize(Decimal('0.01'))
        stakeholder.save(update_fields=['total_payout_paid'])

        return Response({
            'payout': serializer.data,
            'stakeholder': StakeholderSerializer(stakeholder).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def payouts(self, request, pk=None):
        """
        Returns payout disbursements history for this stakeholder.
        """
        stakeholder = self.get_object()
        payouts_qs = stakeholder.payouts.all()
        start_time = parse_filter_datetime(request.query_params.get('start_time'))
        end_time = parse_filter_datetime(request.query_params.get('end_time'))
        if start_time:
            payouts_qs = payouts_qs.filter(Q(created_at__gte=start_time) | Q(payout_date__gte=start_time.date()))
        if end_time:
            payouts_qs = payouts_qs.filter(Q(created_at__lte=end_time) | Q(payout_date__lte=end_time.date()))
        payouts_qs = payouts_qs.order_by('-payout_date', '-created_at')
        serializer = StakeholderPayoutSerializer(payouts_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
