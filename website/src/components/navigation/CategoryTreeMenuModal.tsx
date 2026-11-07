"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { getCategoryIcon } from "@/lib/category-icons";

export interface SubCategoryNode {
  id: number | string;
  name: string;
}

export interface CategoryNode {
  id: number | string;
  name: string;
  slug?: string;
  icon?: string | null;
  subcategories: SubCategoryNode[];
}

// Curated default subcategories when a category has empty subcategories in DB
const DEFAULT_SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  "electronics": ["Accessories & Cables", "Audio & Headphones", "Smartphones & Tablets", "Wearables & Watches"],
  "fashion": ["Casual Apparel", "Sunglasses & Eyewear", "Footwear & Shoes", "Bags & Wallets"],
  "personal care": ["Beard Trimmers", "Hair Dryers & Styling", "Oral Care", "Skin & Wellness"],
  "food": ["Artisan Coffee & Tea", "Dry Fruits & Nuts", "Healthy Snacks", "Daily Essentials"],
  "home": ["Dry & Steam Irons", "Vacuum Cleaners", "Room Heaters & Fans", "Home Lighting"],
  "kitchen": ["Pressure Cookers", "Mixer Grinders & Blenders", "Non-Stick Cookware", "Dinner Sets & Flasks"],
  "toys": ["STEM Building Sets", "Educational Puzzles", "Board Games & Cards", "Remote Control Toys"],
};

const FALLBACK_CATEGORIES: CategoryNode[] = [
  {
    id: "kitchen-appliances",
    name: "Kitchen Appliances",
    slug: "kitchen-appliances",
    icon: "Utensils",
    subcategories: [
      { id: "ka-1", name: "Pressure Cookers" },
      { id: "ka-2", name: "Mixer Grinders" },
      { id: "ka-3", name: "Air Fryers" },
      { id: "ka-4", name: "Induction Cooktops" },
      { id: "ka-5", name: "Electric Kettles" },
    ],
  },
  {
    id: "home-appliances",
    name: "Home Appliances",
    slug: "home-appliances",
    icon: "Fan",
    subcategories: [
      { id: "ha-1", name: "Dry & Steam Irons" },
      { id: "ha-2", name: "Handheld Vacuums" },
      { id: "ha-3", name: "Water Heaters" },
      { id: "ha-4", name: "Ceiling & Table Fans" },
      { id: "ha-5", name: "Room Heaters" },
    ],
  },
  {
    id: "electronics-audio",
    name: "Electronics & Audio",
    slug: "electronics-audio",
    icon: "Headphones",
    subcategories: [
      { id: "ea-1", name: "Wireless Headphones" },
      { id: "ea-2", name: "TWS Earbuds" },
      { id: "ea-3", name: "Bluetooth Speakers" },
      { id: "ea-4", name: "Smartwatches" },
      { id: "ea-5", name: "Fast Chargers" },
    ],
  },
  {
    id: "crockery-kitchenware",
    name: "Crockery & Kitchenware",
    slug: "crockery-kitchenware",
    icon: "Coffee",
    subcategories: [
      { id: "ck-1", name: "Dinner Sets" },
      { id: "ck-2", name: "Non-Stick Cookware" },
      { id: "ck-3", name: "Thermosteel Flasks" },
      { id: "ck-4", name: "Modular Storage" },
      { id: "ck-5", name: "Ceramic Mugs" },
    ],
  },
  {
    id: "toys-games",
    name: "Toys & Games",
    slug: "toys-games",
    icon: "Gamepad2",
    subcategories: [
      { id: "tg-1", name: "STEM Building Sets" },
      { id: "tg-2", name: "Educational Puzzles" },
      { id: "tg-3", name: "Board Games" },
      { id: "tg-4", name: "Action Figures" },
      { id: "tg-5", name: "Plush Soft Toys" },
    ],
  },
  {
    id: "personal-care-grooming",
    name: "Personal Care & Grooming",
    slug: "personal-care-grooming",
    icon: "Sparkles",
    subcategories: [
      { id: "pc-1", name: "Beard Trimmers" },
      { id: "pc-2", name: "Hair Dryers" },
      { id: "pc-3", name: "Oral Care" },
      { id: "pc-4", name: "Skin Serums" },
      { id: "pc-5", name: "Massagers" },
    ],
  },
  {
    id: "fashion-footwear",
    name: "Fashion & Footwear",
    slug: "fashion-footwear",
    icon: "Shirt",
    subcategories: [
      { id: "ff-1", name: "Casual Sneakers" },
      { id: "ff-2", name: "Polarized Sunglasses" },
      { id: "ff-3", name: "Cotton T-Shirts" },
      { id: "ff-4", name: "Backpacks" },
      { id: "ff-5", name: "Sports Sandals" },
    ],
  },
  {
    id: "groceries-daily-essentials",
    name: "Groceries & Daily Essentials",
    slug: "groceries-daily-essentials",
    icon: "ShoppingBag",
    subcategories: [
      { id: "gr-1", name: "Artisan Coffee & Tea" },
      { id: "gr-2", name: "Dry Fruits & Nuts" },
      { id: "gr-3", name: "Organic Grains" },
      { id: "gr-4", name: "Healthy Snacks" },
      { id: "gr-5", name: "Breakfast Cereals" },
    ],
  },
];

function getCategorySubcategories(categoryName: string, backendSubs: Array<{ id: number | string; name: string }>): SubCategoryNode[] {
  if (Array.isArray(backendSubs) && backendSubs.length > 0) {
    return backendSubs.map((s) => ({ id: s.id, name: s.name }));
  }
  const lower = categoryName.toLowerCase();
  for (const [key, defaults] of Object.entries(DEFAULT_SUBCATEGORIES_BY_CATEGORY)) {
    if (lower.includes(key)) {
      return defaults.map((name, i) => ({ id: `${key}-${i}`, name }));
    }
  }
  return [
    { id: "sub-1", name: "General Items" },
    { id: "sub-2", name: "Popular Accessories" },
    { id: "sub-3", name: "Bestseller Packs" },
  ];
}

export const CategoryTreeMenuModal: React.FC = () => {
  const { isCategoryMenuOpen, closeCategoryMenu } = useStorefront();
  const [categories, setCategories] = useState<CategoryNode[]>(FALLBACK_CATEGORIES);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Manage smooth enter & exit animation timing
  useEffect(() => {
    if (isCategoryMenuOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isCategoryMenuOpen, shouldRender]);

  const handleSmoothClose = () => {
    closeCategoryMenu();
  };

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const mapped: CategoryNode[] = data.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            slug: item.slug || String(item.id),
            icon: item.icon,
            subcategories: getCategorySubcategories(item.name, item.subcategories || []),
          }));
          setCategories(mapped);
        }
      })
      .catch(() => {
        setCategories(FALLBACK_CATEGORIES);
      });
  }, []);

  // Dynamically calculate the exact bottom position of the header
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerEl = document.getElementById("wondersale-global-header");
      if (headerEl) {
        setHeaderHeight(headerEl.getBoundingClientRect().height);
      }
    };

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, [isCategoryMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCategoryMenuOpen) {
        closeCategoryMenu();
      }
    };
    if (isCategoryMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isCategoryMenuOpen, closeCategoryMenu]);

  if (!shouldRender) return null;

  // Use dynamic header height or exact fallback
  const topOffset = headerHeight > 0 ? `${headerHeight}px` : "5rem";

  return (
    <>
      {/* =========================================================================
          COMMON BACKDROP OVERLAY
          Lightweight tint with subtle blur (backdrop-blur-[1px]) starting flush beneath navbar
          ========================================================================= */}
      <div
        onClick={handleSmoothClose}
        style={{ top: topOffset }}
        className={`fixed inset-x-0 bottom-0 bg-black/15 backdrop-blur-[1px] z-40 ${
          isClosing ? "animate-backdrop-out" : "animate-backdrop-in"
        }`}
      />

      {/* =========================================================================
          DESKTOP VIEWPORT: Attached dropdown card extending near the bottom
          - Attached flush directly below navbar
          - Smooth cubic-bezier dropdown extraction and exit animation
          - Extends downwards near the end of the window (bottom-6)
          - Fully scrollable if content exceeds window height
          ========================================================================= */}
      {/* Clip wrapper: overflow-hidden so the card is invisible while at translateY(-100%) */}
      <div
        style={{ top: topOffset }}
        className="hidden md:block fixed inset-x-0 bottom-6 z-50 px-4 sm:px-6 md:px-8 xl:px-12 category-clip-wrapper"
      >
        <div
          className={`w-full max-w-[1600px] mx-auto bg-[#F6E9C8] border-2 border-t-0 border-[#680114] rounded-b-3xl shadow-[0_24px_50px_rgba(0,0,0,0.25)] pointer-events-auto flex flex-col overflow-hidden max-h-full ${
            isClosing ? "animate-category-close" : "animate-category-extract"
          }`}
        >
          
          {/* Header Bar: "All Categories" in big bold font without any dots + Close button */}
          <div className="flex items-center justify-between px-8 py-3.5 bg-[#EFE0BC] border-b border-[#DBC599]/90 shrink-0">
            <h2 className="text-xl sm:text-2xl font-serif font-extrabold text-[#680114] tracking-tight">
              All Categories
            </h2>
            <button
              type="button"
              onClick={handleSmoothClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-serif font-bold text-[#680114] hover:bg-[#E8D7B0] border border-[#DFCBA0] transition-colors cursor-pointer"
            >
              <span>Close</span>
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Clean 4 in a row Desktop Tree Grid (Scrollable if height exceeds screen) */}
          <div className="p-8 md:p-10 overflow-y-auto flex-1 overscroll-contain custom-scrollbar-burgundy pr-6 md:pr-8">
            <div className="grid grid-cols-4 gap-x-10 gap-y-10 items-start">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category.icon, category.name);
                const targetSlug = category.slug || String(category.id);
                const subcats = category.subcategories || [];

                return (
                  <div key={category.id} className="flex flex-col select-none">
                    {/* Category Title Row: Circular SVG on the left, Category Name on the right */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-[#680114] text-[#F6E9C8] flex items-center justify-center shrink-0 shadow-sm relative z-10">
                        <Icon className="w-6 h-6 stroke-[2.2]" />
                      </div>

                      <Link
                        href={`/category/${targetSlug}`}
                        onClick={closeCategoryMenu}
                        className="text-lg sm:text-[19px] font-serif font-bold text-[#680114] hover:underline transition-colors leading-snug truncate"
                      >
                        {category.name}
                      </Link>
                    </div>

                    {/* Tree Branch Line directly below the center of the SVG circle */}
                    <div className="relative ml-[23px] pl-6 pt-1 -mt-1 flex flex-col">
                      {subcats.map((sub, idx) => {
                        const isLast = idx === subcats.length - 1;

                        return (
                          <div key={sub.id || idx} className="relative flex items-center py-1.5 min-h-[34px]">
                            {!isLast && (
                              <span className="absolute -left-[24px] top-0 bottom-0 w-0.5 bg-[#680114]" />
                            )}

                            {isLast ? (
                              <span className="absolute -left-[24px] top-0 w-5 h-4.5 border-l-2 border-b-2 border-[#680114] rounded-bl-xl" />
                            ) : (
                              <span className="absolute -left-[24px] top-0 w-5 h-4.5 border-l-2 border-b-2 border-[#680114] rounded-bl-lg" />
                            )}
                            
                            <Link
                              href={`/category/${targetSlug}?subcategory=${encodeURIComponent(sub.name)}`}
                              onClick={closeCategoryMenu}
                              className="text-sm sm:text-[14.5px] font-medium text-[#4D060E] hover:text-[#680114] hover:font-bold hover:translate-x-1 transition-all pl-1 leading-tight inline-block"
                            >
                              {sub.name}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Minimalist Bottom Bar */}
          <div className="px-8 py-3 bg-[#EFE0BC] border-t border-[#DBC599]/90 flex items-center justify-between text-xs sm:text-sm text-[#735A4A] shrink-0">
            <span>Click any category or subcategory to view matching store products</span>
            <Link
              href="/categories"
              onClick={closeCategoryMenu}
              className="text-[#680114] font-serif font-bold hover:underline inline-flex items-center gap-1.5 text-sm"
            >
              <span>View Full Directory</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEWPORT: Clip wrapper + slide-down animation
          ========================================================================= */}
      <div
        style={{ top: topOffset }}
        className="md:hidden fixed inset-x-2 bottom-[84px] z-50 category-clip-wrapper"
      >
        <div
          className={`w-full h-full bg-[#F6E9C8] border-2 border-t-0 border-[#680114] rounded-b-2xl shadow-[0_16px_36px_rgba(0,0,0,0.28)] pointer-events-auto flex flex-col overflow-hidden ${
            isClosing ? "animate-category-close" : "animate-category-extract"
          }`}
        >
          
          {/* Mobile Top Header: "All Categories" in bigger font without dots + Close button */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#EFE0BC] border-b border-[#DBC599]/90 shrink-0">
            <h2 className="text-lg sm:text-xl font-serif font-extrabold text-[#680114] tracking-tight">
              All Categories
            </h2>
            <button
              type="button"
              onClick={handleSmoothClose}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-serif font-bold text-[#680114] hover:bg-[#E8D7B0] border border-[#DFCBA0] transition-colors cursor-pointer"
            >
              <span>Close</span>
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          </div>

          {/* Mobile Tree Grid - 2 categories per row (Directly scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 items-start">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category.icon, category.name);
                const targetSlug = category.slug || String(category.id);
                const subcats = category.subcategories || [];

                return (
                  <div key={category.id} className="flex flex-col select-none">
                    {/* Category Title Row: Circular SVG on the left, Category Name */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#680114] text-[#F6E9C8] flex items-center justify-center shrink-0 shadow-xs relative z-10">
                        <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                      </div>

                      <Link
                        href={`/category/${targetSlug}`}
                        onClick={closeCategoryMenu}
                        className="text-xs sm:text-sm font-serif font-bold text-[#680114] hover:underline active:underline transition-colors leading-tight line-clamp-2"
                      >
                        {category.name}
                      </Link>
                    </div>

                    {/* Connecting Tree Branch Line directly below the center of the circular SVG */}
                    <div className="relative ml-[17px] pl-3.5 pt-1 -mt-1 flex flex-col">
                      {subcats.map((sub, idx) => {
                        const isLast = idx === subcats.length - 1;

                        return (
                          <div key={sub.id || idx} className="relative flex items-center py-1 min-h-[26px]">
                            {!isLast && (
                              <span className="absolute -left-[18px] top-0 bottom-0 w-0.5 bg-[#680114]" />
                            )}

                            {isLast ? (
                              <span className="absolute -left-[18px] top-0 w-4 h-3.5 border-l-2 border-b-2 border-[#680114] rounded-bl-lg" />
                            ) : (
                              <span className="absolute -left-[18px] top-0 w-4 h-3.5 border-l-2 border-b-2 border-[#680114] rounded-bl-md" />
                            )}

                            <Link
                              href={`/category/${targetSlug}?subcategory=${encodeURIComponent(sub.name)}`}
                              onClick={closeCategoryMenu}
                              className="text-xs font-medium text-[#4D060E] hover:text-[#680114] active:text-[#680114] active:font-bold pl-0.5 leading-tight line-clamp-2"
                            >
                              {sub.name}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Bottom Footer Strip: "View Full Directory" */}
          <div className="px-4 py-2.5 bg-[#EFE0BC] border-t border-[#DBC599]/90 flex items-center justify-between text-xs text-[#735A4A] shrink-0">
            <span>Tap subcategory to view products</span>
            <Link
              href="/categories"
              onClick={closeCategoryMenu}
              className="text-[#680114] font-serif font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>View Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
};
