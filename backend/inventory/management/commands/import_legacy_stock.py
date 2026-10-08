import csv
import os
import re
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inventory.models import Store, Category, SubCategory, Item, StockMovement
from inventory.services import adjust_stock, generate_next_uid


def sanitize_csv_cell(val: str) -> str:
    """Neutralizes CSV formula injection by stripping or escaping leading '=', '+', '-', '@'."""
    if not val:
        return ""
    s = str(val).strip()
    if s and s[0] in ('=', '+', '-', '@', chr(9), chr(13)):
        return "'" + s
    return s


def is_clean_numeric_code(barcode_val: str) -> bool:
    """Returns True if barcode is non-blank, non-zero, and consists purely of digits."""
    s = str(barcode_val).strip()
    if not s or s == "0":
        return False
    # Check if digits only and not all zeros
    return bool(re.fullmatch(r'\d+', s)) and any(c != '0' for c in s)


def clean_decimal(val, default=Decimal('0.00')) -> Decimal:
    """Safely converts string to Decimal, stripping commas or currency signs."""
    if not val:
        return default
    s = str(val).strip().replace(',', '').replace('$', '').replace('₹', '')
    try:
        return Decimal(s)
    except InvalidOperation:
        return default


class Command(BaseCommand):
    help = "Import legacy stock CSV export into Wondersale inventory module."

    def add_arguments(self, parser):
        parser.add_argument('csv_path', type=str, help='Path to legacy CSV file.')
        parser.add_argument(
            '--store',
            type=str,
            default='Main Store',
            help='Store name to assign imported items to (defaults to "Main Store").'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate the import without committing to the database.'
        )

    def handle(self, *args, **options):
        csv_path = options['csv_path']
        store_name = options['store']
        dry_run = options['dry_run']

        if not os.path.exists(csv_path):
            raise CommandError(f"CSV file not found: {csv_path}")

        self.stdout.write(self.style.NOTICE(f"=== Starting Legacy Stock Import: {csv_path} ==="))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN MODE] No database changes will be committed."))

        # Track statistics
        stats = {
            'total_rows': 0,
            'clean_imports': 0,
            'new_barcodes_generated': 0,
            'duplicates_merged': 0,
            'duplicates_reassigned': 0,
            'skipped_invalid': 0,
        }
        action_list_needs_print = []

        try:
            with transaction.atomic():
                # Ensure target Store exists
                store, _ = Store.objects.get_or_create(
                    name=store_name,
                    defaults={'address': 'Primary Retail Location'}
                )

                # In-memory tracking of items created/seen during this import run
                # uid_map: uid -> Item instance
                uid_to_item = {}
                # Pre-populate uid_to_item with existing DB items to guard against collisions
                for existing in Item.objects.filter(store=store):
                    uid_to_item[existing.uid] = existing

                with open(csv_path, mode='r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)

                    # Normalize header field names (strip whitespace and lower/title match)
                    field_map = {}
                    for col in reader.fieldnames or []:
                        clean_col = col.strip().lower()
                        if clean_col in ('s_no', 's.no', 'sno', 'sr_no'):
                            field_map['s_no'] = col
                        elif clean_col in ('category', 'cat'):
                            field_map['category'] = col
                        elif clean_col in ('product', 'product_name', 'item_name', 'name'):
                            field_map['product'] = col
                        elif clean_col in ('barcode', 'bar_code', 'code'):
                            field_map['barcode'] = col
                        elif clean_col in ('qty', 'quantity', 'stock'):
                            field_map['qty'] = col
                        elif clean_col in ('cost_price', 'costprice', 'cost'):
                            field_map['cost_price'] = col
                        elif clean_col in ('sell_price', 'selling_price', 'sellprice', 'price'):
                            field_map['sell_price'] = col

                    for row_num, row in enumerate(reader, start=1):
                        stats['total_rows'] += 1

                        s_no = row.get(field_map.get('s_no', 'S_No'), str(row_num)).strip()
                        cat_name = row.get(field_map.get('category', 'Category'), 'General').strip() or 'General'
                        product_name = sanitize_csv_cell(row.get(field_map.get('product', 'Product'), f'Item {row_num}').strip())
                        raw_barcode = row.get(field_map.get('barcode', 'Barcode'), '').strip()
                        raw_qty = row.get(field_map.get('qty', 'Qty'), '0').strip()
                        raw_cost = row.get(field_map.get('cost_price', 'Cost_Price'), '0.00').strip()
                        raw_sell = row.get(field_map.get('sell_price', 'Sell_Price'), '0.00').strip()

                        try:
                            qty = int(float(raw_qty))
                        except (ValueError, TypeError):
                            qty = 0

                        cost_price = clean_decimal(raw_cost)
                        sell_price = clean_decimal(raw_sell)

                        # Category & SubCategory handling
                        category, _ = Category.objects.get_or_create(name=cat_name)
                        subcategory, _ = SubCategory.objects.get_or_create(
                            category=category,
                            name=f"{cat_name} General" if cat_name.lower() in ['apparel', 'electronics'] else cat_name
                        )

                        # Classification logic
                        if is_clean_numeric_code(raw_barcode):
                            # Clean numeric code candidate
                            target_uid = raw_barcode
                            is_clean_numeric = True
                        else:
                            # Non-numeric, blank, or "0"
                            target_uid = None
                            is_clean_numeric = False

                        # Duplicate & conflict resolution
                        if is_clean_numeric:
                            if target_uid in uid_to_item:
                                existing_item = uid_to_item[target_uid]
                                # Check if it looks like the exact same product (merge)
                                norm_existing = existing_item.name.strip().lower()
                                norm_new = product_name.strip().lower()

                                if norm_existing == norm_new or norm_existing in norm_new or norm_new in norm_existing:
                                    # Merge Qty into existing item via ledger
                                    if qty != 0:
                                        adjust_stock(
                                            item=existing_item,
                                            change=qty,
                                            reason=StockMovement.REASON_INITIAL_IMPORT,
                                            note=f"Merged legacy duplicate CSV row S_No: {s_no}"
                                        )
                                    stats['duplicates_merged'] += 1
                                    continue
                                else:
                                    # Genuinely different product sharing a duplicate code
                                    # Keep existing with original code, generate new UID for this item
                                    new_uid = generate_next_uid()
                                    item = Item.objects.create(
                                        uid=new_uid,
                                        name=product_name,
                                        cost_price=cost_price,
                                        selling_price=sell_price,
                                        mrp=None,  # Defaults to selling_price at read time
                                        store=store,
                                        source=Item.SOURCE_LEGACY,
                                        legacy_uid=raw_barcode,
                                        needs_new_barcode_printed=True
                                    )
                                    item.subcategories.add(subcategory)
                                    uid_to_item[new_uid] = item
                                    if qty != 0:
                                        adjust_stock(
                                            item=item,
                                            change=qty,
                                            reason=StockMovement.REASON_INITIAL_IMPORT,
                                            note=f"Initial import (duplicate code reassigned) S_No: {s_no}"
                                        )
                                    stats['duplicates_reassigned'] += 1
                                    action_list_needs_print.append({
                                        'uid': new_uid,
                                        'name': product_name,
                                        'reason': f"Duplicate code '{raw_barcode}' reassigned"
                                    })
                                    continue
                            else:
                                # Clean direct import
                                item = Item.objects.create(
                                    uid=target_uid,
                                    name=product_name,
                                    cost_price=cost_price,
                                    selling_price=sell_price,
                                    mrp=None,
                                    store=store,
                                    source=Item.SOURCE_LEGACY,
                                    legacy_uid=None,
                                    needs_new_barcode_printed=False
                                )
                                item.subcategories.add(subcategory)
                                uid_to_item[target_uid] = item
                                if qty != 0:
                                    adjust_stock(
                                        item=item,
                                        change=qty,
                                        reason=StockMovement.REASON_INITIAL_IMPORT,
                                        note=f"Initial legacy import S_No: {s_no}"
                                    )
                                stats['clean_imports'] += 1
                        else:
                            # Non-numeric or blank or "0" -> auto-generate new UID
                            new_uid = generate_next_uid()
                            item = Item.objects.create(
                                uid=new_uid,
                                name=product_name,
                                cost_price=cost_price,
                                selling_price=sell_price,
                                mrp=None,
                                store=store,
                                source=Item.SOURCE_LEGACY,
                                legacy_uid=raw_barcode if raw_barcode and raw_barcode != "0" else None,
                                needs_new_barcode_printed=True
                            )
                            item.subcategories.add(subcategory)
                            uid_to_item[new_uid] = item
                            if qty != 0:
                                adjust_stock(
                                    item=item,
                                    change=qty,
                                    reason=StockMovement.REASON_INITIAL_IMPORT,
                                    note=f"Initial import (no legacy barcode) S_No: {s_no}"
                                )
                            stats['new_barcodes_generated'] += 1
                            action_list_needs_print.append({
                                'uid': new_uid,
                                'name': product_name,
                                'reason': f"Invalid or missing legacy code ('{raw_barcode}')"
                            })

                if dry_run:
                    # Rollback transaction in dry run mode
                    transaction.set_rollback(True)

        except Exception as e:
            raise CommandError(f"Import aborted due to error on row {stats['total_rows']}: {e}")

        # Summary Log
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("=== LEGACY STOCK IMPORT SUMMARY ==="))
        self.stdout.write("=" * 60)
        self.stdout.write(f"Total Rows Processed:          {stats['total_rows']}")
        self.stdout.write(self.style.SUCCESS(f"Clean Imports (reused barcode): {stats['clean_imports']}"))
        self.stdout.write(self.style.WARNING(f"New Barcodes Auto-Generated:   {stats['new_barcodes_generated']}"))
        self.stdout.write(self.style.NOTICE(f"Duplicates Merged (same item):  {stats['duplicates_merged']}"))
        self.stdout.write(self.style.WARNING(f"Duplicates Reassigned (new UID):{stats['duplicates_reassigned']}"))
        self.stdout.write("-" * 60)

        total_needs_print = len(action_list_needs_print)
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"ACTION LIST FOR STORE STAFF: {total_needs_print} NEW BARCODE LABELS TO PRINT"
            )
        )
        if total_needs_print > 0:
            for idx, item in enumerate(action_list_needs_print[:25], start=1):
                self.stdout.write(
                    f"  [{idx}] UID: {item['uid']} | Product: {item['name']} | Reason: {item['reason']}"
                )
            if total_needs_print > 25:
                self.stdout.write(f"  ... and {total_needs_print - 25} more items flagged in database.")
        self.stdout.write("=" * 60 + "\n")
