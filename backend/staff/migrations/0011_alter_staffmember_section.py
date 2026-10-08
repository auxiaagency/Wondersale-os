import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0028_section_item_section'),
        ('staff', '0010_interim_settlement'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='staffmember',
            name='section',
        ),
        migrations.AddField(
            model_name='staffmember',
            name='section',
            field=models.ForeignKey(
                blank=True,
                help_text='Assigned section/department in store (optional, at most 1 section; can be left blank).',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='staff_members',
                to='inventory.section'
            ),
        ),
    ]


