"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Fan,
  Utensils,
  Headphones,
  Coffee,
  Gamepad2,
  Cookie,
  Clock,
  Glasses,
  ChevronRight,
} from "lucide-react";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

const CATEGORIES = [
  {
    name: "Home Appliances",
    slug: "home-appliances",
    icon: Fan,
    subcategories: ["Fans & Air Coolers", "Irons & Steamers", "Vacuum Cleaners"],
  },
  {
    name: "Kitchen Appliances",
    slug: "kitchen-appliances",
    icon: Utensils,
    subcategories: ["Mixer Grinders", "Electric Kettles", "Induction Cooktops", "Hand Blenders"],
  },
  {
    name: "Electronics & Audio",
    slug: "electronics-audio",
    icon: Headphones,
    subcategories: ["Headphones & Earphones", "Bluetooth Speakers", "Smart Watches"],
  },
  {
    name: "Crockery & Kitchenware",
    slug: "crockery-kitchenware",
    icon: Coffee,
    subcategories: ["Cookware & Pans", "Dinner Sets", "Water Bottles & Flasks"],
  },
  {
    name: "Toys & Games",
    slug: "toys-games",
    icon: Gamepad2,
    subcategories: ["Educational Toys", "Board Games", "Remote Control Cars"],
  },
  {
    name: "Packaged Food & Snacks",
    slug: "packaged-food-snacks",
    icon: Cookie,
    subcategories: ["Namkeen & Savouries", "Dry Fruits & Nuts", "Chocolates & Sweets"],
  },
  {
    name: "Clocks & Timepieces",
    slug: "clocks-timepieces",
    icon: Clock,
    subcategories: ["Wall Clocks", "Table Clocks", "Decorative Clocks"],
  },
  {
    name: "Sunglasses & Accessories",
    slug: "sunglasses-accessories",
    icon: Glasses,
    subcategories: ["Polarized Sunglasses", "Fashion Eyewear", "Glasses Cases"],
  },
];

export default function CategoriesDirectoryPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="p-1 -ml-1 text-slate-700 hover:text-[#D91E2A] rounded-full hover:bg-slate-100"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-base text-slate-900">All Categories</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.slug}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-[#D91E2A] transition-colors"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <Link
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 group flex-1"
                >
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#D91E2A] group-hover:bg-[#D91E2A] group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 group-hover:text-[#D91E2A]">
                      {cat.name}
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      {cat.subcategories.length} sub-categories
                    </span>
                  </div>
                </Link>
                <Link
                  href={`/category/${cat.slug}`}
                  className="text-slate-400 hover:text-[#D91E2A]"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              <div className="pt-2 flex flex-wrap gap-1.5">
                {cat.subcategories.map((sub) => (
                  <Link
                    key={sub}
                    href={`/category/${cat.slug}`}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {sub}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      <BottomTabBar />
    </div>
  );
}
