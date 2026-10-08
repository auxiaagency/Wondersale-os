from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0009_staffmember_session_token'),
        ('inventory', '0024_counterpayout_employee_staff_payout_fields'),
    ]

    operations = [
        # AttendanceDay: is_settled
        migrations.AddField(
            model_name='attendanceday',
            name='is_settled',
            field=models.BooleanField(
                default=False,
                db_index=True,
                help_text="True when this day's wages have been counted in an interim payroll settlement."
            ),
        ),
        # AttendanceDay: settled_at
        migrations.AddField(
            model_name='attendanceday',
            name='settled_at',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text='Timestamp when this day was included in an interim settlement.'
            ),
        ),
        # AttendanceDay: settlement_ref
        migrations.AddField(
            model_name='attendanceday',
            name='settlement_ref',
            field=models.CharField(
                max_length=100,
                blank=True,
                default='',
                help_text='Reference number of the interim settlement (e.g. ISETL-20261001-0001).'
            ),
        ),
        # AttendanceDay: ot_verified
        migrations.AddField(
            model_name='attendanceday',
            name='ot_verified',
            field=models.BooleanField(
                default=False,
                help_text='True when a manager has reviewed and verified the overtime minutes for this day.'
            ),
        ),
        # AttendanceDay: ot_override_minutes
        migrations.AddField(
            model_name='attendanceday',
            name='ot_override_minutes',
            field=models.PositiveIntegerField(
                null=True,
                blank=True,
                help_text='Manager-approved OT override in minutes. If set, this takes precedence over overtime_minutes in payroll calculations.'
            ),
        ),
        # EmployeeLedgerEntry: counter_payout FK
        migrations.AddField(
            model_name='employeeledgerentry',
            name='counter_payout',
            field=models.ForeignKey(
                to='inventory.CounterPayout',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='ledger_entries',
                help_text='Links this ledger entry to a cash drawer payout when wages were paid in cash from a register.'
            ),
        ),
        # EmployeeLedgerEntry: update entry_type max_length to accommodate new type
        migrations.AlterField(
            model_name='employeeledgerentry',
            name='entry_type',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('OPENING_BALANCE', 'Opening Balance'),
                    ('SALARY_ACCRUAL', 'Salary Accrual (Month-End Full Run)'),
                    ('INTERIM_WAGE_CREDIT', 'Interim Wage Credit (Partial Settlement)'),
                    ('PAYOUT', 'Salary Payout (Cash/UPI Disbursement)'),
                    ('ADVANCE', 'Advance Paid'),
                    ('BONUS', 'Bonus'),
                    ('FINE', 'Fine'),
                    ('ADJUSTMENT', 'Adjustment'),
                    ('REVERSAL', 'Reversal'),
                ],
                db_index=True,
            ),
        ),
    ]
