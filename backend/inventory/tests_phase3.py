import json
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from inventory.models import Store, Section, Item, Category, SubCategory
from staff.models import StaffRole, StaffMember


class Phase3SectionAccessControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create store
        self.store = Store.objects.create(name="Flagship Store", address="Main Street")

        # Create two sections
        self.section_a = Section.objects.create(name="Electronics", code="ELEC", store=self.store)
        self.section_b = Section.objects.create(name="Clothing", code="CLOTH", store=self.store)

        # Create category and subcategory
        self.category = Category.objects.create(name="General")
        self.subcategory = SubCategory.objects.create(name="SubGeneral", category=self.category)

        # Create items in each section
        self.item_a = Item.objects.create(
            name="Laptop Pro",
            uid="ITEM-A-001",
            store=self.store,
            section=self.section_a,
            cost_price=Decimal("50000.00"),
            selling_price=Decimal("65000.00"),
            quantity=10,
        )
        self.item_b = Item.objects.create(
            name="Cotton Shirt",
            uid="ITEM-B-001",
            store=self.store,
            section=self.section_b,
            cost_price=Decimal("500.00"),
            selling_price=Decimal("999.00"),
            quantity=50,
        )

        # 1. Owner Role & Member
        self.owner_role = StaffRole.objects.create(
            name="Owner Role",
            is_owner=True,
            can_access_inventory=True,
            can_access_staff=True,
            inventory_scope="full",
        )
        self.owner = StaffMember.objects.create(
            staff_id="OWNER01",
            name="Alice Owner",
            phone="+919876543210",
            role=self.owner_role,
            store=self.store,
        )

        # 2. Section A Restricted Role & Member
        self.section_role = StaffRole.objects.create(
            name="Electronics Associate",
            is_owner=False,
            can_access_inventory=True,
            can_access_staff=False,
            inventory_scope="assigned_section",
        )
        self.staff_section_a = StaffMember.objects.create(
            staff_id="ELEC01",
            name="Bob Section A",
            phone="+919876543211",
            role=self.section_role,
            store=self.store,
            section=self.section_a,
            inventory_scope="assigned_section",
        )

        # 3. Unassigned Section Staff with assigned_section scope
        self.staff_unassigned = StaffMember.objects.create(
            staff_id="UNASSIGNED01",
            name="Charlie Unassigned",
            phone="+919876543212",
            role=self.section_role,
            store=self.store,
            section=None,
            inventory_scope="assigned_section",
        )

        # 4. Full Scope Manager
        self.manager_role = StaffRole.objects.create(
            name="Store Manager",
            is_owner=False,
            can_access_inventory=True,
            can_access_staff=False,
            inventory_scope="full",
        )
        self.manager = StaffMember.objects.create(
            staff_id="MGR01",
            name="Diana Manager",
            phone="+919876543213",
            role=self.manager_role,
            store=self.store,
            inventory_scope="full",
        )

    def auth_as(self, member):
        self.client.credentials(HTTP_X_STAFF_ID=member.staff_id)

    def test_owner_sees_all_items_across_all_sections(self):
        self.auth_as(self.owner)
        res = self.client.get("/api/inventory/items/")
        self.assertEqual(res.status_code, 200)
        item_ids = [it["id"] for it in res.data]
        self.assertIn(self.item_a.id, item_ids)
        self.assertIn(self.item_b.id, item_ids)

    def test_section_restricted_staff_only_sees_items_in_assigned_section(self):
        self.auth_as(self.staff_section_a)
        res = self.client.get("/api/inventory/items/")
        self.assertEqual(res.status_code, 200)
        item_ids = [it["id"] for it in res.data]
        self.assertIn(self.item_a.id, item_ids)
        self.assertNotIn(self.item_b.id, item_ids)

    def test_section_restricted_staff_cannot_retrieve_other_section_item_by_id(self):
        self.auth_as(self.staff_section_a)
        # Attempt to access item in Section B -> Must return 404
        res = self.client.get(f"/api/inventory/items/{self.item_b.id}/")
        self.assertEqual(res.status_code, 404)

        # Accessing item in Section A -> Returns 200
        res_a = self.client.get(f"/api/inventory/items/{self.item_a.id}/")
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_a.data["id"], self.item_a.id)

    def test_section_restricted_staff_create_item_forces_assigned_section(self):
        self.auth_as(self.staff_section_a)
        payload = {
            "name": "Wireless Mouse",
            "store": self.store.id,
            "section": self.section_b.id,  # Attempting to assign to Section B!
            "cost_price": "800.00",
            "selling_price": "1200.00",
            "quantity": 5,
        }
        res = self.client.post("/api/inventory/items/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        created_item = Item.objects.get(id=res.data["id"])
        # Section MUST be forced to Section A
        self.assertEqual(created_item.section, self.section_a)

    def test_section_restricted_staff_update_item_cannot_change_section(self):
        self.auth_as(self.staff_section_a)
        payload = {
            "name": "Laptop Pro 2026",
            "section": self.section_b.id,  # Trying to move item to Section B
            "cost_price": "52000.00",
            "selling_price": "68000.00",
        }
        res = self.client.patch(f"/api/inventory/items/{self.item_a.id}/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.name, "Laptop Pro 2026")
        self.assertEqual(self.item_a.section, self.section_a)

    def test_section_restricted_staff_cannot_modify_sections(self):
        self.auth_as(self.staff_section_a)
        # Attempt to create section -> 403 Forbidden
        res_create = self.client.post("/api/inventory/sections/", {"name": "Gaming", "code": "GAME"}, format="json")
        self.assertEqual(res_create.status_code, 403)

        # Attempt to delete section -> 403 Forbidden
        res_del = self.client.delete(f"/api/inventory/sections/{self.section_a.id}/")
        self.assertEqual(res_del.status_code, 403)

    def test_unassigned_section_staff_sees_empty_list_and_cannot_create(self):
        self.auth_as(self.staff_unassigned)
        res = self.client.get("/api/inventory/items/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

        # Attempt to create item -> 403 Forbidden (must have section assigned)
        res_create = self.client.post("/api/inventory/items/", {
            "name": "Headphones",
            "store": self.store.id,
            "cost_price": "500.00",
            "selling_price": "900.00",
        }, format="json")
        self.assertEqual(res_create.status_code, 403)

    def test_full_scope_manager_can_access_multiple_sections(self):
        self.auth_as(self.manager)
        res = self.client.get("/api/inventory/items/")
        self.assertEqual(res.status_code, 200)
        item_ids = [it["id"] for it in res.data]
        self.assertIn(self.item_a.id, item_ids)
        self.assertIn(self.item_b.id, item_ids)
