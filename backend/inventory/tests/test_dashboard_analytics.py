from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import (
    Store,
    Category,
    SubCategory,
    Item,
    SaleOrder,
    SaleOrderItem,
)
from inventory.dashboard_services import get_dashboard_analytics


class DashboardAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Bhopal Superstore", city="Bhopal")
        self.other_store = Store.objects.create(name="Indore Branch", city="Indore")

        self.cat_apparel = Category.objects.create(name="Apparel")
        self.sub_casual = SubCategory.objects.create(category=self.cat_apparel, name="Casuals")
        self.sub_formal = SubCategory.objects.create(category=self.cat_apparel, name="Formals")

        self.cat_fmcg = Category.objects.create(name="Groceries")
        self.sub_beverages = SubCategory.objects.create(category=self.cat_fmcg, name="Beverages")

        # 1. Best-selling item (will be sold heavily, current stock 0 -> Out of Stock)
        self.item_best = Item.objects.create(
            uid="WS-DSH-01",
            name="Classic Denim Jeans",
            quantity=0,  # Now depleted
            cost_price=Decimal("500.00"),
            selling_price=Decimal("1200.00"),
            mrp=Decimal("1500.00"),
            store=self.store,
        )
        self.item_best.subcategories.add(self.sub_casual)

        # 2. Moderate-selling item (sold 5, current stock 3 -> Critically Low)
        self.item_moderate = Item.objects.create(
            uid="WS-DSH-02",
            name="Oxford Cotton Shirt",
            quantity=3,  # Critically low
            cost_price=Decimal("350.00"),
            selling_price=Decimal("700.00"),
            mrp=Decimal("900.00"),
            store=self.store,
        )
        self.item_moderate.subcategories.add(self.sub_formal)

        # 3. Slow-moving / Zero-sales item (stock 50, sold 0 -> Dead Stock)
        self.item_dead_stock = Item.objects.create(
            uid="WS-DSH-03",
            name="Winter Woolen Scarf",
            quantity=50,
            cost_price=Decimal("200.00"),
            selling_price=Decimal("450.00"),
            mrp=Decimal("500.00"),
            store=self.store,
        )
        self.item_dead_stock.subcategories.add(self.sub_casual)

        # Create sales in Sep 2026
        dt_sep = timezone.make_aware(timezone.datetime(2026, 9, 15, 14, 30, 0))

        # Order 1: 10 denim jeans
        order1 = SaleOrder.objects.create(
            invoice_number="INV-TEST-0001",
            store=self.store,
            customer_phone="9998887771",
            customer_name="Buyer One",
            payment_method="cash",
            subtotal=Decimal("12000.00"),
            total_amount=Decimal("12000.00"),
            status="completed",
        )
        order1.created_at = dt_sep
        order1.save()

        SaleOrderItem.objects.create(
            sale_order=order1,
            item=self.item_best,
            item_name=self.item_best.name,
            item_uid=self.item_best.uid,
            unit_cost_price=self.item_best.cost_price,
            unit_selling_price=self.item_best.selling_price,
            quantity=10,
            total_price=Decimal("12000.00"),
        )

        # Order 2: 5 denim jeans + 5 oxford shirts
        order2 = SaleOrder.objects.create(
            invoice_number="INV-TEST-0002",
            store=self.store,
            customer_phone="9998887772",
            customer_name="Buyer Two",
            payment_method="upi",
            subtotal=Decimal("9500.00"),
            total_amount=Decimal("9500.00"),
            status="completed",
        )
        order2.created_at = dt_sep
        order2.save()

        SaleOrderItem.objects.create(
            sale_order=order2,
            item=self.item_best,
            item_name=self.item_best.name,
            item_uid=self.item_best.uid,
            unit_cost_price=self.item_best.cost_price,
            unit_selling_price=self.item_best.selling_price,
            quantity=5,
            total_price=Decimal("6000.00"),
        )
        SaleOrderItem.objects.create(
            sale_order=order2,
            item=self.item_moderate,
            item_name=self.item_moderate.name,
            item_uid=self.item_moderate.uid,
            unit_cost_price=self.item_moderate.cost_price,
            unit_selling_price=self.item_moderate.selling_price,
            quantity=5,
            total_price=Decimal("3500.00"),
        )

    def test_service_computes_analytics_correctly(self):
        analytics = get_dashboard_analytics(store_id=self.store.id, year=2026, month=9)

        # 1. Overview
        overview = analytics['overview']
        self.assertEqual(Decimal(str(overview['total_revenue'])), Decimal("21500.00"))
        self.assertEqual(overview['total_units_sold'], 20)
        self.assertEqual(overview['total_orders_count'], 2)

        # 2. Best-selling products
        best_sellers = analytics['best_selling_products']
        self.assertTrue(len(best_sellers) >= 2)
        top_product = best_sellers[0]
        self.assertEqual(top_product['name'], "Classic Denim Jeans")
        self.assertEqual(top_product['units_sold'], 15)
        self.assertEqual(Decimal(str(top_product['revenue'])), Decimal("18000.00"))
        self.assertEqual(top_product['stock_status'], "out_of_stock")

        second_product = best_sellers[1]
        self.assertEqual(second_product['name'], "Oxford Cotton Shirt")
        self.assertEqual(second_product['units_sold'], 5)

        # 3. Slow-moving / Zero sales products
        slow_movers = analytics['low_selling_products']
        dead_stock_item = next((x for x in slow_movers if x['uid'] == "WS-DSH-03"), None)
        self.assertIsNotNone(dead_stock_item)
        self.assertEqual(dead_stock_item['units_sold'], 0)
        self.assertEqual(dead_stock_item['current_stock'], 50)
        self.assertEqual(Decimal(str(dead_stock_item['tied_up_capital'])), Decimal("10000.00")) # 50 * 200

        # 4. Out of stock & Depleting products
        depletion = analytics['stock_depletion_products']
        depleted_item = next((x for x in depletion if x['uid'] == "WS-DSH-01"), None)
        self.assertIsNotNone(depleted_item)
        self.assertEqual(depleted_item['current_stock'], 0)
        self.assertEqual(depleted_item['units_sold_this_month'], 15)

        low_stock_item = next((x for x in depletion if x['uid'] == "WS-DSH-02"), None)
        self.assertIsNotNone(low_stock_item)
        self.assertEqual(low_stock_item['current_stock'], 3)

        # 5. Categories & Subcategories
        cats = analytics['category_analytics']
        self.assertEqual(len(cats), 1)
        self.assertEqual(cats[0]['name'], "Apparel")
        self.assertEqual(Decimal(str(cats[0]['revenue'])), Decimal("21500.00"))
        self.assertEqual(cats[0]['units_sold'], 20)

        subs = analytics['subcategory_analytics']
        self.assertEqual(len(subs), 2)
        top_sub = subs[0]
        self.assertEqual(top_sub['name'], "Casuals")
        self.assertEqual(Decimal(str(top_sub['revenue'])), Decimal("18000.00"))

    def test_api_endpoint_dashboard_analytics(self):
        url = reverse('dashboard-analytics')
        response = self.client.get(url, {'store_id': self.store.id, 'year': 2026, 'month': 9})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('overview', data)
        self.assertIn('best_selling_products', data)
        self.assertIn('low_selling_products', data)
        self.assertIn('stock_depletion_products', data)
        self.assertIn('category_analytics', data)
        self.assertIn('subcategory_analytics', data)
        self.assertEqual(data['overview']['total_units_sold'], 20)
