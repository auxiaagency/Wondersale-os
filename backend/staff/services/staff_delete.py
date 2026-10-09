from django.db import transaction
from ..models import (
    StaffMember, Employee, RFIDCard, EmployeeShiftAssignment,
    EmployeeStoreAssignment, Punch, AttendanceDay, AttendanceSession,
    LeaveRequest, LeaveBalanceEntry, HRSetting, SalaryStructure,
    SalaryStatement, SalaryLine, PayrollAdjustment, EmployeeLedgerEntry,
    FinanceEvent, EmployeeTask, StaffPasswordResetRequest, AttendanceAuditLog,
    PayrollRun
)
from inventory.models import (
    StockMovement, BrokenItemReport, ItemPriceHistory,
    SaleOrder, OrderPaymentTransaction, CounterPayout, DailyRegisterShift
)
from accounting.models import OperatingExpense, SectionMonthlyGoal


def delete_employee_records(employee: Employee):
    """
    Completely and cleanly deletes an Employee and all associated records,
    resolving any PROTECT foreign keys (Punches, SalaryStatements, LedgerEntries)
    and removing any uploaded photos or linked data.
    """
    if not employee:
        return

    # 1. Salary lines and statements
    statements = SalaryStatement.objects.filter(employee=employee)
    SalaryLine.objects.filter(statement__in=statements).delete()
    statements.delete()

    # 2. Ledger entries - first clear self-referential PROTECT foreign key (reversed_entry)
    emp_entries = EmployeeLedgerEntry.objects.filter(employee=employee)
    emp_entries.update(reversed_entry=None, related_statement=None, counter_payout=None)
    emp_entries.delete()

    # 3. Punches and attendance
    Punch.objects.filter(employee=employee).delete()
    days = AttendanceDay.objects.filter(employee=employee)
    AttendanceSession.objects.filter(attendance_day__in=days).delete()
    days.delete()

    # 4. Leaves & HR settings
    LeaveRequest.objects.filter(employee=employee).delete()
    LeaveBalanceEntry.objects.filter(employee=employee).delete()
    HRSetting.objects.filter(employee=employee).delete()
    SalaryStructure.objects.filter(employee=employee).delete()
    PayrollAdjustment.objects.filter(employee=employee).delete()
    FinanceEvent.objects.filter(employee=employee).delete()

    # 5. Cards & assignments
    RFIDCard.objects.filter(employee=employee).delete()
    EmployeeShiftAssignment.objects.filter(employee=employee).delete()
    EmployeeStoreAssignment.objects.filter(employee=employee).delete()

    # 6. Inventory relations referencing employee
    BrokenItemReport.objects.filter(fined_employee=employee).update(fined_employee=None)
    CounterPayout.objects.filter(employee=employee).update(employee=None)

    # 7. Audit logs targeting this employee
    AttendanceAuditLog.objects.filter(
        target_type='Employee',
        target_id__in=[str(employee.id), str(employee.employee_code)]
    ).delete()

    # 8. Photo cleanup
    if employee.photo:
        try:
            employee.photo.delete(save=False)
        except Exception:
            pass

    employee_id = employee.id
    employee.delete()
    return employee_id


def delete_staff_member_completely(staff_member: StaffMember):
    """
    Deletes a StaffMember permanently and removes or unlinks their identity
    from everywhere they were ever mentioned, assigned, or recorded in the system.
    Runs inside an atomic transaction.
    """
    with transaction.atomic():
        staff_id = staff_member.staff_id
        db_id = staff_member.id

        # 1. Find and completely purge any linked Employee profiles
        linked_employees = list(Employee.objects.filter(staff_member=staff_member))
        same_code_employees = list(Employee.objects.filter(employee_code__iexact=staff_id))
        all_emps = {e.id: e for e in linked_employees + same_code_employees}.values()
        for emp in all_emps:
            delete_employee_records(emp)

        # 2. Employee Tasks assigned to or created by this staff member
        tasks_to_delete = EmployeeTask.objects.filter(assigned_to=staff_member) | EmployeeTask.objects.filter(created_by=staff_member)
        for task in tasks_to_delete:
            if task.proof_image:
                try:
                    task.proof_image.delete(save=False)
                except Exception:
                    pass
            task.delete()
        EmployeeTask.objects.filter(verified_by=staff_member).update(verified_by=None)

        # 3. Password reset requests
        StaffPasswordResetRequest.objects.filter(staff_member=staff_member).delete()
        StaffPasswordResetRequest.objects.filter(resolved_by=staff_member).update(resolved_by=None)

        # 4. Cashier & POS shifts
        DailyRegisterShift.objects.filter(cashier=staff_member).update(cashier=None)
        DailyRegisterShift.objects.filter(closed_by=staff_member).update(closed_by=None)
        DailyRegisterShift.objects.filter(settled_by=staff_member).update(settled_by=None)

        # 5. Sales, transactions & payouts
        SaleOrder.objects.filter(cashier=staff_member).update(cashier=None)
        OrderPaymentTransaction.objects.filter(collected_by=staff_member).update(collected_by=None)
        CounterPayout.objects.filter(paid_by=staff_member).update(paid_by=None)

        # 6. Inventory management logs
        StockMovement.objects.filter(performed_by=staff_member).update(performed_by=None)
        BrokenItemReport.objects.filter(reported_by=staff_member).update(reported_by=None)
        ItemPriceHistory.objects.filter(performed_by=staff_member).update(performed_by=None)

        # 7. Accounting
        OperatingExpense.objects.filter(recorded_by=staff_member).update(recorded_by=None)
        SectionMonthlyGoal.objects.filter(created_by=staff_member).update(created_by=None)

        # 8. HR & Attendance actions performed by this user
        Punch.objects.filter(created_by=staff_member).update(created_by=None)
        Punch.objects.filter(voided_by=staff_member).update(voided_by=None)
        AttendanceDay.objects.filter(override_by=staff_member).update(override_by=None)
        LeaveRequest.objects.filter(decided_by=staff_member).update(decided_by=None)
        PayrollRun.objects.filter(finalized_by=staff_member).update(finalized_by=None)
        PayrollRun.objects.filter(reopened_by=staff_member).update(reopened_by=None)
        PayrollAdjustment.objects.filter(created_by=staff_member).update(created_by=None)
        EmployeeLedgerEntry.objects.filter(created_by=staff_member).update(created_by=None)

        # 9. Attendance audit logs
        AttendanceAuditLog.objects.filter(actor=staff_member).update(actor=None)
        AttendanceAuditLog.objects.filter(
            target_type='StaffMember',
            target_id__in=[str(db_id), str(staff_id)]
        ).delete()

        # 10. Photo cleanup
        if staff_member.photo:
            try:
                staff_member.photo.delete(save=False)
            except Exception:
                pass

        # 11. Delete the staff member account
        staff_member.delete()
