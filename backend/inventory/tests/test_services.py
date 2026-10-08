import io
from decimal import Decimal
from PIL import Image
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from inventory.models import Store, Item, StockMovement
from inventory.services import (
    adjust_stock,
    generate_next_uid,
    convert_image_to_webp,
    generate_barcode_image,
)


class InventoryServiceTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(name="Service Test Store")
        self.item = Item.objects.create(
            uid="900000",
            name="Testing Item",
            cost_price=Decimal("100.00"),
            selling_price=Decimal("200.00"),
            store=self.store
        )

    def test_adjust_stock_increases_and_decreases(self):
        # Initial stock should be 0
        self.assertEqual(self.item.quantity, 0)

        # Inward stock
        m1 = adjust_stock(
            item=self.item,
            change=50,
            reason=StockMovement.REASON_RESTOCK,
            note="Restocked from supplier"
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 50)
        self.assertEqual(m1.change, 50)

        # Deduction (damaged)
        m2 = adjust_stock(
            item=self.item,
            change=-5,
            reason=StockMovement.REASON_DAMAGE,
            note="Damaged box"
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 45)
        self.assertEqual(m2.change, -5)

        # Check movements count
        self.assertEqual(self.item.stock_movements.count(), 2)

    def test_generate_next_uid_starts_at_million_and_increments(self):
        # When no items >= 1000000 exist
        uid1 = generate_next_uid()
        self.assertEqual(uid1, "1000000")

        # Create item with that UID
        Item.objects.create(
            uid=uid1,
            name="Item 1M",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            store=self.store
        )

        # Next should be 1000001
        uid2 = generate_next_uid()
        self.assertEqual(uid2, "1000001")

    def test_convert_image_to_webp(self):
        # Create an in-memory PNG
        img = Image.new('RGBA', (60, 60), color=(255, 0, 0, 128))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        uploaded = SimpleUploadedFile("sample.png", buffer.getvalue(), content_type="image/png")
        converted_file = convert_image_to_webp(uploaded)

        self.assertTrue(converted_file.name.endswith('.webp'))
        # Verify it can be opened as WebP
        result_img = Image.open(converted_file)
        self.assertEqual(result_img.format, 'WEBP')
        self.assertEqual(result_img.mode, 'RGBA')

    def test_generate_barcode_image(self):
        buffer = generate_barcode_image("1000000")
        self.assertIsNotNone(buffer)
        buffer.seek(0)
        # Check PNG header bytes
        header = buffer.read(8)
        self.assertEqual(header[:4], b'\x89PNG')

    def test_create_product_variant_copies_photos_and_ensures_unique_uid(self):
        from inventory.services import create_product_variant
        from inventory.models import ItemImage

        # Create source item with dimensions, description, supplier, and image
        source = Item.objects.create(
            uid="1000010",
            name="Scissor Bottle Big",
            cost_price=Decimal("25.00"),
            selling_price=Decimal("33.75"),
            mrp=Decimal("33.75"),
            store=self.store,
            length=Decimal("12.00"),
            width=Decimal("12.00"),
            height=Decimal("12.00"),
            weight=Decimal("350.00"),
            description="Professional salon bottle",
        )
        ItemImage.objects.create(
            item=source,
            image="item_images/test_bottle.webp",
            is_primary=True,
            order=0,
        )

        # Create variant with changed cost price
        variant = create_product_variant(
            source_item=source,
            variant_data={
                'variant_name': 'Nov Batch',
                'cost_price': Decimal('30.00'),
                'initial_quantity': 15,
            },
        )

        # 1. Verify UID is strictly unique and not equal to source
        self.assertNotEqual(variant.uid, source.uid)
        self.assertTrue(len(variant.uid) >= 7)

        # 2. Verify all photos are copied
        self.assertEqual(variant.images.count(), 1)
        copied_img = variant.images.first()
        self.assertEqual(copied_img.image.name, "item_images/test_bottle.webp")
        self.assertTrue(copied_img.is_primary)

        # 3. Verify all other attributes are identically copied
        self.assertEqual(variant.name, source.name)
        self.assertEqual(variant.length, Decimal("12.00"))
        self.assertEqual(variant.width, Decimal("12.00"))
        self.assertEqual(variant.height, Decimal("12.00"))
        self.assertEqual(variant.weight, Decimal("350.00"))
        self.assertEqual(variant.description, "Professional salon bottle")
        self.assertEqual(variant.variant_group_id, source.variant_group_id)
        self.assertFalse(variant.is_master_variant)
        self.assertEqual(variant.cost_price, Decimal("30.00"))  # the changed field
        self.assertEqual(variant.quantity, 15)

