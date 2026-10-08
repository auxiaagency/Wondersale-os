from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from inventory.models import Store, Category, SubCategory, Item, StockMovement, SaleOrder, SaleOrderItem
from inventory.services import adjust_stock
from stakeholders.models import Stakeholder, StakeholderPayout


class StakeholderTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Bhopal Flagship", city="Bhopal")

        self.stakeholder = Stakeholder.objects.create(
            name="Rahul Mehra",
            email="rahul@mehra.com",
            phone="9876543210",
            store=self.store,
            investment_amount=Decimal("500000.00"),
            profit_percentage=Decimal("10.00"),
            status="active"
        )

    def test_list_stakeholders(self):
        url = reverse('stakeholder-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_create_stakeholder(self):
        url = reverse('stakeholder-list')
        payload = {
            "name": "Kavita Rao",
            "email": "kavita@rao.com",
            "phone": "9123456780",
            "investment_amount": "250000.00",
            "profit_percentage": "5.00",
            "contract_date": "2026-01-15",
            "status": "active"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], "Kavita Rao")
        self.assertEqual(Decimal(str(res.data['profit_percentage'])), Decimal("5.00"))

    def test_profit_percentage_validation(self):
        url = reverse('stakeholder-list')
        # Negative percentage fails
        res = self.client.post(url, {
            "name": "Bad Partner",
            "profit_percentage": "-5.00",
            "investment_amount": "1000.00"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Percentage > 100 fails
        res = self.client.post(url, {
            "name": "Greedy Partner",
            "profit_percentage": "105.00",
            "investment_amount": "1000.00"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_record_payout(self):
        url = reverse('stakeholder-record-payout', kwargs={'pk': self.stakeholder.id})
        payload = {
            "amount": "15000.00",
            "payout_date": "2026-09-08",
            "payment_method": "bank_transfer",
            "reference_id": "UTR-999888777",
            "notes": "Q3 profit distribution"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.stakeholder.refresh_from_db()
        self.assertEqual(self.stakeholder.total_payout_paid, Decimal("15000.00"))
        self.assertEqual(self.stakeholder.payouts.count(), 1)

    def test_analytics_endpoint(self):
        # Create a sample completed sale order
        order = SaleOrder.objects.create(
            invoice_number="INV-STAKE-001",
            store=self.store,
            customer_phone="9998887776",
            subtotal=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            status="completed"
        )
        category = Category.objects.create(name="Sample Cat")
        subcategory = SubCategory.objects.create(category=category, name="Sample Sub")
        item = Item.objects.create(
            uid="WS-TEST-ITEM-1",
            name="Sample Product",
            cost_price=Decimal("400.00"),
            selling_price=Decimal("1000.00"),
            store=self.store
        )
        item.subcategories.add(subcategory)
        SaleOrderItem.objects.create(
            sale_order=order,
            item=item,
            item_name=item.name,
            item_uid=item.uid,
            unit_cost_price=Decimal("400.00"),
            unit_selling_price=Decimal("1000.00"),
            quantity=1,
            total_price=Decimal("1000.00")
        )

        url = reverse('stakeholder-analytics')
        res = self.client.get(f"{url}?timeframe=current_month")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('summary', res.data)
        self.assertIn('pie_chart', res.data)
        self.assertIn('monthly_trend', res.data)
        self.assertIn('stakeholders', res.data)
