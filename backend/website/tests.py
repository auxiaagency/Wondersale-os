from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item
from website.models import Customer, CustomerOTP, WebsiteOrder, WebsiteOrderItem


class WebsiteAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Main Store", address="123 Street")
        self.category = Category.objects.create(name="Electronics", description="Gadgets")
        self.subcategory = SubCategory.objects.create(category=self.category, name="Smartphones")

        # Create listed item
        self.listed_item = Item.objects.create(
            store=self.store,
            name="Wonder Phone X",
            uid="WPHONE-X-001",
            cost_price=Decimal("10000.00"),
            selling_price=Decimal("14999.00"),
            mrp=Decimal("16999.00"),
            quantity=15,
            is_listed_on_website=True,
            description="Flagship smartphone",
        )
        self.listed_item.subcategories.add(self.subcategory)

        # Create unlisted item
        self.unlisted_item = Item.objects.create(
            store=self.store,
            name="Secret Internal Stock",
            uid="SECRET-001",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            mrp=Decimal("120.00"),
            quantity=5,
            is_listed_on_website=False,
        )

    def test_products_list_only_returns_listed_items(self):
        response = self.client.get('/api/website/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['uid'], "WPHONE-X-001")
        self.assertEqual(results[0]['name'], "Wonder Phone X")

    def test_product_detail_success_for_listed(self):
        response = self.client.get(f'/api/website/products/{self.listed_item.uid}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['uid'], "WPHONE-X-001")

    def test_product_detail_404_for_unlisted(self):
        response = self.client.get(f'/api/website/products/{self.unlisted_item.uid}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_categories_list(self):
        response = self.client.get('/api/website/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Electronics")
        self.assertEqual(response.data[0]['items_count'], 1)

    def test_otp_flow_and_customer_auth(self):
        # 1. Request OTP
        req_res = self.client.post('/api/website/auth/otp/request/', {'mobile': '9876543210'})
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)
        self.assertEqual(req_res.data['mobile'], '9876543210')

        # 2. Verify OTP
        ver_res = self.client.post('/api/website/auth/otp/verify/', {
            'mobile': '9876543210',
            'code': '123456',
            'name': 'Rahul Sharma'
        })
        self.assertEqual(ver_res.status_code, status.HTTP_200_OK)
        token = ver_res.data.get('token')
        self.assertTrue(token)
        self.assertEqual(ver_res.data['customer']['mobile'], '9876543210')
        self.assertEqual(ver_res.data['customer']['name'], 'Rahul Sharma')

    def test_order_creation_and_tracking(self):
        # Place order
        order_payload = {
            'mobile': '9876543210',
            'customer_name': 'Rahul Sharma',
            'delivery_address': {
                'address_line': 'Flat 101, Galaxy Apts',
                'city': 'Mumbai',
                'pincode': '400001'
            },
            'items': [
                {'item_id': self.listed_item.id, 'quantity': 2}
            ],
            'payment_method': 'COD'
        }
        res = self.client.post('/api/website/orders/', order_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tracking_id = res.data['tracking_id']
        self.assertTrue(tracking_id)
        self.assertEqual(Decimal(str(res.data['order']['total_amount'])), Decimal("29998.00"))

        # Track order
        track_res = self.client.get(f'/api/website/orders/track/{tracking_id}/')
        self.assertEqual(track_res.status_code, status.HTTP_200_OK)
        self.assertEqual(track_res.data['status'], 'PENDING')
        self.assertEqual(len(track_res.data['items']), 1)

    def test_admin_orders_and_stats(self):
        # Create an order first
        customer = Customer.objects.create(mobile="9999999999", name="Test Admin Cust")
        order = WebsiteOrder.objects.create(
            order_number="WS-TEST-1",
            tracking_id="TRK-TEST-1",
            customer=customer,
            total_amount=Decimal("500.00"),
            status="PENDING"
        )

        # Test admin stats
        stats_res = self.client.get('/api/website/admin/stats/')
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res.data['total_listed_items'], 1)
        self.assertEqual(stats_res.data['total_orders'], 1)
        self.assertEqual(stats_res.data['pending_orders'], 1)

        # Test admin order status update
        patch_res = self.client.patch(f'/api/website/admin/orders/{order.id}/', {
            'status': 'CONFIRMED'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['status'], 'CONFIRMED')
