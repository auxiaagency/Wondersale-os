"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { ProductCard } from "@/components/ui/ProductCard";
import { ProductCarouselSection } from "@/components/ui/ProductCarouselSection";
import {
  Fan,
  Utensils,
  Headphones,
  Gamepad2,
  Cookie,
  Clock,
  Glasses,
  Coffee,
  Zap,
  Lock,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Copy,
  Tag,
  Check,
  LayoutGrid,
  X,
  Sparkles,
} from "lucide-react";

import { useStorefront } from "@/context/StorefrontContext";
import { DEMO_PRODUCTS, DemoProduct } from "@/data/demo-products";
import { formatPrice } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";

export interface CategoryItem {
  id: number | string;
  name: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
  items_count?: number;
}

export interface HeroSlideItem {
  id: number | string;
  badge: string;
  title: string;
  subtitle: string;
  button_text?: string;
  buttonText?: string;
  button_link?: string;
  buttonLink?: string;
  image_url?: string;
  image?: string;
  alt_text?: string;
  alt?: string;
}

export interface ShopByCategoryCardItem {
  id: number | string;
  title: string;
  subtitle: string;
  badge?: string;
  image_url: string;
  category_id?: number | null;
  category_name?: string | null;
  link_url?: string;
  display_order?: number;
  is_active?: boolean;
}

const DEFAULT_SHOP_CATEGORY_CARDS: ShopByCategoryCardItem[] = [
  {
    id: 1,
    title: "Cookware & Dining",
    subtitle: "Non-stick, Pots & Bowls",
    badge: "Up to 60% Off",
    link_url: "/category/kitchen-appliances",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9w2vUJKQkRNV1FUIkncrCapIM725jmL-G4rr-BgEIijGnUcOrUwaQD6BVKw5Wwm79xdLoqRaszlezpJ6H077FxVzakFF0vorXx2dP9LcnV_XTIB28W8uOjt7leYjhJLvPd3y6r6ILeVDWkiI1B_g4xcK5YTPfatiZw5jxpqIryrhTFz9qAfvAcSJDv6gx0qXKWohElzV1EN6zRF-LyYxA5jqnpUqI-QVPYQd3rEoKUgYoKnMiYvcR1Q",
  },
  {
    id: 2,
    title: "Smart Gadgets",
    subtitle: "Wearables & Audio",
    badge: "Min 40% Off",
    link_url: "/category/electronics-audio",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDmYpYYgOcAqx8zW2hmXeF5lgJgFB03SDzmr2JqIRTMHSAiVxdL6sT3FHPc0SksAwcHJpP7gU0ZIE0sIMBL09f5SMbTusBEsD9UiZ_RaP_5P011JBecJ5kiCwZhnDbXVDWDjNHAtCn89uJPFG_MLAisZbg6Mlwx1xvQ2lcL6SSVSFwjk6AQlMHafVHoReK5vHXJG1fBOmocUh8qif0vg8W-B4DNRIP5dYNbvzEfKB5QpWc2mjFGViG81g",
  },
  {
    id: 3,
    title: "Kids & Toys",
    subtitle: "STEM & Board Games",
    badge: "Under ₹499",
    link_url: "/category/toys-games",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD37ApjZxEPIH29J5O9A8EdaspEO4NB2MUkfTComCU8qol45FjqL0wKJQpVbJlIH-Ao1xen1ITW4rTgqN8enPGkxEj0C7jcuEenBanwxcoC5zwk7AUBvNQuCt8TwpV1TYPtnG5uaiZDnDyU7lfbFFoR4QKufOFTnE9-h2rwMZrDZivD0_3TXsBk1K7xGV3GANp_7XBbPBMEdK5nHFpScPwuwfLmT7lwXbP5a2Fu_nnKMzVCvgsRRJO87A",
  },
  {
    id: 4,
    title: "Eyewear & Style",
    subtitle: "UV400 Polarized",
    badge: "Buy 1 Get 1",
    link_url: "/category/sunglasses-accessories",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCN1i80jVIbv2fEfKtFphirGBNs7n1uTfhjkqSC55XNFR0q_EHw_Lcgemw4XRLroqdEzkHa5yVjBULXzb36Npq3ES7DbpDDjtx4LUqx4bEFvmBLIOgs_rcceU4dmH5xuuec1JEAPGiCm0IMPl0oroYkEVn4wgJNY2bcc7i5X1PO-p7lC1pQgLCGm9I-ZvVdxvDU4dKBQ9uPVTg-0weRw3nrORWDNlDCdpi8SDYR95X29Wys8m44hxsEVQ",
  },
];

const DEFAULT_HERO_SLIDES: HeroSlideItem[] = [
  {
    id: "slide-1",
    badge: "Festival Special",
    title: "Mega Kitchen Bonanza",
    subtitle: "Up to 40% Off on Premium Air Fryers & Mixers",
    button_text: "Shop Deals",
    button_link: "/category/kitchen-appliances",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqSUbvjWIHdKh4q59CJUJS1hL6VB-lIzmuz4ymqGpn6bv10LY8_6LoBntAmGTXnlkbF6nkFAISR8eNu3FwJRUOk-yILX4H97lZh_Aa-_csb7sGvNzAYrQPabKzqWi8U-NwDOR5mLwnJbTKBZvg8fYU2AABQdkyrxgIRGAtOs7EYrZUIvVphSMRnPUIANe6zdspgV9vQhALj26WMg40h98txzkPku5Q3FrXvK7zKpVRFNTBHFCWQY3qg",
    alt_text: "Mega Kitchen Bonanza air fryers and blender display",
  },
  {
    id: "slide-2",
    badge: "Electronics Carnival",
    title: "Smart Audio & Accessories",
    subtitle: "Flat 50% Off on Bluetooth Headphones & RGB Speakers",
    button_text: "Explore Audio",
    button_link: "/category/electronics-audio",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDhX23oALAsXCOEjIxtEWk7AsYgghM4p55dhNf3t-x0MEDV_iE-xEsk7eVoys0_6a9V9gqoQovqYJNPWB-UpYMCEyITscsxPj1sc8HRh09C7Yjww46yrDZy6rFrjRqnz_xcRncSockj_22AORYY1a3xepqBMTpXqccywREJqL6a0-kNqvjNsScovSMrGJnPgHZ1ROy5mDVPivmbJNyxyZZdGflRpa8DDhpXt1PoyDfHBylRhJHQfcq-A",
    alt_text: "Smart Audio, wireless headphones and speakers",
  },
  {
    id: "slide-3",
    badge: "Home Makeover",
    title: "Royal Crockery & Dining",
    subtitle: "Starting at ₹499 | Opalware Sets & Anodized Tawas",
    button_text: "View Collection",
    button_link: "/category/crockery-kitchenware",
    image_url:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAJe7xis5zKoGIyTbHhUMUVKjDb2d-hhGspRS0nSA67ntQoEV9iRlc280OojE7Xa9CprFgmU8fu-ymexGmxzEPzkt_QbpZcK0R29-M2xZg_HVSgch2DCC3v0kjjHTAAGpnz51xrIIZrbuuCpwT44o0JGqG9AAyEmArTDdSahwitTurYtZujCgNoqRNhHFl6ugHNJ4LDbmv0rlH7SfMnZuEzGR9FRdWRGaz3kvYz35VXgmMjH2KupSegAg",
    alt_text: "Royal Crockery and Dining sets display",
  },
];

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlideItem[]>(DEFAULT_HERO_SLIDES);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [addedItemNotification, setAddedItemNotification] = useState<string | null>(null);

  // Live countdown timer state based on Indian Standard Time (IST, UTC+5:30) ending at 23:59:59 daily
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getSecondsUntilISTMidnight = () => {
      const now = new Date();
      // UTC time in ms + 5.5 hours in ms = Indian Standard Time
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffsetMs);
      const istMidnight = new Date(istNow);
      istMidnight.setUTCHours(23, 59, 59, 999);
      const diffMs = istMidnight.getTime() - istNow.getTime();
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      return {
        hours: Math.floor(totalSecs / 3600),
        minutes: Math.floor((totalSecs % 3600) / 60),
        seconds: totalSecs % 60,
      };
    };

    setTimeLeft(getSecondsUntilISTMidnight());
    const timer = setInterval(() => {
      setTimeLeft(getSecondsUntilISTMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const [currentSlide, setCurrentSlide] = useState(0);
  const isHeroHoveredRef = useRef(false);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addToCart, toggleWishlist, isInWishlist, openCategoryMenu } = useStorefront();

  const resetHeroTimer = useCallback(() => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      if (isHeroHoveredRef.current) return;
      setCurrentSlide((prev) => {
        const count = heroSlides.length;
        if (count <= 1) return prev;
        return (prev + 1) % count;
      });
    }, 4000);
  }, [heroSlides.length]);

  const handlePrevSlide = useCallback(() => {
    const count = heroSlides.length;
    if (count <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + count) % count);
    resetHeroTimer();
  }, [heroSlides.length, resetHeroTimer]);

  const handleNextSlide = useCallback(() => {
    const count = heroSlides.length;
    if (count <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % count);
    resetHeroTimer();
  }, [heroSlides.length, resetHeroTimer]);

  const handleSelectSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    resetHeroTimer();
  }, [resetHeroTimer]);

  useEffect(() => {
    resetHeroTimer();
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [resetHeroTimer]);



  const handleAddToCart = (item: Partial<DemoProduct> & { id: string; slug: string; title: string; mrpPaise: number; sellingPricePaise: number }) => {
    addToCart({
      id: item.id,
      slug: item.slug,
      title: item.title,
      brand: item.brand,
      variantLabel: item.variants?.[0]?.capacity || "Standard",
      specNote: item.variants?.[0]?.note || "In Stock",
      mrpPaise: item.mrpPaise,
      sellingPricePaise: item.sellingPricePaise,
      badge: "⚡ Bhopal 2-Hr Express Ready",
      imageUrl: item.imageUrl,
    });
    setAddedItemNotification(item.title);
    setTimeout(() => setAddedItemNotification(null), 2500);
  };

  const handleToggleWishlist = (item: Partial<DemoProduct> & { id: string; slug: string; title: string; mrpPaise: number; sellingPricePaise: number }) => {
    toggleWishlist({
      id: item.id,
      slug: item.slug,
      title: item.title,
      brand: item.brand,
      mrpPaise: item.mrpPaise,
      sellingPricePaise: item.sellingPricePaise,
      rating: item.rating,
      ratingCount: item.ratingCount,
      inStock: item.inStock,
      imageUrl: item.imageUrl,
    });
  };

  const [realDeals, setRealDeals] = useState<any[]>([]);
  const [shopCategoryCards, setShopCategoryCards] = useState<ShopByCategoryCardItem[]>(DEFAULT_SHOP_CATEGORY_CARDS);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [newArrivals, setNewArrivals] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setCategories(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/hero-slides")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setHeroSlides(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/deals-of-the-day")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setRealDeals(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/shop-by-category")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setShopCategoryCards(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/best-sellers")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBestSellers(data.data);
        }
      })
      .catch(() => {});

    fetch("/api/new-arrivals")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setNewArrivals(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const padTime = (num: number) => String(num).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] antialiased flex flex-col justify-between font-sans">
      {/* 1. Global Header */}
      <GlobalHeader />

      <main className="flex-1 w-full bg-[#F6E9C8]">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-3 md:py-6 flex flex-col gap-3 sm:gap-5 md:gap-7">

          {/* 2. EXPLORE CATEGORIES / CATEGORY ICON ROW (Real Backend Categories) */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-serif font-bold tracking-tight text-[#680114]">
                  Explore Categories
                </h2>
              </div>
              <button
                type="button"
                onClick={openCategoryMenu}
                className="text-xs text-[#680114] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile View: Dynamic category grid with deep burgundy outline */}
            <div className="grid grid-cols-5 md:hidden gap-1.5 items-start justify-items-center">
              {categories.slice(0, 5).map((cat) => {
                const Icon = getCategoryIcon(cat.icon, cat.name);
                const targetSlug = cat.slug || String(cat.id);
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${targetSlug}`}
                    className="flex flex-col items-center group w-full px-0.5 py-1 transition-transform active:scale-95 text-center"
                  >
                    <div className="w-13 h-13 rounded-full bg-transparent border-2 border-[#680114] flex items-center justify-center transition-all group-hover:bg-[#680114]/10 shadow-2xs shrink-0">
                      <Icon className="w-5.5 h-5.5 text-[#680114] stroke-[2]" />
                    </div>
                    <span className="text-[11px] text-[#680114] text-center mt-1.5 line-clamp-2 leading-tight font-serif font-bold group-hover:text-[#680114] transition-colors h-[28px] flex items-start justify-center w-full">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Desktop View: Full real categories evenly spaced without More button, showing full names */}
            <div className="hidden md:grid md:grid-cols-7 gap-3 lg:gap-6 items-start justify-items-center w-full">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.icon, cat.name);
                const targetSlug = cat.slug || String(cat.id);
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${targetSlug}`}
                    className="flex flex-col items-center group w-full px-1 py-1 transition-transform hover:-translate-y-0.5 text-center"
                  >
                    <div className="w-15 h-15 rounded-full bg-transparent border-2 border-[#680114] flex items-center justify-center transition-all group-hover:bg-[#680114] group-hover:text-[#F6E9C8] shadow-2xs">
                      <Icon className="w-6.5 h-6.5 text-[#680114] group-hover:text-[#F6E9C8] stroke-[2] transition-colors" />
                    </div>
                    <span className="text-xs lg:text-sm text-[#680114] text-center mt-2 font-serif font-bold group-hover:text-[#680114] transition-colors leading-tight line-clamp-2 max-w-[140px]">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 3. HERO CAMPAIGN BANNER (Rich Burgundy with Large Inner Image Circle) */}
          <section
            onMouseEnter={() => { isHeroHoveredRef.current = true; }}
            onMouseLeave={() => { isHeroHoveredRef.current = false; }}
            onTouchStart={() => { isHeroHoveredRef.current = true; }}
            onTouchEnd={() => { isHeroHoveredRef.current = false; }}
            className="w-full my-[calc(var(--spacing)*4)] md:my-2.5"
          >
            <div className="relative rounded-2xl md:rounded-[2.25rem] bg-[#680114] text-[#F6E9C8]">
              {heroSlides.map((slide, index) => {
                const isActive = index === currentSlide;
                const buttonText = slide.button_text || slide.buttonText || "Shop Now";
                const buttonLink = slide.button_link || slide.buttonLink || "/categories";
                const imageUrl = slide.image_url || slide.image || "";
                const altText = slide.alt_text || slide.alt || slide.title;

                return (
                  <div
                    key={slide.id}
                    className={`w-full transition-opacity duration-700 ease-in-out ${
                    isActive ? "block opacity-100" : "hidden opacity-0"
                    }`}
                  >
                    <div className="w-full relative flex flex-row items-center justify-between px-3.5 py-0 sm:px-6 sm:py-6 md:px-14 md:py-10 h-[143px] md:!h-auto md:!min-h-[310px] lg:!min-h-[340px] gap-2 sm:gap-4 md:gap-8">
                      {/* Left: Vertically centered container holding badge, titles, subtitle & button */}
                      <div className="flex-1 min-w-0 max-w-[53%] sm:max-w-[58%] md:max-w-md lg:max-w-xl z-10 flex flex-col justify-center space-y-1 sm:space-y-1.5 md:space-y-4 text-left pl-2.5 sm:pl-4 md:pl-0 h-full md:h-auto md:my-auto -translate-y-[6px] md:translate-y-0">
                        <div>
                          <span className="inline-block border border-[#DBC599]/40 bg-black/20 backdrop-blur-xs text-[#F6E9C8] text-[7.5px] sm:text-[8.5px] md:text-[10px] px-1.5 py-0.5 sm:px-2 md:px-3 rounded-full tracking-wider uppercase font-semibold leading-none">
                            {slide.badge}
                          </span>
                        </div>
                        <h2 className="text-[12.5px] sm:text-lg md:text-4xl lg:text-[44px] text-[#F6E9C8] leading-tight font-serif font-bold tracking-tight line-clamp-1 sm:line-clamp-2 md:line-clamp-none">
                          {slide.title}
                        </h2>
                        <p className="text-[8px] sm:text-xs md:text-sm text-[#EFE0BC]/85 font-medium max-w-xs line-clamp-2 md:line-clamp-none leading-tight">
                          {slide.subtitle}
                        </p>
                        <div className="pt-0.5 sm:pt-1 md:pt-2 flex justify-start">
                          <Link
                            href={buttonLink}
                            className="bg-[#F6E9C8] hover:bg-[#EFE0BC] text-[#680114] text-[8px] sm:text-xs md:text-sm px-2 py-0.5 sm:px-3.5 sm:py-1.5 md:px-6 md:py-3 rounded-md sm:rounded-lg md:rounded-xl flex items-center gap-1 md:gap-2 active:scale-95 transition-all font-bold cursor-pointer whitespace-nowrap shadow-xs leading-none"
                          >
                            <span>{buttonText}</span>
                            <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" />
                          </Link>
                        </div>
                      </div>

                      {/* Right: Inner Product Image Circle (Mobile calibrated, Desktop exact locked) */}
                      <div className="relative flex items-center justify-center shrink-0 z-10 pr-2 sm:pr-3 md:pr-0">
                        <div
                          className="relative rounded-full overflow-hidden bg-[#F6E9C8] shrink-0 w-[173px] h-[173px] -my-[50px] border-[7px] md:!w-[470px] md:!h-[470px] md:!-my-[88px] md:!border-[20px] border-[#F6E9C8] border-solid"
                        >
                          <img
                            alt={altText}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                            src={imageUrl}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Functional Round Angle Arrows (Desktop exact: 52px height, 11px boundary; Mobile proportional) */}
              <button
                type="button"
                onClick={handlePrevSlide}
                aria-label="Previous Slide"
                className="absolute top-1/2 -translate-y-1/2 z-20 p-0.5 md:p-1 text-[#F6E9C8] hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer group left-[4px] sm:left-[8px] md:!left-[11px]"
              >
                <svg
                  viewBox="0 0 20 52"
                  className="w-2.5 h-7 sm:w-3.5 sm:h-9 md:!w-[20px] md:!h-[52px] overflow-visible group-hover:-translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="#F6E9C8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="14,3 4,26 14,49" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNextSlide}
                aria-label="Next Slide"
                className="absolute top-1/2 -translate-y-1/2 z-20 p-0.5 md:p-1 text-[#F6E9C8] hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer group right-[4px] sm:right-[8px] md:!right-[11px]"
              >
                <svg
                  viewBox="0 0 20 52"
                  className="w-2.5 h-7 sm:w-3.5 sm:h-9 md:!w-[20px] md:!h-[52px] overflow-visible group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="#F6E9C8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="4,3 14,26 4,49" />
                </svg>
              </button>

              {/* Slider Dots Indicator */}
              <div className="absolute bottom-2 md:bottom-3 left-[31%] -translate-x-1/2 md:left-1/2 md:-translate-x-1/2 flex items-center gap-1 md:gap-1.5 z-20">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => handleSelectSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-1 md:h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentSlide
                        ? "w-4 md:w-5 bg-[#C51B26]"
                        : "w-1 md:w-1.5 bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* 4. DEALS OF THE DAY (Swipeable Carousel) */}
          {realDeals.length > 0 ? (
            <ProductCarouselSection
              id="deals"
              icon={<Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#680114] fill-[#680114]" />}
              title={
                <>
                  <span className="inline sm:hidden">Deals</span>
                  <span className="hidden sm:inline">Deals of the Day</span>
                </>
              }
              bgClass="bg-[#F6E9C8] border-0"
              badge={
                <div className="bg-[#E8D7B0] text-[#680114] border border-[#680114]/40 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full inline-flex items-center gap-1 sm:gap-1.5 text-[9.5px] sm:text-[11px] font-bold shadow-2xs leading-none translate-y-[1px] sm:translate-y-0.5 self-center">
                  <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#680114] shrink-0" />
                  <span className="font-sans font-semibold">
                    <span className="inline sm:hidden">
                      {padTime(timeLeft.hours)}h : {padTime(timeLeft.minutes)}m : {padTime(timeLeft.seconds)}s
                    </span>
                    <span className="hidden sm:inline">
                      Ends in {padTime(timeLeft.hours)}h : {padTime(timeLeft.minutes)}m : {padTime(timeLeft.seconds)}s
                    </span>
                  </span>
                </div>
              }
              actionText="All Deals"
              actionHref="/categories"
              products={realDeals.map((deal) => {
                const dealSp = Number(deal.deal_selling_price || 0);
                const dealMrp = Number(deal.deal_mrp || dealSp);
                const discountPct = deal.discount_percentage
                  ? Math.round(Number(deal.discount_percentage))
                  : (dealMrp > dealSp ? Math.round(((dealMrp - dealSp) / dealMrp) * 100) : 0);

                return {
                  id: String(deal.item_id || deal.id),
                  slug: String(deal.item_uid || deal.item_id || deal.id),
                  title: deal.item_name || "Special Deal Product",
                  brand: "Wondersale Deal",
                  category: "Deals of the Day",
                  categorySlug: "deals",
                  mrpPaise: Math.round(dealMrp * 100),
                  sellingPricePaise: Math.round(dealSp * 100),
                  rating: 4.8,
                  ratingCount: 38,
                  imageUrl: deal.item_image_url || "",
                  inStock: Boolean(deal.item_in_stock),
                  stockCount: deal.item_quantity || 10,
                  badge: deal.custom_badge || (discountPct > 0 ? `${discountPct}% OFF` : "Deal of the Day"),
                  description: "Limited-time Deal of the Day promotion directly from Bhopal store inventory.",
                  variants: [{ capacity: "Standard", pricePaise: Math.round(dealSp * 100), note: `${deal.item_quantity || 0} in stock` }],
                  specs: [{ label: "Condition", value: "Brand New" }],
                  reviews: [],
                };
              })}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              isInWishlist={isInWishlist}
            />
          ) : (
            <ProductCarouselSection
              id="deals"
              icon={<Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#680114] fill-[#680114]" />}
              title={
                <>
                  <span className="inline sm:hidden">Deals</span>
                  <span className="hidden sm:inline">Deals of the Day</span>
                </>
              }
              bgClass="bg-[#F6E9C8] border-0"
              badge={
                <div className="bg-[#E8D7B0] text-[#680114] border border-[#680114]/40 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full inline-flex items-center gap-1 sm:gap-1.5 text-[9.5px] sm:text-[11px] font-bold shadow-2xs leading-none translate-y-[1px] sm:translate-y-0.5 self-center">
                  <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#680114] shrink-0" />
                  <span className="font-sans font-semibold">
                    <span className="inline sm:hidden">
                      {padTime(timeLeft.hours)}h : {padTime(timeLeft.minutes)}m : {padTime(timeLeft.seconds)}s
                    </span>
                    <span className="hidden sm:inline">
                      Ends in {padTime(timeLeft.hours)}h : {padTime(timeLeft.minutes)}m : {padTime(timeLeft.seconds)}s
                    </span>
                  </span>
                </div>
              }
              actionText="All Deals"
              actionHref="/categories"
              products={DEMO_PRODUCTS.slice(0, 10)}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              isInWishlist={isInWishlist}
            />
          )}

          {/* 5. SHOP BY CATEGORY */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl text-[#680114] font-serif font-bold tracking-tight">Shop By Category</h2>
              <button
                type="button"
                onClick={openCategoryMenu}
                className="text-xs text-[#680114] font-bold flex items-center hover:underline cursor-pointer"
              >
                <span>See All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
              {(shopCategoryCards && shopCategoryCards.length > 0 ? shopCategoryCards : DEFAULT_SHOP_CATEGORY_CARDS).map((card, idx) => {
                const targetHref = card.link_url || (card.category_id ? `/categories?selected=${card.category_id}` : '/categories');
                return (
                  <Link
                    key={card.id || `shop-cat-${idx}`}
                    href={targetHref}
                    className="bg-[#F6E9C8] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all border-2 border-[#680114]"
                  >
                    <div className="w-full aspect-[2/1] sm:aspect-auto sm:h-36 relative overflow-hidden bg-[#F6E9C8] border-b border-[#680114]/30">
                      <img
                        alt={`${card.title} category`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={card.image_url}
                      />
                      {card.badge && (
                        <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-[#680114] text-[#F6E9C8] text-[9px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full shadow-2xs font-bold leading-none">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <div className="p-2 sm:p-3">
                      <h3 className="text-xs sm:text-sm md:text-base text-[#680114] font-serif font-bold leading-tight">{card.title}</h3>
                      {card.subtitle && (
                        <p className="text-[10px] sm:text-xs text-[#680114]/80 mt-0.5 font-sans leading-tight">{card.subtitle}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>



          {/* 7. BEST SELLERS */}
          <ProductCarouselSection
            id="best-sellers"
            icon={<TrendingUp className="w-5 h-5 text-[#680114]" />}
            title="Best Sellers"
            bgClass="bg-[#F6E9C8] border-0"
            badge={null}
            actionText="View Top 25"
            actionHref="/categories"
            products={
              bestSellers.length > 0
                ? bestSellers.slice(0, 25).map((item, idx) => ({
                    id: String(item.id),
                    slug: String(item.uid || item.id),
                    title: item.name,
                    brand: "Wondersale",
                    category: item.categories?.[0]?.name || "General",
                    categorySlug: item.categories?.[0]?.name?.toLowerCase().replace(/\s+/g, "-") || "general",
                    mrpPaise: Math.round(Number(item.mrp || item.selling_price || 0) * 100),
                    sellingPricePaise: Math.round(Number(item.selling_price || 0) * 100),
                    rating: 4.8,
                    ratingCount: 50 + idx * 7,
                    imageUrl: item.primary_image_url || (item.images?.[0]?.url) || "",
                    inStock: Boolean(item.in_stock),
                    stockCount: item.quantity || 10,
                    bestsellerRank: `#${idx + 1} Best Seller`,
                    badge: `#${idx + 1} Best Seller`,
                    description: item.description || "Top rated customer favourite item directly from our store inventory.",
                    variants: [{ capacity: "Standard", pricePaise: Math.round(Number(item.selling_price || 0) * 100), note: `${item.quantity || 0} in stock` }],
                    specs: [{ label: "Condition", value: "Brand New" }],
                    reviews: [],
                  }))
                : DEMO_PRODUCTS.slice(0, 10)
            }
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 8. NEW ARRIVALS */}
          <ProductCarouselSection
            id="new-arrivals"
            icon={<Sparkles className="w-5 h-5 text-[#680114]" />}
            title="New Arrivals"
            bgClass="bg-[#F6E9C8] border-0"
            badge={null}
            actionText="View Catalog"
            actionHref="/categories"
            products={
              newArrivals.length > 0
                ? newArrivals.slice(0, 25).map((item, idx) => ({
                    id: String(item.id),
                    slug: String(item.uid || item.id),
                    title: item.name,
                    brand: "Wondersale",
                    category: item.categories?.[0]?.name || "General",
                    categorySlug: item.categories?.[0]?.name?.toLowerCase().replace(/\s+/g, "-") || "general",
                    mrpPaise: Math.round(Number(item.mrp || item.selling_price || 0) * 100),
                    sellingPricePaise: Math.round(Number(item.selling_price || 0) * 100),
                    rating: 4.9,
                    ratingCount: 15 + idx * 4,
                    imageUrl: item.primary_image_url || (item.images?.[0]?.url) || "",
                    inStock: Boolean(item.in_stock),
                    stockCount: item.quantity || 10,
                    badge: "New Arrival",
                    description: item.description || "Fresh arrival just added to our warehouse catalogue.",
                    variants: [{ capacity: "Standard", pricePaise: Math.round(Number(item.selling_price || 0) * 100), note: `${item.quantity || 0} in stock` }],
                    specs: [{ label: "Condition", value: "Fresh Stock" }],
                    reviews: [],
                  }))
                : DEMO_PRODUCTS.slice(10, 20)
            }
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

        </div>
      </main>

      {/* Instant Add-to-Cart Toast Notification (Fully Responsive) */}
      {addedItemNotification && (
        <div className="fixed bottom-[72px] md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#42060B]/95 backdrop-blur-md text-[#F6E9C8] text-xs px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 border border-[#7A0C16]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <span className="text-[#D8B4B8] text-[11px] sm:text-xs">Added: </span>
              <span className="font-bold text-[#F6E9C8] text-[11px] sm:text-xs truncate inline-block max-w-[150px] sm:max-w-[210px] align-bottom">
                {addedItemNotification}
              </span>
            </div>
          </div>
          <Link
            href="/cart"
            className="shrink-0 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] border border-[#DFCBA0]/30 font-serif font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs whitespace-nowrap flex items-center gap-1 leading-normal"
          >
            <span>View Cart</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
          </Link>
        </div>
      )}

      {/* Global Storefront Footer */}
      <StorefrontFooter />

      {/* Sticky Bottom Navigation Bar (Mobile Viewports Only) */}
      <BottomTabBar />
    </div>
  );
}
