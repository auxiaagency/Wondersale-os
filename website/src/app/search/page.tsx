"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Search as SearchIcon,
  X,
  Mic,
  Camera,
  ShoppingBag,
  MapPin,
  TrendingUp,
  History,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Zap,
  SearchX,
  ChevronRight,
} from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useStorefront } from "@/context/StorefrontContext";

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string; slug: string } | null;
  category?: { name: string; slug: string } | null;
  variants: {
    mrpPaise: number;
    sellingPricePaise: number;
    stockQuantity: number;
    inStock: boolean;
  }[];
  ratingAverage: number;
  reviewCount: number;
}

const INITIAL_RECENT_SEARCHES = [
  "Prestige Cooker",
  "Dry Iron 1000W",
  "Milton Flask",
  "Bajaj Mixer",
];

const TRENDING_SEARCHES = [
  { rank: "#1", query: "Wall Clock" },
  { rank: "#2", query: "Non-stick Tawa" },
  { rank: "#3", query: "Electric Kettle" },
  { rank: "#4", query: "Mixer Grinder" },
  { rank: "#5", query: "Pressure Cooker" },
];

const DIRECT_SUGGESTIONS = [
  { title: "Cooker 5L", subtitle: "in Kitchen Appliances", query: "cooker" },
  { title: "Prestige Induction cooktop", subtitle: "Top brand", query: "prestige" },
  { title: "Electric Kettle 1.5L", subtitle: "Cordless stainless", query: "kettle" },
  { title: "boAt Bluetooth Headphones", subtitle: "Electronics & Audio", query: "boat" },
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const { cartCount, location, isHydrated, addToCart, toggleWishlist, isInWishlist } = useStorefront();

  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>(INITIAL_RECENT_SEARCHES);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"relevance" | "price-asc" | "price-desc" | "rating">(
    "relevance"
  );
  const [fastDeliveryOnly, setFastDeliveryOnly] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Synchronize query param changes externally
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
    setActiveQuery(initialQuery);
  }

  // Fetch from database API
  const fetchSearchResults = useCallback(async (searchQuery: string, sort: string) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (searchQuery.trim()) {
        sp.set("q", searchQuery.trim());
      }
      if (sort === "price-asc") sp.set("sort", "price_asc");
      else if (sort === "price-desc") sp.set("sort", "price_desc");
      else if (sort === "rating") sp.set("sort", "rating");

      const res = await fetch(`/api/catalog/products?${sp.toString()}`);
      const data = await res.json();
      if (data.success && data.data?.products) {
        setProducts(data.data.products);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchResults(activeQuery, sortBy);
  }, [activeQuery, sortBy, fetchSearchResults]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();

    setActiveQuery(clean);
    setShowSuggestions(false);
    if (clean && !recentSearches.includes(clean)) {
      setRecentSearches((prev) => [clean, ...prev.slice(0, 5)]);
    }
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(clean)}`);
    });
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    setActiveQuery(term);
    setShowSuggestions(false);
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    });
  };

  const handleRemoveRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => prev.filter((item) => item !== term));
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
  };

  // Filter products based on quick pills in memory
  const filteredProducts = products.filter((item) => {
    const primaryVariant = item.variants[0];
    const price = primaryVariant ? primaryVariant.sellingPricePaise : 0;
    const brandName = item.brand?.name.toLowerCase() || "";

    if (selectedQuickFilter === "under-999" && price > 99900) return false;
    if (selectedQuickFilter === "rating-4" && item.ratingAverage < 4.0) return false;
    if (selectedQuickFilter === "prestige" && brandName !== "prestige") return false;
    if (selectedQuickFilter === "philips" && brandName !== "philips") return false;

    return true;
  });

  return (
    <div className="relative mx-auto max-w-md min-h-screen bg-neutral-50 pb-28 shadow-xl flex flex-col font-sans">
      {/* 1. TOP SEARCH HEADER */}
      <header className="sticky top-0 z-40 bg-white shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 px-3 pt-3 pb-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Search Input Bar Form */}
          <div className="relative flex flex-1 items-center rounded-xl bg-neutral-100 px-3 py-1.5 ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-[#D91E2A] focus-within:bg-white transition-all">
            <SearchIcon className="h-4 w-4 text-[#D91E2A] mr-2 shrink-0" />
            <input
              id="searchInput"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Search for cookers, brands..."
              className="w-full bg-transparent p-0 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none border-none ring-0"
              autoFocus={!initialQuery}
            />

            {/* Clear Input Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveQuery("");
                  setShowSuggestions(false);
                }}
                aria-label="Clear query"
                className="p-1 text-neutral-400 hover:text-neutral-700 active:scale-90 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Mic & Visual Search */}
            <div className="flex items-center gap-1.5 pl-1.5 ml-1 border-l border-neutral-300">
              <button
                type="button"
                aria-label="Voice search"
                className="p-1 text-neutral-500 hover:text-[#D91E2A] active:scale-90 transition-transform"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Camera visual search"
                className="p-1 text-neutral-500 hover:text-[#D91E2A] active:scale-90 transition-transform"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Cart Quick Access */}
          <Link
            href="/cart"
            aria-label="View Cart"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <ShoppingBag className="h-5 w-5" />
            {isHydrated && cartCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D91E2A] px-1 text-[10px] font-bold text-white shadow-xs">
                {cartCount}
              </span>
            )}
          </Link>
        </form>

        {/* Location Context Strip */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-100 text-xs text-neutral-600 border-t border-neutral-200">
          <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <MapPin className="h-3.5 w-3.5 text-[#D91E2A] shrink-0" />
            <span className="font-medium text-neutral-900">
              Deliver to{" "}
              <span className="font-bold">
                {location.city} {location.pincode}
              </span>
            </span>
            <span className="text-[11px] text-neutral-500">
              ({location.locality || "Fulfillment Hub"})
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#D91E2A] shrink-0">Express Hub</span>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="flex-1 flex flex-col">
        {/* 2. DIRECT AUTOSUGGESTIONS CARD */}
        {query && showSuggestions && (
          <div
            className="bg-white px-4 py-3 shadow-xs border-b border-neutral-200"
            id="suggestModule"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Direct Matches
              </span>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-[11px] font-medium text-[#D91E2A] hover:underline cursor-pointer"
              >
                Hide suggestions
              </button>
            </div>

            <div className="space-y-1">
              {DIRECT_SUGGESTIONS.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setQuery(item.query);
                    setActiveQuery(item.query);
                    setShowSuggestions(false);
                    startTransition(() => {
                      router.push(`/search?q=${encodeURIComponent(item.query)}`);
                    });
                  }}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    {idx === 0 ? (
                      <TrendingUp className="h-4 w-4 text-neutral-400 group-hover:text-[#D91E2A]" />
                    ) : (
                      <SearchIcon className="h-4 w-4 text-neutral-400 group-hover:text-[#D91E2A]" />
                    )}
                    <p className="text-xs text-neutral-900 font-medium">
                      <span>{item.title}</span>{" "}
                      <span className="text-[11px] text-neutral-500 font-normal">
                        ({item.subtitle})
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-400 -rotate-45" />
                </div>
              ))}
            </div>

            {/* Jump to Categories */}
            <div className="flex items-center gap-2 pt-2.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-neutral-500 shrink-0">JUMP TO:</span>
              <Link
                href="/category/kitchen-appliances"
                className="shrink-0 px-2.5 py-1 rounded-full bg-red-50 text-[#D91E2A] text-[11px] font-semibold border border-red-200 hover:bg-red-100 transition-colors"
              >
                Kitchen Appliances
              </Link>
              <Link
                href="/category/crockery-kitchenware"
                className="shrink-0 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200 hover:bg-neutral-200 transition-colors"
              >
                Crockery & Flasks
              </Link>
              <Link
                href="/category/electronics-audio"
                className="shrink-0 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200 hover:bg-neutral-200 transition-colors"
              >
                Electronics & Audio
              </Link>
            </div>
          </div>
        )}

        {/* 3. RECENT SEARCHES & TRENDING */}
        {!activeQuery && (
          <section className="bg-white p-4 mb-2 shadow-2xs space-y-4">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-neutral-400" /> Recent Searches
                  </h3>
                  <button
                    onClick={handleClearRecent}
                    className="text-[11px] text-neutral-400 hover:text-neutral-700"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <span
                      key={term}
                      onClick={() => handleSelectRecent(term)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-800 hover:bg-neutral-200 cursor-pointer transition-colors"
                    >
                      {term}
                      <X
                        className="h-3 w-3 text-neutral-400 hover:text-neutral-700"
                        onClick={(e) => handleRemoveRecent(term, e)}
                      />
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-[#D91E2A]" /> Trending Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {TRENDING_SEARCHES.map((trend) => (
                  <button
                    key={trend.query}
                    onClick={() => handleSelectRecent(trend.query)}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:border-[#D91E2A] hover:text-[#D91E2A] transition-colors cursor-pointer"
                  >
                    <span className="text-[#D91E2A] font-bold">{trend.rank}</span> {trend.query}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. RESULTS STATUS & REFINEMENT BAR */}
        <section className="sticky top-[95px] z-30 bg-white shadow-xs">
          <div className="flex items-baseline justify-between px-4 pt-2.5 pb-1">
            <div>
              <h1 className="text-xs font-bold text-neutral-900 tracking-tight">
                {activeQuery ? (
                  <>
                    Showing {filteredProducts.length} results for{" "}
                    <span className="text-[#D91E2A] font-extrabold">
                      &ldquo;{activeQuery}&rdquo;
                    </span>
                  </>
                ) : (
                  <>Showing {filteredProducts.length} retail products from catalog</>
                )}
              </h1>
              <p className="text-[11px] text-neutral-500 font-normal">
                Direct stock from Superstore & Warehouse
              </p>
            </div>
            <span className="text-[10px] bg-red-100 text-[#D91E2A] px-1.5 py-0.5 rounded font-bold">
              Verified Stock
            </span>
          </div>

          {/* Quick Horizontal Filter Pills */}
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedQuickFilter("all")}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedQuickFilter === "all"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() =>
                setSelectedQuickFilter(selectedQuickFilter === "under-999" ? "all" : "under-999")
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedQuickFilter === "under-999"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              Under ₹999
            </button>
            <button
              onClick={() =>
                setSelectedQuickFilter(selectedQuickFilter === "rating-4" ? "all" : "rating-4")
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedQuickFilter === "rating-4"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              4★ & above
            </button>
            <button
              onClick={() =>
                setSelectedQuickFilter(selectedQuickFilter === "prestige" ? "all" : "prestige")
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedQuickFilter === "prestige"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              Prestige
            </button>
            <button
              onClick={() =>
                setSelectedQuickFilter(selectedQuickFilter === "philips" ? "all" : "philips")
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedQuickFilter === "philips"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              Philips
            </button>
          </div>

          {/* Sticky Docked Sort Bar */}
          <div className="grid grid-cols-2 divide-x divide-neutral-200 border-t border-b border-neutral-200 py-1.5 text-xs font-semibold text-neutral-800">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-center gap-1 py-1 hover:text-[#D91E2A] active:scale-95 transition-transform cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>
                {sortBy === "relevance"
                  ? "Sort: Relevance"
                  : sortBy === "price-asc"
                    ? "Price: Low to High"
                    : sortBy === "price-desc"
                      ? "Price: High to Low"
                      : "Top Rated"}
              </span>
            </button>

            <label className="flex items-center justify-center gap-1.5 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fastDeliveryOnly}
                onChange={(e) => setFastDeliveryOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-[#D91E2A] focus:ring-[#D91E2A] border-neutral-300"
              />
              <span className="text-[11px] font-bold text-[#D91E2A] flex items-center gap-0.5">
                <Zap className="h-3 w-3 fill-current" /> 2-Hr Express
              </span>
            </label>
          </div>
        </section>

        {/* 5. 2-COLUMN PRODUCT GRID */}
        <section className="p-3">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-3 border-[#D91E2A] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-neutral-500">Searching store database...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredProducts.map((p) => {
                const primaryVariant = p.variants[0];
                const mrpPaise = primaryVariant ? primaryVariant.mrpPaise : 0;
                const sellingPricePaise = primaryVariant ? primaryVariant.sellingPricePaise : 0;
                return (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    slug={p.slug}
                    title={p.name}
                    brand={p.brand?.name}
                    mrpPaise={mrpPaise}
                    sellingPricePaise={sellingPricePaise}
                    rating={p.ratingAverage || 4.2}
                    ratingCount={p.reviewCount || 10}
                    inStock={primaryVariant?.inStock ?? true}
                    isWishlisted={isInWishlist(p.id)}
                    onAddToCart={() =>
                      addToCart({
                        id: p.id,
                        slug: p.slug,
                        title: p.name,
                        brand: p.brand?.name,
                        sellingPricePaise,
                        mrpPaise,
                      })
                    }
                    onToggleWishlist={() =>
                      toggleWishlist({
                        id: p.id,
                        slug: p.slug,
                        title: p.name,
                        brand: p.brand?.name,
                        sellingPricePaise,
                        mrpPaise,
                      })
                    }
                  />
                );
              })}
            </div>
          ) : (
            /* ZERO SEARCH RESULTS STATE */
            <div className="rounded-xl bg-white p-6 text-center border border-dashed border-neutral-300 my-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#D91E2A] mb-3">
                <SearchX className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900">
                No products found for &ldquo;{activeQuery}&rdquo;
              </h3>
              <p className="text-xs text-neutral-600 max-w-xs mx-auto mt-1 mb-4 leading-relaxed">
                Check your spelling or search by general category terms like &ldquo;cooker&rdquo;,
                &ldquo;kettle&rdquo;, or &ldquo;mixer&rdquo;.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveQuery("");
                  setSelectedQuickFilter("all");
                  setFastDeliveryOnly(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D91E2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#B31520] transition-colors shadow-xs cursor-pointer"
              >
                Clear Search &amp; View All
              </button>
            </div>
          )}
        </section>

        {/* 6. LOOKING FOR SOMETHING ELSE / FALLBACK HELPER CARD */}
        <section className="px-3 pb-6">
          <div className="rounded-xl bg-white p-4 text-center border border-dashed border-neutral-300 shadow-xs">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-[#D91E2A] mb-2">
              <SearchIcon className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-neutral-900">Looking for something else?</h3>
            <p className="text-[11px] text-neutral-600 max-w-xs mx-auto mt-1 mb-3">
              Explore our complete retail superstore warehouse catalog by department.
            </p>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-50 px-4 py-1.5 text-xs font-bold text-[#D91E2A] ring-1 ring-red-200 hover:bg-[#D91E2A] hover:text-white transition-all shadow-xs"
            >
              <span>Explore All Departments</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>

      {/* SORT BOTTOM SHEET */}
      {isSortOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h2 className="text-sm font-bold text-neutral-900">Sort Products By</h2>
              <button
                onClick={() => setIsSortOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="divide-y divide-neutral-100 py-2">
              {[
                { id: "relevance", label: "Relevance" },
                { id: "price-asc", label: "Price: Low to High" },
                { id: "price-desc", label: "Price: High to Low" },
                { id: "rating", label: "Customer Rating (High to Low)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSortBy(opt.id as typeof sortBy);
                    setIsSortOpen(false);
                  }}
                  className="flex items-center justify-between w-full py-3 text-xs font-semibold text-neutral-800 hover:text-[#D91E2A] cursor-pointer"
                >
                  <span className={sortBy === opt.id ? "text-[#D91E2A] font-bold" : ""}>
                    {opt.label}
                  </span>
                  {sortBy === opt.id && <Check className="h-4 w-4 text-[#D91E2A]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <BottomTabBar />
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-md min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D91E2A] border-t-transparent" />
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  );
}
