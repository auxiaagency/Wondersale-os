from django.db import migrations


def backfill_primary_subcategories(apps, schema_editor):
    Item = apps.get_model('inventory', 'Item')
    # For every item where primary_subcategory is null, set it to the first subcategory if one exists
    for item in Item.objects.filter(primary_subcategory__isnull=True):
        first_sub = item.subcategories.first()
        if first_sub:
            item.primary_subcategory = first_sub
            item.save(update_fields=['primary_subcategory'])


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0016_item_primary_subcategory'),
    ]

    operations = [
        migrations.RunPython(backfill_primary_subcategories, reverse_code=reverse_backfill),
    ]
