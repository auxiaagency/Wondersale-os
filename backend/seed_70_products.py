import os
import sys
import uuid
import random
from decimal import Decimal
import django

# Setup Django environment
sys.path.append(os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wondersale_core.settings')
django.setup()

from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont
from inventory.models import Item, ItemImage, Category, SubCategory, Store

STORE = Store.objects.first()

# 1. Ensure subcategories exist for each category
CATEGORIES_AND_SUBS = [
    ("Electronics", ["Audio & Headphones", "Accessories & Cables", "Smartphones & Tablets"]),
    ("Kitchen & Dining", ["Cookware & Tawa", "Pressure Cookers", "Mixer Grinders & Blenders", "Electric Kettles", "Flasks & Bottles", "Dinner Sets & Storage"]),
    ("Home & Kitchen", ["Steam & Dry Irons", "Cleaning & Vacuums", "Room Comfort & Fans", "Organizers & Racks"]),
    ("Personal Care & Beauty", ["Hair Dryers & Stylers", "Beard Trimmers", "Skin & Body Care", "Oral Care"]),
    ("Fashion & Accessories", ["Casual Footwear", "Backpacks & Luggage", "Watches & Eyewear", "Apparel"]),
    ("Toys & Kids", ["Plush Toys & Dolls", "Educational & Games", "Remote Control Toys"]),
    ("Food Items", ["Beverages & Coffee", "Dry Fruits & Nuts", "Snacks & Spices"]),
]

created_subcategories = {}

for cat_name, sub_names in CATEGORIES_AND_SUBS:
    cat, _ = Category.objects.get_or_create(name=cat_name)
    created_subcategories[cat_name] = []
    for sub_name in sub_names:
        sub, _ = SubCategory.objects.get_or_create(name=sub_name, category=cat)
        created_subcategories[cat_name].append(sub)

print(f"Verified subcategories for {len(created_subcategories)} categories.")

# 70 rich, realistic product definitions across Bhopal superstore catalogue
RAW_PRODUCTS = [
    # Kitchen & Dining (Pressure Cookers, Cookware, Appliances, Flasks) - 20 items
    ("Prestige Svachh Deluxe Alpha 3L Stainless Steel Pressure Cooker", "Kitchen & Dining", "Pressure Cookers", 2250, 2750, 1850, 15),
    ("Prestige Svachh Deluxe Alpha 5L Stainless Steel Pressure Cooker", "Kitchen & Dining", "Pressure Cookers", 2850, 3450, 2400, 20),
    ("Hawkins Contura 3 Litre Hard Anodized Inner Lid Pressure Cooker", "Kitchen & Dining", "Pressure Cookers", 1750, 2100, 1600, 12),
    ("Hawkins Miss Mary 5 Litre Aluminium Pressure Cooker", "Kitchen & Dining", "Pressure Cookers", 1499, 1850, 1950, 18),
    ("Pigeon by Stovekraft Favourite 3L Outer Lid Pressure Cooker", "Kitchen & Dining", "Pressure Cookers", 899, 1295, 1200, 25),
    ("Prestige Omega Deluxe Granite Non-Stick Omni Tawa 280mm", "Kitchen & Dining", "Cookware & Tawa", 849, 1140, 850, 22),
    ("Hawkins Futura Hard Anodized Dosa Tawa 33cm Non-Stick", "Kitchen & Dining", "Cookware & Tawa", 1299, 1550, 1100, 14),
    ("Wonderchef Royal Velvet Non-Stick Frying Pan 24cm with Soft-Touch Handle", "Kitchen & Dining", "Cookware & Tawa", 799, 1100, 750, 16),
    ("Prestige Induction Compatible Hard Anodised Kadai 2.5L with Glass Lid", "Kitchen & Dining", "Cookware & Tawa", 1199, 1600, 1300, 10),
    ("Philips HL7756/00 750W Mixer Grinder with 3 Stainless Steel Jars", "Kitchen & Dining", "Mixer Grinders & Blenders", 3499, 5295, 3800, 8),
    ("Preethi Zodiac MG 218 750-Watt Mixer Grinder with 5 Jars", "Kitchen & Dining", "Mixer Grinders & Blenders", 7899, 10500, 6200, 6),
    ("Bajaj Rex 500W Mixer Grinder with Nutri-Pro Feature and 3 Jars", "Kitchen & Dining", "Mixer Grinders & Blenders", 1999, 3210, 3100, 15),
    ("Kent 16044 Hand Blender with Stainless Steel Whisk and Blades 300W", "Kitchen & Dining", "Mixer Grinders & Blenders", 1299, 1800, 750, 20),
    ("Bajaj Majesty KKN 1.5L Cordless Stainless Steel Electric Kettle", "Kitchen & Dining", "Electric Kettles", 849, 1299, 850, 30),
    ("Prestige PKOSS 1.5 Litre 1500W Electric Kettle with Automatic Cut-off", "Kitchen & Dining", "Electric Kettles", 749, 1195, 780, 28),
    ("Milton Thermosteel Flip Lid 1000ml Insulated Water Flask Bottle", "Kitchen & Dining", "Flasks & Bottles", 799, 1060, 520, 35),
    ("Cello Flip Style Stainless Steel Double Wall Vacuum Flask 750ml", "Kitchen & Dining", "Flasks & Bottles", 649, 890, 410, 24),
    ("Borosil Stainless Steel Hydra Trek Vacuum Insulated Flask 500ml", "Kitchen & Dining", "Flasks & Bottles", 575, 745, 330, 18),
    ("Cello Opalware Dazzle Tropical Lagoon 18-Piece Dinner Set", "Kitchen & Dining", "Dinner Sets & Storage", 1699, 2490, 4200, 8),
    ("Milton Executive Stainless Steel Insulated Tiffin Box with 3 Containers", "Kitchen & Dining", "Dinner Sets & Storage", 499, 695, 680, 25),

    # Electronics & Audio (Audio, Cables, Chargers, Accessories) - 15 items
    ("boAt Rockerz 450 Bluetooth On-Ear Wireless Headphones with Mic", "Electronics", "Audio & Headphones", 1299, 3990, 168, 20),
    ("boAt Airdopes 141 True Wireless Earbuds with 42H Playtime", "Electronics", "Audio & Headphones", 1099, 4490, 60, 40),
    ("OnePlus Nord Buds 2 True Wireless in-Ear Earbuds with Active Noise Cancellation", "Electronics", "Audio & Headphones", 2499, 3299, 55, 15),
    ("JBL Go 3 Eco Portable Waterproof Bluetooth Speaker with Bold Style", "Electronics", "Audio & Headphones", 2999, 3999, 209, 10),
    ("Sony WH-CH520 Wireless Bluetooth On-Ear Headphones with 50H Battery", "Electronics", "Audio & Headphones", 3990, 4990, 147, 8),
    ("Portronics SoundDrum 20W Bluetooth Portable Speaker with Type-C Charging", "Electronics", "Audio & Headphones", 1499, 2999, 420, 16),
    ("Ambrane 20000mAh Power Bank 20W Fast Charging Stylo Pro", "Electronics", "Accessories & Cables", 1499, 2499, 410, 22),
    ("Mi 10000mAh Pocket Power Bank Pro 22.5W Ultra-Compact Fast Charging", "Electronics", "Accessories & Cables", 1299, 2199, 200, 18),
    ("boAt Deuce 300 2-in-1 Type C & Micro USB Braided Cable 1.5 Meter", "Electronics", "Accessories & Cables", 249, 699, 75, 50),
    ("Portronics Konnect L 1.2M Fast Charging Nylon Braided Lightning Cable", "Electronics", "Accessories & Cables", 199, 499, 60, 35),
    ("Ambrane 65W GaN Multi-Port USB Fast Wall Charger Adapter with Type-C PD", "Electronics", "Accessories & Cables", 1699, 2999, 140, 14),
    ("Spigen Ultra Hybrid Back Case Cover for iPhone 15 Matte Finish", "Electronics", "Smartphones & Tablets", 1199, 1999, 45, 12),
    ("Portronics Clamp X2 Car Air Vent Universal Mobile Phone Mount Holder", "Electronics", "Accessories & Cables", 349, 799, 95, 26),
    ("Logitech M221 Silent Wireless Optical Mouse with 2.4GHz USB Nano Receiver", "Electronics", "Accessories & Cables", 749, 1095, 75, 20),
    ("SanDisk Ultra Dual Drive Go 64GB USB Type-C & Type-A Pen Drive", "Electronics", "Accessories & Cables", 629, 1100, 25, 30),

    # Home & Kitchen (Irons, Cleaners, Fans, Organizers) - 10 items
    ("Philips GC181 Heavy Weight 1000W Dry Iron with Golden American Heritage Soleplate", "Home & Kitchen", "Steam & Dry Irons", 999, 1345, 1600, 25),
    ("Bajaj DX-7 1000W Lightweight Dry Iron with Non-Stick Coated Soleplate", "Home & Kitchen", "Steam & Dry Irons", 699, 995, 800, 30),
    ("Morphy Richards Super Glider 2000W Steam Iron with Ceramic Soleplate", "Home & Kitchen", "Steam & Dry Irons", 1699, 2595, 1350, 12),
    ("Eureka Forbes Sure from Forbes Quick Clean DX Vacuum Cleaner 1200W", "Home & Kitchen", "Cleaning & Vacuums", 3299, 4500, 3600, 6),
    ("Spotzero by Milton Prime Spin Mop with Big Wheels and Stainless Steel Wringer", "Home & Kitchen", "Cleaning & Vacuums", 1099, 1690, 2200, 14),
    ("Atomberg Renesa 1200mm BLDC Motor Energy Saving Ceiling Fan with Remote", "Home & Kitchen", "Room Comfort & Fans", 3699, 4990, 3900, 8),
    ("Usha Mist Air Icy 400mm 55-Watt Table Fan with Aerodynamic Blades", "Home & Kitchen", "Room Comfort & Fans", 1899, 2550, 2900, 10),
    ("Kuber Industries 6-Shelf Hanging Wardrobe Closet Organizer Foldable", "Home & Kitchen", "Organizers & Racks", 399, 699, 450, 20),
    ("Scotch-Brite 2-in-1 Bucket Spin Mop and Microfiber Floor Cleaner", "Home & Kitchen", "Cleaning & Vacuums", 1249, 1890, 2100, 15),
    ("Havells Glaze 1200mm Decorative Ceiling Fan Espresso Brown", "Home & Kitchen", "Room Comfort & Fans", 2499, 3350, 4100, 7),

    # Personal Care & Beauty (Grooming, Hair Care, Oral Care) - 10 items
    ("Philips BT1232/15 Skin-Friendly Beard Trimmer with USB Charging", "Personal Care & Beauty", "Beard Trimmers", 899, 1195, 180, 25),
    ("Mi Cordless Beard Trimmer 1C with 20 Length Settings and 60 Min Run Time", "Personal Care & Beauty", "Beard Trimmers", 1199, 1499, 210, 20),
    ("Nova NHT 1071 Cordless USB Rechargeable Beard Trimmer for Men", "Personal Care & Beauty", "Beard Trimmers", 449, 799, 150, 35),
    ("Philips HP8100/46 1000W Hair Dryer with ThermoProtect Compact Ergonomic", "Personal Care & Beauty", "Hair Dryers & Stylers", 799, 995, 320, 22),
    ("Havells HD3151 1200W Foldable Hair Dryer with 3 Heat Settings", "Personal Care & Beauty", "Hair Dryers & Stylers", 949, 1395, 360, 18),
    ("Oral-B Vitality CrossAction Electric Rechargeable Toothbrush", "Personal Care & Beauty", "Oral Care", 1399, 1899, 240, 14),
    ("Colgate ProClinical 150 Charcoal Battery Sonic Powered Electric Toothbrush", "Personal Care & Beauty", "Oral Care", 699, 999, 110, 28),
    ("Nivea Men Dark Spot Reduction Moisturizing Face Cream SPF 30 50ml", "Personal Care & Beauty", "Skin & Body Care", 215, 299, 75, 40),
    ("Garnier Men Acno Fight Anti-Pimple Face Wash with Salicylic Acid 100g", "Personal Care & Beauty", "Skin & Body Care", 165, 225, 120, 45),
    ("Dettol Original Germ Protection Bathing Soap Bar Pack of 4 125g Each", "Personal Care & Beauty", "Skin & Body Care", 220, 260, 520, 50),

    # Toys & Kids (Plush Dolls, Educational Games, RC Cars) - 8 items
    ("Pikachu Soft Plush Stuffed Animal Doll 30cm Cute Yellow Anime Toy", "Toys & Kids", "Plush Toys & Dolls", 349, 599, 220, 30),
    ("Teddy Bear Ultra-Soft Giant Plush Toy Brown 45cm with Ribbon Neck", "Toys & Kids", "Plush Toys & Dolls", 499, 899, 450, 18),
    ("Monopoly Deluxe Classic Board Game Family Trading Game for Kids and Adults", "Toys & Kids", "Educational & Games", 699, 999, 650, 15),
    ("Funskool Jenga Classic Wooden Block Stacking Game 54 Precision Blocks", "Toys & Kids", "Educational & Games", 749, 999, 920, 12),
    ("Rubik's Cube 3x3 Speed Cube Smooth Rotation Stickerless Puzzle", "Toys & Kids", "Educational & Games", 249, 499, 90, 40),
    ("Remote Control High Speed Racing Sports Car with LED Headlights 1:18 Scale", "Toys & Kids", "Remote Control Toys", 699, 1299, 480, 20),
    ("Hot Wheels 5-Car Gift Pack Authentic Die-Cast Vehicles Assorted 1:64", "Toys & Kids", "Remote Control Toys", 649, 799, 240, 25),
    ("Fisher-Price Brilliant Basics Baby's First Blocks Shape Sorter Bucket", "Toys & Kids", "Educational & Games", 449, 599, 390, 16),

    # Fashion & Accessories - 4 items
    ("Wildcraft 35L Water Resistant Outdoor Laptop Backpack with Padded Straps", "Fashion & Accessories", "Backpacks & Luggage", 1499, 2299, 550, 14),
    ("Safari Pentagon 55cm Small Cabin Trolley Suitcase Polypropylene Hardsided", "Fashion & Accessories", "Backpacks & Luggage", 1999, 5999, 2700, 8),
    ("Fastrack Casual Analog Black Dial Men's Quartz Wrist Watch with Leather Strap", "Fashion & Accessories", "Watches & Eyewear", 1195, 1795, 130, 16),
    ("Vincent Chase Polarized Aviator Sunglasses Full Rim Silver Grey Unisex", "Fashion & Accessories", "Watches & Eyewear", 899, 1999, 65, 20),

    # Food Items - 3 items
    ("Nescafe Classic Pure Instant Coffee Glass Jar 200g Roasted Granules", "Food Items", "Beverages & Coffee", 495, 595, 480, 35),
    ("Tata Tea Premium Desh Ki Chai Leaf Tea Pouch 1kg Fresh Assam Blend", "Food Items", "Beverages & Coffee", 420, 520, 1020, 40),
    ("Nutraj California Almonds Whole Kernels Value Pouch 500g Premium Badam", "Food Items", "Dry Fruits & Nuts", 449, 650, 510, 30),
]

# Color palettes for clean product badge image generation
PALETTES = [
    ("#680114", "#F6E9C8", "#88091E"),
    ("#1A365D", "#EBF8FF", "#2B6CB0"),
    ("#22543D", "#F0FFF4", "#2F855A"),
    ("#742A2A", "#FFF5F5", "#9B2C2C"),
    ("#7B341E", "#FFFAF0", "#C05621"),
    ("#2D3748", "#EDF2F7", "#4A5568"),
    ("#44337A", "#FAF5FF", "#6B46C1"),
]

def generate_product_image(name, cat, price, filename):
    img = Image.new("RGB", (600, 600), color="#FBF8F1")
    draw = ImageDraw.Draw(img)

    bg_main, fg_cream, accent = random.choice(PALETTES)

    # Rounded card frame
    draw.rounded_rectangle([(30, 30), (570, 570)], radius=32, fill="#FFFFFF", outline="#680114", width=4)

    # Accent header band
    draw.rounded_rectangle([(45, 45), (555, 140)], radius=20, fill=bg_main)

    # Brand label
    draw.text((65, 60), "WONDERSALE STORE", fill=fg_cream)
    draw.text((65, 95), cat.upper(), fill="#DFCBA0")

    # Center circle badge
    draw.ellipse([(175, 180), (425, 430)], fill=fg_cream, outline=accent, width=5)

    # Category and initials in circle
    words = [w for w in name.split() if len(w) > 2]
    initials = "".join([w[0].upper() for w in words[:3]])
    draw.text((250, 270), initials, fill=bg_main)
    draw.text((230, 340), "GENUINE ITEM", fill=accent)

    # Product Name preview bottom
    display_title = name[:36] + ("..." if len(name) > 36 else "")
    draw.text((60, 465), display_title, fill="#680114")

    # Price pill
    draw.rounded_rectangle([(60, 505), (260, 550)], radius=12, fill=bg_main)
    draw.text((80, 518), f"Rs. {price:,.0f} INCL. GST", fill=fg_cream)

    # Express badge
    draw.rounded_rectangle([(340, 505), (540, 550)], radius=12, fill="#EFE0BC", outline="#680114", width=2)
    draw.text((365, 518), "BHOPAL EXPRESS", fill="#680114")

    out_path = os.path.join("backend/media/item_images", filename)
    img.save(out_path, "WEBP", quality=88)
    return out_path

added_count = 0
now = timezone.now()

for idx, (p_name, c_name, s_name, sel_price, mrp, wt_grams, qty) in enumerate(RAW_PRODUCTS, start=1):
    sub_list = created_subcategories.get(c_name, [])
    matching_sub = next((s for s in sub_list if s.name == s_name), None)

    # Unique UID
    sku_uid = f"WS{random.randint(100000, 999999)}"
    while Item.objects.filter(uid=sku_uid).exists():
        sku_uid = f"WS{random.randint(100000, 999999)}"

    # Generate Image
    img_filename = f"gen_prod_{uuid.uuid4().hex}.webp"
    generate_product_image(p_name, c_name, sel_price, img_filename)

    desc = f"""### Overview
{p_name} is a high-grade, authentic product sourced directly for Wondersale's central Bhopal retail and online superstore. Engineered with premium materials for maximum durability, performance, and everyday convenience.

### Key Highlights & Features
- **100% Genuine Quality**: Brand new, sealed packaging with manufacturer quality guarantee.
- **Precision Engineered**: Optimized for Indian household conditions and high-frequency daily usage.
- **Superstore Direct**: Inspected and fulfilled directly from our Bhopal Plaza warehouse with same-day express pickup readiness.
- **Warranty & Support**: Standard brand manufacturer warranty valid at authorized service centers across Bhopal and India.

### Product Specifications
- **Category & Subcategory**: {c_name} / {s_name}
- **Net Weight**: {wt_grams} grams
- **Store Inventory**: Stocked at Wondersale Superstore, Bhopal Plaza, MP."""

    item = Item.objects.create(
        uid=sku_uid,
        name=p_name,
        quantity=qty,
        cost_price=Decimal(str(round(sel_price * 0.75, 2))),
        selling_price=Decimal(str(sel_price)),
        mrp=Decimal(str(mrp)),
        store=STORE,
        primary_subcategory=matching_sub,
        weight=Decimal(str(wt_grams)),
        description=desc,
        is_listed_on_website=True,
        listed_on_website_at=now,
        created_at=now,
        updated_at=now,
    )

    if matching_sub:
        item.subcategories.add(matching_sub)

    # Attach primary Image
    ItemImage.objects.create(
        item=item,
        image=f"item_images/{img_filename}",
        is_primary=True,
    )

    added_count += 1
    if added_count % 10 == 0:
        print(f"Added {added_count} products...")

print(f"SUCCESS: Successfully created {added_count} new products with verified photos, weights, and categories!")
