"""
Employee Ledger Service.
Append-only financial ledger for employee payables and receivables.
Sign Convention:
  - Positive (+) = Store owes employee (SALARY_ACCRUAL, BONUS)
  - Negative (-) = Employee owes store (PAYOUT, ADVANCE, FINE)
  - Balance = SUM(amount).
Never edits or deletes in-place; provides atomic reversal and correction.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import Employee, EmployeeLedgerEntry, SalaryStatement, StaffMember
from inventory.models import Store


def get_employee_balance(employee: Employee, as_of_date: date | None = None) -> Decimal:
    """
    Calculates the net balance for an employee.
    Positive (+) means store owes employee.
    Negative (-) means employee owes store.
    """
    qs = EmployeeLedgerEntry.objects.filter(employee=employee)
    if as_of_date:
        qs = qs.filter(entry_date__lte=as_of_date)

    res = qs.aggregate(total=Sum('amount'))['total']
    if res is None:
        return Decimal('0.00')
    return res.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def add_entry(
    employee: Employee,
    store: Store,
    entry_type: str,
    amount: Decimal,
    entry_date: date | None = None,
    payment_method: str = 'cash',
    reference_no: str = '',
    note: str = '',
    related_statement: SalaryStatement | None = None,
    reversed_entry: EmployeeLedgerEntry | None = None,
    actor: StaffMember | None = None,
) -> EmployeeLedgerEntry:
    """
    Appends a new ledger entry with concurrency lock on the employee row.
    Amount must be signed correctly:
      - Accrual/Bonus: positive
      - Payout/Advance/Fine: negative
    """
    if entry_date is None:
        entry_date = timezone.now().date()

    quantized_amount = Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    with transaction.atomic():
        # Concurrency control: lock employee row
        Employee.objects.select_for_update().get(pk=employee.pk)

        entry = EmployeeLedgerEntry.objects.create(
            employee=employee,
            store=store,
            entry_date=entry_date,
            entry_type=entry_type,
            amount=quantized_amount,
            payment_method=payment_method,
            reference_no=reference_no,
            note=note,
            related_statement=related_statement,
            reversed_entry=reversed_entry,
            created_by=actor,
        )

        # Dispatch finance event if appropriate
        from .finance import post_finance_event
        if entry_type == EmployeeLedgerEntry.ENTRY_PAYOUT:
            post_finance_event(
                event_type='salary_payout_recorded',
                store=store,
                amount=abs(quantized_amount),
                source_ref=f"LEDGER-{entry.id}",
                employee=employee,
                payload={'entry_id': entry.id, 'payment_method': payment_method, 'reference_no': reference_no}
            )
        elif entry_type == EmployeeLedgerEntry.ENTRY_ADVANCE:
            post_finance_event(
                event_type='advance_recorded',
                store=store,
                amount=abs(quantized_amount),
                source_ref=f"LEDGER-{entry.id}",
                employee=employee,
                payload={'entry_id': entry.id, 'payment_method': payment_method, 'reference_no': reference_no}
            )

        return entry


def reverse_entry(
    entry_id: int,
    reason: str,
    actor: StaffMember | None = None
) -> EmployeeLedgerEntry:
    """
    Reverses an existing ledger entry by creating an opposite-signed REVERSAL entry.
    Atomic and safe: will fail if entry has already been reversed.
    """
    with transaction.atomic():
        target = EmployeeLedgerEntry.objects.select_for_update().get(pk=entry_id)
        Employee.objects.select_for_update().get(pk=target.employee.pk)

        if target.entry_type == EmployeeLedgerEntry.ENTRY_REVERSAL:
            raise ValueError("Cannot reverse a reversal entry.")

        # Check if already reversed
        if EmployeeLedgerEntry.objects.filter(reversed_entry=target).exists():
            raise ValueError(f"Ledger entry #{target.id} has already been reversed.")

        reversing_amount = (-target.amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        rev_entry = EmployeeLedgerEntry.objects.create(
            employee=target.employee,
            store=target.store,
            entry_date=timezone.now().date(),
            entry_type=EmployeeLedgerEntry.ENTRY_REVERSAL,
            amount=reversing_amount,
            payment_method=target.payment_method,
            reference_no=f"REV-{target.id}",
            note=f"Reversal of #{target.id} ({target.get_entry_type_display()}): {reason}",
            related_statement=target.related_statement,
            reversed_entry=target,
            created_by=actor,
        )

        return rev_entry


def correct_entry(
    entry_id: int,
    new_amount: Decimal,
    new_entry_type: str | None = None,
    new_note: str = '',
    reason: str = '',
    actor: StaffMember | None = None
) -> tuple[EmployeeLedgerEntry, EmployeeLedgerEntry]:
    """
    Corrects a mistake by performing atomic reversal + replacement entry.
    Returns (reversal_entry, new_entry).
    """
    with transaction.atomic():
        target = EmployeeLedgerEntry.objects.select_for_update().get(pk=entry_id)
        reversal = reverse_entry(entry_id=target.id, reason=f"Correction: {reason}", actor=actor)

        new_entry = add_entry(
            employee=target.employee,
            store=target.store,
            entry_type=new_entry_type or target.entry_type,
            amount=new_amount,
            entry_date=target.entry_date,
            payment_method=target.payment_method,
            reference_no=target.reference_no,
            note=new_note or target.note,
            related_statement=target.related_statement,
            actor=actor
        )

        return reversal, new_entry


def get_store_ledger_summary(store: Store, as_of_date: date | None = None, employee_id: int | None = None) -> dict[str, Any]:
    """
    Returns high-level totals of staff balances across a store, or for a single employee.
    """
    entries_qs = EmployeeLedgerEntry.objects.filter(store=store)
    if as_of_date:
        entries_qs = entries_qs.filter(entry_date__lte=as_of_date)

    if employee_id:
        emp = Employee.objects.filter(id=employee_id).first()
        emp_entries = entries_qs.filter(employee_id=employee_id)

        # Positive entries: accruals, interim wage credits, bonuses, positive adjustments
        total_credits = (
            emp_entries.filter(amount__gt=0).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Negative entries: payouts, advances, fines, negative adjustments
        total_payouts = abs(
            emp_entries.filter(entry_type=EmployeeLedgerEntry.ENTRY_PAYOUT).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        total_advances = abs(
            emp_entries.filter(entry_type=EmployeeLedgerEntry.ENTRY_ADVANCE).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        total_debits = abs(
            emp_entries.filter(amount__lt=0).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        net_bal = (
            emp_entries.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        total_store_owes = net_bal if net_bal > Decimal('0.00') else Decimal('0.00')
        total_staff_owes = abs(net_bal) if net_bal < Decimal('0.00') else Decimal('0.00')

        return {
            'is_employee_specific': True,
            'employee_id': emp.id if emp else int(employee_id),
            'employee_name': emp.name if emp else '',
            'employee_code': emp.employee_code if emp else '',
            'total_credits': str(total_credits),
            'total_debits': str(total_debits),
            'total_payouts': str(total_payouts),
            'total_advances': str(total_advances),
            'net_balance': str(net_bal),
            'total_store_owes': str(total_store_owes),
            'total_staff_owes': str(total_staff_owes),
            'net_liability': str(net_bal),
            'entry_count': emp_entries.count(),
            'employee_count': 1,
            'balances': [{
                'employee_id': emp.id if emp else int(employee_id),
                'employee_name': emp.name if emp else '',
                'employee_code': emp.employee_code if emp else '',
                'balance': str(net_bal),
            }] if emp else [],
        }

    # Group by employee to find current net per employee
    emp_balances = (
        entries_qs.values('employee_id', 'employee__name', 'employee__employee_code')
        .annotate(balance=Sum('amount'))
    )

    total_store_owes = Decimal('0.00')
    total_staff_owes = Decimal('0.00')
    net_liability = Decimal('0.00')

    emp_list = []
    for eb in emp_balances:
        bal = (eb['balance'] or Decimal('0.00')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if bal > Decimal('0.00'):
            total_store_owes += bal
        elif bal < Decimal('0.00'):
            total_staff_owes += abs(bal)
        net_liability += bal

        emp_list.append({
            'employee_id': eb['employee_id'],
            'employee_name': eb['employee__name'],
            'employee_code': eb['employee__employee_code'],
            'balance': str(bal),
        })

    return {
        'is_employee_specific': False,
        'total_store_owes': str(total_store_owes),
        'total_staff_owes': str(total_staff_owes),
        'net_liability': str(net_liability),
        'employee_count': len(emp_list),
        'balances': emp_list,
    }
