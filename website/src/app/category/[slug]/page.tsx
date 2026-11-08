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
  ChevronLeft,
  Layers,
  Sparkles,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
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
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on scroll so cards tuck in automatically (mobile only)
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      // Collapse only on mobile viewport (< 768px)
      if (window.innerWidth >= 768) {
        if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        return;
      }

      const currentScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Smoothly trigger collapse as soon as user starts scrolling down (>= 12px)
          if (currentScrollY > 12 && currentScrollY > lastScrollY) {
            setIsSidebarCollapsed(true);
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarCollapsed(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isSidebarCollapsed]);

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

  // Automatically expand active category when navigating
  useEffect(() => {
    if (activeCategory) {
      setExpandedCategoryId(activeCategory.id);
    }
  }, [activeCategory]);

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
    popularity: "Popularity",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc: "Name: A to Z",
  };

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] flex flex-col font-sans">
      {/* Top Global Header (Sticky, with Search & Cart) */}
      <GlobalHeader />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pb-3 md:pb-6 flex flex-col">
        
        {/* Sticky Breadcrumb Bar: Attached cleanly right below sticky GlobalHeader with single-line horizontal scroll on mobile */}
        <div className="sticky top-[118px] md:top-20 z-30 bg-[#F6E9C8] py-1.5 md:py-2 px-1 mb-2 border-b border-[#680114]/15">
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base font-serif font-bold text-[#680114] whitespace-nowrap overflow-x-auto no-scrollbar">
            <Link href="/" className="hover:text-[#88091E] flex items-center transition-colors shrink-0">
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
            <Link
              href="/category/all"
              className={`transition-colors shrink-0 ${
                !activeCategory
                  ? "text-[#680114] font-extrabold cursor-default"
                  : "hover:text-[#88091E]"
              }`}
            >
              All Products
            </Link>
            {activeCategory && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
                <span className="text-[#680114] font-extrabold shrink-0">
                  {activeCategory.name}
                </span>
              </>
            )}
            {selectedSubcategory && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
                <span className="text-[#680114] font-bold bg-[#EFE0BC] border border-[#680114]/30 px-2 py-0.5 rounded-full text-[11px] sm:text-sm shrink-0">
                  {selectedSubcategory}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 2-Column Layout: Left Categories/Subcategories Bar + Right Column (Products Grid on mobile, Header+Grid on desktop) */}
        <div className="flex-1 flex items-start gap-2 sm:gap-4 lg:gap-5 min-h-[60vh]">
          
          {/* ========================================================= */}
          {/* LEFT SIDEBAR: Categories & Subcategories Tree Dropdown    */}
          {/* ========================================================= */}
          <aside
            onClick={() => {
              if (isSidebarCollapsed && window.innerWidth < 768) {
                setIsSidebarCollapsed(false);
              }
            }}
            className={`sticky top-[168px] md:top-[132px] flex flex-col shrink-0 transition-[width] duration-300 ease-in-out z-20 select-none ${
              isSidebarCollapsed
                ? "w-14 sm:w-16 md:w-60 lg:w-72 cursor-pointer md:cursor-default"
                : "w-[195px] sm:w-60 md:w-60 lg:w-72"
            }`}
          >
            {/* Sidebar Card: Categories Tree Dropdown View */}
            <div
              className={`bg-[#F6E9C8] border-2 border-[#680114] rounded-xl sm:rounded-2xl transition-all duration-300 ease-in-out shadow-sm relative overflow-hidden ${
                isSidebarCollapsed ? "p-1.5 md:p-3" : "p-2 sm:p-3"
              }`}
            >
              {/* Header with Title and Toggle Sideways Button (Button only on mobile) */}
              <div
                className={`flex items-center pb-1.5 sm:pb-2 mb-2 border-b border-[#680114]/20 transition-all ${
                  isSidebarCollapsed
                    ? "justify-center md:justify-between border-b-0 md:border-b mb-1 md:mb-2 pb-1 md:pb-2"
                    : "justify-between text-left"
                }`}
              >
                {/* On mobile show title when not collapsed; on desktop always show */}
                <div
                  className={`items-center gap-1.5 ${
                    isSidebarCollapsed ? "hidden md:flex" : "flex"
                  }`}
                >
                  <span className="font-serif font-bold text-xs sm:text-sm text-[#680114] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#680114]" />
                    <span>Categories</span>
                  </span>
                </div>

                {/* Desktop: "All Products" button positioned on the far right of the card header */}
                <Link
                  href="/category/all"
                  onClick={(e) => e.stopPropagation()}
                  className={`hidden md:inline-flex text-[11px] font-serif font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                    !activeCategory
                      ? "bg-[#680114] text-[#F6E9C8] border-[#680114]"
                      : "bg-[#EFE0BC] text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] border-[#680114]/30"
                  }`}
                >
                  All Products
                </Link>

                {/* Sidebar Collapse/Expand Toggle Button: ONLY ON MOBILE (< md) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }}
                  title={isSidebarCollapsed ? "Expand Categories" : "Collapse Categories"}
                  aria-label={isSidebarCollapsed ? "Expand Categories" : "Collapse Categories"}
                  className="md:hidden w-7 h-7 rounded-lg bg-[#680114] text-[#F6E9C8] hover:bg-[#88091E] flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>
              </div>

              {/* Navigation Items: If collapsed on mobile, shows only icons; Desktop always shows full details */}
              <div className="space-y-1.5 max-h-[75vh] md:max-h-[680px] overflow-y-auto no-scrollbar">
                {/* Mobile-Only First Item: "All Products" with LayoutGrid icon */}
                <div className="md:hidden flex flex-col select-none">
                  <div
                    className={`flex items-center w-full rounded-lg hover:bg-[#680114]/5 transition-colors group relative py-1 ${
                      isSidebarCollapsed ? "justify-center" : "justify-between"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCategoryId(null);
                        handleCategorySelect("all");
                      }}
                      title="All Products"
                      className={`flex items-center text-left cursor-pointer border-none bg-transparent min-w-0 ${
                        isSidebarCollapsed
                          ? "w-full justify-center px-0 py-0.5"
                          : "w-auto flex-1 gap-2.5 px-0.5 py-0.5"
                      }`}
                    >
                      {/* 32px diameter circle icon */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          !activeCategory
                            ? "bg-[#680114] text-[#F6E9C8] shadow-xs"
                            : "bg-[#680114]/15 text-[#680114] group-hover:bg-[#680114] group-hover:text-[#F6E9C8]"
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4 stroke-[2]" />
                      </div>

                      {/* Title: Only shown when sidebar is expanded */}
                      <span
                        className={`text-xs sm:text-[13px] font-serif font-bold leading-tight break-words transition-all duration-300 ease-in-out ${
                          isSidebarCollapsed
                            ? "hidden"
                            : "w-auto opacity-100"
                        } ${
                          !activeCategory ? "text-[#680114] font-extrabold" : "text-[#680114]/90"
                        }`}
                      >
                        All Products
                      </span>
                    </button>
                  </div>
                </div>

                {categories.map((cat) => {
                  const isCurrentCat = activeCategory?.id === cat.id;
                  const isExpanded = expandedCategoryId === cat.id;
                  const catTargetSlug = cat.slug || String(cat.id);
                  const Icon = getCategoryIcon(cat.icon, cat.name);
                  const subcats = cat.subcategories || [];

                  return (
                    <div key={cat.id} className="flex flex-col select-none">
                      {/* Category Header Row */}
                      <div
                        className={`flex items-center w-full rounded-lg hover:bg-[#680114]/5 transition-colors group relative py-1 ${
                          isSidebarCollapsed ? "justify-center md:justify-between" : "justify-between"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            if (isSidebarCollapsed && window.innerWidth < 768) {
                              e.stopPropagation();
                              setIsSidebarCollapsed(false);
                              setExpandedCategoryId(cat.id);
                              handleCategorySelect(catTargetSlug);
                              return;
                            }
                            if (subcats.length > 0) {
                              setExpandedCategoryId(isExpanded ? null : cat.id);
                            }
                            handleCategorySelect(catTargetSlug);
                          }}
                          title={cat.name}
                          className={`flex items-center text-left cursor-pointer border-none bg-transparent min-w-0 ${
                            isSidebarCollapsed ? "w-full justify-center px-0 py-0.5 md:w-auto md:flex-1 md:justify-start md:gap-2.5 md:px-0.5" : "w-auto flex-1 gap-2.5 px-0.5 py-0.5"
                          }`}
                        >
                          {/* 32px diameter circle icon — centered on collapsed mobile, left-aligned on desktop */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              isCurrentCat
                                ? "bg-[#680114] text-[#F6E9C8] shadow-xs"
                                : "bg-[#680114]/15 text-[#680114] group-hover:bg-[#680114] group-hover:text-[#F6E9C8]"
                            }`}
                          >
                            <Icon className="w-4 h-4 stroke-[2]" />
                          </div>

                          {/* Title: Smoothly wraps into multiple lines when needed without ellipsis cutting */}
                          <span
                            className={`text-xs sm:text-[13px] font-serif font-bold leading-tight break-words transition-all duration-300 ease-in-out ${
                              isSidebarCollapsed
                                ? "hidden md:inline-block md:w-auto md:opacity-100"
                                : "w-auto opacity-100"
                            } ${
                              isCurrentCat ? "text-[#680114] font-extrabold" : "text-[#680114]/90"
                            }`}
                          >
                            {cat.name}
                          </span>
                        </button>

                        {/* Chevron for expanding/collapsing dropdown: Smooth transition */}
                        {subcats.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCategoryId(isExpanded ? null : cat.id);
                            }}
                            aria-label={`Toggle ${cat.name} subcategories`}
                            className={`p-1 text-[#680114] hover:bg-[#680114]/10 rounded-md transition-all duration-300 cursor-pointer shrink-0 ml-1 ${
                              isSidebarCollapsed ? "hidden md:block" : "block"
                            }`}
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 stroke-[2.2] ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Tree Branch Dropdown Menu - Centered line directly below category icon circle */}
                      {isExpanded && subcats.length > 0 && (
                        <div className={`relative ml-[12px] pl-6 pt-0 -mt-2 flex flex-col transition-all duration-300 overflow-hidden ${
                          isSidebarCollapsed
                            ? "max-h-0 opacity-0 pointer-events-none md:max-h-[600px] md:opacity-100 md:pointer-events-auto"
                            : "max-h-[600px] opacity-100"
                        }`}>
                          {subcats.map((sub, idx) => {
                            const isSubActive = isCurrentCat && selectedSubcategory === sub.name;
                            const isFirst = idx === 0;
                            const isLast = idx === subcats.length - 1;

                            return (
                              <div
                                key={sub.id || idx}
                                className="relative flex items-center py-1.5 min-h-[30px]"
                              >
                                {/* Vertical connection going up into the bottom center of the 32px icon circle */}
                                {isFirst && (
                                  <span className="absolute -left-[20px] -top-2 h-2 w-0.5 bg-[#680114]" />
                                )}

                                {!isLast && (
                                  <span className="absolute -left-[20px] top-0 bottom-0 w-0.5 bg-[#680114]" />
                                )}

                                {isLast ? (
                                  <span className="absolute -left-[20px] top-0 w-4 h-4 border-l-2 border-b-2 border-[#680114] rounded-bl-xl pointer-events-none" />
                                ) : (
                                  <span className="absolute -left-[20px] top-0 w-4 h-4 border-l-2 border-b-2 border-[#680114] rounded-bl-lg pointer-events-none" />
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isCurrentCat) {
                                      router.push(`/category/${catTargetSlug}?subcategory=${encodeURIComponent(sub.name)}`);
                                    } else {
                                      handleSubcategorySelect(sub.name);
                                    }
                                  }}
                                  className={`text-[12px] sm:text-[13px] font-sans pl-1 pr-1 py-0.5 text-left transition-all leading-snug cursor-pointer line-clamp-2 max-w-full hover:translate-x-0.5 border-none bg-transparent ${
                                    isSubActive
                                      ? "text-[#680114] font-bold underline underline-offset-4 decoration-[#680114] decoration-[1.5px]"
                                      : "text-[#5A0A10] font-medium hover:text-[#680114] hover:font-semibold"
                                  }`}
                                >
                                  {sub.name}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Products Grid                                */}
          {/* ========================================================= */}
          <section className="flex-1 min-w-0 self-stretch flex flex-col">
            {/* Loading Indicator: 3D Gyroscopic Spinning Circles */}
            {loading ? (
              <LoadingSpinner
                text="Loading catalog products..."
                className="flex-1 min-h-[400px]"
              />
            ) : products.length === 0 ? (
              /* Empty State: Perfectly centered horizontally and vertically */
              <div className="flex-1 min-h-[50vh] flex items-center justify-center py-6">
                <div className="w-full max-w-md bg-[#F6E9C8] rounded-2xl border-2 border-[#680114] text-center p-8 sm:p-10 shadow-xs">
                  <div className="w-12 h-12 bg-[#E8D7B0] rounded-full flex items-center justify-center mx-auto mb-3 text-[#680114]">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif font-bold text-base text-[#680114]">
                    No products found
                  </h3>
                  <p className="text-xs text-[#680114]/80 mt-1 mb-4">
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
              </div>
            ) : (
              /* Products Grid: 3 columns on mobile when sidebar is collapsed (in), 2 columns when sidebar is open (out) */
              <>
                <div
                  className={`grid gap-1.5 sm:gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${
                    isSidebarCollapsed
                      ? "grid-cols-3 sm:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex flex-col h-full w-full min-w-0"
                    >
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
                  <div className="mt-8 pt-4 border-t border-[#680114]/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#680114]/80">
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
                              {showEllipsis && <span className="px-1 text-[#680114]/80">...</span>}
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
                { label: "Popularity", key: "popularity" },
                { label: "Price: Low to High", key: "price_asc" },
                { label: "Price: High to Low", key: "price_desc" },
                { label: "Name: A to Z", key: "name_asc" },
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
                <span className="text-[11px] text-[#680114]/80">{totalCount} items in view</span>
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
        <LoadingSpinner fullScreen text="Loading category products..." />
      }
    >
      <CategoryContent />
    </React.Suspense>
  );
}
