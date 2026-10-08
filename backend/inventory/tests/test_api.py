import io
from decimal import Decimal
from PIL import Image
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item, StockMovement, Customer, Supplier


class InventoryAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="API Test Store")
        self.category = Category.objects.create(name="Electronics")
        self.subcategory = SubCategory.objects.create(category=self.category, name="Peripherals")
        self.item = Item.objects.create(
            uid="1000000",
            name="Wireless Mouse",
            cost_price=Decimal("300.00"),
            selling_price=Decimal("600.00"),
            mrp=Decimal("750.00"),
            store=self.store
        )
        self.item.subcategories.add(self.subcategory)

    def test_list_items(self):
        url = reverse('item-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['uid'], "1000000")
        self.assertEqual(response.data[0]['effective_mrp'], "750.00")
        # Subcategories & derived categories in response
        self.assertEqual(len(response.data[0]['subcategories']), 1)
        self.assertEqual(response.data[0]['subcategories'][0]['name'], "Peripherals")
        self.assertEqual(len(response.data[0]['categories']), 1)
        self.assertEqual(response.data[0]['categories'][0]['name'], "Electronics")

    def test_search_items(self):
        url = reverse('item-list')
        response = self.client.get(url, {'search': 'Mouse'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        response_empty = self.client.get(url, {'search': 'NonexistentProduct'})
        self.assertEqual(len(response_empty.data), 0)

    def test_filter_by_parent_category_and_subcategory(self):
        cat2 = Category.objects.create(name="Apparel")
        sub2 = SubCategory.objects.create(category=cat2, name="Shoes")
        item2 = Item.objects.create(
            uid="1000002",
            name="Running Shoes",
            cost_price=Decimal("800.00"),
            selling_price=Decimal("1500.00"),
            store=self.store
        )
        item2.subcategories.add(sub2)

        # Filter by parent category
        url = reverse('item-list')
        res_cat1 = self.client.get(url, {'category': self.category.id})
        self.assertEqual(len(res_cat1.data), 1)
        self.assertEqual(res_cat1.data[0]['uid'], "1000000")

        # Filter by subcategory
        res_sub2 = self.client.get(url, {'subcategory': sub2.id})
        self.assertEqual(len(res_sub2.data), 1)
        self.assertEqual(res_sub2.data[0]['uid'], "1000002")

    def test_create_item_auto_generates_uid_and_initial_stock(self):
        url = reverse('item-list')
        payload = {
            'name': 'Ergonomic Keyboard',
            'cost_price': '1200.00',
            'selling_price': '2200.00',
            'store': self.store.id,
            'subcategories': [self.subcategory.id],
            'initial_quantity': 25
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Ergonomic Keyboard')
        self.assertEqual(response.data['uid'], '1000001')

        new_item = Item.objects.get(uid='1000001')
        self.assertEqual(new_item.quantity, 25)
        self.assertEqual(new_item.subcategories.count(), 1)
        self.assertEqual(new_item.stock_movements.count(), 1)
        self.assertEqual(new_item.stock_movements.first().change, 25)

    def test_adjust_stock_endpoint(self):
        url = reverse('item-adjust-stock-action', kwargs={'pk': self.item.id})
        payload = {
            'change': 15,
            'reason': StockMovement.REASON_RESTOCK,
            'note': 'Supplier shipment arrived'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 15)

    def test_barcode_endpoint_returns_png(self):
        url = reverse('item-barcode-action', kwargs={'pk': self.item.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'image/png')
        self.assertTrue(response.content.startswith(b'\x89PNG'))

    def test_by_uid_scanner_lookup(self):
        url = reverse('item-by-uid', kwargs={'uid': '1000000'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "Wireless Mouse")

        url_404 = reverse('item-by-uid', kwargs={'uid': '9999999'})
        response_404 = self.client.get(url_404)
        self.assertEqual(response_404.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_images_converts_to_webp(self):
        img = Image.new('RGB', (100, 100), color='blue')
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)

        uploaded = SimpleUploadedFile("product.jpg", buf.getvalue(), content_type="image/jpeg")
        url = reverse('item-upload-images', kwargs={'pk': self.item.id})
        response = self.client.post(url, {'images': [uploaded]}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.images.count(), 1)
        created_image = self.item.images.first()
        self.assertTrue(created_image.image.name.endswith('.webp'))
        self.assertTrue(created_image.is_primary)

    def test_subcategory_crud_endpoints(self):
        # List subcategories
        url = reverse('subcategory-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Create subcategory
        create_payload = {
            'category': self.category.id,
            'name': 'Keyboards'
        }
        res_create = self.client.post(url, create_payload, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_create.data['name'], 'Keyboards')
        new_sub_id = res_create.data['id']

        # Update subcategory
        detail_url = reverse('subcategory-detail', kwargs={'pk': new_sub_id})
        res_update = self.client.put(detail_url, {'category': self.category.id, 'name': 'Mechanical Keyboards'}, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(res_update.data['name'], 'Mechanical Keyboards')

        # Delete subcategory
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

    def test_store_allow_manual_uid_toggle(self):
        store_url = reverse('store-detail', kwargs={'pk': self.store.id})
        res = self.client.patch(store_url, {'allow_manual_uid': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.store.refresh_from_db()
        self.assertTrue(self.store.allow_manual_uid)

    def test_create_item_with_custom_uid(self):
        url = reverse('item-list')
        payload = {
            'name': 'Legacy Barcode Item',
            'uid': 'OLD-SKU-999',
            'cost_price': '500.00',
            'selling_price': '850.00',
            'store': self.store.id,
            'subcategories': [self.subcategory.id],
            'initial_quantity': 10
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['uid'], 'OLD-SKU-999')
        item = Item.objects.get(uid='OLD-SKU-999')
        self.assertEqual(item.name, 'Legacy Barcode Item')

    def test_create_item_duplicate_uid_fails(self):
        url = reverse('item-list')
        payload = {
            'name': 'Duplicate UID Item',
            'uid': '1000000',  # already exists from setUp
            'cost_price': '500.00',
            'selling_price': '850.00',
            'store': self.store.id,
            'subcategories': [self.subcategory.id],
            'initial_quantity': 5
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('uid', res.data)

    def test_customer_store_isolation(self):
        store_bhopal = Store.objects.create(name="Bhopal Plaza")
        store_indore = Store.objects.create(name="Indore Branch")

        cust_bhopal = Customer.objects.create(
            phone="9876500001",
            name="Bhopal Customer",
            store=store_bhopal
        )
        cust_indore = Customer.objects.create(
            phone="9876500002",
            name="Indore Customer",
            store=store_indore
        )

        list_url = reverse('customer-list')

        # Bhopal store filter should only show Bhopal Customer
        res_bhopal = self.client.get(list_url, {'store': store_bhopal.id})
        self.assertEqual(res_bhopal.status_code, status.HTTP_200_OK)
        bhopal_phones = [c['phone'] for c in res_bhopal.data]
        self.assertIn("9876500001", bhopal_phones)
        self.assertNotIn("9876500002", bhopal_phones)

        # Indore store filter should only show Indore Customer
        res_indore = self.client.get(list_url, {'store': store_indore.id})
        self.assertEqual(res_indore.status_code, status.HTTP_200_OK)
        indore_phones = [c['phone'] for c in res_indore.data]
        self.assertIn("9876500002", indore_phones)
        self.assertNotIn("9876500001", indore_phones)

        # Autocomplete Lookup isolated by store
        lookup_url = reverse('customer-lookup')
        lookup_bhopal = self.client.get(lookup_url, {'q': '98765', 'store': store_bhopal.id})
        self.assertEqual(lookup_bhopal.status_code, status.HTTP_200_OK)
        lookup_bhopal_phones = [c['phone'] for c in lookup_bhopal.data]
        self.assertIn("9876500001", lookup_bhopal_phones)
        self.assertNotIn("9876500002", lookup_bhopal_phones)

        lookup_indore = self.client.get(lookup_url, {'q': '98765', 'store': store_indore.id})
        self.assertEqual(lookup_indore.status_code, status.HTTP_200_OK)
        lookup_indore_phones = [c['phone'] for c in lookup_indore.data]
        self.assertIn("9876500002", lookup_indore_phones)
        self.assertNotIn("9876500001", lookup_indore_phones)

    def test_stock_movement_time_range_filtering(self):
        from datetime import datetime, timedelta
        from django.utils import timezone
        from inventory.models import CounterPayout

        now = timezone.now()
        t1 = now - timedelta(hours=3)
        t2 = now - timedelta(minutes=10)
        t3 = now + timedelta(hours=2)

        sm1 = StockMovement.objects.create(
            item=self.item,
            change=5,
            reason=StockMovement.REASON_RESTOCK,
            note="Old movement"
        )
        StockMovement.objects.filter(id=sm1.id).update(created_at=t1)

        sm2 = StockMovement.objects.create(
            item=self.item,
            change=-2,
            reason=StockMovement.REASON_SALE,
            note="Recent movement"
        )
        StockMovement.objects.filter(id=sm2.id).update(created_at=t2)

        # 1. Query stock movements with a window around t2 (±15 mins)
        start_iso = (t2 - timedelta(minutes=15)).isoformat()
        end_iso = (t2 + timedelta(minutes=15)).isoformat()

        res = self.client.get(reverse('stock-movement-list'), {'start_time': start_iso, 'end_time': end_iso})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [m['id'] for m in res.data]
        self.assertIn(sm2.id, ids)
        self.assertNotIn(sm1.id, ids)

        # 2. Test ItemDetail action endpoint: items/{id}/stock-movements/
        item_sm_url = reverse('item-stock-movements', kwargs={'pk': self.item.id})
        res_item = self.client.get(item_sm_url, {'start_time': start_iso, 'end_time': end_iso})
        self.assertEqual(res_item.status_code, status.HTTP_200_OK)
        item_ids = [m['id'] for m in res_item.data]
        self.assertIn(sm2.id, item_ids)
        self.assertNotIn(sm1.id, item_ids)

        # 3. Test Counter Payout time filtering
        p1 = CounterPayout.objects.create(
            payout_number="PAY-TEST-001",
            store=self.store,
            amount=Decimal("150.00"),
            paid_to="Tea Stall",
            reason="Refreshments",
            paid_at=t1
        )
        p2 = CounterPayout.objects.create(
            payout_number="PAY-TEST-002",
            store=self.store,
            amount=Decimal("500.00"),
            paid_to="Delivery Agent",
            reason="Courier Freight",
            paid_at=t2
        )

        res_payout = self.client.get(reverse('counter-payout-list'), {'start_time': start_iso, 'end_time': end_iso})
        self.assertEqual(res_payout.status_code, status.HTTP_200_OK)
        payout_ids = [p['id'] for p in res_payout.data]
        self.assertIn(p2.id, payout_ids)
        self.assertNotIn(p1.id, payout_ids)

    def test_product_analytics_endpoint(self):
        # 1. Update prices on the item to generate price history
        self.item.cost_price = Decimal("350.00")
        self.item.selling_price = Decimal("600.00")
        self.item.save()

        # 2. Call product-analytics endpoint
        url = reverse('item-product-analytics', kwargs={'pk': self.item.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertIn('item', data)
        self.assertIn('performance', data)
        self.assertIn('subcategory_analysis', data)
        self.assertIn('price_history', data)
        self.assertIn('timeline', data)

        # Verify price history has records
        self.assertGreaterEqual(len(data['price_history']), 1)
        latest_ph = data['price_history'][-1]
        self.assertEqual(latest_ph['cost_price'], 350.0)
        self.assertEqual(latest_ph['selling_price'], 600.0)

        # Verify timeline structure
        timeline_levels = data['timeline']['levels']
        self.assertIn('year', timeline_levels)
        self.assertIn('month', timeline_levels)
        self.assertIn('week', timeline_levels)
        self.assertIn('day', timeline_levels)

        # Verify new rankings, valuation, and worst periods
        self.assertIn('rankings', data)
        self.assertIn('by_units', data['rankings'])
        self.assertIn('by_revenue', data['rankings'])
        self.assertIn('by_profit', data['rankings'])
        self.assertIn('stock_valuation_cost', data['item'])
        self.assertIn('stock_valuation_retail', data['item'])
        self.assertIn('worst_month', data['performance'])
        self.assertIn('primary_subcategory', data['item'])

    def test_create_item_with_explicit_primary_subcategory(self):
        cat = Category.objects.create(name="Sports")
        sub1 = SubCategory.objects.create(category=cat, name="Cricket")
        sub2 = SubCategory.objects.create(category=cat, name="Gear")

        url = reverse('item-list')
        payload = {
            'name': 'Cricket Bat',
            'cost_price': '1000.00',
            'selling_price': '2000.00',
            'store': self.store.id,
            'subcategories': [sub1.id, sub2.id],
            'primary_subcategory': sub2.id,
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        item = Item.objects.get(id=res.data['id'])
        self.assertEqual(item.primary_subcategory_id, sub2.id)
        self.assertEqual(item.effective_primary_subcategory.id, sub2.id)
        self.assertEqual(item.effective_primary_category.id, cat.id)
        self.assertEqual(set(item.subcategories.values_list('id', flat=True)), {sub1.id, sub2.id})
        self.assertEqual(res.data['primary_subcategory']['id'], sub2.id)

    def test_create_item_fallback_primary_to_first_subcategory(self):
        cat = Category.objects.create(name="Home")
        sub1 = SubCategory.objects.create(category=cat, name="Kitchen")
        sub2 = SubCategory.objects.create(category=cat, name="Dining")

        url = reverse('item-list')
        payload = {
            'name': 'Spoon Set',
            'cost_price': '150.00',
            'selling_price': '300.00',
            'store': self.store.id,
            'subcategories': [sub1.id, sub2.id],
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        item = Item.objects.get(id=res.data['id'])
        self.assertEqual(item.primary_subcategory_id, sub1.id)
        self.assertEqual(res.data['primary_subcategory']['id'], sub1.id)

    def test_update_item_primary_subcategory(self):
        cat = Category.objects.create(name="Stationery")
        sub1 = SubCategory.objects.create(category=cat, name="Pens")
        sub2 = SubCategory.objects.create(category=cat, name="Notebooks")
        item = Item.objects.create(
            name="Gel Pen",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            store=self.store,
            primary_subcategory=sub1
        )
        item.subcategories.set([sub1, sub2])

        url = reverse('item-detail', kwargs={'pk': item.id})
        patch_res = self.client.patch(url, {'primary_subcategory': sub2.id})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.primary_subcategory_id, sub2.id)

    def test_supplier_crud_and_item_link(self):
        # 1. Create Supplier
        url = reverse('supplier-list')
        payload = {
            'name': 'Acme Global Traders',
            'contact_person': 'John Doe',
            'phone': '+91 9876543210',
            'email': 'john@acme.com',
            'address': 'Plot 42, Tech Park',
            'gst_number': '27ABCDE1234F1Z5',
            'store': self.store.id,
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        supplier_id = res.data['id']
        self.assertEqual(res.data['name'], 'Acme Global Traders')

        # 2. Create Item with Supplier
        item_url = reverse('item-list')
        item_payload = {
            'name': 'Industrial Power Drill',
            'cost_price': '1500.00',
            'selling_price': '2500.00',
            'store': self.store.id,
            'supplier': supplier_id,
            'initial_quantity': 10,
        }
        item_res = self.client.post(item_url, item_payload, format='json')
        self.assertEqual(item_res.status_code, status.HTTP_201_CREATED)
        item_id = item_res.data['id']
        self.assertEqual(item_res.data['supplier'], supplier_id)
        self.assertEqual(item_res.data['supplier_name'], 'Acme Global Traders')

        # 3. Filter Items by Supplier
        filter_res = self.client.get(item_url, {'supplier': supplier_id})
        self.assertEqual(len(filter_res.data), 1)
        self.assertEqual(filter_res.data[0]['id'], item_id)

        # 4. Filter Items by has_no_supplier
        no_supplier_res = self.client.get(item_url, {'has_no_supplier': 'true'})
        self.assertTrue(any(i['id'] == self.item.id for i in no_supplier_res.data))
        self.assertFalse(any(i['id'] == item_id for i in no_supplier_res.data))

        # 5. Delete Supplier - Item.supplier should be set to null (SET_NULL)
        supplier_detail_url = reverse('supplier-detail', kwargs={'pk': supplier_id})
        del_res = self.client.delete(supplier_detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

        item = Item.objects.get(id=item_id)
        self.assertIsNone(item.supplier)
        self.assertEqual(item.quantity, 10)  # item remains intact





