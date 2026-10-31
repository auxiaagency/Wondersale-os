"use client";

import React, { useEffect, useState } from "react";
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
  ArrowRight,
  TrendingUp,
  CreditCard,
  Copy,
  Tag,
  Check,
} from "lucide-react";

import { useStorefront } from "@/context/StorefrontContext";
import { DEMO_PRODUCTS, DemoProduct } from "@/data/demo-products";
import { formatPrice } from "@/lib/format";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "home-appliances": Fan,
  "kitchen-appliances": Utensils,
  "electronics-audio": Headphones,
  "toys-games": Gamepad2,
  "packaged-food-snacks": Cookie,
  "clocks-timepieces": Clock,
  "sunglasses-accessories": Glasses,
  "crockery-kitchenware": Coffee,
};

const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: "c1", name: "Home App", slug: "home-appliances", description: null },
  { id: "c2", name: "Kitchen", slug: "kitchen-appliances", description: null },
  { id: "c3", name: "Electronics", slug: "electronics-audio", description: null },
  { id: "c4", name: "Toys", slug: "toys-games", description: null },
  { id: "c5", name: "Snacks", slug: "packaged-food-snacks", description: null },
  { id: "c6", name: "Clocks", slug: "clocks-timepieces", description: null },
  { id: "c7", name: "Eyewear", slug: "sunglasses-accessories", description: null },
  { id: "c8", name: "Crockery", slug: "crockery-kitchenware", description: null },
];

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryItem[]>(FALLBACK_CATEGORIES);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [addedItemNotification, setAddedItemNotification] = useState<string | null>(null);

  // Live countdown timer state (hours, minutes, seconds)
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 18, seconds: 26 });

  // Hero carousel auto-slider state
  const [currentSlide, setCurrentSlide] = useState(0);

  const HERO_SLIDES = [
    {
      id: "slide-1",
      badge: "Festival Special",
      title: "Mega Kitchen Bonanza",
      subtitle: "Up to 40% Off on Premium Air Fryers & Mixers",
      buttonText: "Shop Deals",
      buttonLink: "/category/kitchen-appliances",
      gradient: "from-[#ffdad7] via-[#ffdad7]/60 to-[#f1f4fa]",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqSUbvjWIHdKh4q59CJUJS1hL6VB-lIzmuz4ymqGpn6bv10LY8_6LoBntAmGTXnlkbF6nkFAISR8eNu3FwJRUOk-yILX4H97lZh_Aa-_csb7sGvNzAYrQPabKzqWi8U-NwDOR5mLwnJbTKBZvg8fYU2AABQdkyrxgIRGAtOs7EYrZUIvVphSMRnPUIANe6zdspgV9vQhALj26WMg40h98txzkPku5Q3FrXvK7zKpVRFNTBHFCWQY3qg",
      alt: "Mega Kitchen Bonanza air fryers and blender display",
    },
    {
      id: "slide-2",
      badge: "Electronics Carnival",
      title: "Smart Audio & Accessories",
      subtitle: "Flat 50% Off on Bluetooth Headphones & RGB Speakers",
      buttonText: "Explore Audio",
      buttonLink: "/category/electronics-audio",
      gradient: "from-[#ede9fe] via-[#ede9fe]/60 to-[#f1f4fa]",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDhX23oALAsXCOEjIxtEWk7AsYgghM4p55dhNf3t-x0MEDV_iE-xEsk7eVoys0_6a9V9gqoQovqYJNPWB-UpYMCEyITscsxPj1sc8HRh09C7Yjww46yrDZy6rFrjRqnz_xcRncSockj_22AORYY1a3xepqBMTpXqccywREJqL6a0-kNqvjNsScovSMrGJnPgHZ1ROy5mDVPivmbJNyxyZZdGflRpa8DDhpXt1PoyDfHBylRhJHQfcq-A",
      alt: "Smart Audio, wireless headphones and speakers",
    },
    {
      id: "slide-3",
      badge: "Home Makeover",
      title: "Royal Crockery & Dining",
      subtitle: "Starting at ₹499 | Opalware Sets & Anodized Tawas",
      buttonText: "View Collection",
      buttonLink: "/category/crockery-kitchenware",
      gradient: "from-[#dcfce7] via-[#dcfce7]/60 to-[#f1f4fa]",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAJe7xis5zKoGIyTbHhUMUVKjDb2d-hhGspRS0nSA67ntQoEV9iRlc280OojE7Xa9CprFgmU8fu-ymexGmxzEPzkt_QbpZcK0R29-M2xZg_HVSgch2DCC3v0kjjHTAAGpnz51xrIIZrbuuCpwT44o0JGqG9AAyEmArTDdSahwitTurYtZujCgNoqRNhHFl6ugHNJ4LDbmv0rlH7SfMnZuEzGR9FRdWRGaz3kvYz35VXgmMjH2KupSegAg",
      alt: "Royal Crockery and Dining sets display",
    },
    {
      id: "slide-4",
      badge: "Kids & Toys Fest",
      title: "STEM Toys & Puzzles",
      subtitle: "Up to 45% Off on Learning Games & Action RC Toys",
      buttonText: "Shop Kids Toys",
      buttonLink: "/category/toys-games",
      gradient: "from-[#fef3c7] via-[#fef3c7]/60 to-[#f1f4fa]",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuD37ApjZxEPIH29J5O9A8EdaspEO4NB2MUkfTComCU8qol45FjqL0wKJQpVbJlIH-Ao1xen1ITW4rTgqN8enPGkxEj0C7jcuEenBanwxcoC5zwk7AUBvNQuCt8TwpV1TYPtnG5uaiZDnDyU7lfbFFoR4QKufOFTnE9-h2rwMZrDZivD0_3TXsBk1K7xGV3GANp_7XBbPBMEdK5nHFpScPwuwfLmT7lwXbP5a2Fu_nnKMzVCvgsRRJO87A",
      alt: "STEM toys and learning games for kids",
    },
  ];

  const { addToCart, toggleWishlist, isInWishlist } = useStorefront();

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(slideTimer);
  }, [HERO_SLIDES.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 4, minutes: 18, seconds: 26 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    fetch("/api/catalog/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setCategories(data.data);
        }
      })
      .catch(() => {
        // Fallback already in place
      });
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const padTime = (num: number) => String(num).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#2C1810] antialiased flex flex-col justify-between font-sans">
      {/* 1. Global Header */}
      <GlobalHeader />

      <main className="flex-1 w-full bg-[#FDF8EE]">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-6 flex flex-col gap-7">

          {/* 2. HERO CAMPAIGN BANNER (Rich Burgundy with Circular Image Portal matching screenshot) */}
          <section className="w-full">
            <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-[#5A0A10] shadow-xl text-[#FDF8EE]">
              {HERO_SLIDES.map((slide, index) => {
                const isActive = index === currentSlide;
                return (
                  <div
                    key={slide.id}
                    className={`w-full transition-opacity duration-700 ease-in-out ${
                      isActive ? "block opacity-100" : "hidden opacity-0"
                    }`}
                  >
                    <div className="w-full relative overflow-hidden flex flex-col md:flex-row items-center justify-between p-4 pb-7 sm:p-6 md:p-12 min-h-0 md:min-h-[340px] gap-3.5 md:gap-8">
                      {/* Left: Text & CTA Content */}
                      <div className="max-w-xl z-10 space-y-2 md:space-y-4 text-center md:text-left">
                        <span className="inline-block border border-[#D8B4B8]/60 bg-white/10 backdrop-blur-xs text-[#FDF8EE] text-[9px] md:text-[11px] px-2.5 py-0.5 md:px-3.5 md:py-1 rounded-full tracking-wider uppercase font-bold shadow-xs">
                          {slide.badge}
                        </span>
                        <h2 className="text-xl sm:text-2xl md:text-5xl text-[#FDF8EE] leading-tight font-serif font-bold tracking-tight">
                          {slide.title}
                        </h2>
                        <p className="text-xs md:text-base text-[#EADFC7] font-medium max-w-md line-clamp-2 md:line-clamp-none">
                          {slide.subtitle}
                        </p>
                        <div className="pt-0.5 md:pt-2 flex justify-center md:justify-start">
                          <Link
                            href={slide.buttonLink}
                            className="bg-[#FDF8EE] hover:bg-[#F4ECDC] text-[#5A0A10] text-xs md:text-sm px-4 py-1.5 md:px-7 md:py-3 rounded-xl md:rounded-2xl flex items-center gap-1.5 md:gap-2 active:scale-95 transition-all shadow-md font-bold cursor-pointer"
                          >
                            <span>{slide.buttonText}</span>
                            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </Link>
                        </div>
                      </div>

                      {/* Right: Circular Boundary Image Frame */}
                      <div className="relative flex items-center justify-center shrink-0">
                        {/* Circular Portal Frame with Thick Cream Border */}
                        <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-96 md:h-96 rounded-full border-[5px] sm:border-[8px] md:border-[14px] border-[#F4ECDC] overflow-hidden shadow-xl bg-[#EADFC7]">
                          <img
                            alt={slide.alt}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                            src={slide.image}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Slider Dots Indicator */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                {HERO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentSlide
                        ? "w-7 bg-[#C51B26]"
                        : "w-2 bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* 3. EXPLORE DEPARTMENTS / CATEGORY ICON ROW (Warm Cream Minimalist Icons) */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <div>
                <h2 className="text-xl md:text-2xl text-[#2C1810] font-serif font-bold tracking-tight">
                  Explore Departments
                </h2>
                <p className="text-xs text-[#735A4A] font-sans font-medium mt-0.5 hidden sm:block">
                  Handcrafted cookware, electronics, toys & daily essentials
                </p>
              </div>
              <Link
                href="/categories"
                className="text-xs text-[#7A0C16] font-bold flex items-center gap-0.5 hover:underline"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile View: 5 categories */}
            <div className="grid grid-cols-5 md:hidden gap-2 items-center justify-items-center">
              {categories.slice(0, 5).map((cat) => {
                const Icon = CATEGORY_ICONS[cat.slug] || Utensils;
                return (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="flex flex-col items-center group w-full p-1 transition-transform active:scale-95"
                  >
                    <div className="w-13 h-13 rounded-full bg-[#F4ECDC] border border-[#D5C4A1]/80 flex items-center justify-center transition-all group-hover:border-[#7A0C16] shadow-2xs">
                      <Icon className="w-5.5 h-5.5 text-[#7A0C16]" />
                    </div>
                    <span className="text-[11px] text-[#2C1810] text-center mt-1.5 line-clamp-1 font-semibold group-hover:text-[#7A0C16] transition-colors">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Desktop View: Full 9 departments */}
            <div className="hidden md:grid md:grid-cols-9 gap-3 items-center justify-items-center">
              {categories.slice(0, 8).map((cat) => {
                const Icon = CATEGORY_ICONS[cat.slug] || Utensils;
                return (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="flex flex-col items-center group w-full p-1 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="w-15 h-15 rounded-full bg-[#F4ECDC] border border-[#D5C4A1]/80 flex items-center justify-center transition-all group-hover:border-[#7A0C16] group-hover:bg-[#EADFC7] shadow-xs">
                      <Icon className="w-6 h-6 text-[#7A0C16]" />
                    </div>
                    <span className="text-xs text-[#2C1810] text-center mt-2 line-clamp-1 font-semibold group-hover:text-[#7A0C16] transition-colors">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}

              {/* More / All Categories Icon */}
              <Link
                href="/categories"
                className="flex flex-col items-center group w-full p-1 transition-transform hover:-translate-y-0.5"
              >
                <div className="w-15 h-15 rounded-full bg-[#F4ECDC] border border-[#D5C4A1]/80 flex items-center justify-center transition-all group-hover:border-[#7A0C16] group-hover:bg-[#EADFC7] shadow-xs">
                  <span className="text-xl text-[#7A0C16]">⊞</span>
                </div>
                <span className="text-xs text-[#2C1810] text-center mt-2 line-clamp-1 font-semibold group-hover:text-[#7A0C16] transition-colors">
                  More
                </span>
              </Link>
            </div>
          </section>

          {/* 4. DEALS OF THE DAY (Swipeable Carousel) */}
          <ProductCarouselSection
            id="deals"
            icon="⚡"
            title="Deals of the Day"
            subtitle="Handpicked limited-time discounts with 2-hour Bhopal express delivery"
            bgClass="bg-[#F4ECDC]/90 border border-[#D5C4A1]"
            badge={
              <div className="bg-[#EADFC7] text-[#5A0A10] border border-[#D5C4A1] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-[11px] font-bold shadow-2xs">
                <Clock className="w-3 h-3 text-[#7A0C16]" />
                <span>
                  Ends in {padTime(timeLeft.hours)}h : {padTime(timeLeft.minutes)}m : {padTime(timeLeft.seconds)}s
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

          {/* 5. SHOP BY CATEGORY */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xl md:text-2xl text-[#2C1810] font-serif font-bold tracking-tight">Shop By Category</h2>
              <Link
                href="/categories"
                className="text-xs text-[#7A0C16] font-bold flex items-center hover:underline"
              >
                <span>See All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Cat 1 */}
              <Link
                href="/category/kitchen-appliances"
                className="bg-[#FAF3E0] rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#EADFC7] hover:border-[#CDB992]"
              >
                <div className="h-36 w-full relative overflow-hidden bg-[#FDF8EE]">
                  <img
                    alt="Cookware & Dining category"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9w2vUJKQkRNV1FUIkncrCapIM725jmL-G4rr-BgEIijGnUcOrUwaQD6BVKw5Wwm79xdLoqRaszlezpJ6H077FxVzakFF0vorXx2dP9LcnV_XTIB28W8uOjt7leYjhJLvPd3y6r6ILeVDWkiI1B_g4xcK5YTPfatiZw5jxpqIryrhTFz9qAfvAcSJDv6gx0qXKWohElzV1EN6zRF-LyYxA5jqnpUqI-QVPYQd3rEoKUgYoKnMiYvcR1Q"
                  />
                  <span className="absolute bottom-2 left-2 bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full shadow-2xs font-bold">
                    Up to 60% Off
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm md:text-base text-[#2C1810] font-serif font-bold">Cookware &amp; Dining</h3>
                  <p className="text-xs text-[#735A4A] mt-0.5 font-sans">Non-stick, Pots &amp; Bowls</p>
                </div>
              </Link>

              {/* Cat 2 */}
              <Link
                href="/category/electronics-audio"
                className="bg-[#FAF3E0] rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#EADFC7] hover:border-[#CDB992]"
              >
                <div className="h-36 w-full relative overflow-hidden bg-[#FDF8EE]">
                  <img
                    alt="Smart Gadgets category"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmYpYYgOcAqx8zW2hmXeF5lgJgFB03SDzmr2JqIRTMHSAiVxdL6sT3FHPc0SksAwcHJpP7gU0ZIE0sIMBL09f5SMbTusBEsD9UiZ_RaP_5P011JBecJ5kiCwZhnDbXVDWDjNHAtCn89uJPFG_MLAisZbg6Mlwx1xvQ2lcL6SSVSFwjk6AQlMHafVHoReK5vHXJG1fBOmocUh8qif0vg8W-B4DNRIP5dYNbvzEfKB5QpWc2mjFGViG81g"
                  />
                  <span className="absolute bottom-2 left-2 bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full shadow-2xs font-bold">
                    Min 40% Off
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm md:text-base text-[#2C1810] font-serif font-bold">Smart Gadgets</h3>
                  <p className="text-xs text-[#735A4A] mt-0.5 font-sans">Wearables &amp; Audio</p>
                </div>
              </Link>

              {/* Cat 3 */}
              <Link
                href="/category/toys-games"
                className="bg-[#FAF3E0] rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#EADFC7] hover:border-[#CDB992]"
              >
                <div className="h-36 w-full relative overflow-hidden bg-[#FDF8EE]">
                  <img
                    alt="Kids & Toys category"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD37ApjZxEPIH29J5O9A8EdaspEO4NB2MUkfTComCU8qol45FjqL0wKJQpVbJlIH-Ao1xen1ITW4rTgqN8enPGkxEj0C7jcuEenBanwxcoC5zwk7AUBvNQuCt8TwpV1TYPtnG5uaiZDnDyU7lfbFFoR4QKufOFTnE9-h2rwMZrDZivD0_3TXsBk1K7xGV3GANp_7XBbPBMEdK5nHFpScPwuwfLmT7lwXbP5a2Fu_nnKMzVCvgsRRJO87A"
                  />
                  <span className="absolute bottom-2 left-2 bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full shadow-2xs font-bold">
                    Under ₹499
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm md:text-base text-[#2C1810] font-serif font-bold">Kids &amp; Toys</h3>
                  <p className="text-xs text-[#735A4A] mt-0.5 font-sans">STEM &amp; Board Games</p>
                </div>
              </Link>

              {/* Cat 4 */}
              <Link
                href="/category/sunglasses-accessories"
                className="bg-[#FAF3E0] rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:shadow-md transition-all border border-[#EADFC7] hover:border-[#CDB992]"
              >
                <div className="h-36 w-full relative overflow-hidden bg-[#FDF8EE]">
                  <img
                    alt="Eyewear & Style category"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCN1i80jVIbv2fEfKtFphirGBNs7n1uTfhjkqSC55XNFR0q_EHw_Lcgemw4XRLroqdEzkHa5yVjBULXzb36Npq3ES7DbpDDjtx4LUqx4bEFvmBLIOgs_rcceU4dmH5xuuec1JEAPGiCm0IMPl0oroYkEVn4wgJNY2bcc7i5X1PO-p7lC1pQgLCGm9I-ZvVdxvDU4dKBQ9uPVTg-0weRw3nrORWDNlDCdpi8SDYR95X29Wys8m44hxsEVQ"
                  />
                  <span className="absolute bottom-2 left-2 bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full shadow-2xs font-bold">
                    Buy 1 Get 1
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm md:text-base text-[#2C1810] font-serif font-bold">Eyewear &amp; Style</h3>
                  <p className="text-xs text-[#735A4A] mt-0.5 font-sans">UV400 Polarized</p>
                </div>
              </Link>
            </div>
          </section>

          {/* 6. PARTNER BANK OFFER BANNER */}
          <section className="w-full">
            <div className="bg-gradient-to-r from-[#4A080D] via-[#5A0A10] to-[#7A0C16] text-[#FDF8EE] rounded-2xl p-6 md:p-7 shadow-md flex items-center justify-between relative overflow-hidden border border-[#D5C4A1]/40">
              <CreditCard className="w-36 h-36 text-white/5 absolute -right-6 -bottom-6 select-none pointer-events-none" />
              <div className="z-10 max-w-2xl space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-[#EADFC7]" />
                  <span className="text-xs uppercase tracking-wider text-[#EADFC7] font-bold font-sans">
                    Partner Bank Offer
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl text-[#FDF8EE] leading-tight font-serif font-bold">
                  Instant 10% Off on HDFC &amp; ICICI Cards
                </h3>
                <p className="text-sm text-[#EADFC7]/90">
                  Applicable on cart value above ₹1,499. Use code at checkout.
                </p>
                <div className="pt-2">
                  <button
                    className="inline-flex items-center gap-2 bg-[#FAF3E0] text-[#5A0A10] px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs hover:bg-[#FDF8EE] transition-colors cursor-pointer border border-[#EADFC7]"
                    onClick={() => handleCopyCode("WONDERFEST")}
                    type="button"
                  >
                    <span className="tracking-wider">CODE: WONDERFEST</span>
                    {copiedCoupon === "WONDERFEST" ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#7A0C16]" />
                    )}
                  </button>
                  {copiedCoupon === "WONDERFEST" && (
                    <span className="ml-2 text-xs font-bold text-amber-200">Copied!</span>
                  )}
                </div>
              </div>
              <div className="z-10 hidden sm:flex flex-col items-center justify-center p-3">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-[#EADFC7]/20">
                  <Tag className="w-8 h-8 text-[#EADFC7]" />
                </div>
              </div>
            </div>
          </section>

          {/* 7. BEST SELLERS */}
          <ProductCarouselSection
            id="best-sellers"
            icon={<TrendingUp className="w-5 h-5 text-[#7A0C16]" />}
            title="Best Sellers"
            subtitle="Most loved and highest ordered products across Bhopal"
            bgClass="bg-[#FAF3E0] border border-[#EADFC7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A0C16] bg-[#FCEDEE] px-2 py-0.5 rounded-full border border-[#F6D8DA]">
                Updated Hourly
              </span>
            }
            actionText="View Top 50"
            actionHref="/categories"
            products={DEMO_PRODUCTS.slice(0, 10)}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 8. FRESH IN STORE */}
          <ProductCarouselSection
            id="fresh-in-store"
            icon="✨"
            title="Fresh In Store"
            subtitle="Just unboxed new season arrivals with guaranteed fast delivery"
            bgClass="bg-[#F8F2E6] border border-[#E4D5B7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                New Arrivals
              </span>
            }
            actionText="View Catalog"
            actionHref="/categories"
            products={DEMO_PRODUCTS.slice(10, 20)}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 9. KITCHEN & DINING MUST-HAVES */}
          <ProductCarouselSection
            id="kitchen-dining"
            icon="🍳"
            title="Kitchen & Dining Must-Haves"
            subtitle="Pressure cookers, mixer grinders, air fryers & hard anodized cookware"
            bgClass="bg-[#FAF3E0] border border-[#EADFC7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Up to 45% Off
              </span>
            }
            actionText={`Explore (${DEMO_PRODUCTS.filter((p) => p.categorySlug === "kitchen-appliances").length}+)`}
            actionHref="/category/kitchen-appliances"
            products={DEMO_PRODUCTS.filter((p) => p.categorySlug === "kitchen-appliances")}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 10. SMART GADGETS & AUDIO HIGHLIGHTS */}
          <ProductCarouselSection
            id="smart-gadgets"
            icon="🎧"
            title="Smart Audio & Tech Gadgets"
            subtitle="Wireless headphones, fast car mounts, smartwatch calling & speakers"
            bgClass="bg-[#F8F2E6] border border-[#E4D5B7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Top Rated Audio
              </span>
            }
            actionText={`View All (${DEMO_PRODUCTS.filter((p) => p.categorySlug === "electronics-audio").length}+)`}
            actionHref="/category/electronics-audio"
            products={DEMO_PRODUCTS.filter((p) => p.categorySlug === "electronics-audio")}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 11. DAILY ESSENTIALS & PANTRY FAVORITES */}
          <ProductCarouselSection
            id="gourmet-pantry"
            icon="🛒"
            title="Daily Essentials & Gourmet Pantry"
            subtitle="Artisan roasted coffee, California almonds, mountain honey & cold-pressed oils"
            bgClass="bg-[#FAF3E0] border border-[#EADFC7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                100% Genuine
              </span>
            }
            actionText={`Shop Pantry (${DEMO_PRODUCTS.filter((p) => p.categorySlug === "packaged-food-snacks").length}+)`}
            actionHref="/category/packaged-food-snacks"
            products={DEMO_PRODUCTS.filter((p) => p.categorySlug === "packaged-food-snacks")}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />

          {/* 12. TOYS, GAMES & KIDS CORNER */}
          <ProductCarouselSection
            id="toys-games"
            icon="🎲"
            title="Toys, STEM & Family Games"
            subtitle="Montessori puzzles, RC monster trucks, board games & speed cubes"
            bgClass="bg-[#F8F2E6] border border-[#E4D5B7] shadow-xs"
            badge={
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                Kids &amp; Family
              </span>
            }
            actionText={`View Toys (${DEMO_PRODUCTS.filter((p) => p.categorySlug === "toys-games").length}+)`}
            actionHref="/category/toys-games"
            products={DEMO_PRODUCTS.filter((p) => p.categorySlug === "toys-games")}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            isInWishlist={isInWishlist}
          />



          {/* 10. MOBILE FOOTER ACCORDION & TRUST INFO (< md screens) */}
          <section className="md:hidden w-full bg-[#FAF3E0]/70 rounded-2xl p-4 space-y-2 border border-[#EADFC7]">
            {/* Accordion 1: About Wondersale */}
            <div className="bg-[#FAF3E0] rounded-xl overflow-hidden shadow-2xs border border-[#EADFC7]">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#2C1810]"
                onClick={() => {
                  const el = document.getElementById("mobile-acc-about");
                  el?.classList.toggle("hidden");
                }}
              >
                <span>About Wondersale</span>
                <ChevronRight className="w-4 h-4 text-[#735A4A]" />
              </button>
              <div
                id="mobile-acc-about"
                className="hidden px-4 pb-3 pt-1 text-[#735A4A] text-xs leading-relaxed"
              >
                Wondersale is India&apos;s fastest growing multi-category digital superstore. We bring genuine lifestyle, home, electronics, and kitchen goods right to your doorstep with guaranteed savings.
              </div>
            </div>

            {/* Accordion 2: Help & Support */}
            <div className="bg-[#FAF3E0] rounded-xl overflow-hidden shadow-2xs border border-[#EADFC7]">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#2C1810]"
                onClick={() => {
                  const el = document.getElementById("mobile-acc-help");
                  el?.classList.toggle("hidden");
                }}
              >
                <span>Customer Help &amp; FAQs</span>
                <ChevronRight className="w-4 h-4 text-[#735A4A]" />
              </button>
              <div
                id="mobile-acc-help"
                className="hidden px-4 pb-3 pt-1 text-[#735A4A] text-xs space-y-1.5"
              >
                <p><Link href="/orders" className="hover:text-[#7A0C16]">Track Ongoing Shipment</Link></p>
                <p><Link href="/returns" className="hover:text-[#7A0C16]">Initiate a Return or Exchange</Link></p>
                <p><Link href="/shipping" className="hover:text-[#7A0C16]">Shipping Rates &amp; Delivery Policies</Link></p>
              </div>
            </div>

            {/* Accordion 3: Policies */}
            <div className="bg-[#FAF3E0] rounded-xl overflow-hidden shadow-2xs border border-[#EADFC7]">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#2C1810]"
                onClick={() => {
                  const el = document.getElementById("mobile-acc-policy");
                  el?.classList.toggle("hidden");
                }}
              >
                <span>Terms &amp; Privacy Policies</span>
                <ChevronRight className="w-4 h-4 text-[#735A4A]" />
              </button>
              <div
                id="mobile-acc-policy"
                className="hidden px-4 pb-3 pt-1 text-[#735A4A] text-xs space-y-1.5"
              >
                <p><Link href="/privacy" className="hover:text-[#7A0C16]">Privacy Policy</Link></p>
                <p><Link href="/terms" className="hover:text-[#7A0C16]">Terms of Service</Link></p>
                <p><Link href="/security" className="hover:text-[#7A0C16]">Security &amp; Compliance Standards</Link></p>
              </div>
            </div>

            {/* Accordion 4: Contact */}
            <div className="bg-[#FAF3E0] rounded-xl overflow-hidden shadow-2xs border border-[#EADFC7]">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#2C1810]"
                onClick={() => {
                  const el = document.getElementById("mobile-acc-contact");
                  el?.classList.toggle("hidden");
                }}
              >
                <span>Contact &amp; Grievance</span>
                <ChevronRight className="w-4 h-4 text-[#735A4A]" />
              </button>
              <div
                id="mobile-acc-contact"
                className="hidden px-4 pb-3 pt-1 text-[#735A4A] text-xs space-y-1"
              >
                <p>24x7 Support Hotline: 1800-419-8900</p>
                <p>Email: care@wondersale.in</p>
                <p>Headquarters: Connaught Place, New Delhi, India</p>
              </div>
            </div>

            {/* Payment Partner Badges */}
            <div className="pt-3 flex flex-col items-center">
              <span className="text-[10px] text-[#735A4A] uppercase tracking-wider mb-2 font-semibold">
                100% Secure Payment Partners
              </span>
              <div className="flex items-center justify-center gap-2">
                <div className="px-2.5 py-1 bg-[#FAF3E0] rounded-md shadow-2xs border border-[#EADFC7]">
                  <span className="text-[10px] font-bold text-[#2C1810]">UPI</span>
                </div>
                <div className="px-2.5 py-1 bg-[#FAF3E0] rounded-md shadow-2xs border border-[#EADFC7]">
                  <span className="text-[10px] font-bold text-[#7A0C16]">RuPay</span>
                </div>
                <div className="px-2.5 py-1 bg-[#FAF3E0] rounded-md shadow-2xs border border-[#EADFC7]">
                  <span className="text-[10px] font-bold text-[#2C1810]">VISA</span>
                </div>
                <div className="px-2.5 py-1 bg-[#FAF3E0] rounded-md shadow-2xs border border-[#EADFC7]">
                  <span className="text-[10px] font-bold text-[#2C1810]">Mastercard</span>
                </div>
              </div>
              <p className="text-[10px] text-[#735A4A] mt-3">
                © 2025 Wondersale Retail Private Limited
              </p>
            </div>
          </section>

        </div>
      </main>

      {/* Instant Add-to-Cart Toast Notification */}
      {addedItemNotification && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 bg-[#2C1810] text-[#FDF8EE] text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-[#D5C4A1]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium">Added to cart:</span>
          <span className="font-bold text-[#EADFC7] max-w-xs truncate">
            {addedItemNotification}
          </span>
          <Link
            href="/cart"
            className="ml-2 bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-xs"
          >
            View Cart →
          </Link>
        </div>
      )}

      {/* Global Footer (Desktop Viewports) */}
      <div className="hidden md:block">
        <StorefrontFooter />
      </div>

      {/* Sticky Bottom Navigation Bar (Mobile Viewports Only) */}
      <BottomTabBar />
    </div>
  );
}
