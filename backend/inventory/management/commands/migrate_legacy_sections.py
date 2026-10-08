from django.core.management.base import BaseCommand
from inventory.models import Item, Section, Store
from staff.models import StaffMember


class Command(BaseCommand):
    help = "Safely migrates legacy location_section text on items and staff into structured Section entities."

    def handle(self, *args, **options):
        self.stdout.write("Scanning for legacy section text to migrate...")
        
        # Get all store names / cities to avoid confusing store physical location with in-store section
        stores = list(Store.objects.all())
        store_names_lower = {s.name.strip().lower() for s in stores if s.name}
        store_cities_lower = {s.city.strip().lower() for s in stores if s.city}
        known_locations = store_names_lower | store_cities_lower

        migrated_items = 0
        skipped_items = 0

        for item in Item.objects.filter(section__isnull=True).exclude(location_section=''):
            raw_text = str(item.location_section).strip()
            if not raw_text:
                continue

            # Context check: Avoid confusing with Store name or Store city
            if raw_text.lower() in known_locations:
                self.stdout.write(f"Skipping '{raw_text}' on item {item.name} as it matches a store location.")
                skipped_items += 1
                continue

            # This is a valid in-store section/aisle/department
            section_obj, created = Section.objects.get_or_create(
                name=raw_text,
                store=item.store,
                defaults={
                    'description': f'Auto-migrated in-store section for {item.store.name if item.store else "all stores"}',
                    'color': '#3B82F6',
                }
            )
            item.section = section_obj
            item.save(update_fields=['section'])
            migrated_items += 1

        self.stdout.write(self.style.SUCCESS(
            f"Section migration complete: {migrated_items} items assigned to sections, {skipped_items} skipped."
        ))
