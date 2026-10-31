import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    name: "Home Appliances",
    slug: "home-appliances",
    description: "Fans, heaters, irons, vacuum cleaners and home comfort",
    displayOrder: 1,
    children: [
      { name: "Fans & Air Coolers", slug: "fans-air-coolers", displayOrder: 1 },
      { name: "Irons & Steamers", slug: "irons-steamers", displayOrder: 2 },
      { name: "Vacuum Cleaners", slug: "vacuum-cleaners", displayOrder: 3 },
    ],
  },
  {
    name: "Kitchen Appliances",
    slug: "kitchen-appliances",
    description: "Mixer grinders, induction cooktops, kettles and blenders",
    displayOrder: 2,
    children: [
      { name: "Mixer Grinders", slug: "mixer-grinders", displayOrder: 1 },
      { name: "Electric Kettles", slug: "electric-kettles", displayOrder: 2 },
      { name: "Induction Cooktops", slug: "induction-cooktops", displayOrder: 3 },
    ],
  },
  {
    name: "Electronics & Audio",
    slug: "electronics-audio",
    description: "Headphones, wireless speakers, smart watches and accessories",
    displayOrder: 3,
    children: [
      { name: "Headphones & Earphones", slug: "headphones-earphones", displayOrder: 1 },
      { name: "Bluetooth Speakers", slug: "bluetooth-speakers", displayOrder: 2 },
      { name: "Smart Watches", slug: "smart-watches", displayOrder: 3 },
    ],
  },
  {
    name: "Crockery & Kitchenware",
    slug: "crockery-kitchenware",
    description: "Dinner sets, cookware, glass sets, storage and flasks",
    displayOrder: 4,
    children: [
      { name: "Cookware & Pans", slug: "cookware-pans", displayOrder: 1 },
      { name: "Dinner Sets", slug: "dinner-sets", displayOrder: 2 },
      { name: "Water Bottles & Flasks", slug: "water-bottles-flasks", displayOrder: 3 },
    ],
  },
  {
    name: "Toys & Games",
    slug: "toys-games",
    description: "Educational toys, board games, remote cars and action figures",
    displayOrder: 5,
    children: [
      { name: "Educational Toys", slug: "educational-toys", displayOrder: 1 },
      { name: "Board Games", slug: "board-games", displayOrder: 2 },
    ],
  },
  {
    name: "Packaged Food & Snacks",
    slug: "packaged-food-snacks",
    description: "Namkeen, dry fruits, sweets, beverages and quick bites",
    displayOrder: 6,
    children: [
      { name: "Namkeen & Savouries", slug: "namkeen-savouries", displayOrder: 1 },
      { name: "Dry Fruits & Nuts", slug: "dry-fruits-nuts", displayOrder: 2 },
    ],
  },
  {
    name: "Clocks & Timepieces",
    slug: "clocks-timepieces",
    description: "Wall clocks, table clocks, alarm clocks and decorative dials",
    displayOrder: 7,
  },
  {
    name: "Sunglasses & Accessories",
    slug: "sunglasses-accessories",
    description: "UV protection eyewear, polarized glasses and cases",
    displayOrder: 8,
  },
];

const BRANDS = [
  { name: "Philips", slug: "philips" },
  { name: "Bajaj", slug: "bajaj" },
  { name: "Havells", slug: "havells" },
  { name: "Prestige", slug: "prestige" },
  { name: "boAt", slug: "boat" },
  { name: "Milton", slug: "milton" },
  { name: "Cello", slug: "cello" },
  { name: "Titan", slug: "titan" },
];

const STORE_SETTINGS = [
  { key: "STORE_NAME", value: "Wondersale Bhopal", description: "Store primary name" },
  { key: "STORE_CITY", value: "Bhopal", description: "Physical store headquarters" },
  { key: "STORE_STATE", value: "Madhya Pradesh", description: "State" },
  { key: "STORE_PINCODE", value: "462001", description: "Store location pincode" },
  { key: "SUPPORT_PHONE", value: "+91 755 4000000", description: "Customer care phone" },
  { key: "SUPPORT_EMAIL", value: "support@wondersale.in", description: "Customer care email" },
  {
    key: "FREE_SHIPPING_THRESHOLD_BHOPAL_PAISE",
    value: "49900",
    description: "Free shipping threshold for Bhopal",
  },
  {
    key: "FREE_SHIPPING_THRESHOLD_PAN_INDIA_PAISE",
    value: "99900",
    description: "Free shipping threshold pan-India",
  },
  {
    key: "MAX_COD_PAISE",
    value: "500000",
    description: "Maximum COD order limit in paise (₹5,000)",
  },
];

const BHOPAL_PINCODES = [
  "462001",
  "462002",
  "462003",
  "462004",
  "462007",
  "462008",
  "462010",
  "462011",
  "462013",
  "462016",
  "462021",
  "462022",
  "462023",
  "462024",
  "462026",
  "462030",
  "462038",
  "462042",
];

export async function seedDatabase() {
  console.log(
    "🌱 Starting Wondersale seed script (Categories, Brands, Settings, Delivery Pincodes, Admin)..."
  );

  // Seed Categories
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, displayOrder: cat.displayOrder },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        displayOrder: cat.displayOrder,
      },
    });

    if (cat.children) {
      for (const child of cat.children) {
        await prisma.category.upsert({
          where: { slug: child.slug },
          update: { name: child.name, parentId: parent.id, displayOrder: child.displayOrder },
          create: {
            name: child.name,
            slug: child.slug,
            parentId: parent.id,
            displayOrder: child.displayOrder,
          },
        });
      }
    }
  }
  console.log(`✓ Seeded ${CATEGORIES.length} top-level retail categories.`);

  // Seed Brands
  for (const brand of BRANDS) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: { name: brand.name, slug: brand.slug },
    });
  }
  console.log(`✓ Seeded ${BRANDS.length} verified catalog brands.`);

  // Seed Store Settings
  for (const setting of STORE_SETTINGS) {
    await prisma.storeSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: { key: setting.key, value: setting.value, description: setting.description },
    });
  }
  console.log(`✓ Seeded ${STORE_SETTINGS.length} store configuration parameters.`);

  // Seed Bhopal Pincodes
  for (const pin of BHOPAL_PINCODES) {
    await prisma.deliveryPincode.upsert({
      where: { pincode: pin },
      update: { city: "Bhopal", state: "Madhya Pradesh", isDeliverable: true, isCodAllowed: true },
      create: {
        pincode: pin,
        city: "Bhopal",
        state: "Madhya Pradesh",
        isDeliverable: true,
        isCodAllowed: true,
        minDeliveryDays: 1,
        maxDeliveryDays: 2,
      },
    });
  }
  console.log(`✓ Seeded ${BHOPAL_PINCODES.length} Bhopal delivery and COD pincodes.`);

  // Seed Initial Admin User
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@wondersale.in";
  await prisma.user.upsert({
    where: { mobile: "9999999999" },
    update: { email: adminEmail, fullName: "Wondersale Admin", role: "ADMIN" },
    create: {
      mobile: "9999999999",
      email: adminEmail,
      fullName: "Wondersale Admin",
      role: "ADMIN",
    },
  });
  console.log(`✓ Seeded Admin account for ${adminEmail}.`);

  console.log("✨ Seed completed successfully! Zero fake/demo products seeded.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .catch((err) => {
      console.error("❌ Seed script error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
