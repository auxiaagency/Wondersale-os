"""
Finance and Accounting Integration Service for Employee Management.
Handles outbox event logging and syncing payroll accruals to accounting OperatingExpense.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
import calendar

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import Employee, PayrollRun, FinanceEvent
from inventory.models import Store


def post_finance_event(
    event_type: str,
    store: Store,
    amount: Decimal,
    source_ref: str,
    employee: Employee | None = None,
    year: int | None = None,
    month: int | None = None,
    payload: dict | None = None,
) -> FinanceEvent:
    """
    Creates an outbox FinanceEvent for audit and downstream synchronization.
    """
    quantized_amount = Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return FinanceEvent.objects.create(
        event_type=event_type,
        store=store,
        employee=employee,
        year=year,
        month=month,
        amount=quantized_amount,
        source_ref=source_ref,
        status='consumed',
        payload=payload or {},
    )


def sync_payroll_to_accounting(payroll_run: PayrollRun) -> Any:
    """
    Creates or updates the summary OperatingExpense entry in backend/accounting.
    Called when a PayrollRun is finalized.
    """
    try:
        from accounting.models import OperatingExpense
    except ImportError:
        return None

    _, last_day = calendar.monthrange(payroll_run.year, payroll_run.month)
    voucher_no = f"EXP-PAYROLL-{payroll_run.store.id}-{payroll_run.year}{payroll_run.month:02d}"

    # Calculate total gross and net of included statements
    included_statements = payroll_run.statements.filter(is_included=True)
    total_gross = included_statements.aggregate(total=Sum('gross'))['total'] or Decimal('0.00')
    total_net = included_statements.aggregate(total=Sum('net'))['total'] or Decimal('0.00')

    with transaction.atomic():
        expense, _ = OperatingExpense.objects.update_or_create(
            voucher_number=voucher_no,
            defaults={
                'store': payroll_run.store,
                'title': f"Staff Payroll Expense - {calendar.month_name[payroll_run.month]} {payroll_run.year}",
                'category': 'salaries',
                'amount': total_gross,
                'expense_date': date(payroll_run.year, payroll_run.month, last_day),
                'month': payroll_run.month,
                'year': payroll_run.year,
                'payment_method': 'other',
                'paid_to': f"Staff Payroll ({payroll_run.store.name})",
                'reference_number': f"PR-{payroll_run.id}",
                'notes': f"Auto-synced payroll accrual for {included_statements.count()} staff. Gross ₹{total_gross}, Net ₹{total_net}.",
            }
        )

        post_finance_event(
            event_type=FinanceEvent.EVENT_SALARY_ACCRUED,
            store=payroll_run.store,
            amount=total_gross,
            source_ref=f"PAYROLL-{payroll_run.id}",
            year=payroll_run.year,
            month=payroll_run.month,
            payload={
                'payroll_run_id': payroll_run.id,
                'total_gross': str(total_gross),
                'total_net': str(total_net),
                'voucher_number': voucher_no,
            }
        )

        return expense


def reverse_payroll_in_accounting(payroll_run: PayrollRun) -> None:
    """
    Reverses or removes the OperatingExpense entry when a PayrollRun is reopened.
    """
    try:
        from accounting.models import OperatingExpense
    except ImportError:
        return

    voucher_no = f"EXP-PAYROLL-{payroll_run.store.id}-{payroll_run.year}{payroll_run.month:02d}"
    OperatingExpense.objects.filter(voucher_number=voucher_no).delete()

    post_finance_event(
        event_type=FinanceEvent.EVENT_SALARY_REVERSED,
        store=payroll_run.store,
        amount=Decimal('0.00'),
        source_ref=f"PAYROLL-{payroll_run.id}",
        year=payroll_run.year,
        month=payroll_run.month,
        payload={'payroll_run_id': payroll_run.id, 'action': 'reopened'}
    )


def get_monthly_finance_summary(store: Store, year: int, month: int) -> dict[str, Any]:
    """
    Returns summary of payroll events, accruals, and disbursements for a month.
    """
    events = FinanceEvent.objects.filter(store=store, year=year, month=month)
    payroll_run = PayrollRun.objects.filter(store=store, year=year, month=month).first()

    total_accrued = Decimal('0.00')
    total_payouts = Decimal('0.00')
    total_advances = Decimal('0.00')

    if payroll_run and payroll_run.status == PayrollRun.STATUS_FINALIZED:
        total_accrued = (
            payroll_run.statements.filter(is_included=True).aggregate(s=Sum('net'))['s'] or Decimal('0.00')
        )

    return {
        'year': year,
        'month': month,
        'payroll_run_status': payroll_run.status if payroll_run else 'none',
        'payroll_run_id': payroll_run.id if payroll_run else None,
        'total_accrued': str(total_accrued),
        'events_count': events.count(),
    }
