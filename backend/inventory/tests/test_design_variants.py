from django.test import TestCase
from decimal import Decimal
from inventory.models import Store, Item, ItemVariant, SaleOrder, SaleOrderItem
from staff.models import StaffRole, StaffMember
from inventory.serializers import CheckoutSerializer, ItemCreateUpdateSerializer


class DesignVariantTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(name="Main Store", city="Mumbai")
        self.role = StaffRole.objects.create(name="Cashier")
        self.staff = StaffMember.objects.create(
            name="John Doe",
            staff_id="EMP001",
            store=self.store,
            role=self.role
        )

    def test_create_item_with_variants(self):
        payload = {
            'store': self.store.id,
            'name': "Superhero Backpack",
            'cost_price': '300.00',
            'selling_price': '600.00',
            'has_variants': True,
            'initial_quantity': 10,
            'variants': [
                {'name': 'Spider-Man', 'quantity': 6},
                {'name': 'Iron Man', 'quantity': 4},
            ]
        }
        serializer = ItemCreateUpdateSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        item = serializer.save()

        self.assertEqual(item.quantity, 10)
        self.assertTrue(item.has_variants)
        self.assertEqual(item.design_variants.count(), 2)

        spidey = item.design_variants.get(name='Spider-Man')
        ironman = item.design_variants.get(name='Iron Man')
        self.assertEqual(spidey.quantity, 6)
        self.assertEqual(ironman.quantity, 4)

    def test_pos_checkout_variant_deduction(self):
        # Open register shift first
        from inventory.models import DailyRegisterShift
        shift = DailyRegisterShift.objects.create(
            store=self.store,
            cashier=self.staff,
            cashier_name=self.staff.name,
            opening_cash=Decimal('1000.00'),
            status=DailyRegisterShift.STATUS_OPEN
        )

        item = Item.objects.create(
            store=self.store,
            name="Superhero Backpack",
            uid="BAG1001",
            cost_price=Decimal('300.00'),
            selling_price=Decimal('600.00'),
            has_variants=True
        )
        from inventory.services import adjust_stock
        from inventory.models import StockMovement
        adjust_stock(item=item, change=10, reason=StockMovement.REASON_RESTOCK)
        spidey = ItemVariant.objects.create(
            item=item,
            name="Spider-Man",
            quantity=6
        )
        ironman = ItemVariant.objects.create(
            item=item,
            name="Iron Man",
            quantity=4
        )

        checkout_data = {
            'store_id': self.store.id,
            'customer_phone': '9876543210',
            'payment_method': 'cash',
            'amount_paid': '1200.00',
            'items': [
                {
                    'item_id': item.id,
                    'variant_id': spidey.id,
                    'quantity': 2,
                    'unit_price': '600.00',
                }
            ]
        }
        # Fake request context with staff
        from unittest.mock import Mock
        mock_request = Mock()
        mock_request.user = Mock(is_authenticated=True)
        from django.contrib.auth.models import AnonymousUser
        setattr(mock_request, 'staff_member', self.staff)

        serializer = CheckoutSerializer(data=checkout_data, context={'request': mock_request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale_order = serializer.save()

        # Check stock deductions
        item.refresh_from_db()
        spidey.refresh_from_db()
        ironman.refresh_from_db()

        self.assertEqual(spidey.quantity, 4)
        self.assertEqual(ironman.quantity, 4)
        self.assertEqual(item.quantity, 8)

        # Check line item
        line = sale_order.items.first()
        self.assertEqual(line.variant_name, "Spider-Man")
        self.assertEqual(line.variant.id, spidey.id)
