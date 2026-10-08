import io
import os
from decimal import Decimal
from django.test import TestCase
from django.core.management import call_command
from inventory.models import Store, Category, Item, StockMovement


class ImportLegacyStockCommandTests(TestCase):
    def test_import_legacy_stock_sample_csv(self):
        fixture_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'sample_legacy_stock.csv'
        )
        self.assertTrue(os.path.exists(fixture_path), f"Fixture not found at {fixture_path}")

        out = io.StringIO()
        call_command('import_legacy_stock', fixture_path, store='Test Retail Store', stdout=out)
        output = out.getvalue()

        # Check summary output
        self.assertIn("LEGACY STOCK IMPORT SUMMARY", output)
        self.assertIn("Total Rows Processed:          10", output)

        # 1. Clean shop numeric: 10245 (T-Shirt) appeared twice with same name (rows 1 & 9)
        # It should have merged quantities: 15 + 5 = 20
        tshirt = Item.objects.get(uid='10245')
        self.assertEqual(tshirt.name, "Classic Cotton T-Shirt Navy M")
        self.assertEqual(tshirt.quantity, 20)
        self.assertEqual(tshirt.source, Item.SOURCE_LEGACY)
        self.assertFalse(tshirt.needs_new_barcode_printed)
        # Should have 2 stock movements
        self.assertEqual(tshirt.stock_movements.count(), 2)

        # 2. Clean manufacturer 13-digit barcode: 8901234567890 (Earbuds)
        earbuds = Item.objects.get(uid='8901234567890')
        self.assertEqual(earbuds.quantity, 20)
        self.assertFalse(earbuds.needs_new_barcode_printed)

        # 3. Duplicate code 10247 for DIFFERENT products:
        # Row 4: Executive Leather Notebook A5 (keeps 10247)
        # Row 10: Premium Gel Pen Blue 0.5 (reassigned to new UID >= 1000000)
        notebook = Item.objects.get(uid='10247')
        self.assertEqual(notebook.name, "Executive Leather Notebook A5")
        self.assertFalse(notebook.needs_new_barcode_printed)

        pen = Item.objects.get(name="Premium Gel Pen Blue 0.5")
        self.assertTrue(int(pen.uid) >= 1000000)
        self.assertTrue(pen.needs_new_barcode_printed)
        self.assertEqual(pen.legacy_uid, "10247")
        self.assertEqual(pen.quantity, 50)

        # 4. Non-numeric barcodes: "Tote Bag 1", "Sipper"
        tote = Item.objects.get(name="Eco Canvas Tote Bag 1")
        self.assertTrue(int(tote.uid) >= 1000000)
        self.assertTrue(tote.needs_new_barcode_printed)
        self.assertEqual(tote.legacy_uid, "Tote Bag 1")
        self.assertEqual(tote.quantity, 12)

        # 5. Literal "0" barcode: "Ceramic Coffee Mug Matte"
        mug = Item.objects.get(name="Ceramic Coffee Mug Matte")
        self.assertTrue(int(mug.uid) >= 1000000)
        self.assertTrue(mug.needs_new_barcode_printed)
        self.assertEqual(mug.quantity, 30)

        # 6. Blank barcode: "Comfort Running Shoes Grey 9"
        shoes = Item.objects.get(name="Comfort Running Shoes Grey 9")
        self.assertTrue(int(shoes.uid) >= 1000000)
        self.assertTrue(shoes.needs_new_barcode_printed)
        self.assertEqual(shoes.quantity, 10)

        # Verify all stock ledger entries are present and derived quantity matches
        for item in Item.objects.all():
            ledger_sum = sum(m.change for m in item.stock_movements.all())
            self.assertEqual(item.quantity, ledger_sum)
