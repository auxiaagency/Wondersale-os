from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from inventory.models import Store, Category, SubCategory, Item, StockMovement, ItemImage


class InventoryModelTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(name="Flagship Store", address="123 High Street")
        self.category1 = Category.objects.create(name="Apparel")
        self.category2 = Category.objects.create(name="Accessories")

    def test_item_effective_mrp(self):
        # Case 1: mrp is null -> effective_mrp equals selling_price
        item_null_mrp = Item.objects.create(
            uid="TEST001",
            name="Classic T-Shirt",
            cost_price=Decimal("400.00"),
            selling_price=Decimal("799.00"),
            mrp=None,
            store=self.store
        )
        self.assertIsNone(item_null_mrp.mrp)
        self.assertEqual(item_null_mrp.effective_mrp, Decimal("799.00"))

        # Case 2: mrp is set -> effective_mrp equals mrp
        item_with_mrp = Item.objects.create(
            uid="TEST002",
            name="Premium Jacket",
            cost_price=Decimal("1200.00"),
            selling_price=Decimal("2499.00"),
            mrp=Decimal("2999.00"),
            store=self.store
        )
        self.assertEqual(item_with_mrp.effective_mrp, Decimal("2999.00"))

    def test_single_primary_image_enforcement(self):
        item = Item.objects.create(
            uid="TEST003",
            name="Cap",
            cost_price=Decimal("150.00"),
            selling_price=Decimal("350.00"),
            store=self.store
        )
        # Dummy 1x1 GIF
        dummy_gif = (
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff'
            b'\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00'
            b'\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        )
        img1 = ItemImage.objects.create(
            item=item,
            image=SimpleUploadedFile("img1.gif", dummy_gif, content_type="image/gif"),
            is_primary=True,
            order=0
        )
        self.assertTrue(img1.is_primary)

        # Create second image as primary -> first image should automatically become non-primary
        img2 = ItemImage.objects.create(
            item=item,
            image=SimpleUploadedFile("img2.gif", dummy_gif, content_type="image/gif"),
            is_primary=True,
            order=1
        )
        img1.refresh_from_db()
        self.assertFalse(img1.is_primary)
        self.assertTrue(img2.is_primary)

    def test_category_subcategory_item_hierarchy(self):
        cat_apparel = self.category1
        cat_sports = Category.objects.create(name="Sports")

        sub_men = SubCategory.objects.create(category=cat_apparel, name="Men's Wear")
        sub_active = SubCategory.objects.create(category=cat_sports, name="Activewear")

        item = Item.objects.create(
            uid="TEST004",
            name="Running Shorts",
            cost_price=Decimal("200.00"),
            selling_price=Decimal("499.00"),
            store=self.store
        )
        item.subcategories.add(sub_men, sub_active)

        self.assertEqual(item.subcategories.count(), 2)
        parent_cats = list(item.parent_categories)
        self.assertEqual(len(parent_cats), 2)
        self.assertIn(cat_apparel, parent_cats)
        self.assertIn(cat_sports, parent_cats)
