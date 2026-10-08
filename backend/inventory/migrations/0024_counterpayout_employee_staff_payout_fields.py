from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0023_aidescriptionbatchjob_status_message'),
        ('staff', '0009_staffmember_session_token'),
    ]

    operations = [
        # CounterPayout: employee FK
        migrations.AddField(
            model_name='counterpayout',
            name='employee',
            field=models.ForeignKey(
                to='staff.Employee',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='counter_payouts',
                help_text='Staff employee whose wages are being paid (populated only for staff_salary_payout category).'
            ),
        ),
        # CounterPayout: register_shift FK
        migrations.AddField(
            model_name='counterpayout',
            name='register_shift',
            field=models.ForeignKey(
                to='inventory.DailyRegisterShift',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='payouts',
                help_text='Register shift from which this cash payout was made.'
            ),
        ),
        # CounterPayout: is_post_close
        migrations.AddField(
            model_name='counterpayout',
            name='is_post_close',
            field=models.BooleanField(
                default=False,
                help_text='True if this payout was made after the register shift was formally closed.'
            ),
        ),
        # CounterPayout: update category field to include staff_salary_payout
        migrations.AlterField(
            model_name='counterpayout',
            name='category',
            field=models.CharField(
                max_length=50,
                choices=[
                    ('stock_purchase', 'Stock Delivery / Purchase'),
                    ('freight_delivery', 'Freight & Courier / Transport'),
                    ('store_maintenance', 'Store Repairs & Maintenance'),
                    ('daily_expense', 'Tea & Daily Supplies / Refreshments'),
                    ('utility_bill', 'Electricity / Internet / Utilities'),
                    ('customer_refund', 'Customer Return / Bill Refund'),
                    ('staff_salary_payout', 'Staff Salary / Wage Payout'),
                    ('other', 'Other Counter Expense'),
                ],
                default='stock_purchase',
            ),
        ),
        # DailyRegisterShift: post_close_payouts_amount
        migrations.AddField(
            model_name='dailyregistershift',
            name='post_close_payouts_amount',
            field=models.DecimalField(
                max_digits=12,
                decimal_places=2,
                default='0.00',
                help_text='Total cash paid out after this shift was formally closed (e.g. manager paid staff wages from closed drawer). Deducted from net handover.'
            ),
        ),
    ]
