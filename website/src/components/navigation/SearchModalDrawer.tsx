"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ArrowRight,
  TrendingUp,
  History,
  SlidersHorizontal,
  Check,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { DEMO_PRODUCTS } from "@/data/demo-products";
import { PriceRangeSlider } from "@/components/ui/PriceRangeSlider";

const DEFAULT_TRENDING = [
  "Pressure Cooker",
  "Electric Kettle",
  "Non-stick Tawa",
  "Mixer Grinder",
  "Thermos Flask",
  "Steam Iron",
];

export const SearchModalDrawer: React.FC = () => {
  const router = useRouter();
  const {
    isSearchModalOpen,
    closeSearchModal,
    searchHeaderQuery,
    setSearchHeaderQuery,
    searchInStockOnly: inStockOnly,
    setSearchInStockOnly: setInStockOnly,
    searchMinPrice: minPrice,
    setSearchMinPrice: setMinPrice,
    searchMaxPrice: maxPrice,
    setSearchMaxPrice: setMaxPrice,
    searchScopeCategory,
    setSearchScopeCategory,
    searchScopeSubcategory,
    setSearchScopeSubcategory,
  } = useStorefront();

  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Live previews from real backend (with fallback to DEMO_PRODUCTS)
  const [liveMatches, setLiveMatches] = useState<Array<{
    id: number | string;
    title: string;
    slug: string;
    category: string;
    sellingPricePaise: number;
    mrpPaise: number;
    imageUrl?: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Compute stock limits dynamically from demo/inventory stock
  const { stockMin, stockMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    DEMO_PRODUCTS.forEach((p) => {
      const price = Math.round(p.sellingPricePaise / 100);
      if (price < min) min = price;
      if (price > max) max = price;
    });
    return {
      stockMin: isFinite(min) ? min : 99,
      stockMax: isFinite(max) ? max : 5999,
    };
  }, []);

  // Measure navbar height so drawer stays flush underneath
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
  }, [isSearchModalOpen]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wondersale_recent_searches");
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      } else {
        setRecentSearches(["Cooker 5L", "Prestige Tawa", "Milton Flask"]);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Open / Close animation lifecycle
  useEffect(() => {
    if (isSearchModalOpen) {
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
  }, [isSearchModalOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (isSearchModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isSearchModalOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchModalOpen) {
        handleSmoothClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchModalOpen]);

  const handleSmoothClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeSearchModal();
      setShouldRender(false);
      setIsClosing(false);
    }, 260);
  };

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [
      trimmed,
      ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 8);
    setRecentSearches(next);
    try {
      localStorage.setItem("wondersale_recent_searches", JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleSearchSubmit = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setSearchHeaderQuery(trimmed);
    handleSmoothClose();

    const sp = new URLSearchParams();
    sp.set("q", trimmed);
    if (searchScopeSubcategory) sp.set("subcategory", searchScopeSubcategory);
    if (minPrice !== null) sp.set("min_price", String(minPrice));
    if (maxPrice !== null) sp.set("max_price", String(maxPrice));
    if (inStockOnly) sp.set("in_stock", "true");

    const targetPath = searchScopeCategory?.slug
      ? `/category/${searchScopeCategory.slug}?${sp.toString()}`
      : `/category/all?${sp.toString()}`;

    router.push(targetPath);
  };

  const removeRecentTerm = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = recentSearches.filter((s) => s !== term);
    setRecentSearches(next);
    try {
      localStorage.setItem("wondersale_recent_searches", JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  // Instant preview matches fetched from real backend (with fallback to DEMO_PRODUCTS)
  useEffect(() => {
    const q = searchHeaderQuery.trim();
    if (!q) {
      setLiveMatches([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("q", q);
        if (searchScopeCategory) sp.set("category", searchScopeCategory.name);
        if (searchScopeSubcategory) sp.set("subcategory", searchScopeSubcategory);
        if (inStockOnly) sp.set("in_stock", "true");
        if (minPrice !== null && !isNaN(minPrice)) sp.set("min_price", String(minPrice));
        if (maxPrice !== null && !isNaN(maxPrice)) sp.set("max_price", String(maxPrice));
        sp.set("pageSize", "4");

        const res = await fetch(`/api/catalog/products?${sp.toString()}`);
        if (!res.ok) throw new Error("Search fetch failed");
        const json = await res.json();

        if (active) {
          if (json.success && json.data) {
            const rawItems = Array.isArray(json.data) ? json.data : json.data.results || [];
            const mapped = rawItems.slice(0, 4).map((p: any) => ({
              id: p.id,
              title: p.name || p.title,
              slug: p.slug || String(p.id),
              category: Array.isArray(p.categories) && p.categories[0]?.name
                ? p.categories[0].name
                : p.category_name || "General",
              sellingPricePaise: Math.round(parseFloat(p.selling_price || "0") * 100),
              mrpPaise: p.mrp ? Math.round(parseFloat(p.mrp) * 100) : 0,
              imageUrl: p.primary_image_url || p.images?.[0]?.url || "/placeholder-product.png",
            }));
            setLiveMatches(mapped);
            setIsSearching(false);
            return;
          }
          // If real backend returns 0 results or null, show empty (no dummy fallback)
          setLiveMatches([]);
          setIsSearching(false);
        }
      } catch {
        if (active) {
          setLiveMatches([]);
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchHeaderQuery, inStockOnly, minPrice, maxPrice, searchScopeCategory, searchScopeSubcategory]);

  if (!shouldRender) return null;

  const topOffset = headerHeight > 0 ? `${headerHeight}px` : "5rem";

  return (
    <>
      {/* COMMON BACKDROP OVERLAY */}
      <div
        onClick={handleSmoothClose}
        style={{ top: topOffset }}
        className={`fixed inset-x-0 bottom-0 bg-black/20 backdrop-blur-[1px] z-40 ${
          isClosing ? "animate-backdrop-out" : "animate-backdrop-in"
        }`}
      />

      {/* =========================================================================
          DESKTOP VIEWPORT: Horizontally Divided Panel
          - Left column: Recent searches & Trending searches only (Quick Departments removed per request)
          - Right column: Instant Product Previews + Search Filters (In-Stock & Price Range Slider with Min/Max)
          ========================================================================= */}
      <div
        style={{ top: topOffset }}
        className="hidden md:block fixed inset-x-0 bottom-8 z-50 px-4 sm:px-6 md:px-8 xl:px-12 category-clip-wrapper"
      >
        <div
          className={`w-full max-w-[1400px] mx-auto bg-[#F6E9C8] border-2 border-t-0 border-[#680114] rounded-b-3xl shadow-[0_24px_50px_rgba(0,0,0,0.28)] pointer-events-auto flex flex-col overflow-hidden max-h-full ${
            isClosing ? "animate-category-close" : "animate-category-extract"
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-8 py-3 bg-[#EFE0BC] border-b border-[#DBC599]/90 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-serif font-bold text-[#680114]">
                {searchHeaderQuery.trim()
                  ? `Searching for "${searchHeaderQuery.trim()}"`
                  : "Explore Catalog & Discover Products"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSmoothClose}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-serif font-bold text-[#680114] hover:bg-[#E8D7B0] border border-[#DFCBA0] transition-colors cursor-pointer"
            >
              <span>Close</span>
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Desktop Body: Horizontally Divided */}
          <div className="grid grid-cols-12 flex-1 overflow-hidden divide-x-2 divide-[#680114]/15 min-h-[380px]">
            {/* LEFT COLUMN (Col 5): Clean Recent Searches & Trending (Quick departments removed) */}
            <div className="col-span-5 p-7 flex flex-col gap-6 overflow-y-auto custom-scrollbar-burgundy">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs font-serif font-bold text-[#680114]">
                    <span className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem("wondersale_recent_searches");
                      }}
                      className="text-[11px] font-sans text-[#680114]/70 hover:text-[#680114] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => handleSearchSubmit(term)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFE0BC] hover:bg-[#E8D7B0] text-[#680114] text-xs font-medium border border-[#DFCBA0] cursor-pointer transition-colors group shadow-2xs"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentTerm(term, e)}
                          className="text-[#680114]/60 hover:text-[#680114] p-0.5 rounded-full"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Searches */}
              <div className="flex flex-col gap-2.5">
                <span className="flex items-center gap-1.5 text-xs font-serif font-bold text-[#680114]">
                  <TrendingUp className="w-3.5 h-3.5 text-[#FEC501] stroke-[2.5]" />
                  <span>Trending Searches</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_TRENDING.map((trend) => (
                    <button
                      key={trend}
                      type="button"
                      onClick={() => handleSearchSubmit(trend)}
                      className="px-3 py-1.5 rounded-xl bg-[#EFE0BC]/80 hover:bg-[#680114] hover:text-[#F6E9C8] text-[#680114] text-xs font-medium border border-[#DFCBA0] cursor-pointer transition-all shadow-2xs hover:scale-102"
                    >
                      {trend}
                    </button>
                  ))}
                </div>
              </div>

              {/* (Hint removed per request) */}
            </div>

            {/* RIGHT COLUMN (Col 7): Instant Previews + Advanced Filter Section (Slider + Min/Max) */}
            <div className="col-span-7 p-7 flex flex-col gap-5 overflow-y-auto custom-scrollbar-burgundy bg-[#FAF3E0]">
              {/* Filter Bar Controls in the Drawer */}
              <div className="p-4 rounded-2xl bg-[#F6E9C8] border border-[#DFCBA0] shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-serif font-bold text-[#680114] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Search Filters</span>
                  </span>
                  {(inStockOnly || minPrice !== null || maxPrice !== null) && (
                    <button
                      type="button"
                      onClick={() => {
                        setInStockOnly(false);
                        setMinPrice(null);
                        setMaxPrice(null);
                      }}
                      className="text-[11px] text-[#680114] underline font-medium cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Active Category / Subcategory Scope Indicator & In Stock Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Scope Badge */}
                  {searchScopeCategory && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-serif font-bold bg-[#680114] text-[#F6E9C8] border border-[#680114] shadow-xs">
                      <span>In &ldquo;{searchScopeCategory.name}&rdquo;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchScopeCategory(null);
                          setSearchScopeSubcategory(null);
                        }}
                        className="hover:opacity-75 cursor-pointer ml-0.5"
                        title="Search across all categories instead"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </span>
                  )}

                  {/* Subcategory Scope Badge */}
                  {searchScopeSubcategory && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-serif font-bold bg-[#EFE0BC] text-[#680114] border border-[#DFCBA0]">
                      <span>{searchScopeSubcategory}</span>
                      <button
                        type="button"
                        onClick={() => setSearchScopeSubcategory(null)}
                        className="hover:opacity-75 cursor-pointer ml-0.5"
                        title="Remove subcategory filter"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setInStockOnly(!inStockOnly)}
                    className={`px-3 py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      inStockOnly
                        ? "bg-[#680114] text-[#F6E9C8] border-[#680114] shadow-xs"
                        : "bg-[#EFE0BC] text-[#680114] border-[#DFCBA0] hover:bg-[#E8D7B0]"
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>In Stock Only</span>
                    {inStockOnly && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                </div>

                {/* Price Range Slider with Min & Max Entry (Calculated from stock) */}
                <div className="pt-2 border-t border-[#680114]/15">
                  <span className="text-[11px] font-serif font-bold text-[#680114] block mb-1">
                    Price Range
                  </span>
                  <PriceRangeSlider
                    stockMin={stockMin}
                    stockMax={stockMax}
                    minValue={minPrice}
                    maxValue={maxPrice}
                    onChangeMin={setMinPrice}
                    onChangeMax={setMaxPrice}
                  />
                </div>
              </div>

              {/* Product Match Previews */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-serif font-bold text-[#680114]">
                    {searchHeaderQuery.trim()
                      ? `Matching Products (${liveMatches.length})`
                      : "Featured In-Store Picks"}
                  </span>
                  {searchHeaderQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSearchSubmit(searchHeaderQuery)}
                      className="text-xs font-serif font-bold text-[#680114] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View in catalog</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {liveMatches.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#680114]">
                    <Search className="w-8 h-8 opacity-40 mb-2 stroke-[1.5]" />
                    <p className="font-serif font-bold text-sm">
                      {searchHeaderQuery.trim()
                        ? `No match for "${searchHeaderQuery.trim()}" in this price range`
                        : "Start typing in the top bar to preview products"}
                    </p>
                    {searchHeaderQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => handleSearchSubmit(searchHeaderQuery)}
                        className="mt-3 px-4 py-2 bg-[#680114] text-[#F6E9C8] rounded-xl text-xs font-serif font-bold shadow-xs cursor-pointer hover:bg-[#88091E]"
                      >
                        Search All Products for &ldquo;{searchHeaderQuery}&rdquo;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {liveMatches.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          saveRecentSearch(item.title);
                          handleSmoothClose();
                          router.push(`/product/${item.slug}`);
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#F6E9C8] hover:bg-[#EFE0BC] border border-[#DFCBA0] transition-all cursor-pointer group shadow-2xs hover:translate-y-[-1px]"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-[#680114]/15 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl || "/placeholder-product.png"}
                            alt={item.title}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-serif font-bold text-[#680114] truncate group-hover:underline">
                            {item.title}
                          </h4>
                          <span className="text-[11px] text-[#680114]/75 block truncate">
                            {item.category}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-bold text-[#680114]">
                              ₹{(item.sellingPricePaise / 100).toFixed(0)}
                            </span>
                            {item.mrpPaise > item.sellingPricePaise && (
                              <span className="text-[10px] text-[#680114]/60 line-through">
                                ₹{(item.mrpPaise / 100).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enter CTA Bar */}
              {searchHeaderQuery.trim() && (
                <button
                  type="button"
                  onClick={() => handleSearchSubmit(searchHeaderQuery)}
                  className="w-full py-2.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] rounded-xl font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <span>See all results in catalog for &ldquo;{searchHeaderQuery}&rdquo;</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEWPORT: Vertically Stacked Panel
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
          {/* Mobile Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#EFE0BC] border-b border-[#DBC599]/90 shrink-0">
            <span className="text-xs font-serif font-bold text-[#680114] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                {searchHeaderQuery.trim()
                  ? `Results for "${searchHeaderQuery.trim()}"`
                  : "Search & Filters"}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSmoothClose}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-serif font-bold text-[#680114] hover:bg-[#E8D7B0] border border-[#DFCBA0] transition-colors cursor-pointer"
            >
              <span>Close</span>
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          </div>

          {/* Mobile Scrollable Body (Vertically Stacked) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 overscroll-contain">
            {/* Filter Options Section */}
            <div className="p-3 bg-[#EFE0BC] rounded-xl border border-[#DFCBA0] space-y-3">
              <div className="flex items-center justify-between text-xs font-serif font-bold text-[#680114]">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 stroke-[2.2]" />
                  <span>Filters</span>
                </span>
                {(inStockOnly || minPrice !== null || maxPrice !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setInStockOnly(false);
                      setMinPrice(null);
                      setMaxPrice(null);
                    }}
                    className="text-[10px] underline font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* In Stock & Scope Indicators */}
              <div className="flex flex-wrap items-center gap-1.5">
                {searchScopeCategory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-serif font-bold bg-[#680114] text-[#F6E9C8] border border-[#680114]">
                    <span>In &ldquo;{searchScopeCategory.name}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchScopeCategory(null);
                        setSearchScopeSubcategory(null);
                      }}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </span>
                )}
                {searchScopeSubcategory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-serif font-bold bg-[#F6E9C8] text-[#680114] border border-[#DFCBA0]">
                    <span>{searchScopeSubcategory}</span>
                    <button
                      type="button"
                      onClick={() => setSearchScopeSubcategory(null)}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-serif font-bold shrink-0 border flex items-center gap-1 ${
                    inStockOnly
                      ? "bg-[#680114] text-[#F6E9C8] border-[#680114]"
                      : "bg-[#F6E9C8] text-[#680114] border-[#DFCBA0]"
                  }`}
                >
                  <span>In Stock Only</span>
                  {inStockOnly && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                </button>
              </div>

              {/* Mobile Price Slider & Inputs */}
              <div className="pt-2 border-t border-[#680114]/15">
                <span className="text-[11px] font-serif font-bold text-[#680114] block mb-1">
                  Price Range
                </span>
                <PriceRangeSlider
                  stockMin={stockMin}
                  stockMax={stockMax}
                  minValue={minPrice}
                  maxValue={maxPrice}
                  onChangeMin={setMinPrice}
                  onChangeMax={setMaxPrice}
                />
              </div>
            </div>

            {/* Live Matches */}
            {searchHeaderQuery.trim() ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-serif font-bold text-[#680114]">
                  <span>Instant Previews ({liveMatches.length})</span>
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit(searchHeaderQuery)}
                    className="text-[11px] underline"
                  >
                    See all
                  </button>
                </div>

                {liveMatches.length === 0 ? (
                  <div className="text-center py-4 text-[#680114]">
                    <p className="text-xs font-serif font-bold">No instant preview matches</p>
                    <button
                      type="button"
                      onClick={() => handleSearchSubmit(searchHeaderQuery)}
                      className="mt-2 px-3 py-1.5 bg-[#680114] text-[#F6E9C8] rounded-xl text-xs font-serif font-bold shadow-2xs"
                    >
                      Search &ldquo;{searchHeaderQuery}&rdquo; in Catalog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {liveMatches.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          saveRecentSearch(item.title);
                          handleSmoothClose();
                          router.push(`/product/${item.slug}`);
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-[#EFE0BC]/80 border border-[#DFCBA0] active:scale-98 transition-transform"
                      >
                        <div className="w-11 h-11 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-[#680114]/15">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl || "/placeholder-product.png"}
                            alt={item.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-serif font-bold text-[#680114] truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#680114]">
                            <span>₹{(item.sellingPricePaise / 100).toFixed(0)}</span>
                            {item.mrpPaise > item.sellingPricePaise && (
                              <span className="text-[10px] text-[#680114]/60 line-through">
                                ₹{(item.mrpPaise / 100).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#680114] shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-serif font-bold text-[#680114]">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 stroke-[2.2]" />
                    <span>Recent Searches</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("wondersale_recent_searches");
                    }}
                    className="text-[10px] text-[#680114]/70"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      onClick={() => handleSearchSubmit(term)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFE0BC] text-[#680114] text-[11px] font-medium border border-[#DFCBA0]"
                    >
                      <span>{term}</span>
                      <button
                        type="button"
                        onClick={(e) => removeRecentTerm(term, e)}
                        className="text-[#680114]/60 p-0.5"
                      >
                        <X className="w-2.5 h-2.5 stroke-[2.5]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1 text-xs font-serif font-bold text-[#680114]">
                <TrendingUp className="w-3 h-3 text-[#FEC501] stroke-[2.5]" />
                <span>Trending Searches</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TRENDING.map((trend) => (
                  <button
                    key={trend}
                    type="button"
                    onClick={() => handleSearchSubmit(trend)}
                    className="px-2.5 py-1 rounded-lg bg-[#EFE0BC]/80 text-[#680114] text-[11px] font-medium border border-[#DFCBA0]"
                  >
                    {trend}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Action CTA */}
          <div className="p-3 bg-[#EFE0BC] border-t border-[#DBC599]/90 shrink-0">
            <button
              type="button"
              onClick={() => handleSearchSubmit(searchHeaderQuery || "all")}
              className="w-full py-2.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] rounded-xl font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <span>
                {searchHeaderQuery.trim()
                  ? `Show results for "${searchHeaderQuery.trim()}"`
                  : "View All Products"}
              </span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
