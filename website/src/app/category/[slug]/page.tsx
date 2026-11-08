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
import { PriceRangeSlider } from "@/components/ui/PriceRangeSlider";
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
  const {
    addToCart,
    toggleWishlist,
    isInWishlist,
    searchHeaderQuery,
    setSearchHeaderQuery,
    setSearchInStockOnly,
    setSearchMinPrice,
    setSearchMaxPrice,
    setSearchScopeCategory,
    setSearchScopeSubcategory,
  } = useStorefront();

  // Categories Master List
  const [categories, setCategories] = useState<CategoryNode[]>(FALLBACK_CATEGORIES);

  // Filters & Search State from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(searchParams.get("subcategory") || "");
  const [selectedSort, setSelectedSort] = useState<string>(searchParams.get("sort") || "relevance");
  const [inStockOnly, setInStockOnly] = useState<boolean>(searchParams.get("in_stock") === "true");
  const [minPrice, setMinPrice] = useState<number | null>(() => {
    const raw = searchParams.get("min_price");
    return raw ? parseInt(raw, 10) : null;
  });
  const [maxPrice, setMaxPrice] = useState<number | null>(() => {
    const raw = searchParams.get("max_price");
    return raw ? parseInt(raw, 10) : null;
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });

  // Calculate dynamic min/max stock limits from DEMO_PRODUCTS / inventory
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
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
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

  // Automatically expand active category when navigating & sync search scope
  useEffect(() => {
    if (activeCategory) {
      setExpandedCategoryId(activeCategory.id);
      setSearchScopeCategory({
        id: activeCategory.id,
        name: activeCategory.name,
        slug: activeCategory.slug || String(activeCategory.id),
      });
    } else {
      setSearchScopeCategory(null);
    }
  }, [activeCategory, setSearchScopeCategory]);

  // Sync subcategory search scope
  useEffect(() => {
    setSearchScopeSubcategory(selectedSubcategory || null);
  }, [selectedSubcategory, setSearchScopeSubcategory]);

  // URL State Synchronizer
  const updateQueryParams = useCallback(
    (updates: {
      subcategory?: string;
      q?: string;
      sort?: string;
      min_price?: number | null;
      max_price?: number | null;
      in_stock?: boolean;
      page?: number;
    }) => {
      const nextSub = updates.subcategory !== undefined ? updates.subcategory : selectedSubcategory;
      const nextQ = updates.q !== undefined ? updates.q : searchQuery;
      const nextSort = updates.sort !== undefined ? updates.sort : selectedSort;
      const nextMin = updates.min_price !== undefined ? updates.min_price : minPrice;
      const nextMax = updates.max_price !== undefined ? updates.max_price : maxPrice;
      const nextInStock = updates.in_stock !== undefined ? updates.in_stock : inStockOnly;
      const nextPage = updates.page !== undefined ? updates.page : 1;

      const sp = new URLSearchParams();
      if (nextSub) sp.set("subcategory", nextSub);
      if (nextQ.trim()) sp.set("q", nextQ.trim());
      if (nextSort && nextSort !== "relevance") sp.set("sort", nextSort);
      if (nextMin !== null && !isNaN(nextMin)) sp.set("min_price", String(nextMin));
      if (nextMax !== null && !isNaN(nextMax)) sp.set("max_price", String(nextMax));
      if (nextInStock) sp.set("in_stock", "true");
      if (nextPage > 1) sp.set("page", String(nextPage));

      const queryStr = sp.toString() ? `?${sp.toString()}` : "";
      router.push(`/category/${slugParam}${queryStr}`, { scroll: false });
    },
    [router, slugParam, selectedSubcategory, searchQuery, selectedSort, minPrice, maxPrice, inStockOnly]
  );

  // Sync state when URL searchParams change
  useEffect(() => {
    setSelectedSubcategory(searchParams.get("subcategory") || "");
    const qParam = searchParams.get("q") || "";
    setSearchQuery(qParam);
    if (qParam !== searchHeaderQuery) {
      setSearchHeaderQuery(qParam);
    }
    setSelectedSort(searchParams.get("sort") || "relevance");
    const inStockVal = searchParams.get("in_stock") === "true";
    setInStockOnly(inStockVal);
    setSearchInStockOnly(inStockVal);

    const minRaw = searchParams.get("min_price");
    const parsedMin = minRaw ? parseInt(minRaw, 10) : null;
    setMinPrice(parsedMin);
    setSearchMinPrice(parsedMin);

    const maxRaw = searchParams.get("max_price");
    const parsedMax = maxRaw ? parseInt(maxRaw, 10) : null;
    setMaxPrice(parsedMax);
    setSearchMaxPrice(parsedMax);

    const p = parseInt(searchParams.get("page") || "1", 10);
    setCurrentPage(isNaN(p) || p < 1 ? 1 : p);
  }, [searchParams]);

  // Main Data Fetching Engine with Backend Pagination + Fallback to Demo Data
  const fetchProducts = useCallback(async (pageToFetch: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }
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
    } else if (selectedSort === "newest") {
      sp.set("sort", "newest");
    }
    if (minPrice !== null && !isNaN(minPrice)) {
      sp.set("min_price", String(minPrice));
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      sp.set("max_price", String(maxPrice));
    }
    if (inStockOnly) {
      sp.set("in_stock", "true");
    }
    sp.set("page", String(pageToFetch));
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

        if (append) {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = mapped.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newOnes];
          });
        } else {
          setProducts(mapped);
        }
        setTotalCount(count);
        setPageSize(24);
        setCurrentPage(pageToFetch);
        setLoading(false);
        setIsLoadingMore(false);
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
            p.category.toLowerCase().includes(q)
        );
      }

      if (minPrice !== null && !isNaN(minPrice)) {
        matched = matched.filter((p) => p.sellingPricePaise >= minPrice * 100);
      }
      if (maxPrice !== null && !isNaN(maxPrice)) {
        matched = matched.filter((p) => p.sellingPricePaise <= maxPrice * 100);
      }

      if (inStockOnly) {
        matched = matched.filter((p) => p.inStock);
      }

      if (selectedSort === "price_asc") {
        matched.sort((a, b) => a.sellingPricePaise - b.sellingPricePaise);
      } else if (selectedSort === "price_desc") {
        matched.sort((a, b) => b.sellingPricePaise - a.sellingPricePaise);
      } else if (selectedSort === "name_asc") {
        matched.sort((a, b) => a.title.localeCompare(b.title));
      } else if (selectedSort === "discount") {
        matched.sort((a, b) => {
          const discA = a.mrpPaise > a.sellingPricePaise ? (a.mrpPaise - a.sellingPricePaise) / a.mrpPaise : 0;
          const discB = b.mrpPaise > b.sellingPricePaise ? (b.mrpPaise - b.sellingPricePaise) / b.mrpPaise : 0;
          return discB - discA;
        });
      }

      const total = matched.length;
      const pSize = 24;
      const start = (pageToFetch - 1) * pSize;
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

      if (append) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = mapped.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newOnes];
        });
      } else {
        setProducts(mapped);
      }
      setTotalCount(total);
      setPageSize(pSize);
      setCurrentPage(pageToFetch);
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [
    activeCategory,
    selectedSubcategory,
    searchQuery,
    selectedSort,
    minPrice,
    maxPrice,
    inStockOnly,
    slugParam,
  ]);

  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  const handleLoadMore = () => {
    if (isLoadingMore || products.length >= totalCount) return;
    const nextPage = currentPage + 1;
    fetchProducts(nextPage, true);
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
    setSearchHeaderQuery("");
    setSelectedSort("relevance");
    setMinPrice(null);
    setMaxPrice(null);
    setInStockOnly(false);
    setSearchInStockOnly(false);
    setSearchMinPrice(null);
    setSearchMaxPrice(null);
    updateQueryParams({
      subcategory: "",
      q: "",
      sort: "relevance",
      min_price: null,
      max_price: null,
      in_stock: false,
      page: 1,
    });
  };

  const sortLabelMap: Record<string, string> = {
    relevance: "Relevance",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc: "Name: A to Z",
    discount: "Biggest Discount",
  };

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] flex flex-col font-sans">
      {/* Top Global Header (Sticky, with Search & Cart) */}
      <GlobalHeader />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pb-3 md:pb-6 flex flex-col">
        
        {/* Sticky Breadcrumb & Sort Bar */}
        <div className="sticky top-[118px] md:top-20 z-30 bg-[#F6E9C8] py-2 px-1 mb-2 border-b border-[#680114]/15">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Top / Left: Breadcrumb line */}
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
                  <span className="text-[#680114] font-bold bg-[#EFE0BC] border border-[#680114]/30 px-2 py-0.5 rounded-full text-[11px] sm:text-sm shrink-0 flex items-center gap-1.5">
                    <span>{selectedSubcategory}</span>
                    <button
                      type="button"
                      onClick={() => handleSubcategorySelect(selectedSubcategory)}
                      className="hover:opacity-75 cursor-pointer text-[#680114]"
                      aria-label="Remove subcategory filter"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </span>
                </>
              )}
              {searchQuery && (
                <>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
                  <span className="text-[#680114] font-serif font-bold bg-[#680114] text-[#F6E9C8] px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs shrink-0 flex items-center gap-1.5">
                    <span>&ldquo;{searchQuery}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchHeaderQuery("");
                        updateQueryParams({ q: "", page: 1 });
                      }}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </span>
                </>
              )}
            </div>

            {/* Right Corner (Desktop) / New Line Below (Mobile): Sort dropdown & Filters */}
            <div className="flex items-center justify-between md:justify-end gap-2.5 pt-1 md:pt-0 border-t border-[#680114]/10 md:border-t-0 shrink-0">
              {/* Product Counter Label on Mobile */}
              <span className="md:hidden text-[11px] font-serif text-[#680114]/80">
                {totalCount} products
              </span>

              <div className="flex items-center gap-2">
                {/* Desktop Sort Dropdown / Mobile Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSortSheet(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-serif font-bold bg-[#EFE0BC] text-[#680114] border border-[#DFCBA0] hover:bg-[#E8D7B0] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Sort:</span>
                    <span className="font-extrabold underline decoration-[#680114]/40 underline-offset-2">
                      {sortLabelMap[selectedSort] || "Relevance"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.2] opacity-75" />
                  </button>
                </div>

                {/* Filter Trigger */}
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(true)}
                  className={`px-3 py-1.5 rounded-full text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                    minPrice !== null || maxPrice !== null || inStockOnly
                      ? "bg-[#680114] text-[#F6E9C8] border-[#680114]"
                      : "bg-[#EFE0BC] text-[#680114] border-[#DFCBA0] hover:bg-[#E8D7B0]"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Filters</span>
                  {(minPrice !== null || maxPrice !== null || inStockOnly) && (
                    <span className="w-1.5 h-1.5 bg-[#FEC501] rounded-full" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active Applied Filter Badges Row (Shows Category, Subcategory, Price, Stock & Search tags with 1-click removal) */}
          {(selectedSubcategory || minPrice !== null || maxPrice !== null || inStockOnly || activeCategory) && (
            <div className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar">
              <span className="text-[10.5px] font-serif font-bold text-[#680114]/75 shrink-0 uppercase tracking-wider mr-1">
                Active:
              </span>

              {/* Active Category Tag */}
              {activeCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE0BC] border border-[#DFCBA0] text-xs font-serif font-bold text-[#680114] shrink-0">
                  <span>{activeCategory.name}</span>
                  <Link
                    href="/category/all"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                    title="Clear category filter"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </Link>
                </span>
              )}

              {/* Active Subcategory Tag */}
              {selectedSubcategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE0BC] border border-[#DFCBA0] text-xs font-serif font-bold text-[#680114] shrink-0">
                  <span>{selectedSubcategory}</span>
                  <button
                    type="button"
                    onClick={() => handleSubcategorySelect(selectedSubcategory)}
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                    title="Remove subcategory filter"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </span>
              )}

              {/* Active Price Range Tag */}
              {(minPrice !== null || maxPrice !== null) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE0BC] border border-[#DFCBA0] text-xs font-serif font-bold text-[#680114] shrink-0">
                  <span>
                    ₹{minPrice ?? stockMin} – ₹{maxPrice ?? stockMax}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice(null);
                      setMaxPrice(null);
                      setSearchMinPrice(null);
                      setSearchMaxPrice(null);
                      updateQueryParams({ min_price: null, max_price: null, page: 1 });
                    }}
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                    title="Clear price filter"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </span>
              )}

              {/* Active In-Stock Only Tag */}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE0BC] border border-[#DFCBA0] text-xs font-serif font-bold text-[#680114] shrink-0">
                  <span>In Stock Only</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInStockOnly(false);
                      setSearchInStockOnly(false);
                      updateQueryParams({ in_stock: false, page: 1 });
                    }}
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                    title="Remove in-stock filter"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </span>
              )}

              {/* Clear All Button */}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-sans text-[#680114] hover:underline font-bold shrink-0 ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
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

                {/* Load More Pagination Container (Backend lazy-loading by 25) */}
                {totalCount > 0 && (
                  <div className="mt-8 pt-6 border-t border-[#680114]/20 flex flex-col items-center justify-center gap-3">
                    <p className="text-xs sm:text-sm font-serif font-medium text-[#680114]/80 text-center">
                      Showing <span className="font-bold text-[#680114]">{products.length}</span> of{" "}
                      <span className="font-bold text-[#680114]">{totalCount}</span> products
                    </p>

                    {products.length < totalCount ? (
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className={`px-8 py-3 rounded-xl font-serif font-bold text-sm sm:text-base transition-all duration-200 shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                          isLoadingMore
                            ? "bg-[#680114]/70 text-[#F6E9C8] cursor-wait"
                            : "bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] active:scale-98 hover:shadow-md"
                        }`}
                      >
                        {isLoadingMore ? (
                          <>
                            <div className="w-4 h-4 border-2 border-[#F6E9C8] border-t-transparent rounded-full animate-spin" />
                            <span>Loading more products...</span>
                          </>
                        ) : (
                          <>
                            <span>Show More Products</span>
                            <span className="text-xs bg-[#F6E9C8]/20 px-2 py-0.5 rounded-full font-mono font-medium">
                              +{Math.min(pageSize, totalCount - products.length)} more
                            </span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="py-2 px-4 rounded-full bg-[#EFE0BC]/50 border border-[#680114]/15 text-xs font-serif text-[#680114]/70">
                        You&apos;ve viewed all {totalCount} products
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* ========================================================= */}
      {/* SORT DRAWER (Mobile & Desktop Accessible)                 */}
      {/* ========================================================= */}
      {showSortSheet && (
        <div
          onClick={() => setShowSortSheet(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#F6E9C8] border-2 border-[#680114] rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 bg-[#680114]/30 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-[#680114]/20">
              <h3 className="font-serif font-bold text-sm text-[#680114]">Sort Products By</h3>
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
                { label: "Relevance (Default)", key: "relevance" },
                { label: "Price: Low to High", key: "price_asc" },
                { label: "Price: High to Low", key: "price_desc" },
                { label: "Name: A to Z", key: "name_asc" },
                { label: "Biggest Discount", key: "discount" },
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
                  <span className={selectedSort === opt.key ? "font-bold text-[#680114]" : "text-[#5A0A10]"}>
                    {opt.label}
                  </span>
                  {selectedSort === opt.key && <Check className="w-4 h-4 text-[#680114] stroke-[2.5]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FILTERS DRAWER (Price Brackets & In Stock)               */}
      {/* ========================================================= */}
      {showFilterSheet && (
        <div
          onClick={() => setShowFilterSheet(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#F6E9C8] border-2 border-[#680114] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
          >
            <div className="w-10 h-1 bg-[#680114]/30 rounded-full mx-auto mt-2 sm:hidden" />
            <div className="p-4 flex items-center justify-between border-b border-[#680114]/20">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#680114]">Filter Products</h3>
                <span className="text-[11px] text-[#680114]/80">{totalCount} products in view</span>
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
                <label className="flex items-center gap-2.5 text-xs font-serif font-bold text-[#680114] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#680114]"
                  />
                  <span>Show In-Stock Items Only</span>
                </label>
              </div>

              {/* Price Range Filter (Slider + Min/Max Entry) */}
              <div>
                <span className="text-xs font-serif font-bold text-[#680114] block mb-2">
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

            {/* Sticky Actions */}
            <div className="p-4 border-t border-[#680114]/20 bg-[#FAF3E0] rounded-b-2xl flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMinPrice(null);
                  setMaxPrice(null);
                  setInStockOnly(false);
                }}
                className="flex-1 h-10 border border-[#680114]/40 rounded-xl text-xs font-serif font-bold text-[#680114] hover:bg-[#E8D7B0] cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFilterSheet(false);
                  updateQueryParams({
                    min_price: minPrice,
                    max_price: maxPrice,
                    in_stock: inStockOnly,
                    page: 1,
                  });
                }}
                className="flex-1 h-10 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] rounded-xl text-xs font-serif font-bold shadow-2xs cursor-pointer"
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
