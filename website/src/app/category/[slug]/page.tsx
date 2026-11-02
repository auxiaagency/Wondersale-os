"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { useStorefront } from "@/context/StorefrontContext";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { DEMO_PRODUCTS } from "@/data/demo-products";

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

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string; slug: string } | null;
  variants: {
    mrpPaise: number;
    sellingPricePaise: number;
    stockQuantity: number;
    inStock: boolean;
    images?: { url: string; altText?: string; isThumbnail?: boolean }[];
  }[];
  ratingAverage: number;
  reviewCount: number;
}

function CategoryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "kitchen-appliances";
  const title = CATEGORY_NAMES[slug] || "Category Products";

  const { cartCount, isHydrated, addToCart, toggleWishlist, isInWishlist } = useStorefront();

  // URL state synchronization
  const sortParam = searchParams.get("sort") || "popularity";
  const brandParam = searchParams.get("brand") || "";
  const maxPriceParam = searchParams.get("maxPrice")
    ? parseInt(searchParams.get("maxPrice")!)
    : 10000;
  const expressParam = searchParams.get("express") === "true";

  const [products, setProducts] = useState<ProductItem[]>(() => {
    const demoMatches = DEMO_PRODUCTS.filter(
      (p) =>
        p.categorySlug.toLowerCase() === slug.toLowerCase() ||
        p.category.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
    );
    return demoMatches.map((p) => ({
      id: p.id,
      name: p.title,
      slug: p.slug,
      brand: { name: p.brand, slug: p.brand.toLowerCase() },
      variants: [
        {
          mrpPaise: p.mrpPaise,
          sellingPricePaise: p.sellingPricePaise,
          stockQuantity: p.stockCount,
          inStock: p.inStock,
          images: [{ url: p.imageUrl, altText: p.title, isThumbnail: true }],
        },
      ],
      ratingAverage: p.rating,
      reviewCount: p.ratingCount,
    }));
  });
  const [loading, setLoading] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [selectedSort, setSelectedSort] = useState(sortParam);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    brandParam ? brandParam.split(",").filter(Boolean) : []
  );
  const [maxPrice, setMaxPrice] = useState(maxPriceParam);
  const [expressOnly, setExpressOnly] = useState(expressParam);

  const updateUrlParams = useCallback(
    (newSort: string, newBrands: string[], newMaxPrice: number, newExpress: boolean) => {
      const sp = new URLSearchParams();
      if (newSort !== "popularity") sp.set("sort", newSort);
      if (newBrands.length > 0) sp.set("brand", newBrands.join(","));
      if (newMaxPrice < 10000) sp.set("maxPrice", newMaxPrice.toString());
      if (newExpress) sp.set("express", "true");
      router.replace(`/category/${slug}?${sp.toString()}`, { scroll: false });
    },
    [router, slug]
  );

  const fetchCategoryProducts = useCallback(async () => {
    // 1. Instant local filter from DEMO_PRODUCTS (Zero latency)
    let demoMatches = DEMO_PRODUCTS.filter(
      (p) =>
        p.categorySlug.toLowerCase() === slug.toLowerCase() ||
        p.category.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
    );

    if (selectedBrands.length > 0) {
      demoMatches = demoMatches.filter((p) =>
        selectedBrands.map((b) => b.toLowerCase()).includes(p.brand.toLowerCase())
      );
    }

    if (maxPrice < 10000) {
      demoMatches = demoMatches.filter((p) => p.sellingPricePaise <= maxPrice * 100);
    }

    if (selectedSort === "price_asc") {
      demoMatches.sort((a, b) => a.sellingPricePaise - b.sellingPricePaise);
    } else if (selectedSort === "price_desc") {
      demoMatches.sort((a, b) => b.sellingPricePaise - a.sellingPricePaise);
    } else if (selectedSort === "rating") {
      demoMatches.sort((a, b) => b.rating - a.rating);
    }

    const mapped: ProductItem[] = demoMatches.map((p) => ({
      id: p.id,
      name: p.title,
      slug: p.slug,
      brand: { name: p.brand, slug: p.brand.toLowerCase() },
      variants: [
        {
          mrpPaise: p.mrpPaise,
          sellingPricePaise: p.sellingPricePaise,
          stockQuantity: p.stockCount,
          inStock: p.inStock,
          images: [{ url: p.imageUrl, altText: p.title, isThumbnail: true }],
        },
      ],
      ratingAverage: p.rating,
      reviewCount: p.ratingCount,
    }));

    setProducts(mapped);
    setLoading(false);
  }, [slug, selectedSort, selectedBrands, maxPrice]);

  useEffect(() => {
    fetchCategoryProducts();
  }, [fetchCategoryProducts]);

  const toggleBrand = (brand: string) => {
    const updated = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(updated);
    updateUrlParams(selectedSort, updated, maxPrice, expressOnly);
  };

  const handleApplySort = (sortOption: string) => {
    let apiSort = "popularity";
    if (sortOption === "Price: Low to High") apiSort = "price_asc";
    if (sortOption === "Price: High to Low") apiSort = "price_desc";
    if (sortOption === "Customer Rating 4★+") apiSort = "rating";
    setSelectedSort(apiSort);
    setShowSortSheet(false);
    updateUrlParams(apiSort, selectedBrands, maxPrice, expressOnly);
  };

  const handleApplyFilters = () => {
    setShowFilterSheet(false);
    updateUrlParams(selectedSort, selectedBrands, maxPrice, expressOnly);
  };

  const handleClearFilters = () => {
    setSelectedBrands([]);
    setMaxPrice(10000);
    updateUrlParams(selectedSort, [], 10000, expressOnly);
  };

  const handleToggleExpress = () => {
    const nextExpress = !expressOnly;
    setExpressOnly(nextExpress);
    updateUrlParams(selectedSort, selectedBrands, maxPrice, nextExpress);
  };

  const sortLabelMap: Record<string, string> = {
    popularity: "Popularity",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    rating: "Customer Rating 4★+",
  };

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#680114] pb-20 font-sans">
      {/* Consistent Global Desktop Navigation */}
      <GlobalHeader />

      {/* Category Sub-header Banner */}
      <div className="w-full bg-[#FAF3E0] border-b border-[#EADFC7] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="p-1.5 -ml-1 text-[#680114] hover:text-[#7A0C16] rounded-full hover:bg-[#EADFC7] transition-colors"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-serif font-bold text-lg md:text-2xl text-[#680114] leading-tight">
                {title}
              </h1>
              <span className="text-[11px] text-[#735A4A] font-sans font-medium">
                {products.length} {products.length === 1 ? "item" : "items"} available in Bhopal Superstore
              </span>
            </div>
          </div>
        </div>
      </div>

        {/* 2. Sticky Quick Bar */}
        <div className="w-full bg-[#FAF3E0] border-b border-[#EADFC7] px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs">
          <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Sort Dropdown Trigger */}
              <button
                onClick={() => setShowSortSheet(true)}
                className="h-8 px-3 rounded-lg border border-[#EADFC7] bg-[#FDF8EE] font-medium text-[#680114] flex items-center gap-1.5 shadow-2xs hover:border-[#7A0C16] cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#735A4A]" />
                <span>Sort: {sortLabelMap[selectedSort] || "Popularity"}</span>
              </button>

              {/* Filter Drawer Trigger */}
              <button
                onClick={() => setShowFilterSheet(true)}
                className="h-8 px-3 rounded-lg border border-[#EADFC7] bg-[#FDF8EE] font-medium text-[#680114] flex items-center gap-1.5 shadow-2xs hover:border-[#7A0C16] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#735A4A]" />
                <span>Filters ({selectedBrands.length + (maxPrice < 10000 ? 1 : 0)})</span>
              </button>
            </div>

            {/* Quick Express Toggle */}
            <button
              onClick={handleToggleExpress}
              className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                expressOnly
                  ? "bg-[#FDF8EE] border-[#7A0C16] text-[#7A0C16]"
                  : "bg-[#FDF8EE] border-[#EADFC7] text-[#735A4A] hover:border-[#7A0C16]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#7A0C16]" />
              <span className="hidden sm:inline">⚡ 2-Hr Bhopal Express</span>
              <span className="sm:hidden">2-Hr Express</span>
            </button>
          </div>
        </div>

      {/* Active Filter Pills Bar */}
      {(selectedBrands.length > 0 || maxPrice < 10000 || expressOnly) && (
        <div className="max-w-[1600px] mx-auto px-4 pt-3 flex flex-wrap items-center gap-2">
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
          {maxPrice < 10000 && (
            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded-full text-slate-800 shadow-2xs">
              <span>Under ₹{maxPrice}</span>
              <X
                className="w-3 h-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                onClick={() => {
                  setMaxPrice(10000);
                  updateUrlParams(selectedSort, selectedBrands, 10000, expressOnly);
                }}
              />
            </span>
          )}
          {expressOnly && (
            <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-xs px-2.5 py-1 rounded-full text-[#D91E2A] shadow-2xs">
              <span>⚡ 2-Hr Express</span>
              <X className="w-3 h-3 text-[#D91E2A] cursor-pointer" onClick={handleToggleExpress} />
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-[11px] text-[#D91E2A] font-semibold hover:underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* 3. Product Listing Grid */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-3 border-[#D91E2A] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading catalog from database...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center px-4 max-w-md mx-auto">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">No products match your criteria</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Try adjusting your filters or price threshold to see more items in Bhopal.
            </p>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[#D91E2A] hover:bg-[#B31520] text-white text-xs font-bold rounded-lg"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {products.map((product) => {
              const primaryVariant = product.variants[0];
              const mrp = primaryVariant ? primaryVariant.mrpPaise : 0;
              const price = primaryVariant ? primaryVariant.sellingPricePaise : 0;
              const img = primaryVariant?.images?.[0]?.url;

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  title={product.name}
                  brand={product.brand?.name}
                  mrpPaise={mrp}
                  sellingPricePaise={price}
                  imageUrl={img}
                  rating={product.ratingAverage || 4.2}
                  ratingCount={product.reviewCount || 10}
                  inStock={primaryVariant?.inStock ?? true}
                  variant="grid"
                  onAddToCart={() =>
                    addToCart({
                      id: product.id,
                      slug: product.slug,
                      title: product.name,
                      sellingPricePaise: price,
                      mrpPaise: mrp,
                      imageUrl: img,
                    })
                  }
                  onToggleWishlist={() =>
                    toggleWishlist({
                      id: product.id,
                      slug: product.slug,
                      title: product.name,
                      brand: product.brand?.name || title,
                      sellingPricePaise: price,
                      mrpPaise: mrp,
                      rating: product.ratingAverage || 4.2,
                      ratingCount: product.reviewCount || 10,
                      inStock: primaryVariant?.inStock ?? true,
                      imageUrl: img,
                    })
                  }
                  isWishlisted={isInWishlist(product.id)}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* 4. Sort Bottom Sheet Modal */}
      {showSortSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#680114]">Sort Products By</h3>
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
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => handleApplySort(option)}
                  className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <span
                    className={
                      sortLabelMap[selectedSort] === option ? "text-[#D91E2A] font-bold" : ""
                    }
                  >
                    {option}
                  </span>
                  {sortLabelMap[selectedSort] === option && (
                    <Check className="w-4 h-4 text-[#D91E2A]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Filter Bottom Sheet Modal */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2" />
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-[#680114]">Filter Products</h3>
                <span className="text-[11px] text-slate-500">{products.length} products found</span>
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
                <span className="text-xs font-bold text-[#680114] block mb-2">Verified Brands</span>
                <div className="space-y-2">
                  {["Philips", "Prestige", "Bajaj", "Havells", "boAt", "Milton", "Titan"].map(
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
                  <span className="font-bold text-[#680114]">Max Price (₹)</span>
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
                onClick={handleClearFilters}
                className="flex-1 h-11 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear All
              </button>
              <button
                onClick={handleApplyFilters}
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
