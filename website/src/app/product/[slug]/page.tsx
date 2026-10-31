"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Share2,
  Heart,
  ShoppingBag,
  Flame,
  CheckCircle,
  Box,
  Star,
  MapPin,
  Zap,
  CreditCard,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Soup,
  Leaf,
  ShoppingCart,
} from "lucide-react";
import { formatPrice } from "@/lib/format";

interface ProductDetailData {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: string;
  categorySlug: string;
  rating: number;
  ratingCount: number;
  mrpPaise: number;
  sellingPricePaise: number;
  inStock: boolean;
  stockCount: number;
  bestsellerRank?: string;
  specs: { label: string; value: string }[];
  variants: { capacity: string; pricePaise: number; note: string }[];
  reviews: {
    name: string;
    location: string;
    rating: number;
    title: string;
    text: string;
    date: string;
  }[];
}

const PRODUCT_DATABASE: Record<string, ProductDetailData> = {
  "prestige-svachh-deluxe-alpha-5l": {
    id: "prestige-svachh-5l",
    slug: "prestige-svachh-deluxe-alpha-5l",
    brand: "PRESTIGE",
    title:
      "Prestige Svachh Deluxe Alpha Stainless Steel 5L Pressure Cooker (Induction & Gas Compatible)",
    category: "Kitchen Appliances",
    categorySlug: "kitchen-appliances",
    rating: 4.4,
    ratingCount: 3410,
    mrpPaise: 345000,
    sellingPricePaise: 219900,
    inStock: true,
    stockCount: 12,
    bestsellerRank: "#1 Bestseller in Cookware",
    variants: [
      { capacity: "3 Litre", pricePaise: 185000, note: "2-3 People" },
      { capacity: "5 Litre", pricePaise: 219900, note: "4-6 People" },
      { capacity: "7 Litre", pricePaise: 269900, note: "6+ People" },
    ],
    specs: [
      { label: "Brand", value: "Prestige" },
      { label: "Model Name", value: "Svachh Deluxe Alpha" },
      { label: "Capacity", value: "5 Litres" },
      { label: "Material & Finish", value: "High-Grade Stainless Steel" },
      { label: "Base Compatibility", value: "Induction & Gas Stove (Alpha Base)" },
      { label: "Lid Type", value: "Deep Svachh Spillage Control Outer Lid" },
      { label: "Domestic Warranty", value: "5 Years Prestige India Manufacturer" },
    ],
    reviews: [
      {
        name: "Rohit Verma",
        location: "Arera Colony, Bhopal",
        rating: 5,
        title: "Lightning fast delivery!",
        text: "Received in just 90 mins via Wondersale Express! Genuine Prestige cooker with spillage control lid working great on induction. Highly recommend Bhopal store service.",
        date: "Yesterday",
      },
      {
        name: "Meenakshi S.",
        location: "MP Nagar, Bhopal",
        rating: 4,
        title: "Best local deal",
        text: "Best deal in Bhopal, ₹400 cheaper than local market. Packaging was solid with verified brand hologram warranty intact.",
        date: "3 days ago",
      },
    ],
  },
};

const DEFAULT_PRODUCT: ProductDetailData = PRODUCT_DATABASE["prestige-svachh-deluxe-alpha-5l"];

function ProductDetailContent() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || "prestige-svachh-deluxe-alpha-5l";
  const product = PRODUCT_DATABASE[slug] || DEFAULT_PRODUCT;

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(1); // 5 Litre default
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [pincode, setPincode] = useState("462001");
  const [isChangingPincode, setIsChangingPincode] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState(
    "⚡ Bhopal Express 2-Hour Delivery Available to Arera Colony 462001"
  );
  const [isPincodeValid, setIsPincodeValid] = useState(true);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  const selectedVariant = product.variants[selectedVariantIdx] || product.variants[0];
  const currentSellingPricePaise = selectedVariant.pricePaise;
  const savingsPaise = product.mrpPaise - currentSellingPricePaise;
  const savingsPercent = Math.round((savingsPaise / product.mrpPaise) * 100);

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pincode.trim();
    if (clean.startsWith("462")) {
      setIsPincodeValid(true);
      setPincodeMessage(`⚡ Bhopal Express 2-Hour Delivery Available to Pincode ${clean}`);
      setIsChangingPincode(false);
    } else if (clean.length === 6 && /^\d+$/.test(clean)) {
      setIsPincodeValid(true);
      setPincodeMessage(`Standard Pan-India Express Delivery Available (3-5 days to ${clean})`);
      setIsChangingPincode(false);
    } else {
      setIsPincodeValid(false);
      setPincodeMessage("Please enter a valid 6-digit Indian pincode");
    }
  };

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText("WONDER150");
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const handleAddToCart = () => {
    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2000);
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-28 font-sans">
      {/* 1. TOP BAR / APP HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-white/95 backdrop-blur-md px-3.5 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-black text-lg tracking-tight text-[#D91E2A]">Wondersale</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <Search className="h-5 w-5" />
          </Link>
          <button
            aria-label="Share product"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: product.title, url: window.location.href });
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            aria-label="Add to wishlist"
            onClick={() => setIsWishlisted(!isWishlisted)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-90 transition-transform"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isWishlisted ? "text-[#D91E2A] fill-current" : "text-neutral-600"
              }`}
            />
          </button>
          <Link
            href="/cart"
            aria-label="Shopping Cart with 3 items"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-transform"
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D91E2A] px-1 text-[10px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </Link>
        </div>
      </header>

      {/* 2. PRODUCT IMAGE GALLERY SHOWCASE */}
      <section className="relative bg-white px-4 pt-2 pb-4 overflow-hidden border-b border-neutral-200">
        {/* Floating Badges */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 items-start">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#D91E2A] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-xs">
            <Flame className="h-3.5 w-3.5 fill-current" />
            SAVE {savingsPercent}%
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-xs border border-neutral-200 px-2.5 py-0.5 text-[10px] font-bold text-neutral-800 shadow-xs">
            <CheckCircle className="h-3 w-3 text-[#D91E2A]" />
            Bhopal Verified Stock
          </span>
        </div>

        <div className="absolute right-4 top-4 z-10">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-neutral-800 shadow-xs ring-1 ring-neutral-200 hover:bg-neutral-100 active:scale-95 transition-all"
          >
            <Box className="h-3.5 w-3.5 text-[#D91E2A]" />
            360° View
          </button>
        </div>

        {/* Product Visual Container */}
        <div className="relative mt-5 flex h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-neutral-50 to-neutral-100">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIkQjE3dXe32EPCXGWNP93LiBFy1eya9UMpE2axBiaHgjC67sy7ksxH5Uquhq3zwAfExoLGUX7sCAG4NZNiAmNQWjZ9RYzHUQ8gG3jAX727GUGGv2G1G5A8HGdQ5h9hwd0HVir5MX6CS3y4SoEo4SJL1OnBfGf5x5SzSgevk-Fn8CzKQjrG6uv1MbjullwEiVngCY8B_pH6OYsWALYIHyo2koEosDCugK9UqqwOJdaVEZXktroururt0Gxp0R2U2kAdijWQ_tv5w"
            alt={product.title}
            className="h-64 w-auto object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
          />
          {/* Photo Counter Pill */}
          <span className="absolute bottom-3 right-3 rounded-full bg-neutral-900/75 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-white">
            1 / 5
          </span>
        </div>

        {/* Carousel Dot Indicators */}
        <div className="mt-3.5 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-[#D91E2A] transition-all"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300"></span>
        </div>
      </section>

      {/* 3. PRICING & RATINGS MODULE */}
      <section className="bg-white px-4 pt-3.5 pb-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs tracking-wider text-[#D91E2A]">
              {product.brand}
            </span>
            <CheckCircle className="h-3.5 w-3.5 text-[#D91E2A] fill-[#D91E2A]/10" />
            <span className="text-[11px] font-medium text-neutral-500">Official Store</span>
          </div>
          {product.bestsellerRank && (
            <span className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-[#D91E2A]">
              <Star className="h-3 w-3 fill-current" />
              {product.bestsellerRank}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="mt-1.5 text-base font-bold leading-snug text-neutral-900">
          {product.title}
        </h1>

        {/* Rating Row */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
            <span>{product.rating}</span>
            <Star className="h-3 w-3 fill-current" />
          </div>
          <a href="#reviews" className="text-xs font-medium text-[#D91E2A] hover:underline">
            {product.ratingCount.toLocaleString("en-IN")} verified ratings
          </a>
          <span className="text-neutral-300">•</span>
          <span className="text-xs text-neutral-500">850+ bought in MP this month</span>
        </div>

        {/* Price Row */}
        <div className="mt-3.5 flex items-baseline gap-2.5 flex-wrap">
          <span className="text-2xl font-black tracking-tight text-neutral-900">
            {formatPrice(currentSellingPricePaise)}
          </span>
          <span className="text-xs font-medium text-neutral-500 line-through">
            MRP {formatPrice(product.mrpPaise)}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
            Save {formatPrice(savingsPaise)} ({savingsPercent}% OFF)
          </span>
        </div>

        {/* Taxes & EMI Subtext */}
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Inclusive of all taxes</span>
          <span className="font-semibold text-neutral-800">
            EMI from <strong className="text-[#D91E2A] font-bold">₹106/mo</strong>{" "}
            <span className="underline cursor-pointer">View Plans</span>
          </span>
        </div>
      </section>

      {/* 4. BHOPAL HYPERLOCAL DELIVERY & STOCK CHECKER */}
      <section className="p-3.5">
        <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs">
          {/* Pincode Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-[#D91E2A]">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                  Deliver to
                </p>
                <p className="text-xs font-bold text-neutral-900">
                  {pincode} - {pincode.startsWith("462") ? "Bhopal, MP" : "India"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsChangingPincode(!isChangingPincode)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-[#D91E2A] hover:bg-neutral-50 active:scale-95 transition-all"
            >
              {isChangingPincode ? "Cancel" : "Change"}
            </button>
          </div>

          {/* Inline Change Pincode Form */}
          {isChangingPincode && (
            <form onSubmit={handlePincodeCheck} className="flex gap-2 pt-2.5 pb-1">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit Pincode"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-900 focus:outline-none focus:border-[#D91E2A]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#D91E2A] px-3 py-1 text-xs font-bold text-white hover:bg-[#B31520] transition-colors"
              >
                Apply
              </button>
            </form>
          )}

          {/* Express Delivery Callout */}
          <div
            className={`mt-3 rounded-lg p-2.5 border ${
              isPincodeValid
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-600 fill-current" />
              <span className="text-xs font-bold">{pincodeMessage}</span>
            </div>
            {isPincodeValid && pincode.startsWith("462") && (
              <p className="mt-0.5 text-[11px] text-amber-800 leading-tight">
                Order within <strong className="font-bold">45m</strong> for guaranteed delivery by{" "}
                <strong className="font-bold">4:00 PM today</strong>.
              </p>
            )}
          </div>

          {/* Realtime Stock status */}
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <span>
              In Stock{" "}
              <span className="font-normal text-neutral-500">
                (Only {product.stockCount} units left in Bhopal Warehouse)
              </span>
            </span>
          </div>

          {/* Trust Strip Grid */}
          <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-[#D91E2A] mb-1">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-neutral-900">Cash On Delivery</span>
              <span className="text-[9px] text-neutral-500">Available</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-[#D91E2A] mb-1">
                <RefreshCw className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-neutral-900">7-Day Easy Return</span>
              <span className="text-[9px] text-neutral-500">Hassle-free</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-[#D91E2A] mb-1">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-neutral-900">5-Yr Warranty</span>
              <span className="text-[9px] text-neutral-500">Prestige Brand</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SIZE & VARIANT SELECTOR */}
      <section className="bg-white px-4 py-3.5 border-y border-neutral-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-900">
            Select Capacity: <strong className="text-[#D91E2A]">{selectedVariant.capacity}</strong>
          </span>
          <button className="text-[11px] font-medium text-[#D91E2A] hover:underline">
            Size Guide
          </button>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {product.variants.map((v, idx) => {
            const isSelected = selectedVariantIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedVariantIdx(idx)}
                className={`relative flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all active:scale-95 ${
                  isSelected
                    ? "border-2 border-[#D91E2A] bg-red-50/50 shadow-xs"
                    : "border border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-2 right-1 rounded-full bg-[#D91E2A] px-1.5 py-0.2 text-[8px] font-black uppercase text-white">
                    Selected
                  </span>
                )}
                <span
                  className={`text-xs font-bold ${
                    isSelected ? "text-[#D91E2A]" : "text-neutral-900"
                  }`}
                >
                  {v.capacity}
                </span>
                <span className="text-[11px] font-extrabold text-neutral-900">
                  {formatPrice(v.pricePaise)}
                </span>
                <span className="text-[9px] text-neutral-500">{v.note}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. BANK OFFERS & SAVINGS */}
      <section className="p-3.5">
        <div className="rounded-xl border border-red-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#D91E2A]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Available Offers &amp; Promotions
            </h2>
          </div>
          <div className="mt-2.5 space-y-2">
            {/* UPI Offer */}
            <div className="flex items-start justify-between rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
              <div className="flex items-start gap-2">
                <Wallet className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-neutral-900">
                    Flat ₹150 OFF on UPI Transactions
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Applicable on PhonePe, GPay, Paytm on min. cart ₹1,999
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCoupon}
                className="inline-flex shrink-0 items-center gap-1 rounded bg-neutral-200 px-2 py-1 text-[10px] font-bold text-[#D91E2A] hover:bg-neutral-300 active:scale-95 transition-all"
              >
                <span>{copiedCoupon ? "COPIED" : "WONDER150"}</span>
                {copiedCoupon ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>

            {/* Bank Card Offer */}
            <div className="flex items-start gap-2 rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
              <CreditCard className="h-4 w-4 text-[#D91E2A] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-neutral-900">Bank of Baroda Credit Cards</p>
                <p className="text-[11px] text-neutral-500">
                  10% instant discount up to ₹500 on full swipe / EMI orders.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-bold text-[#D91E2A] hover:underline pt-1"
          >
            <span>View 4 more offers</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* 7. KEY SPECIFICATIONS TABLE */}
      <section className="bg-white px-4 py-4 border-t border-neutral-200">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-sm font-bold text-neutral-900">Product Specifications</h2>
          <span className="text-[11px] text-neutral-500">Genuine Prestige India</span>
        </div>
        <div className="mt-3 divide-y divide-neutral-100 text-xs">
          {product.specs.map((item, idx) => (
            <div key={idx} className="grid grid-cols-2 py-2">
              <span className="font-medium text-neutral-500">{item.label}</span>
              <span className="font-semibold text-neutral-900">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Feature Highlight Snippets */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
            <Soup className="h-5 w-5 text-[#D91E2A]" />
            <p className="mt-1 text-[11px] font-bold text-neutral-900">Spillage Control Lid</p>
            <p className="text-[10px] text-neutral-500 leading-tight">
              Controls froth spillage to keep cooking surface spotless.
            </p>
          </div>
          <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100">
            <Leaf className="h-5 w-5 text-[#D91E2A]" />
            <p className="mt-1 text-[11px] font-bold text-neutral-900">Alpha Base Energy Saver</p>
            <p className="text-[10px] text-neutral-500 leading-tight">
              Even heat distribution ensures faster and safer cooking.
            </p>
          </div>
        </div>
      </section>

      {/* 8. VERIFIED CUSTOMER REVIEWS */}
      <section className="bg-white px-4 py-4 mt-2 border-t border-neutral-200" id="reviews">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Verified Customer Reviews</h2>
            <p className="text-[11px] text-neutral-500">From verified buyers across Bhopal</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">
              <span>{product.rating}</span>
              <Star className="h-3 w-3 fill-current" />
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              {product.ratingCount.toLocaleString("en-IN")} ratings
            </p>
          </div>
        </div>

        {/* Reviews Cards */}
        <div className="space-y-3 pt-2">
          {product.reviews.map((r, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-[#D91E2A]">
                    {r.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">{r.name}</p>
                    <p className="text-[10px] text-neutral-500">{r.location} • Verified Buyer</p>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400">{r.date}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-emerald-700">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
                <span className="ml-1 text-[11px] font-bold text-neutral-900">{r.title}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-600 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 mx-auto w-full max-w-[420px] bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] border-t border-neutral-200">
        <div className="flex items-center gap-3">
          {/* Price Display */}
          <div className="flex flex-col shrink-0 min-w-[90px]">
            <span className="text-[10px] font-medium text-neutral-500 leading-none">
              Total Price
            </span>
            <span className="text-lg font-black tracking-tight text-neutral-900">
              {formatPrice(currentSellingPricePaise)}
            </span>
            <span className="text-[9px] font-bold text-emerald-700 leading-tight">
              ⚡ FREE Express
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-1 items-center gap-2">
            <button
              onClick={handleAddToCart}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                isAddedToCart
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-[#D91E2A] bg-white text-[#D91E2A] hover:bg-red-50"
              }`}
            >
              {isAddedToCart ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
            <Link
              href="/cart"
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#D91E2A] py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#B31520] active:scale-95 transition-all"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>Buy Now</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-md min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D91E2A] border-t-transparent" />
        </div>
      }
    >
      <ProductDetailContent />
    </React.Suspense>
  );
}
