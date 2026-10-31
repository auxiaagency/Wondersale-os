"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  Zap,
} from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

const CATEGORY_NAMES: Record<string, string> = {
  "kitchen-appliances": "Kitchen Appliances",
  "home-appliances": "Home Appliances",
  "electronics-audio": "Electronics & Audio",
  "crockery-kitchenware": "Crockery & Kitchenware",
  "toys-games": "Toys & Games",
  "packaged-food-snacks": "Packaged Food & Snacks",
  "clocks-timepieces": "Clocks & Timepieces",
  "sunglasses-accessories": "Sunglasses & Accessories",
};

const SUB_CATEGORIES = [
  "All",
  "Mixer Grinders",
  "Electric Kettles",
  "Induction Cooktops",
  "Hand Blenders",
  "Toasters & Grills",
];

const PRODUCTS = [
  {
    id: "philips-hl7756",
    title: "Philips HL7756/00 750W Mixer Grinder (3 Jars)",
    mrpPaise: 529500,
    sellingPricePaise: 329900,
    rating: 4.4,
    ratingCount: 5412,
    brand: "Philips",
  },
  {
    id: "prestige-pic-20",
    title: "Prestige PIC 20 1600W Induction Cooktop with Indian Menu",
    mrpPaise: 329500,
    sellingPricePaise: 189900,
    rating: 4.3,
    ratingCount: 3120,
    brand: "Prestige",
  },
  {
    id: "bajaj-kettle-15",
    title: "Bajaj Majesty KKN 1.5L Cordless Electric Kettle",
    mrpPaise: 129900,
    sellingPricePaise: 84900,
    rating: 4.5,
    ratingCount: 2840,
    brand: "Bajaj",
  },
  {
    id: "kent-hand-blender",
    title: "Kent 300W 5-Speed Hand Blender with Stainless Steel Blade",
    mrpPaise: 169900,
    sellingPricePaise: 119900,
    rating: 4.2,
    ratingCount: 940,
    brand: "Kent",
  },
  {
    id: "morphy-toaster-2slice",
    title: "Morphy Richards 2-Slice Pop-Up Toaster with Defrost",
    mrpPaise: 209500,
    sellingPricePaise: 149900,
    rating: 4.1,
    ratingCount: 810,
    brand: "Morphy Richards",
  },
  {
    id: "havells-grinder-heavy",
    title: "Havells Gracia 1000W Heavy Duty Dry Iron & Grinder",
    mrpPaise: 419500,
    sellingPricePaise: 249900,
    rating: 4.4,
    ratingCount: 1530,
    brand: "Havells",
  },
];

function CategoryContent() {
  const params = useParams();
  const slug = (params?.slug as string) || "kitchen-appliances";
  const title = CATEGORY_NAMES[slug] || "Category Products";

  const [activeSub, setActiveSub] = useState("All");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedSort, setSelectedSort] = useState("Popularity");
  const [expressOnly, setExpressOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(["Philips", "Prestige"]);
  const [maxPrice, setMaxPrice] = useState(5000);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 text-slate-700 hover:text-[#D91E2A] rounded-full hover:bg-slate-100"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                {title}
              </h1>
              <span className="text-[10px] text-slate-500 font-medium">
                (148 items available in Bhopal)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="p-2 text-slate-700 hover:text-[#D91E2A] rounded-full hover:bg-slate-100"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative p-2 text-slate-700 hover:text-[#D91E2A] rounded-full hover:bg-slate-100"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute top-1 right-1 bg-[#D91E2A] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                3
              </span>
            </Link>
          </div>
        </div>

        {/* 2. Sub-category Horizontal Scrollable Pills */}
        <div className="border-t border-slate-100 px-4 py-2 overflow-x-auto no-scrollbar flex gap-2">
          {SUB_CATEGORIES.map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSub(sub)}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeSub === sub
                  ? "bg-[#D91E2A] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* 3. Sticky Quick Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {/* Sort Dropdown Trigger */}
            <button
              onClick={() => setShowSortSheet(true)}
              className="h-8 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs hover:border-[#D91E2A] cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Sort: {selectedSort}</span>
            </button>

            {/* Filter Drawer Trigger */}
            <button
              onClick={() => setShowFilterSheet(true)}
              className="h-8 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs hover:border-[#D91E2A] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters ({selectedBrands.length})</span>
            </button>
          </div>

          {/* Quick Express Toggle */}
          <button
            onClick={() => setExpressOnly(!expressOnly)}
            className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              expressOnly
                ? "bg-red-50 border-[#D91E2A] text-[#D91E2A]"
                : "bg-white border-slate-300 text-slate-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#D91E2A]" />
            <span className="hidden sm:inline">⚡ 2-Hr Bhopal Express</span>
            <span className="sm:hidden">2-Hr Express</span>
          </button>
        </div>
      </header>

      {/* Active Filter Pills Bar */}
      <div className="max-w-7xl mx-auto px-4 pt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-slate-500">Active Filters:</span>
        {selectedBrands.map((brand) => (
          <span
            key={brand}
            className="inline-flex items-center gap-1 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded-full text-slate-800 shadow-2xs"
          >
            <span>{brand}</span>
            <X
              className="w-3 h-3 text-slate-400 hover:text-slate-700 cursor-pointer"
              onClick={() => toggleBrand(brand)}
            />
          </span>
        ))}
        {selectedBrands.length > 0 && (
          <button
            onClick={() => setSelectedBrands([])}
            className="text-[11px] text-[#D91E2A] font-semibold hover:underline ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* 4. Product Listing Grid */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {PRODUCTS.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              mrpPaise={product.mrpPaise}
              sellingPricePaise={product.sellingPricePaise}
              rating={product.rating}
              ratingCount={product.ratingCount}
              variant="grid"
            />
          ))}
        </div>
      </main>

      {/* 5. Sort Bottom Sheet Modal */}
      {showSortSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Sort Products By</h3>
              <button
                onClick={() => setShowSortSheet(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 space-y-1">
              {[
                "Popularity",
                "Price: Low to High",
                "Price: High to Low",
                "Customer Rating 4★+",
                "Biggest Discount",
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSelectedSort(option);
                    setShowSortSheet(false);
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <span className={selectedSort === option ? "text-[#D91E2A] font-bold" : ""}>
                    {option}
                  </span>
                  {selectedSort === option && <Check className="w-4 h-4 text-[#D91E2A]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Filter Bottom Sheet Modal */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2" />
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Filter Products</h3>
                <span className="text-[11px] text-slate-500">148 products found</span>
              </div>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5 overflow-y-auto flex-1">
              {/* Brand Filter */}
              <div>
                <span className="text-xs font-bold text-slate-900 block mb-2">Verified Brands</span>
                <div className="space-y-2">
                  {["Philips", "Prestige", "Bajaj", "Kent", "Morphy Richards", "Havells"].map(
                    (brand) => (
                      <label
                        key={brand}
                        className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand)}
                          onChange={() => toggleBrand(brand)}
                          className="w-4 h-4 rounded accent-[#D91E2A] border-slate-300"
                        />
                        <span>{brand}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-900">Max Price (₹)</span>
                  <span className="font-bold text-[#D91E2A]">Under ₹{maxPrice}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#D91E2A] cursor-pointer"
                />
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
              <button
                onClick={() => {
                  setSelectedBrands([]);
                  setMaxPrice(10000);
                }}
                className="flex-1 h-11 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="flex-1 h-11 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docked Bottom Navigation */}
      <BottomTabBar />
    </div>
  );
}

export default function CategoryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-semibold text-slate-500">
          Loading department products...
        </div>
      }
    >
      <CategoryContent />
    </React.Suspense>
  );
}
