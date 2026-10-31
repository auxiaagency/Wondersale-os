"use client";

import React, { useState, useTransition } from "react";
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
  Flame,
  SearchX,
  ChevronRight,
} from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

// Catalog items for instant search demonstration and catalog integration
const CATALOG_ITEMS = [
  {
    id: "prestige-svachh-5l",
    title: "Prestige Svachh Deluxe Alpha Stainless Steel 5L Pressure Cooker",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Prestige",
    mrpPaise: 345000,
    sellingPricePaise: 219900,
    rating: 4.4,
    ratingCount: 3410,
    inStock: true,
    fastDelivery: true,
    keywords: ["cooker", "prestige", "pressure cooker", "kitchen", "5l", "stainless steel"],
  },
  {
    id: "hawkins-contura-3l",
    title: "Hawkins Stainless Steel 3 Litre Contura Pressure Cooker",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Hawkins",
    mrpPaise: 270000,
    sellingPricePaise: 185000,
    rating: 4.5,
    ratingCount: 5120,
    inStock: true,
    fastDelivery: true,
    keywords: [
      "cooker",
      "hawkins",
      "contura",
      "pressure cooker",
      "kitchen",
      "3l",
      "stainless steel",
    ],
  },
  {
    id: "pigeon-favourite-3l",
    title: "Pigeon by Stovekraft Favourite 3L Induction Base Aluminium Cooker",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Pigeon",
    mrpPaise: 149500,
    sellingPricePaise: 89900,
    rating: 4.1,
    ratingCount: 1850,
    inStock: true,
    fastDelivery: true,
    keywords: ["cooker", "pigeon", "stovekraft", "aluminium", "induction", "3l"],
  },
  {
    id: "bajaj-pcx65-5l",
    title: "Bajaj PCX 65 Deluxe 5L Aluminium Pressure Cooker",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Bajaj",
    mrpPaise: 199900,
    sellingPricePaise: 129900,
    rating: 4.3,
    ratingCount: 890,
    inStock: true,
    fastDelivery: true,
    keywords: ["cooker", "bajaj", "pressure cooker", "5l", "aluminium"],
  },
  {
    id: "prestige-pic-20",
    title: "Prestige PIC 20 1600W Induction Cooktop with Indian Menu",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Prestige",
    mrpPaise: 329500,
    sellingPricePaise: 189900,
    rating: 4.3,
    ratingCount: 3120,
    inStock: true,
    fastDelivery: true,
    keywords: ["cooktop", "induction", "prestige", "cooker", "kitchen"],
  },
  {
    id: "butterfly-cordial-5l",
    title: "Butterfly Cordial 5L Induction Base Aluminium Pressure Cooker",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Butterfly",
    mrpPaise: 185000,
    sellingPricePaise: 114900,
    rating: 4.2,
    ratingCount: 720,
    inStock: true,
    fastDelivery: true,
    keywords: ["cooker", "butterfly", "5l", "induction", "pressure cooker"],
  },
  {
    id: "philips-hl7756",
    title: "Philips HL7756/00 750W Mixer Grinder (3 Stainless Steel Jars)",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Philips",
    mrpPaise: 529500,
    sellingPricePaise: 329900,
    rating: 4.4,
    ratingCount: 5412,
    inStock: true,
    fastDelivery: true,
    keywords: ["mixer", "grinder", "philips", "750w", "kitchen appliances"],
  },
  {
    id: "bajaj-kettle-15",
    title: "Bajaj Majesty KKN 1.5L Cordless Electric Kettle",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    brand: "Bajaj",
    mrpPaise: 129900,
    sellingPricePaise: 84900,
    rating: 4.5,
    ratingCount: 2840,
    inStock: true,
    fastDelivery: true,
    keywords: ["kettle", "electric kettle", "bajaj", "tea", "water heater"],
  },
  {
    id: "titan-wall-clock",
    title: "Titan Contemporary Round Silent Sweep Wall Clock (30cm)",
    category: "Clocks & Timepieces",
    categorySlug: "clocks-timepieces",
    brand: "Titan",
    mrpPaise: 199500,
    sellingPricePaise: 149500,
    rating: 4.6,
    ratingCount: 920,
    inStock: true,
    fastDelivery: true,
    keywords: ["clock", "wall clock", "titan", "watch", "home decor"],
  },
  {
    id: "fastrack-aviator",
    title: "Fastrack Polarized Pilot Sunglasses with 100% UV Protection",
    category: "Sunglasses & Accessories",
    categorySlug: "sunglasses-accessories",
    brand: "Fastrack",
    mrpPaise: 249900,
    sellingPricePaise: 149900,
    rating: 4.3,
    ratingCount: 1450,
    inStock: true,
    fastDelivery: true,
    keywords: ["sunglasses", "fastrack", "goggles", "eyewear", "aviator"],
  },
];

const INITIAL_RECENT_SEARCHES = [
  "Prestige Cooker",
  "Dry Iron 1000W",
  "Milton Flask",
  "Bajaj Mixer",
];

const TRENDING_BHOPAL = [
  { rank: "#1", query: "Wall Clock" },
  { rank: "#2", query: "Non-stick Tawa" },
  { rank: "#3", query: "Electric Kettle" },
  { rank: "#4", query: "Kids Toys" },
  { rank: "#5", query: "Pressure Cooker" },
];

const DIRECT_SUGGESTIONS = [
  { title: "cooker 5L", subtitle: "in Kitchen Appliances", query: "cooker 5l" },
  { title: "Prestige Induction cooker", subtitle: "Top brand", query: "prestige induction" },
  { title: "Electric Rice cooker 1.8L", subtitle: "Automatic warm", query: "electric rice cooker" },
  {
    title: "Hawkins Contura Pressure cooker",
    subtitle: "Stainless steel",
    query: "hawkins contura",
  },
];

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

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
  const [, startTransition] = useTransition();

  // Synchronize when query param changes externally without direct setState in effect
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
    setActiveQuery(initialQuery);
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    setActiveQuery(clean);
    if (!recentSearches.includes(clean)) {
      setRecentSearches((prev) => [clean, ...prev.slice(0, 5)]);
    }
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(clean)}`);
    });
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    setActiveQuery(term);
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

  // Filter products based on search term & quick pills
  const filteredProducts = CATALOG_ITEMS.filter((item) => {
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchBrand = item.brand.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchKey = item.keywords.some((k) => k.toLowerCase().includes(q));
      if (!matchTitle && !matchBrand && !matchCat && !matchKey) return false;
    }

    if (fastDeliveryOnly && !item.fastDelivery) return false;

    if (selectedQuickFilter === "under-999" && item.sellingPricePaise > 99900) return false;
    if (selectedQuickFilter === "rating-4" && item.rating < 4.0) return false;
    if (selectedQuickFilter === "prestige" && item.brand.toLowerCase() !== "prestige") return false;
    if (selectedQuickFilter === "hawkins" && item.brand.toLowerCase() !== "hawkins") return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === "price-asc") return a.sellingPricePaise - b.sellingPricePaise;
    if (sortBy === "price-desc") return b.sellingPricePaise - a.sellingPricePaise;
    if (sortBy === "rating") return b.rating - a.rating;
    return 0; // relevance
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
              onChange={(e) => setQuery(e.target.value)}
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
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D91E2A] px-1 text-[10px] font-bold text-white shadow-xs">
              3
            </span>
          </Link>
        </form>

        {/* Bhopal Location Context Strip */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-100 text-xs text-neutral-600 border-t border-neutral-200">
          <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <MapPin className="h-3.5 w-3.5 text-[#D91E2A] shrink-0" />
            <span className="font-medium text-neutral-900">
              Deliver to <span className="font-bold">Bhopal 462001</span>
            </span>
            <span className="text-[11px] text-neutral-500">(Arera Colony, MP)</span>
          </div>
          <span className="text-[11px] font-bold text-[#D91E2A] shrink-0">Change</span>
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
                className="text-[11px] font-medium text-[#D91E2A] hover:underline"
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
                Pressure Cookers
              </Link>
              <Link
                href="/category/crockery-kitchenware"
                className="shrink-0 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200 hover:bg-neutral-200 transition-colors"
              >
                Cookware Sets
              </Link>
              <Link
                href="/category/kitchen-appliances"
                className="shrink-0 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200 hover:bg-neutral-200 transition-colors"
              >
                Induction Cooktops
              </Link>
            </div>
          </div>
        )}

        {/* 3. RECENT SEARCHES & TRENDING IN BHOPAL */}
        <section className="px-4 py-3 bg-neutral-100 border-b border-neutral-200">
          {recentSearches.length > 0 && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                  <History className="h-3.5 w-3.5" />
                  <span>Recent Searches</span>
                </div>
                <button
                  onClick={handleClearRecent}
                  className="text-[11px] font-bold text-neutral-600 hover:text-[#D91E2A] hover:underline"
                >
                  Clear History
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {recentSearches.map((term, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectRecent(term)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-800 shadow-xs border border-neutral-200 cursor-pointer hover:border-neutral-400 transition-colors"
                  >
                    <span>{term}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(term, e)}
                      aria-label="Remove search"
                      className="text-neutral-400 hover:text-[#D91E2A] ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending in Bhopal */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-neutral-600">
              <Flame className="h-3.5 w-3.5 text-[#D91E2A]" />
              <span>Trending in Bhopal</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {TRENDING_BHOPAL.map((trend, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectRecent(trend.query)}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-800 border border-neutral-200 hover:border-neutral-400 transition-colors shrink-0"
                >
                  <span className="text-[#D91E2A] font-bold">{trend.rank}</span> {trend.query}
                </button>
              ))}
            </div>
          </div>
        </section>

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
                  <>Showing {filteredProducts.length} popular products</>
                )}
              </h1>
              <p className="text-[11px] text-neutral-500 font-normal">
                Direct stock from Bhopal Superstore & Warehouse
              </p>
            </div>
            <span className="text-[10px] bg-red-100 text-[#D91E2A] px-1.5 py-0.5 rounded font-bold">
              Verified MP Stock
            </span>
          </div>

          {/* Quick Horizontal Filter Pills */}
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedQuickFilter(selectedQuickFilter === "all" ? "all" : "all")}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedQuickFilter === "prestige"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              Prestige
            </button>
            <button
              onClick={() =>
                setSelectedQuickFilter(selectedQuickFilter === "hawkins" ? "all" : "hawkins")
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedQuickFilter === "hawkins"
                  ? "bg-[#D91E2A] text-white font-semibold"
                  : "bg-neutral-100 text-neutral-800 border border-neutral-200"
              }`}
            >
              Hawkins
            </button>
          </div>

          {/* Sticky Docked Sort & Filter Bar */}
          <div className="grid grid-cols-3 divide-x divide-neutral-200 border-t border-b border-neutral-200 py-1.5 text-xs font-semibold text-neutral-800">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-center gap-1 py-1 hover:text-[#D91E2A] active:scale-95 transition-transform"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>
                {sortBy === "relevance"
                  ? "Relevance"
                  : sortBy === "price-asc"
                    ? "Price: Low"
                    : sortBy === "price-desc"
                      ? "Price: High"
                      : "Top Rated"}
              </span>
            </button>

            <button
              onClick={() => setIsSortOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1 hover:text-[#D91E2A] active:scale-95 transition-transform"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {selectedQuickFilter !== "all" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#D91E2A] text-[10px] font-bold text-white">
                  1
                </span>
              )}
            </button>

            <label className="flex items-center justify-center gap-1.5 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fastDeliveryOnly}
                onChange={(e) => setFastDeliveryOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-[#D91E2A] focus:ring-[#D91E2A] border-neutral-300"
              />
              <span className="text-[11px] font-bold text-[#D91E2A] flex items-center gap-0.5">
                <Zap className="h-3 w-3 fill-current" /> 2-Hr Fast
              </span>
            </label>
          </div>
        </section>

        {/* 5. 2-COLUMN PRODUCT GRID */}
        <section className="p-3">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  mrpPaise={p.mrpPaise}
                  sellingPricePaise={p.sellingPricePaise}
                  rating={p.rating}
                  ratingCount={p.ratingCount}
                  onAddToCart={() => {
                    // Dispatch or show notification
                  }}
                />
              ))}
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D91E2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#B31520] transition-colors shadow-xs"
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
              Didn&apos;t find the exact model? Explore our complete Bhopal retail superstore
              warehouse catalog by department.
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
                  className="flex items-center justify-between w-full py-3 text-xs font-semibold text-neutral-800 hover:text-[#D91E2A]"
                >
                  <span>{opt.label}</span>
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
