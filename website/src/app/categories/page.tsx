"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Fan,
  Headphones,
  Coffee,
  Gamepad2,
  Sparkles,
  Shirt,
  ShoppingBag,
  ArrowLeft,
  Search,
  Mic,
  Camera,
  Heart,
  ShoppingCart,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RotateCcw,
  CreditCard,
  Plus,
} from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { ProductCard } from "@/components/ui/ProductCard";
import { DEMO_PRODUCTS } from "@/data/demo-products";

interface DepartmentProduct {
  id: string;
  sku: string;
  title: string;
  price: string;
  originalPrice: string;
  discount: string;
  rating: string;
  reviews: string;
  badge?: string;
  badgeColor?: string;
  image: string;
  express2Hr?: boolean;
}

interface Department {
  id: string;
  name: string;
  slug: string;
  itemCount: string;
  description: string;
  icon: React.ElementType;
  subcategories: string[];
  featuredProducts: DepartmentProduct[];
}

const DEPARTMENTS: Department[] = [
  {
    id: "kitchen-appliances",
    name: "Kitchen Appliances",
    slug: "kitchen-appliances",
    itemCount: "420+ Products",
    description: "Air fryers, induction cooktops, mixer grinders & blenders",
    icon: Utensils,
    subcategories: [
      "Pressure Cookers",
      "Mixer Grinders",
      "Air Fryers",
      "Induction Cooktops",
      "Electric Kettles",
      "Sandwich Makers",
    ],
    featuredProducts: [
      {
        id: "prod-ka-1",
        sku: "WND-PR-502",
        title: "Prestige Svachh 5L Stainless Steel Deep Outer Lid Cooker",
        price: "₹1,749",
        originalPrice: "₹2,450",
        discount: "28% OFF",
        rating: "4.6",
        reviews: "1,420",
        badge: "Bestseller",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCMSz9Bl_15FHxYl2lN0a9ZN-S3LYCheVvXmowuO3VeWKRMhNaczbw0CebYwF3w1bBxJvp5PtWYa2qwaOVYSVMcesbcPTZmxkIvim2W5tjIqJxr8WBRVNE-N1WU8pNZW-Iik3pmMtDoptI7700p2twZkFCo_5wrhrbY5xzv1iwTt9T_LwXD3PXEz5PXOgynadcuQihG0RK7Nt6EjsdBLAxB4FVCPi9RhRh3FeKCJ9ZayNZiN5NJYNdXwg",
        express2Hr: true,
      },
      {
        id: "prod-ka-2",
        sku: "WND-PH-750",
        title: "Philips HL7756/00 750W Heavy Duty Mixer Grinder with 3 Jars",
        price: "₹3,299",
        originalPrice: "₹5,295",
        discount: "Save ₹1,996",
        rating: "4.7",
        reviews: "840",
        badge: "42% OFF",
        badgeColor: "bg-rose-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAWEvTTxfJWQtGY29j85N1N6GnVzJs6xAnOwsZqyg1NGLosdqKEyJafiFTqexE1WnOvGEYvQbjh5M7eJ1IvYYvzpIIV7AiwicCWbEXUZxWqDhS9fDSBfaxHfDc4rcf9qMndF2vlWxvZEsC_zu9XnfQy1chv3HwGxRC9Mgpqo4__bOy4ynrgKF6gDT7LGVVfp0ckqlGWteN23MGxetjRhxeC2-cwuipGl-7T4_5aCHXNeo430s1vggY7lg",
        express2Hr: true,
      },
      {
        id: "prod-ka-3",
        sku: "WND-AF-450",
        title: "CrispHouse Digital 4.5L Air Fryer with 8 Touch Presets",
        price: "₹3,899",
        originalPrice: "₹6,499",
        discount: "40% OFF",
        rating: "4.8",
        reviews: "612",
        badge: "Deal of Day",
        badgeColor: "bg-amber-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAUf7GZJO5V10wKbLQQ77X8o_qloUQ9lIlF6KNkhNr3rXfyaUweBmf__L4SyJLA4j24vSDEuWOjt1W3w3vFcg-re8Un4nRCX4vHEy2WHblhfVARISFc6LHis0M7Ru7lq3_GknRCw02XMqgGyLb6i00bgwqDJCKipCcFd6qrTD6EknHiPHBxAEk8KmhXrFBqfJv3DswnYBkL3ge5x5VmXUWmprhs2pXvqj_CsLcY3nnmv_Ua17sAU5JV-A",
        express2Hr: true,
      },
    ],
  },
  {
    id: "home-appliances",
    name: "Home Appliances",
    slug: "home-appliances",
    itemCount: "280+ Products",
    description: "Heavy duty irons, handheld vacuums, heaters & ceiling fans",
    icon: Fan,
    subcategories: [
      "Dry & Steam Irons",
      "Handheld Vacuums",
      "Water Heaters",
      "Ceiling & Table Fans",
      "Room Heaters",
      "Emergency Lights",
    ],
    featuredProducts: [
      {
        id: "prod-ha-1",
        sku: "WND-IR-100",
        title: "Havells Gracia 1000W Heavy Duty Dry Iron with Teflon Coating",
        price: "₹1,499",
        originalPrice: "₹2,195",
        discount: "32% OFF",
        rating: "4.5",
        reviews: "518",
        badge: "Top Rated",
        badgeColor: "bg-blue-600",
        image:
          "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-ha-2",
        sku: "WND-VC-300",
        title: "AeroClean Desktop Wireless Mini Vacuum for Home & Car",
        price: "₹399",
        originalPrice: "₹799",
        discount: "50% OFF",
        rating: "4.4",
        reviews: "320",
        badge: "New Arrival",
        badgeColor: "bg-emerald-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBXYTlFUKnKhext0OCqG0Q3Xet5JQbIwPJC7KXCWne0yMW4tganHpPTVqV4cvBF7YmP0zY-i8wM1dDQV1Japh2URp1biupSBgs5goUP0IltbYIlBe1gPLeKI_iCr_cw8kA3vCO_mT7XgFubOI27D9tSYItTyfb6vUkItsf0ODpqw9c7F6r26j0BBaU9MK5R4567aMvyvJv_OwApImKwxuXrtaoDxHLl_Q65r6HSsFoH-Z9CMRPVRWCkCA",
        express2Hr: true,
      },
      {
        id: "prod-ha-3",
        sku: "WND-KT-150",
        title: "Bajaj 1.5L Stainless Steel Cordless Electric Kettle",
        price: "₹849",
        originalPrice: "₹1,299",
        discount: "35% OFF",
        rating: "4.6",
        reviews: "950",
        badge: "Essential",
        badgeColor: "bg-amber-600",
        image:
          "https://images.unsplash.com/photo-1594213114663-ddf3f2a02126?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
    ],
  },
  {
    id: "electronics-audio",
    name: "Electronics & Audio",
    slug: "electronics-audio",
    itemCount: "350+ Products",
    description: "Wireless headphones, smart speakers, earbuds & accessories",
    icon: Headphones,
    subcategories: [
      "Wireless Headphones",
      "TWS Earbuds",
      "Bluetooth Speakers",
      "Smartwatches",
      "Car Mounts & Docks",
      "Fast Chargers",
    ],
    featuredProducts: [
      {
        id: "prod-ea-1",
        sku: "WND-BT-450",
        title: "boAt Rockerz 450 Bluetooth On-Ear Headphone with 15H Playback",
        price: "₹1,499",
        originalPrice: "₹3,990",
        discount: "62% OFF",
        rating: "4.5",
        reviews: "3,890",
        badge: "Trending",
        badgeColor: "bg-purple-600",
        image:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-ea-2",
        sku: "WND-SP-200",
        title: "SoundPulse RGB Wireless Portable Speaker 10W Bass Boost",
        price: "₹1,299",
        originalPrice: "₹2,499",
        discount: "48% OFF",
        rating: "4.7",
        reviews: "410",
        badge: "Hot Deal",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDmYpYYgOcAqx8zW2hmXeF5lgJgFB03SDzmr2JqIRTMHSAiVxdL6sT3FHPc0SksAwcHJpP7gU0ZIE0sIMBL09f5SMbTusBEsD9UiZ_RaP_5P011JBecJ5kiCwZhnDbXVDWDjNHAtCn89uJPFG_MLAisZbg6Mlwx1xvQ2lcL6SSVSFwjk6AQlMHafVHoReK5vHXJG1fBOmocUh8qif0vg8W-B4DNRIP5dYNbvzEfKB5QpWc2mjFGViG81g",
        express2Hr: true,
      },
      {
        id: "prod-ea-3",
        sku: "WND-MG-360",
        title: "MagSafe Fast Wireless Magnetic Car Dashboard & AC Vent Mount",
        price: "₹849",
        originalPrice: "₹1,599",
        discount: "47% OFF",
        rating: "4.6",
        reviews: "285",
        badge: "Must Have",
        badgeColor: "bg-sky-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDuTeOnRD75hn8YVl2MFt4uOnxo485Kxl7_Za-kIYoNnpsjGw0x5RQbOl6y-Me4_tlof3AFvgprWpgO9Zme_Htf1SneSeN4_WTo6tRR21p0pYkIWL4r_Y9tG4mweqLf5oR3jC75KLPvs8YD485XZ4_YmWvcTKKgaBmd7-LzYV-GntWURWOgfijRPGOkBik7Bi98jJEnjdbnGumno-BPXHrp95RxXw1QOY2waB1X7iKGU9y2EGRXyNnpNg",
        express2Hr: true,
      },
    ],
  },
  {
    id: "crockery-kitchenware",
    name: "Crockery & Kitchenware",
    slug: "crockery-kitchenware",
    itemCount: "510+ Products",
    description: "Opalware dinner sets, hard anodized cookware & flasks",
    icon: Coffee,
    subcategories: [
      "Dinner Sets",
      "Non-Stick Cookware",
      "Thermosteel Flasks",
      "Modular Storage",
      "Serving Trays",
      "Ceramic Mugs",
    ],
    featuredProducts: [
      {
        id: "prod-ck-1",
        sku: "WND-DS-16P",
        title: "Clay Craft 16-Piece Ceramic Dinner Set (Microwave Safe)",
        price: "₹1,399",
        originalPrice: "₹2,499",
        discount: "44% OFF",
        rating: "4.8",
        reviews: "780",
        badge: "Opalware",
        badgeColor: "bg-emerald-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAJe7xis5zKoGIyTbHhUMUVKjDb2d-hhGspRS0nSA67ntQoEV9iRlc280OojE7Xa9CprFgmU8fu-ymexGmxzEPzkt_QbpZcK0R29-M2xZg_HVSgch2DCC3v0kjjHTAAGpnz51xrIIZrbuuCpwT44o0JGqG9AAyEmArTDdSahwitTurYtZujCgNoqRNhHFl6ugHNJ4LDbmv0rlH7SfMnZuEzGR9FRdWRGaz3kvYz35VXgmMjH2KupSegAg",
        express2Hr: true,
      },
      {
        id: "prod-ck-2",
        sku: "WND-HW-28T",
        title: "Hawkins Futura Hard Anodized 28cm Dosa Tawa with Handle",
        price: "₹1,120",
        originalPrice: "₹1,400",
        discount: "20% OFF",
        rating: "4.7",
        reviews: "1,150",
        badge: "Bestseller",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDG5yEHa_FLnq6pBUO85i4jsGwE7DVGp_O3NF_S-PfWvFE1E0iaf_6C80ZG4KuMuVEeh6mNilhcFZoxODBPQv_Okxw8rxboJC4-exBYxjLnBu4sYQjVJ2-GwQQOQjWQgC7fdXXXnk3PoOppDDg7IMeporM9JLLzrDTry-asm6Xsj65l7pBOjWUFDvNcNQsBLduMmR1xPCutr2lE_jfBMOFbvwWgYSKkK0BIXuzBUyh2mFVNQzljBTwUoQ",
        express2Hr: true,
      },
      {
        id: "prod-ck-3",
        sku: "WND-ML-100",
        title: "Milton Thermosteel Flip Lid 1000ml Hot & Cold Flask",
        price: "₹749",
        originalPrice: "₹1,099",
        discount: "32% OFF",
        rating: "4.6",
        reviews: "2,300",
        badge: "Essential",
        badgeColor: "bg-teal-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAl8bvIIZlKNj21Gq9b6ZwT_HNU9rhFze0se3zlEKoQX-5wgd2wt3s6XML4pvnZsspjmyZEg5oZhBvZ--5w7YYfe-eSCtpK-uHHlOMSvbj4OWt5c_PtUg6Irajcv8DSMsFqoYeXrr-WcKQ0HFPdsa64j1DQebsMktLqvx9nr2Xkz_YJJAnHdZyw0rC9bSZJ35tWwRA7JgdLz18nD4B2WtouSdHxDOnAl5YvQGwYI0KS82TJzb1XwxDvcQ",
        express2Hr: true,
      },
    ],
  },
  {
    id: "toys-games",
    name: "Toys & Games",
    slug: "toys-games",
    itemCount: "310+ Products",
    description: "STEM educational toys, board games, puzzles & action models",
    icon: Gamepad2,
    subcategories: [
      "STEM Building Sets",
      "Educational Puzzles",
      "Board Games",
      "Action Figures",
      "Plush Soft Toys",
      "Remote Control Cars",
    ],
    featuredProducts: [
      {
        id: "prod-tg-1",
        sku: "WND-TY-301",
        title: "Wooden STEM Montessori Geometric Educational Puzzle Board",
        price: "₹499",
        originalPrice: "₹899",
        discount: "44% OFF",
        rating: "4.8",
        reviews: "340",
        badge: "Ages 3-8",
        badgeColor: "bg-amber-600",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuD37ApjZxEPIH29J5O9A8EdaspEO4NB2MUkfTComCU8qol45FjqL0wKJQpVbJlIH-Ao1xen1ITW4rTgqN8enPGkxEj0C7jcuEenBanwxcoC5zwk7AUBvNQuCt8TwpV1TYPtnG5uaiZDnDyU7lfbFFoR4QKufOFTnE9-h2rwMZrDZivD0_3TXsBk1K7xGV3GANp_7XBbPBMEdK5nHFpScPwuwfLmT7lwXbP5a2Fu_nnKMzVCvgsRRJO87A",
        express2Hr: true,
      },
      {
        id: "prod-tg-2",
        sku: "WND-TY-302",
        title: "SpeedDrift 1:18 Rechargeable High Speed RC Monster Truck",
        price: "₹1,199",
        originalPrice: "₹1,999",
        discount: "40% OFF",
        rating: "4.5",
        reviews: "210",
        badge: "Bestseller",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-tg-3",
        sku: "WND-TY-303",
        title: "Classic Strategy Board Game Deluxe Family Edition",
        price: "₹699",
        originalPrice: "₹1,199",
        discount: "42% OFF",
        rating: "4.7",
        reviews: "185",
        badge: "Family Fun",
        badgeColor: "bg-indigo-600",
        image:
          "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
    ],
  },
  {
    id: "personal-care-grooming",
    name: "Personal Care & Grooming",
    slug: "personal-care-grooming",
    itemCount: "290+ Products",
    description: "Hair styling, trimmers, skin routines & wellness essentials",
    icon: Sparkles,
    subcategories: [
      "Beard Trimmers",
      "Hair Dryers",
      "Oral Care",
      "Skin Serums",
      "Massagers",
      "Hair Straighteners",
    ],
    featuredProducts: [
      {
        id: "prod-pc-1",
        sku: "WND-TR-001",
        title: "Philips Cordless Series 3000 Beard Trimmer with Fast Charge",
        price: "₹1,299",
        originalPrice: "₹1,895",
        discount: "31% OFF",
        rating: "4.6",
        reviews: "1,240",
        badge: "Top Choice",
        badgeColor: "bg-blue-600",
        image:
          "https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-pc-2",
        sku: "WND-HD-002",
        title: "Havells Compact Foldable 1200W Hot & Cold Hair Dryer",
        price: "₹899",
        originalPrice: "₹1,495",
        discount: "40% OFF",
        rating: "4.5",
        reviews: "630",
        badge: "Popular",
        badgeColor: "bg-rose-600",
        image:
          "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-pc-3",
        sku: "WND-TB-003",
        title: "Sonic Clean Smart Rechargeable Electric Toothbrush",
        price: "₹999",
        originalPrice: "₹1,999",
        discount: "50% OFF",
        rating: "4.7",
        reviews: "410",
        badge: "Deal",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://images.unsplash.com/photo-1559591937-e1032397e55a?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
    ],
  },
  {
    id: "fashion-footwear",
    name: "Fashion & Footwear",
    slug: "fashion-footwear",
    itemCount: "640+ Products",
    description: "Athleisure, casual footwear, sunglasses & bags",
    icon: Shirt,
    subcategories: [
      "Casual Sneakers",
      "Polarized Sunglasses",
      "Cotton T-Shirts",
      "Backpacks",
      "Sports Sandals",
      "Leather Wallets",
    ],
    featuredProducts: [
      {
        id: "prod-ff-1",
        sku: "WND-SG-101",
        title: "Classic Aviator UV400 Polarized Metal Sunglasses",
        price: "₹699",
        originalPrice: "₹1,999",
        discount: "65% OFF",
        rating: "4.6",
        reviews: "512",
        badge: "Bestseller",
        badgeColor: "bg-[#d91e2a]",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAGvF0K0-uM4gV_37rT1u6yWw0p-3Ue39hV1N7rPj0yS0n1947bH8gW4s4L8n914vj94u381047H",
        express2Hr: true,
      },
      {
        id: "prod-ff-2",
        sku: "WND-SN-102",
        title: "UrbanGlide Ultra-Lightweight Breathable Running Sneakers",
        price: "₹1,499",
        originalPrice: "₹2,999",
        discount: "50% OFF",
        rating: "4.5",
        reviews: "820",
        badge: "Top Pick",
        badgeColor: "bg-indigo-600",
        image:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-ff-3",
        sku: "WND-BP-103",
        title: "Water-Resistant Laptop Backpack with USB Charging Port",
        price: "₹1,199",
        originalPrice: "₹2,499",
        discount: "52% OFF",
        rating: "4.7",
        reviews: "690",
        badge: "Deal",
        badgeColor: "bg-emerald-600",
        image:
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
    ],
  },
  {
    id: "groceries-daily-essentials",
    name: "Groceries & Daily Essentials",
    slug: "groceries-daily-essentials",
    itemCount: "1,200+ Products",
    description: "Whole grains, specialty coffees, dry fruits & cleaning",
    icon: ShoppingBag,
    subcategories: [
      "Artisan Coffee & Tea",
      "Dry Fruits & Nuts",
      "Organic Grains",
      "Healthy Snacks",
      "Home Cleaners",
      "Breakfast Cereals",
    ],
    featuredProducts: [
      {
        id: "prod-gr-1",
        sku: "WND-CF-201",
        title: "Blue Tokai Coffee Roasters Vienna Roast Ground Coffee 250g",
        price: "₹475",
        originalPrice: "₹550",
        discount: "14% OFF",
        rating: "4.9",
        reviews: "680",
        badge: "Fresh Roast",
        badgeColor: "bg-amber-700",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuB__IyrwPhxgtklPhauSgrwjd3_QkrwV1nZrTjJnnBYP6_7xigzCiGdx2A29qvl0vvdbY0rDUCOpzKdFHpfYA02iQmuWOqPJHvZuEi48jUEu79SMUhEiierVGRnp6xpVt99WSUCTm97DpdF7YDtiQq7fU1gJlpDsoPbyC2iVic2T32cTCvLFjdKqaiybN5BLcmk6CJMspiL6RyTGehQMP_f4SpE8sok_JunCRU2yYs9nV-B6esCtDM9xA",
        express2Hr: true,
      },
      {
        id: "prod-gr-2",
        sku: "WND-DF-202",
        title: "California Premium Jumbo Whole Almonds 500g Vacuum Pack",
        price: "₹489",
        originalPrice: "₹699",
        discount: "30% OFF",
        rating: "4.8",
        reviews: "1,120",
        badge: "Super Saver",
        badgeColor: "bg-emerald-600",
        image:
          "https://images.unsplash.com/photo-1508061252445-5350f3ab0a55?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
      {
        id: "prod-gr-3",
        sku: "WND-OG-203",
        title: "Pure Mountain Raw Organic Honey Glass Jar 500g",
        price: "₹380",
        originalPrice: "₹520",
        discount: "27% OFF",
        rating: "4.7",
        reviews: "410",
        badge: "100% Pure",
        badgeColor: "bg-amber-600",
        image:
          "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80",
        express2Hr: true,
      },
    ],
  },
];

export default function AllCategoriesPage() {
  const router = useRouter();
  const [selectedDeptId, setSelectedDeptId] = useState<string>("kitchen-appliances");
  const [searchQuery, setSearchQuery] = useState("");
  const { cartCount, addToCart, isInWishlist, toggleWishlist } = useStorefront();

  const currentDept =
    DEPARTMENTS.find((d) => d.id === selectedDeptId) || DEPARTMENTS[0];

  const handleAddToCart = (e: React.MouseEvent, prod: DepartmentProduct) => {
    e.preventDefault();
    e.stopPropagation();
    const priceNum = parseInt(prod.price.replace(/[^\d]/g, ""), 10) || 999;
    const origPriceNum = parseInt(prod.originalPrice.replace(/[^\d]/g, ""), 10) || 1299;
    addToCart(
      {
        id: prod.id,
        slug: prod.id,
        title: prod.title,
        sellingPricePaise: priceNum * 100,
        mrpPaise: origPriceNum * 100,
        imageUrl: prod.image,
      },
      1
    );
  };

  const handleToggleWish = (e: React.MouseEvent, prod: DepartmentProduct) => {
    e.preventDefault();
    e.stopPropagation();
    const priceNum = parseInt(prod.price.replace(/[^\d]/g, ""), 10) || 999;
    const origPriceNum = parseInt(prod.originalPrice.replace(/[^\d]/g, ""), 10) || 1299;
    toggleWishlist({
      id: prod.id,
      slug: prod.id,
      title: prod.title,
      brand: currentDept.name,
      sellingPricePaise: priceNum * 100,
      mrpPaise: origPriceNum * 100,
      rating: parseFloat(prod.rating) || 4.5,
      ratingCount: parseInt(prod.reviews.replace(/[^\d]/g, ""), 10) || 100,
      inStock: true,
      imageUrl: prod.image,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#2C1810] antialiased flex flex-col justify-between font-sans">
      {/* 1. Global Header (Exact same header as Home Page) */}
      <GlobalHeader />

      {/* Main Content Wrapper */}
      <main className="flex-1 w-full pb-20 px-4 sm:px-8 py-5">
        <div className="max-w-[1280px] mx-auto space-y-6">
          {/* Breadcrumbs & Section Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="w-9 h-9 rounded-xl border border-[#EADFC7] bg-[#F4ECDC] flex items-center justify-center text-[#735A4A] hover:border-[#7A0C16] hover:text-[#7A0C16] shadow-xs transition-colors"
                title="Go Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <nav className="flex items-center space-x-2 text-xs text-[#735A4A] mb-0.5">
                  <Link href="/" className="hover:text-[#2C1810] transition-colors">
                    Home
                  </Link>
                  <span>/</span>
                  <span className="text-[#2C1810] font-semibold">Departments</span>
                </nav>
                <h1 className="text-xl sm:text-2xl font-bold text-[#2C1810] tracking-tight font-serif">
                  All Departments &amp; Categories
                </h1>
              </div>
            </div>

            {/* Central Warehouse Connected Pill */}
            <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-[#735A4A]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
              <span>Bhopal Central Warehouse Connected</span>
            </div>
          </div>

          {/* =========================================================================
              HERO BANNER (Deep burgundy strip matching hero screenshot)
              ========================================================================= */}
          <section
            className="relative overflow-hidden rounded-3xl bg-[#5A0A10] p-6 sm:p-8 text-[#FDF8EE] shadow-xl border border-[#7A0C16]"
            data-purpose="hero-banner"
          >
            {/* Wave glow decorations */}
            <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute right-1/4 -top-12 w-48 h-48 rounded-full bg-black/20 blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2.5 max-w-2xl">
                {/* Verified Pill Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-amber-200 backdrop-blur-sm border border-white/15">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Verified Bhopal Store Inventory
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-[#FDF8EE]">
                  Explore All 8 Retail Departments
                </h2>
                <p className="text-sm sm:text-base text-[#D8B4B8] font-normal leading-relaxed">
                  Click any department below to view verified products with 2–Hour Express Delivery in Bhopal &amp; Pan–India shipping.
                </p>
              </div>

              {/* Express Delivery Tag */}
              <div className="flex-shrink-0">
                <div className="inline-flex items-center gap-2 bg-[#42060B]/70 backdrop-blur-md border border-[#7A0C16] px-4 py-2.5 rounded-2xl text-[#FDF8EE] text-xs sm:text-sm font-semibold shadow-inner">
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-[#5A0A10] flex items-center justify-center font-bold text-xs">
                    ⚡
                  </span>
                  <span>2–Hour Delivery Active</span>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              TWO COLUMN DIRECTORY LAYOUT
              ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Department List (8 Departments) */}
            <aside className="lg:col-span-4 xl:col-span-4 space-y-3" data-purpose="department-selector">
              <div className="flex items-center justify-between pb-1 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#735A4A]">
                  Select Department ({DEPARTMENTS.length})
                </h3>
                <span className="text-[11px] text-[#735A4A]/80 font-medium">Bhopal Hub Stock</span>
              </div>

              <div className="space-y-2.5">
                {DEPARTMENTS.map((dept) => {
                  const Icon = dept.icon;
                  const isSelected = selectedDeptId === dept.id;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptId(dept.id)}
                      className={`w-full text-left rounded-2xl p-3.5 flex items-center justify-between transition-all relative overflow-hidden group cursor-pointer ${
                        isSelected
                          ? "bg-[#FAF3E0] border-2 border-[#7A0C16] shadow-sm"
                          : "bg-[#FFFFFF] border border-[#EADFC7] hover:border-[#D5C4A1] shadow-xs hover:bg-[#FDF8EE]"
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${
                            isSelected
                              ? "bg-[#5A0A10] text-[#FDF8EE] group-hover:scale-105"
                              : "bg-[#F4ECDC] text-[#735A4A] group-hover:text-[#7A0C16]"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4
                            className={`text-sm ${
                              isSelected
                                ? "font-bold text-[#2C1810] group-hover:text-[#7A0C16]"
                                : "font-semibold text-[#4A3428]"
                            } transition-colors`}
                          >
                            {dept.name}
                          </h4>
                          <p
                            className={`text-xs ${
                              isSelected ? "text-[#7A0C16] font-semibold" : "text-[#735A4A]"
                            }`}
                          >
                            {dept.itemCount}
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <ChevronRight className="w-5 h-5 text-[#7A0C16] flex-shrink-0 transform group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#735A4A]/60 group-hover:text-[#2C1810] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* RIGHT COLUMN: Selected Department Deep-Dive */}
            <section className="lg:col-span-8 xl:col-span-8 space-y-6" data-purpose="department-detail">
              {/* Department Header Card */}
              <div className="bg-[#FFFFFF] border border-[#EADFC7] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#5A0A10] flex items-center justify-center text-[#FDF8EE] flex-shrink-0 shadow-md">
                    <currentDept.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#2C1810] font-serif">
                      {currentDept.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#735A4A]">
                      {currentDept.description}
                    </p>
                  </div>
                </div>

                {/* Browse All Products CTA */}
                <Link
                  href={`/category/${currentDept.slug}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] text-sm font-semibold shadow-md transition-all flex-shrink-0"
                >
                  <span>Browse All Products</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </Link>
              </div>

              {/* Popular Sub-Categories Strip */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#735A4A]">
                  Popular Sub-Categories in {currentDept.name}:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentDept.subcategories.map((sub) => (
                    <Link
                      key={sub}
                      href={`/category/${currentDept.slug}?sub=${encodeURIComponent(sub)}`}
                      className="px-3.5 py-1.5 bg-[#FAF3E0] border border-[#EADFC7] hover:border-[#7A0C16] hover:text-[#7A0C16] rounded-xl text-xs font-semibold text-[#4A3428] shadow-xs transition-colors"
                    >
                      {sub}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Featured Products Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#735A4A]">
                    Featured Products in this Category:
                  </h4>
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    <span>Live in Bhopal</span>
                  </div>
                </div>

                {/* Products Grid: Responsive Cards displaying all category products */}
                {(() => {
                  const deptProducts = DEMO_PRODUCTS.filter(
                    (p) =>
                      p.categorySlug.toLowerCase() === currentDept.slug.toLowerCase() ||
                      p.category.toLowerCase().replace(/\s+/g, "-") === currentDept.slug.toLowerCase()
                  );

                  if (deptProducts.length > 0) {
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                        {deptProducts.map((prod) => {
                          const isWish = isInWishlist(prod.id);
                          return (
                            <ProductCard
                              key={prod.id}
                              id={prod.id}
                              slug={prod.slug}
                              title={prod.title}
                              brand={prod.brand}
                              mrpPaise={prod.mrpPaise}
                              sellingPricePaise={prod.sellingPricePaise}
                              imageUrl={prod.imageUrl}
                              rating={prod.rating}
                              ratingCount={prod.ratingCount}
                              inStock={prod.inStock}
                              badge={prod.bestsellerRank ? "Bestseller" : undefined}
                              express2Hr={true}
                              variant="grid"
                              onAddToCart={() =>
                                addToCart({
                                  id: prod.id,
                                  slug: prod.slug,
                                  title: prod.title,
                                  sellingPricePaise: prod.sellingPricePaise,
                                  mrpPaise: prod.mrpPaise,
                                  imageUrl: prod.imageUrl,
                                })
                              }
                              onToggleWishlist={() =>
                                toggleWishlist({
                                  id: prod.id,
                                  slug: prod.slug,
                                  title: prod.title,
                                  brand: prod.brand,
                                  sellingPricePaise: prod.sellingPricePaise,
                                  mrpPaise: prod.mrpPaise,
                                  imageUrl: prod.imageUrl,
                                })
                              }
                              isWishlisted={isWish}
                            />
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                      {currentDept.featuredProducts.map((prod) => {
                        const isWish = isInWishlist(prod.id);
                        const priceNum = parseInt(prod.price.replace(/[^\d]/g, ""), 10) || 999;
                        const origPriceNum = parseInt(prod.originalPrice.replace(/[^\d]/g, ""), 10) || 1299;

                        return (
                          <ProductCard
                            key={prod.id}
                            id={prod.id}
                            slug={prod.id}
                            title={prod.title}
                            brand={currentDept.name}
                            mrpPaise={origPriceNum * 100}
                            sellingPricePaise={priceNum * 100}
                            imageUrl={prod.image}
                            rating={parseFloat(prod.rating) || 4.5}
                            ratingCount={parseInt(prod.reviews.replace(/[^\d]/g, ""), 10) || 100}
                            inStock={true}
                            badge={prod.badge}
                            express2Hr={prod.express2Hr}
                            variant="grid"
                            onAddToCart={() => handleAddToCart({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent, prod)}
                            onToggleWishlist={() => handleToggleWish({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent, prod)}
                            isWishlisted={isWish}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Banner for Same Day Express Delivery */}
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                    ⚡
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Need it immediately?</h5>
                    <p className="text-xs text-slate-600">
                      Order by 6:00 PM for verified 2-hour doorstep delivery across Bhopal pin codes.
                    </p>
                  </div>
                </div>
                <Link
                  href="/delivery-checker"
                  className="hidden sm:inline-flex text-xs font-bold text-amber-800 hover:text-amber-900 underline underline-offset-4"
                >
                  Check Pin Eligibility →
                </Link>
              </div>
            </section>
          </div>

          {/* =========================================================================
              TRUST PILLARS STRIP
              ========================================================================= */}
          <section className="mt-12 pt-8 border-t border-slate-200" data-purpose="trust-badges">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-center space-x-3.5 p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">2-Hour Express Delivery</h5>
                  <p className="text-[11px] text-slate-500">Live for 462001 &amp; nearby</p>
                </div>
              </div>

              <div className="flex items-center space-x-3.5 p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">100% Genuine Brands</h5>
                  <p className="text-[11px] text-slate-500">Authorized manufacturer stock</p>
                </div>
              </div>

              <div className="flex items-center space-x-3.5 p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">7-Day Easy Returns</h5>
                  <p className="text-[11px] text-slate-500">Doorstep instant pickup</p>
                </div>
              </div>

              <div className="flex items-center space-x-3.5 p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Secure Payments</h5>
                  <p className="text-[11px] text-slate-500">UPI, Cards &amp; Pay on Delivery</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================================
          MAIN FOOTER (Matching HTML specification)
          ========================================================================= */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Brand Summary */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#d91e2a] flex items-center justify-center text-white font-bold">
                  ⚡
                </div>
                <span className="font-bold text-xl text-white font-display">WONDERSALE</span>
              </div>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
                Wondersale is Bhopal’s premier retail omnichannel platform delivering over 15,000 verified kitchen, home, electronic, and daily essential products directly to your doorstep in 2 hours.
              </p>
              <div className="text-[11px] text-slate-500">
                Fulfillment Centre: Plot 18, Commercial Zone, MP Nagar Zone-II, Bhopal, MP 462011
              </div>
            </div>

            {/* Quick Links: Departments */}
            <div className="space-y-3">
              <h6 className="text-white font-bold text-xs uppercase tracking-wider">Top Departments</h6>
              <ul className="space-y-2">
                <li><Link href="/category/kitchen-appliances" className="hover:text-white transition-colors">Kitchen Appliances</Link></li>
                <li><Link href="/category/home-appliances" className="hover:text-white transition-colors">Home Appliances</Link></li>
                <li><Link href="/category/crockery-kitchenware" className="hover:text-white transition-colors">Crockery &amp; Cookware</Link></li>
                <li><Link href="/category/electronics-audio" className="hover:text-white transition-colors">Electronics &amp; Audio</Link></li>
                <li><Link href="/category/personal-care-grooming" className="hover:text-white transition-colors">Personal Grooming</Link></li>
              </ul>
            </div>

            {/* Quick Links: Help & Customer */}
            <div className="space-y-3">
              <h6 className="text-white font-bold text-xs uppercase tracking-wider">Customer Care</h6>
              <ul className="space-y-2">
                <li><Link href="/track" className="hover:text-white transition-colors">Track Your Order</Link></li>
                <li><Link href="/pincodes" className="hover:text-white transition-colors">2-Hour Delivery Pin Codes</Link></li>
                <li><Link href="/returns" className="hover:text-white transition-colors">Return Policy</Link></li>
                <li><Link href="/warranty" className="hover:text-white transition-colors">Warranty &amp; Service</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Contact Support</Link></li>
              </ul>
            </div>

            {/* Quick Links: Legal & Assurance */}
            <div className="space-y-3">
              <h6 className="text-white font-bold text-xs uppercase tracking-wider">Policies &amp; Trust</h6>
              <ul className="space-y-2">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Sale</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Notice</Link></li>
                <li><Link href="/grievance" className="hover:text-white transition-colors">Grievance Officer</Link></li>
                <li><Link href="/wholesale" className="hover:text-white transition-colors">Wholesale &amp; Bulk Orders</Link></li>
                <li><Link href="/stores" className="hover:text-white transition-colors">Store Locator</Link></li>
              </ul>
            </div>
          </div>

          {/* Copyright Strip */}
          <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>© 2025 Wondersale Retail India Private Limited. All rights reserved.</p>
            <div className="flex items-center space-x-4">
              <span>Crafted for Bhopal Shoppers</span>
              <span>•</span>
              <span className="text-emerald-500 font-medium">Servers Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Tab Bar */}
      <BottomTabBar />
    </div>
  );
}
