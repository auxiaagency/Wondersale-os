import os
import sys
import uuid
import random
from decimal import Decimal
from datetime import timedelta

# Ensure python path includes backend directory
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wondersale_core.settings')

import django
django.setup()

from django.utils import timezone
from PIL import Image, ImageDraw

from inventory.models import (
    Store, Category, SubCategory, Item, ItemImage,
    SaleOrder, SaleOrderItem, OrderPaymentTransaction, Customer, StockMovement
)
from staff.models import StaffMember, StaffRole

print("==> Initializing Test Data Generator for Wondersale OS...")

# 1. Ensure Store
store = Store.objects.first()
if not store:
    store = Store.objects.create(
        name="Bhopal Plaza",
        code="BPL-01",
        address="Ground Floor, DB City Mall, MP Nagar, Bhopal",
        city="Bhopal",
        state="Madhya Pradesh",
        pincode="462011",
        phone="0755-4098765",
        email="bhopal@wondersale.in",
        is_active=True,
    )
print(f"Store: {store.name} (ID: {store.id})")

# 2. Ensure Staff (Owner + Cashiers)
owner_role, _ = StaffRole.objects.get_or_create(name='Owner', defaults={'is_owner': True})
cashier_role, _ = StaffRole.objects.get_or_create(name='Cashier', defaults={'is_owner': False})

salman = StaffMember.objects.filter(staff_id__iexact='Salman').first()
if not salman:
    salman = StaffMember.objects.create(
        staff_id='Salman',
        name='Salman Khan',
        role=owner_role,
        store=store,
        is_active=True
    )
    salman.set_password('7869186388')
    salman.save()

pooja, _ = StaffMember.objects.get_or_create(
    staff_id='POOJA01',
    defaults={
        'name': 'Pooja Sharma',
        'role': cashier_role,
        'store': store,
        'is_active': True
    }
)
vikram, _ = StaffMember.objects.get_or_create(
    staff_id='VIKRAM02',
    defaults={
        'name': 'Vikram Rathore',
        'role': cashier_role,
        'store': store,
        'is_active': True
    }
)
staff_pool = [salman, pooja, vikram]
print(f"Staff ready: {[s.name for s in staff_pool]}")

# 3. Ensure Customers
CUSTOMERS_DATA = [
    ("Aarav Patel", "9826011223", "aarav@example.com"),
    ("Sneha Verma", "9425088776", "sneha@example.com"),
    ("Rajesh Kumar", "9179044556", "rajesh@example.com"),
    ("Ananya Sharma", "9893077889", "ananya@example.com"),
    ("Mohammed Faizan", "9827055443", "faizan@example.com"),
    ("Deepika Joshi", "9406533221", "deepika@example.com"),
    ("Amitabh Saxena", "9977012345", "amitabh@example.com"),
    ("Priya Nair", "9826543210", "priya@example.com"),
]

customers = []
for c_name, c_phone, c_email in CUSTOMERS_DATA:
    cust, _ = Customer.objects.get_or_create(
        phone=c_phone,
        defaults={
            'name': c_name,
            'email': c_email,
            'store': store,
        }
    )
    customers.append(cust)
print(f"Verified {len(customers)} customers.")

# 4. Ensure Categories, Subcategories & Products
media_dir = os.path.join(os.path.dirname(__file__), 'media', 'item_images')
os.makedirs(media_dir, exist_ok=True)

CATEGORIES_MAP = {
    "Electronics": ["Audio & Headphones", "Smartwatches", "Accessories & Cables"],
    "Kitchen & Home": ["Cookware & Tawa", "Pressure Cookers", "Appliances & Flasks"],
    "Fashion & Footwear": ["Sneakers & Casuals", "Backpacks", "Apparel & Tees"],
    "Personal Care": ["Hair Styling & Dryers", "Grooming & Trimmers"],
}

SAMPLE_PRODUCTS = [
    # Electronics
    ("boAt Rockerz 450 Bluetooth Headphones", "Electronics", "Audio & Headphones", "WS-EAR-450", 1299, 1799, 790, 45),
    ("boAt Airdopes 141 TWS Earbuds 42H", "Electronics", "Audio & Headphones", "WS-AIR-141", 1099, 1499, 650, 60),
    ("Sony WH-1000XM5 Noise Cancelling Headset", "Electronics", "Audio & Headphones", "WS-SNY-XM5", 26990, 29990, 19500, 12),
    ("Noise ColorFit Pulse 2 Max Smartwatch", "Electronics", "Smartwatches", "WS-NCP-02", 1499, 2499, 890, 35),
    ("Fire-Boltt Ninja Call Pro Plus 1.83-inch", "Electronics", "Smartwatches", "WS-FB-NINJA", 1299, 1999, 720, 28),
    ("Anker 65W GaN Fast Wall Charger", "Electronics", "Accessories & Cables", "WS-ANK-65W", 2499, 3499, 1450, 20),

    # Kitchen & Home
    ("Prestige Svachh Deluxe Alpha 3L Cooker", "Kitchen & Home", "Pressure Cookers", "WS-CKR-3L", 2250, 2750, 1600, 25),
    ("Hawkins Contura 3L Hard Anodized Inner Lid", "Kitchen & Home", "Pressure Cookers", "WS-HWK-3L", 1750, 2100, 1200, 30),
    ("Prestige Omega Deluxe Granite Omni Tawa 280mm", "Kitchen & Home", "Cookware & Tawa", "WS-TWA-280", 849, 1140, 520, 40),
    ("Hawkins Futura Hard Anodized Dosa Tawa 33cm", "Kitchen & Home", "Cookware & Tawa", "WS-HWK-DOSA", 1299, 1550, 850, 18),
    ("Milton Thermosteel 1000ml Flask Bottle", "Kitchen & Home", "Appliances & Flasks", "WS-MLT-1000", 799, 1060, 480, 50),
    ("Bajaj Rex 500W Mixer Grinder with 3 Jars", "Kitchen & Home", "Appliances & Flasks", "WS-BJJ-REX", 1999, 3210, 1350, 15),

    # Fashion & Footwear
    ("Nike Air Max 270 Black & White Sneaker", "Fashion & Footwear", "Sneakers & Casuals", "WS-NK-270", 8999, 11999, 5400, 22),
    ("Puma Classic Suede Low-Top Navy", "Fashion & Footwear", "Sneakers & Casuals", "WS-PM-SUEDE", 3499, 4999, 2100, 35),
    ("Wildcraft 45L Trailblazer Adventure Rucksack", "Fashion & Footwear", "Backpacks", "WS-WC-TRL45", 2199, 2999, 1300, 20),
    ("Oversized Heavyweight Cotton Graphic Tee", "Fashion & Footwear", "Apparel & Tees", "WS-TEE-HVY01", 699, 1199, 280, 80),
    ("Classic Slim Fit Stretch Denim Jeans", "Fashion & Footwear", "Apparel & Tees", "WS-JNS-SLIM02", 1299, 1999, 650, 45),

    # Personal Care
    ("Philips HP8100/46 1000W Hair Dryer", "Personal Care", "Hair Styling & Dryers", "WS-PH-HD1000", 799, 995, 510, 30),
    ("Havells BT5111C Li-Ion Cordless Trimmer", "Personal Care", "Grooming & Trimmers", "WS-HV-TRIM", 1199, 1695, 740, 25),
    ("Vega 3-in-1 Hair Styler Straightener & Curler", "Personal Care", "Hair Styling & Dryers", "WS-VG-STYLE", 1499, 1999, 920, 18),
]

def make_sample_image(name, cat_name, filename):
    img = Image.new("RGB", (400, 400), color="#1E293B")
    draw = ImageDraw.Draw(img)
    draw.rectangle([(20, 20), (380, 380)], fill="#0F172A", outline="#10B981", width=3)
    draw.rectangle([(40, 40), (360, 100)], fill="#10B981")
    draw.text((60, 60), cat_name[:24].upper(), fill="#FFFFFF")
    draw.ellipse([(140, 140), (260, 260)], fill="#1E293B", outline="#38BDF8", width=3)
    draw.text((180, 190), "ITEM", fill="#38BDF8")
    words = name.split()[:4]
    draw.text((40, 290), " ".join(words), fill="#F8FAFC")
    out_file = os.path.join(media_dir, filename)
    img.save(out_file, "WEBP", quality=85)
    return f"item_images/{filename}"

items_created = []
now = timezone.now()

for p_title, cat_name, sub_name, uid, sel_price, mrp, cost, qty in SAMPLE_PRODUCTS:
    cat, _ = Category.objects.get_or_create(name=cat_name)
    sub, _ = SubCategory.objects.get_or_create(name=sub_name, category=cat)

    item = Item.objects.filter(uid=uid).first()
    if not item:
        item = Item.objects.create(
            uid=uid,
            name=p_title,
            cost_price=Decimal(str(cost)),
            selling_price=Decimal(str(sel_price)),
            mrp=Decimal(str(mrp)),
            quantity=qty,
            store=store,
            primary_subcategory=sub,
            description=f"Authentic {p_title} stocked at Wondersale Superstore Bhopal.",
            is_listed_on_website=True,
            created_at=now - timedelta(days=90),
        )
        item.subcategories.add(sub)

        # Image
        img_name = f"{uid.lower()}_{uuid.uuid4().hex[:6]}.webp"
        rel_img_path = make_sample_image(p_title, cat_name, img_name)
        ItemImage.objects.create(item=item, image=rel_img_path, is_primary=True)

        # Stock Movement Ledger Entry
        StockMovement.objects.create(
            item=item,
            change=qty,
            reason=StockMovement.REASON_INITIAL_IMPORT,
            note="Initial Inventory Intake",
            performed_by=salman,
            performed_by_name=salman.name,
        )
    items_created.append(item)

print(f"Verified {len(items_created)} items ready in catalog.")

# 5. Generate Realistic Historical Sales Orders (60 orders across past 45 days)
PAYMENT_MODES = [
    SaleOrder.PAYMENT_CASH,
    SaleOrder.PAYMENT_UPI,
    SaleOrder.PAYMENT_CARD,
    SaleOrder.PAYMENT_SPLIT,
]

order_count_target = 65
existing_orders = SaleOrder.objects.count()
orders_to_create = max(0, order_count_target - existing_orders)

print(f"Creating {orders_to_create} sample sales orders with bills...")

for i in range(1, orders_to_create + 1):
    inv_num = f"INV-2026-{(existing_orders + i):05d}"
    
    # Spread dates over last 45 days
    days_ago = random.randint(0, 45)
    hours_ago = random.randint(10, 21) # 10 AM to 9 PM shopping hours
    minutes_ago = random.randint(0, 59)
    order_time = now - timedelta(days=days_ago, hours=(now.hour - hours_ago), minutes=minutes_ago)

    chosen_cust = random.choice(customers) if random.random() > 0.15 else None
    chosen_cashier = random.choice(staff_pool)
    pay_mode = random.choice(PAYMENT_MODES)

    # 1 to 3 distinct items per basket
    basket_items = random.sample(items_created, k=random.randint(1, 3))
    
    order = SaleOrder.objects.create(
        invoice_number=inv_num,
        store=store,
        cashier=chosen_cashier,
        cashier_name=chosen_cashier.name,
        customer=chosen_cust,
        customer_name=chosen_cust.name if chosen_cust else "Walk-in Customer",
        customer_phone=chosen_cust.phone if chosen_cust else f"9826{random.randint(100000, 999999)}",
        payment_method=pay_mode,
        status=SaleOrder.STATUS_COMPLETED,
        subtotal=Decimal('0.00'),
        tax_amount=Decimal('0.00'),
        discount_amount=Decimal('0.00'),
        total_amount=Decimal('0.00'),
        amount_paid=Decimal('0.00'),
        balance_due=Decimal('0.00'),
        is_fully_paid=True,
    )

    subtotal = Decimal('0.00')
    total_qty = 0

    for item in basket_items:
        qty_purchased = random.randint(1, 2)
        unit_price = item.selling_price
        line_total = unit_price * qty_purchased
        subtotal += line_total
        total_qty += qty_purchased

        SaleOrderItem.objects.create(
            sale_order=order,
            item=item,
            item_name=item.name,
            item_uid=item.uid,
            unit_cost_price=item.cost_price,
            unit_selling_price=unit_price,
            unit_mrp=item.mrp or unit_price,
            quantity=qty_purchased,
            returned_quantity=0,
            is_return=False,
            total_price=line_total,
        )

        # Stock reduction ledger
        StockMovement.objects.create(
            item=item,
            change=-qty_purchased,
            reason=StockMovement.REASON_SALE,
            note=f"POS Sale #{inv_num}",
            performed_by=chosen_cashier,
            performed_by_name=chosen_cashier.name,
        )

    order.subtotal = subtotal
    order.total_amount = subtotal
    order.amount_paid = subtotal
    order.is_fully_paid = True
    order.save(update_fields=['subtotal', 'total_amount', 'amount_paid', 'is_fully_paid'])
    SaleOrder.objects.filter(id=order.id).update(created_at=order_time, updated_at=order_time)

    # OrderPaymentTransaction record
    if pay_mode == SaleOrder.PAYMENT_SPLIT:
        split_cash = round(subtotal / Decimal('2.00'), 2)
        split_upi = subtotal - split_cash
        OrderPaymentTransaction.objects.create(order=order, store=store, payment_method=SaleOrder.PAYMENT_CASH, amount=split_cash)
        OrderPaymentTransaction.objects.create(order=order, store=store, payment_method=SaleOrder.PAYMENT_UPI, amount=split_upi)
    else:
        OrderPaymentTransaction.objects.create(order=order, store=store, payment_method=pay_mode, amount=subtotal)

print(f"SUCCESS: Created {orders_to_create} realistic Sales Orders!")
print("==> Sample Data Generation Completed Successfully.")
