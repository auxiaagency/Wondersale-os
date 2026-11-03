"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { useStorefront } from "@/context/StorefrontContext";
import { DEMO_PRODUCTS, DemoProduct } from "@/data/demo-products";
import { getCategoryIcon } from "@/lib/category-icons";

interface SubCategoryNode {
  id: number | string;
  name: string;
}

interface CategoryNode {
  id: number | string;
  name: string;
  slug?: string;
  icon?: string | null;
  subcategories: SubCategoryNode[];
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  categoryName?: string;
  subcategoryName?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  stockQuantity: number;
  inStock: boolean;
  imageUrl?: string;
  ratingAverage: number;
  reviewCount: number;
  badge?: string;
}

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
      { id: "tg-1", name: "Educational Toys" },
      { id: "tg-2", name: "Board Games" },
      { id: "tg-3", name: "Remote Control Cars" },
      { id: "tg-4", name: "Action Figures" },
      { id: "tg-5", name: "Puzzles & Blocks" },
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

const DEFAULT_SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  electronics: ["Accessories & Cables", "Audio & Headphones", "Smartphones & Tablets", "Wearables & Watches"],
  fashion: ["Casual Apparel", "Sunglasses & Eyewear", "Footwear & Shoes", "Bags & Wallets"],
  "personal care": ["Beard Trimmers", "Hair Dryers & Styling", "Oral Care", "Skin & Wellness"],
  food: ["Artisan Coffee & Tea", "Dry Fruits & Nuts", "Healthy Snacks", "Daily Essentials"],
  home: ["Dry & Steam Irons", "Vacuum Cleaners", "Room Heaters & Fans", "Home Lighting"],
  kitchen: ["Pressure Cookers", "Mixer Grinders & Blenders", "Non-Stick Cookware", "Dinner Sets & Flasks"],
  toys: ["STEM Building Sets", "Educational Puzzles", "Board Games & Cards", "Remote Control Toys"],
};

function fillSubcategories(categoryName: string, backendSubs: Array<{ id: number | string; name: string }>): SubCategoryNode[] {
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

function CategoryContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slugParam = (params?.slug as string) || "all";
  const { addToCart, toggleWishlist, isInWishlist } = useStorefront();

  // Categories Master List
  const [categories, setCategories] = useState<CategoryNode[]>(FALLBACK_CATEGORIES);

  // Filters & Search State from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(searchParams.get("subcategory") || "");
  const [selectedSort, setSelectedSort] = useState<string>(searchParams.get("sort") || "popularity");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    searchParams.get("brand") ? searchParams.get("brand")!.split(",").filter(Boolean) : []
  );
  const [inStockOnly, setInStockOnly] = useState<boolean>(searchParams.get("in_stock") === "true");
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });

  // UI Drawers / Modals
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // Data & Backend Pagination State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(24);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(true);

  // Fetch Category Tree
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: CategoryNode[] = res.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            slug: item.slug || String(item.id),
            icon: item.icon,
            subcategories: fillSubcategories(item.name, item.subcategories || []),
          }));
          setCategories(mapped);
        }
      })
      .catch(() => {
        setCategories(FALLBACK_CATEGORIES);
      });
  }, []);

  // Determine current active Category
  const activeCategory = useMemo(() => {
    if (!slugParam || slugParam === "all") return null;
    const lowerSlug = slugParam.toLowerCase();
    return (
      categories.find(
        (c) =>
          String(c.id).toLowerCase() === lowerSlug ||
          (c.slug && c.slug.toLowerCase() === lowerSlug) ||
          c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === lowerSlug ||
          c.name.toLowerCase() === lowerSlug
      ) || null
    );
  }, [categories, slugParam]);

  const activeCategoryTitle = activeCategory ? activeCategory.name : "All Products & Categories";

  // URL State Synchronizer
  const updateQueryParams = useCallback(
    (updates: {
      subcategory?: string;
      q?: string;
      sort?: string;
      brand?: string[];
      in_stock?: boolean;
      page?: number;
    }) => {
      const nextSub = updates.subcategory !== undefined ? updates.subcategory : selectedSubcategory;
      const nextQ = updates.q !== undefined ? updates.q : searchQuery;
      const nextSort = updates.sort !== undefined ? updates.sort : selectedSort;
      const nextBrands = updates.brand !== undefined ? updates.brand : selectedBrands;
      const nextInStock = updates.in_stock !== undefined ? updates.in_stock : inStockOnly;
      const nextPage = updates.page !== undefined ? updates.page : 1;

      const sp = new URLSearchParams();
      if (nextSub) sp.set("subcategory", nextSub);
      if (nextQ.trim()) sp.set("q", nextQ.trim());
      if (nextSort && nextSort !== "popularity") sp.set("sort", nextSort);
      if (nextBrands.length > 0) sp.set("brand", nextBrands.join(","));
      if (nextInStock) sp.set("in_stock", "true");
      if (nextPage > 1) sp.set("page", String(nextPage));

      const queryStr = sp.toString() ? `?${sp.toString()}` : "";
      router.push(`/category/${slugParam}${queryStr}`, { scroll: false });
    },
    [router, slugParam, selectedSubcategory, searchQuery, selectedSort, selectedBrands, inStockOnly]
  );

  // Sync state when URL searchParams change
  useEffect(() => {
    setSelectedSubcategory(searchParams.get("subcategory") || "");
    setSearchQuery(searchParams.get("q") || "");
    setSelectedSort(searchParams.get("sort") || "popularity");
    setSelectedBrands(searchParams.get("brand") ? searchParams.get("brand")!.split(",").filter(Boolean) : []);
    setInStockOnly(searchParams.get("in_stock") === "true");
    const p = parseInt(searchParams.get("page") || "1", 10);
    setCurrentPage(isNaN(p) || p < 1 ? 1 : p);
  }, [searchParams]);

  // Main Data Fetching Engine with Backend Pagination + Fallback to Demo Data
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (activeCategory) {
      sp.set("category", activeCategory.name);
    }
    if (selectedSubcategory) {
      sp.set("subcategory", selectedSubcategory);
    }
    if (searchQuery.trim()) {
      sp.set("q", searchQuery.trim());
    }
    if (selectedSort === "price_asc") {
      sp.set("sort", "price_asc");
    } else if (selectedSort === "price_desc") {
      sp.set("sort", "price_desc");
    } else if (selectedSort === "name_asc") {
      sp.set("sort", "name_asc");
    }
    if (inStockOnly) {
      sp.set("in_stock", "true");
    }
    sp.set("page", String(currentPage));
    sp.set("pageSize", "24");

    try {
      const res = await fetch(`/api/catalog/products?${sp.toString()}`);
      if (!res.ok) throw new Error("Backend query failed");
      const json = await res.json();

      if (json.success && json.data) {
        setBackendAvailable(true);
        const data = json.data;
        const results = Array.isArray(data) ? data : data.results || [];
        const count = typeof data.count === "number" ? data.count : results.length;

        const mapped: ProductItem[] = results.map((item: any) => ({
          id: String(item.id),
          name: item.name,
          slug: item.uid || String(item.id),
          brand: item.brand || "Wondersale",
          categoryName: item.categories?.[0]?.name,
          subcategoryName: item.subcategories?.[0]?.name,
          mrpPaise: Math.round(Number(item.mrp || item.selling_price || 0) * 100),
          sellingPricePaise: Math.round(Number(item.selling_price || 0) * 100),
          stockQuantity: item.quantity || 10,
          inStock: Boolean(item.in_stock),
          imageUrl: item.primary_image_url || item.images?.[0]?.url || "",
          ratingAverage: 4.5,
          reviewCount: 28,
          badge: undefined,
        }));

        setProducts(mapped);
        setTotalCount(count);
        setPageSize(24);
        setLoading(false);
        return;
      }
      throw new Error("Invalid response format");
    } catch {
      // Fallback: Local demo products filtering with complete simulation
      setBackendAvailable(false);
      let matched = [...DEMO_PRODUCTS];

      if (activeCategory) {
        matched = matched.filter(
          (p) =>
            p.category.toLowerCase().includes(activeCategory.name.toLowerCase()) ||
            p.categorySlug.toLowerCase().includes(slugParam.toLowerCase()) ||
            slugParam.toLowerCase().includes(p.categorySlug.toLowerCase())
        );
      }

      if (selectedSubcategory) {
        matched = matched.filter((p) =>
          p.title.toLowerCase().includes(selectedSubcategory.toLowerCase()) ||
          p.category.toLowerCase().includes(selectedSubcategory.toLowerCase())
        );
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matched = matched.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
      }

      if (selectedBrands.length > 0) {
        matched = matched.filter((p) =>
          selectedBrands.some((b) => b.toLowerCase() === p.brand.toLowerCase())
        );
      }

      if (inStockOnly) {
        matched = matched.filter((p) => p.inStock);
      }

      if (selectedSort === "price_asc") {
        matched.sort((a, b) => a.sellingPricePaise - b.sellingPricePaise);
      } else if (selectedSort === "price_desc") {
        matched.sort((a, b) => b.sellingPricePaise - a.sellingPricePaise);
      } else if (selectedSort === "rating") {
        matched.sort((a, b) => b.rating - a.rating);
      }

      const total = matched.length;
      const pSize = 24;
      const start = (currentPage - 1) * pSize;
      const pageSlice = matched.slice(start, start + pSize);

      const mapped: ProductItem[] = pageSlice.map((p) => ({
        id: p.id,
        name: p.title,
        slug: p.slug,
        brand: p.brand,
        categoryName: p.category,
        subcategoryName: undefined,
        mrpPaise: p.mrpPaise,
        sellingPricePaise: p.sellingPricePaise,
        stockQuantity: p.stockCount,
        inStock: p.inStock,
        imageUrl: p.imageUrl,
        ratingAverage: p.rating,
        reviewCount: p.ratingCount,
        badge: (p as any).badge || (p.bestsellerRank ? "Top Seller" : undefined),
      }));

      setProducts(mapped);
      setTotalCount(total);
      setPageSize(pSize);
      setLoading(false);
    }
  }, [
    activeCategory,
    selectedSubcategory,
    searchQuery,
    selectedSort,
    inStockOnly,
    currentPage,
    selectedBrands,
    slugParam,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    updateQueryParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ q: searchQuery, page: 1 });
  };

  const handleCategorySelect = (targetSlug: string) => {
    router.push(`/category/${targetSlug}`);
  };

  const handleSubcategorySelect = (subName: string) => {
    const nextSub = selectedSubcategory === subName ? "" : subName;
    setSelectedSubcategory(nextSub);
    updateQueryParams({ subcategory: nextSub, page: 1 });
  };

  const handleClearFilters = () => {
    setSelectedSubcategory("");
    setSearchQuery("");
    setSelectedSort("popularity");
    setSelectedBrands([]);
    setInStockOnly(false);
    updateQueryParams({
      subcategory: "",
      q: "",
      sort: "popularity",
      brand: [],
      in_stock: false,
      page: 1,
    });
  };

  // Distinct verified brands for filter
  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    DEMO_PRODUCTS.forEach((p) => {
      if (p.brand) brandSet.add(p.brand);
    });
    return Array.from(brandSet).slice(0, 8);
  }, []);

  const toggleBrand = (brand: string) => {
    const updated = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(updated);
    updateQueryParams({ brand: updated, page: 1 });
  };

  const sortLabelMap: Record<string, string> = {
    popularity: "Popularity / Best Match",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc: "Name: A to Z",
    rating: "Customer Rating 4★+",
  };

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#680114] flex flex-col font-sans">
      {/* Top Global Header (Sticky, with Search & Cart) */}
      <GlobalHeader />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-3 md:py-6">
        
        {/* Breadcrumb & Mobile Back Row */}
        <div className="flex items-center gap-2 text-xs text-[#735A4A] mb-3 px-1">
          <Link href="/" className="hover:text-[#680114] font-medium flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5 md:hidden" />
            <span>Home</span>
          </Link>
          <ChevronRight className="w-3 h-3 opacity-60" />
          <Link href="/category/all" className="hover:text-[#680114] font-medium">
            Categories
          </Link>
          {activeCategory && (
            <>
              <ChevronRight className="w-3 h-3 opacity-60" />
              <span className="text-[#680114] font-bold truncate max-w-[180px] sm:max-w-none">
                {activeCategory.name}
              </span>
            </>
          )}
          {selectedSubcategory && (
            <>
              <ChevronRight className="w-3 h-3 opacity-60" />
              <span className="text-[#680114] font-semibold bg-[#EFE0BC] px-2 py-0.5 rounded-full text-[10px]">
                {selectedSubcategory}
              </span>
            </>
          )}
        </div>

        {/* Top Header Row: Category Title, In-Category Search Bar, and Mobile Filter/Sort Triggers */}
        <div className="bg-[#FAF3E0] rounded-xl sm:rounded-2xl border-2 border-[#680114] p-3 sm:p-4 md:p-5 shadow-xs mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
            
            {/* Left: Category Icon, Name & Product Count */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#680114] text-[#F6E9C8] flex items-center justify-center shrink-0 shadow-2xs">
                {(() => {
                  const Icon = getCategoryIcon(activeCategory?.icon, activeCategoryTitle);
                  return <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />;
                })()}
              </div>
              <div className="min-w-0">
                <h1 className="font-serif font-extrabold text-base sm:text-xl md:text-2xl text-[#680114] leading-tight truncate">
                  {activeCategoryTitle}
                </h1>
                <p className="text-[11px] sm:text-xs text-[#735A4A] mt-0.5 font-medium">
                  {totalCount} {totalCount === 1 ? "product" : "products"} available
                  {selectedSubcategory ? ` in "${selectedSubcategory}"` : ""}
                </p>
              </div>
            </div>

            {/* Right: In-Page Real-time Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-full md:max-w-md w-full">
              <Search className="w-4 h-4 text-[#680114] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${activeCategoryTitle}...`}
                className="w-full bg-[#F6E9C8] text-[#5A0A10] placeholder:text-[#8C7355] text-xs sm:text-sm rounded-full pl-9 pr-9 py-2 border border-[#680114]/40 focus:outline-none focus:ring-1 focus:ring-[#680114] transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    updateQueryParams({ q: "", page: 1 });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#735A4A] hover:text-[#680114]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>

          {/* Subcategory Pills Row (Horizontal Scrollable on Mobile & Desktop) */}
          {activeCategory && activeCategory.subcategories && activeCategory.subcategories.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#680114]/15 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => handleSubcategorySelect("")}
                className={`px-3 py-1 rounded-full text-xs font-serif font-bold whitespace-nowrap transition-all cursor-pointer ${
                  !selectedSubcategory
                    ? "bg-[#680114] text-[#F6E9C8] shadow-2xs"
                    : "bg-[#F6E9C8] text-[#680114] hover:bg-[#E8D7B0] border border-[#680114]/30"
                }`}
              >
                All {activeCategory.name}
              </button>

              {activeCategory.subcategories.map((sub) => {
                const isSelected = selectedSubcategory === sub.name;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubcategorySelect(sub.name)}
                    className={`px-3 py-1 rounded-full text-xs font-serif font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#680114] text-[#F6E9C8] shadow-2xs"
                        : "bg-[#F6E9C8] text-[#680114] hover:bg-[#E8D7B0] border border-[#680114]/30"
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Quick Action Buttons (Filter Drawer + Sort Sheet) */}
        <div className="flex md:hidden items-center justify-between gap-2 mb-3 px-0.5">
          <button
            type="button"
            onClick={() => setShowFilterSheet(true)}
            className="flex-1 h-9 bg-[#F6E9C8] border-2 border-[#680114] rounded-xl text-xs font-serif font-bold text-[#680114] flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters {selectedBrands.length > 0 || inStockOnly ? "• Active" : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSortSheet(true)}
            className="flex-1 h-9 bg-[#F6E9C8] border-2 border-[#680114] rounded-xl text-xs font-serif font-bold text-[#680114] flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="truncate">Sort: {sortLabelMap[selectedSort] || "Popularity"}</span>
          </button>
        </div>

        {/* Desktop 2-Column Grid Layout: Left Sidebar + Right Products Grid */}
        <div className="flex items-start gap-5 lg:gap-6">
          
          {/* ========================================================= */}
          {/* LEFT SIDEBAR (Desktop): Category Tree & Master Filters   */}
          {/* ========================================================= */}
          <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 space-y-4">
            
            {/* Categories & Subcategories Tree Card */}
            <div className="bg-[#F6E9C8] border-2 border-[#680114] rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#680114]/20">
                <span className="font-serif font-bold text-sm text-[#680114] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#680114]" />
                  <span>Departments</span>
                </span>
                <Link
                  href="/category/all"
                  className={`text-[11px] font-bold ${
                    !activeCategory ? "text-[#680114] underline" : "text-[#735A4A] hover:text-[#680114]"
                  }`}
                >
                  View All
                </Link>
              </div>

              {/* Category Tree Navigation with subcategory expand/collapse */}
              <div className="pt-2 space-y-1.5 max-h-[480px] overflow-y-auto no-scrollbar">
                {categories.map((cat) => {
                  const isCurrentCat = activeCategory?.id === cat.id;
                  const catTargetSlug = cat.slug || String(cat.id);
                  const Icon = getCategoryIcon(cat.icon, cat.name);

                  return (
                    <div key={cat.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleCategorySelect(catTargetSlug)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-serif transition-colors text-left cursor-pointer ${
                          isCurrentCat
                            ? "bg-[#680114] text-[#F6E9C8] font-bold shadow-2xs"
                            : "text-[#680114] hover:bg-[#E8D7B0] font-semibold"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrentCat ? "text-[#F6E9C8]" : "text-[#680114]"}`} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${isCurrentCat ? "rotate-180" : ""}`}
                          />
                        )}
                      </button>

                      {/* Expanded Subcategories Under Active Category */}
                      {isCurrentCat && cat.subcategories && cat.subcategories.length > 0 && (
                        <div className="pl-6 pr-2 py-1 space-y-1 border-l-2 border-[#680114]/30 ml-4 my-1">
                          {cat.subcategories.map((sub) => {
                            const isSubActive = selectedSubcategory === sub.name;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSubcategorySelect(sub.name)}
                                className={`w-full text-left text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                  isSubActive
                                    ? "bg-[#680114]/15 text-[#680114] font-bold"
                                    : "text-[#735A4A] hover:text-[#680114] hover:bg-[#E8D7B0]"
                                }`}
                              >
                                • {sub.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Faceted Filters Card (Availability, Verified Brands, Sorting) */}
            <div className="bg-[#F6E9C8] border-2 border-[#680114] rounded-2xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#680114]/20">
                <span className="font-serif font-bold text-sm text-[#680114] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#680114]" />
                  <span>Filters</span>
                </span>
                {(selectedBrands.length > 0 || inStockOnly || selectedSubcategory || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-[11px] font-bold text-[#680114] hover:underline cursor-pointer"
                  >
                    Reset All
                  </button>
                )}
              </div>

              {/* In Stock Only Checkbox */}
              <div>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-[#680114] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setInStockOnly(next);
                      updateQueryParams({ in_stock: next, page: 1 });
                    }}
                    className="w-4 h-4 rounded accent-[#680114] cursor-pointer"
                  />
                  <span>In-Stock Items Only</span>
                </label>
              </div>

              {/* Verified Brands Filter */}
              <div>
                <span className="text-xs font-serif font-bold text-[#680114] block mb-2">
                  Verified Brands
                </span>
                <div className="space-y-1.5">
                  {availableBrands.map((brand) => (
                    <label
                      key={brand}
                      className="flex items-center gap-2 text-xs font-medium text-[#680114] hover:text-[#7A0C16] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                        className="w-4 h-4 rounded accent-[#680114] cursor-pointer"
                      />
                      <span>{brand}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort By Dropdown */}
              <div>
                <span className="text-xs font-serif font-bold text-[#680114] block mb-1.5">
                  Sort Order
                </span>
                <select
                  value={selectedSort}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedSort(next);
                    updateQueryParams({ sort: next, page: 1 });
                  }}
                  className="w-full bg-[#FAF3E0] border border-[#680114]/40 rounded-xl px-2.5 py-1.5 text-xs text-[#680114] font-medium focus:outline-none focus:ring-1 focus:ring-[#680114] cursor-pointer"
                >
                  <option value="popularity">Popularity / Best Match</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="rating">Customer Rating 4★+</option>
                </select>
              </div>
            </div>
          </aside>

          {/* ========================================================= */}
          {/* RIGHT PRODUCT LISTING GRID: Products + Pagination        */}
          {/* ========================================================= */}
          <section className="flex-1 min-w-0">
            
            {/* Loading Indicator */}
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-3 border-[#680114] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-serif font-bold text-[#680114]">
                  Loading catalog products...
                </p>
              </div>
            ) : products.length === 0 ? (
              /* Empty State */
              <div className="py-16 bg-[#F6E9C8] rounded-2xl border-2 border-[#680114] text-center px-4 max-w-md mx-auto shadow-xs">
                <div className="w-12 h-12 bg-[#E8D7B0] rounded-full flex items-center justify-center mx-auto mb-3 text-[#680114]">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-base text-[#680114]">
                  No products found
                </h3>
                <p className="text-xs text-[#735A4A] mt-1 mb-4">
                  We couldn&apos;t find any products matching your current filters or search term.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] text-xs font-serif font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              /* Products Grid: Exactly 3 cards per row on mobile (compact scaled cards), 3 on sm, 4 on md/lg, 5 on xl */
              <>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2.5 md:gap-3">
                  {products.map((prod) => (
                    <div key={prod.id} className="flex flex-col h-full">
                      <ProductCard
                        id={prod.id}
                        slug={prod.slug}
                        title={prod.name}
                        brand={prod.brand}
                        mrpPaise={prod.mrpPaise}
                        sellingPricePaise={prod.sellingPricePaise}
                        rating={prod.ratingAverage}
                        ratingCount={prod.reviewCount}
                        imageUrl={prod.imageUrl}
                        inStock={prod.inStock}
                        badge={prod.badge}
                        variant="grid"
                        onAddToCart={() =>
                          addToCart({
                            id: prod.id,
                            slug: prod.slug,
                            title: prod.name,
                            sellingPricePaise: prod.sellingPricePaise,
                            mrpPaise: prod.mrpPaise,
                            imageUrl: prod.imageUrl,
                          })
                        }
                        onToggleWishlist={() =>
                          toggleWishlist({
                            id: prod.id,
                            slug: prod.slug,
                            title: prod.name,
                            brand: prod.brand,
                            sellingPricePaise: prod.sellingPricePaise,
                            mrpPaise: prod.mrpPaise,
                            rating: prod.ratingAverage,
                            ratingCount: prod.reviewCount,
                            inStock: prod.inStock,
                            imageUrl: prod.imageUrl,
                          })
                        }
                        isWishlisted={isInWishlist(prod.id)}
                      />
                    </div>
                  ))}
                </div>

                {/* Backend Pagination Bar */}
                {totalPages > 1 && (
                  <div className="mt-8 pt-4 border-t border-[#680114]/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#735A4A]">
                    <div>
                      Showing {(currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, totalCount)} of {totalCount} products
                    </div>

                    <div className="flex items-center gap-1.5 select-none">
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-serif font-bold transition-all ${
                          currentPage === 1
                            ? "border-[#680114]/20 text-[#680114]/30 cursor-not-allowed bg-[#FAF3E0]"
                            : "border-[#680114] text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] cursor-pointer bg-[#F6E9C8]"
                        }`}
                      >
                        Prev
                      </button>

                      {/* Page Numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          if (totalPages <= 5) return true;
                          return Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
                        })
                        .map((page, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && page - prev > 1;

                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && <span className="px-1 text-[#735A4A]">...</span>}
                              <button
                                type="button"
                                onClick={() => handlePageChange(page)}
                                className={`w-8 h-8 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer ${
                                  currentPage === page
                                    ? "bg-[#680114] text-[#F6E9C8] shadow-2xs"
                                    : "bg-[#F6E9C8] border border-[#680114]/40 text-[#680114] hover:bg-[#E8D7B0]"
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}

                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-serif font-bold transition-all ${
                          currentPage === totalPages
                            ? "border-[#680114]/20 text-[#680114]/30 cursor-not-allowed bg-[#FAF3E0]"
                            : "border-[#680114] text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] cursor-pointer bg-[#F6E9C8]"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MOBILE SORT BOTTOM SHEET                                  */}
      {/* ========================================================= */}
      {showSortSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs md:hidden">
          <div className="w-full max-w-md bg-[#F6E9C8] border-t-2 border-x-2 border-[#680114] rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-[#680114]/30 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-[#680114]/20">
              <h3 className="font-serif font-bold text-sm text-[#680114]">Sort Products</h3>
              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="p-1 text-[#680114] hover:text-[#88091E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 space-y-1">
              {[
                { label: "Popularity / Best Match", key: "popularity" },
                { label: "Price: Low to High", key: "price_asc" },
                { label: "Price: High to Low", key: "price_desc" },
                { label: "Name: A to Z", key: "name_asc" },
                { label: "Customer Rating 4★+", key: "rating" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setSelectedSort(opt.key);
                    setShowSortSheet(false);
                    updateQueryParams({ sort: opt.key, page: 1 });
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-medium text-[#680114] hover:bg-[#E8D7B0] cursor-pointer"
                >
                  <span className={selectedSort === opt.key ? "font-bold" : ""}>
                    {opt.label}
                  </span>
                  {selectedSort === opt.key && <Check className="w-4 h-4 text-[#680114]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE FILTERS BOTTOM SHEET                               */}
      {/* ========================================================= */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs md:hidden">
          <div className="w-full max-w-md bg-[#F6E9C8] border-t-2 border-x-2 border-[#680114] rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 bg-[#680114]/30 rounded-full mx-auto mt-2" />
            <div className="p-4 flex items-center justify-between border-b border-[#680114]/20">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#680114]">Filter Products</h3>
                <span className="text-[11px] text-[#735A4A]">{totalCount} items in view</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterSheet(false)}
                className="p-1 text-[#680114] hover:text-[#88091E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* In Stock Toggle */}
              <div>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-[#680114] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#680114]"
                  />
                  <span>Show In-Stock Items Only</span>
                </label>
              </div>

              {/* Brands */}
              <div>
                <span className="text-xs font-serif font-bold text-[#680114] block mb-2">
                  Verified Brands
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {availableBrands.map((brand) => (
                    <label
                      key={brand}
                      className="flex items-center gap-2 text-xs font-medium text-[#680114] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => {
                          setSelectedBrands((prev) =>
                            prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
                          );
                        }}
                        className="w-4 h-4 rounded accent-[#680114]"
                      />
                      <span className="truncate">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Actions */}
            <div className="p-4 border-t border-[#680114]/20 bg-[#FAF3E0] flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedBrands([]);
                  setInStockOnly(false);
                }}
                className="flex-1 h-10 border border-[#680114]/40 rounded-xl text-xs font-serif font-bold text-[#680114] hover:bg-[#E8D7B0]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFilterSheet(false);
                  updateQueryParams({ brand: selectedBrands, in_stock: inStockOnly, page: 1 });
                }}
                className="flex-1 h-10 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] rounded-xl text-xs font-serif font-bold shadow-2xs"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Storefront Footer */}
      <StorefrontFooter />

      {/* Sticky Bottom Tab Bar (Mobile) */}
      <BottomTabBar />
    </div>
  );
}

export default function CategoryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FDF8EE] flex items-center justify-center text-xs font-serif font-bold text-[#680114]">
          Loading department products...
        </div>
      }
    >
      <CategoryContent />
    </React.Suspense>
  );
}
