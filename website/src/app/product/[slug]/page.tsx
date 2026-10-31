"use client";

import React, { useState, useEffect } from "react";
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
  Phone,
  Truck,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useStorefront } from "@/context/StorefrontContext";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";

import { DEMO_PRODUCTS, getDemoProductBySlug } from "@/data/demo-products";

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
  imageUrl?: string;
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

const DEFAULT_PRODUCT: ProductDetailData = {
  id: "prod-prestige-cooker",
  slug: "prestige-svachh-deluxe-alpha-5l",
  brand: "PRESTIGE",
  title:
    "Prestige Svachh Deluxe Alpha Stainless Steel 5L Pressure Cooker (Induction & Gas Compatible)",
  category: "Kitchen Appliances",
  categorySlug: "kitchen-appliances",
  rating: 4.8,
  ratingCount: 3410,
  mrpPaise: 345000,
  sellingPricePaise: 219900,
  inStock: true,
  stockCount: 12,
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAwD9TPlEtuCmhz0cV6XwCoydv46QKplJ3rYrlOAHZjnEPJCL56XR7xRcRHKeAUIYqbIyOnWXh6ECTTd_wJJ_UarOzAR1mK0z50bkbDbLIkzEAoDXQZc-hV4QwuA5NCvr1Ob5a3IH_zY4uEAQ4hnK527Ydz5sDb_91kIA6Aj5ywjpN43zgArNRJs8C_UgGJxzToPz9FqYxomTOG35fu5bblv6wgnRbCqlffJI6u4AKAW01tusb4f5g_ld16V-trax0R9UJo3gyXlw",
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
      title: "Genuine product with warranty",
      text: "Got bill with GST and authorized stamp. Heavy alpha bottom, cooks dal and rice without burning. Delivered in intact sealed retail carton.",
      date: "3 days ago",
    },
    {
      name: "Deepak Patel",
      location: "Kolar Road, Bhopal",
      rating: 5,
      title: "Best price in Bhopal market",
      text: "Checked local electronics market in Zone 1, Wondersale price with instant coupon was ₹300 cheaper and delivered right to my apartment.",
      date: "1 week ago",
    },
  ],
};

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { addToCart, cartCount, toggleWishlist, isInWishlist, location, isHydrated } = useStorefront();

  const [product, setProduct] = useState<ProductDetailData>(() => {
    if (slug) {
      const demo = getDemoProductBySlug(slug);
      if (demo) return demo;
    }
    return DEFAULT_PRODUCT;
  });
  const [loading, setLoading] = useState(false);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [pincode, setPincode] = useState(location?.pincode || "462001");
  const [isChangingPincode, setIsChangingPincode] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState(
    "⚡ Bhopal Express 2-Hour Delivery Guaranteed"
  );
  const [isPincodeValid, setIsPincodeValid] = useState(true);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  useEffect(() => {
    if (!slug) return;

    // Check demo products first
    const demo = getDemoProductBySlug(slug);
    if (demo) {
      setProduct(demo);
      return;
    }

    // Try backend catalog API
    fetch(`/api/catalog/products/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const p = data.data;
          const variantsList =
            p.variants && p.variants.length > 0
              ? p.variants.map(
                  (v: {
                    title: string;
                    sellingPricePaise: number;
                    mrpPaise: number;
                    stockQuantity: number;
                  }) => ({
                    capacity: v.title,
                    pricePaise: v.sellingPricePaise,
                    note: v.stockQuantity > 0 ? `${v.stockQuantity} in stock` : "Backorder",
                  })
                )
              : DEFAULT_PRODUCT.variants;

          setProduct({
            id: p.id,
            slug: p.slug,
            brand: p.brand?.name || "Wondersale",
            title: p.name,
            category: p.category?.name || "Retail",
            categorySlug: p.category?.slug || "kitchen-appliances",
            rating: p.ratingAverage > 0 ? p.ratingAverage : 4.4,
            ratingCount: p.reviewCount > 0 ? p.reviewCount : 12,
            mrpPaise: p.variants?.[0]?.mrpPaise || 345000,
            sellingPricePaise: p.variants?.[0]?.sellingPricePaise || 219900,
            inStock: p.variants?.[0]?.inStock ?? true,
            stockCount: p.variants?.[0]?.stockQuantity || 15,
            imageUrl: p.variants?.[0]?.images?.[0]?.url || DEFAULT_PRODUCT.imageUrl,
            bestsellerRank: `#1 in ${p.category?.name || "Bhopal Store"}`,
            variants: variantsList,
            specs: [
              { label: "Brand", value: p.brand?.name || "Wondersale" },
              { label: "Category", value: p.category?.name || "General" },
              { label: "Stock Location", value: "Bhopal MP Nagar Hub" },
              { label: "Dispatch Guarantee", value: "2-Hour Express Delivery in Bhopal" },
              { label: "Warranty", value: "Manufacturer Domestic Warranty" },
            ],
            reviews: DEFAULT_PRODUCT.reviews,
          });
        }
      })
      .catch(() => {
        // Fallback gracefully
      });
  }, [slug]);

  const isWishlisted = isInWishlist(product.id);

  const selectedVariant = product.variants[selectedVariantIdx] || product.variants[0];
  const currentSellingPricePaise = selectedVariant?.pricePaise || product.sellingPricePaise;
  const currentMrpPaise = product.mrpPaise;
  const savingsPaise = Math.max(0, currentMrpPaise - currentSellingPricePaise);
  const savingsPercent = Math.round((savingsPaise / currentMrpPaise) * 100);

  const handlePincodeCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pincode.trim();
    if (clean.length !== 6 || !/^\d+$/.test(clean)) {
      setIsPincodeValid(false);
      setPincodeMessage("Please enter a valid 6-digit Indian PIN code");
      return;
    }
    try {
      const res = await fetch(`/api/pincode/check?pincode=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.success && data.data.isDeliverable) {
        setIsPincodeValid(true);
        setPincodeMessage(
          data.data.isExpressAvailable
            ? `⚡ Bhopal Express 2-Hour Delivery Available to ${data.data.city} (${clean})`
            : `Standard Delivery Available (${data.data.estimatedDays} to ${data.data.city})`
        );
        setIsChangingPincode(false);
      } else {
        setIsPincodeValid(false);
        setPincodeMessage(`Delivery currently unavailable for PIN code ${clean}`);
      }
    } catch {
      setIsPincodeValid(false);
      setPincodeMessage("Error verifying PIN code. Please retry.");
    }
  };

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText("WONDER150");
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const productImg =
    product.imageUrl ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAwD9TPlEtuCmhz0cV6XwCoydv46QKplJ3rYrlOAHZjnEPJCL56XR7xRcRHKeAUIYqbIyOnWXh6ECTTd_wJJ_UarOzAR1mK0z50bkbDbLIkzEAoDXQZc-hV4QwuA5NCvr1Ob5a3IH_zY4uEAQ4hnK527Ydz5sDb_91kIA6Aj5ywjpN43zgArNRJs8C_UgGJxzToPz9FqYxomTOG35fu5bblv6wgnRbCqlffJI6u4AKAW01tusb4f5g_ld16V-trax0R9UJo3gyXlw";

  const handleToggleWishlist = () => {
    toggleWishlist({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      rating: product.rating,
      ratingCount: product.ratingCount,
      inStock: product.inStock,
      imageUrl: productImg,
    });
  };

  const handleAddToCart = () => {
    addToCart({
      id: `${product.id}-${selectedVariant?.capacity || "default"}`,
      slug: product.slug,
      title: product.title,
      variantLabel: `Variant: ${selectedVariant?.capacity || "Standard"}`,
      specNote: selectedVariant?.note || "In Stock",
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      badge: "⚡ Bhopal 2-Hr Express Delivery Ready",
      imageUrl: productImg,
    });
    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart({
      id: `${product.id}-${selectedVariant?.capacity || "default"}`,
      slug: product.slug,
      title: product.title,
      variantLabel: `Variant: ${selectedVariant?.capacity || "Standard"}`,
      specNote: selectedVariant?.note || "In Stock",
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      badge: "⚡ Bhopal 2-Hr Express Delivery Ready",
      imageUrl: productImg,
    });
    router.push("/cart");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8EE] flex flex-col items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7A0C16] border-t-transparent mb-3" />
        <p className="text-xs font-semibold text-[#735A4A]">
          Loading product details from database...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#2C1810] font-sans flex flex-col justify-between">
      {/* ======================================================== */}
      {/* DESKTOP VIEWPORT LAYOUT (md: and above, from Stitch Screen 34) */}
      {/* ======================================================== */}
      <div className="hidden md:flex flex-col min-h-screen">
        {/* Global Proportional Desktop Navigation */}
        <GlobalHeader />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-5">
          {/* 1. Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#735A4A] mb-5 py-1">
            <Link href="/" className="hover:text-[#7A0C16] transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/categories" className="hover:text-[#7A0C16] transition-colors">Categories</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/category/${product.categorySlug}`} className="hover:text-[#7A0C16] transition-colors">
              {product.category}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#2C1810] font-semibold truncate max-w-xs">{product.title}</span>
          </nav>

          {/* 2. Desktop Two-Column Split Layout */}
          <div className="grid grid-cols-12 gap-8 items-start mb-10">
            {/* Left Column: Image Gallery & Badges */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 sticky top-24">
              <div className="relative w-full aspect-square bg-[#FAF3E0] rounded-3xl shadow-sm border border-[#EADFC7] overflow-hidden flex items-center justify-center group p-8">
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 items-start">
                  {savingsPercent > 0 && (
                    <span className="bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                      {savingsPercent}% OFF
                    </span>
                  )}
                  {product.bestsellerRank && (
                    <span className="bg-[#FAF3E0] text-[#7A0C16] border border-[#EADFC7] text-xs px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 font-bold">
                      <Flame className="w-3.5 h-3.5 text-[#7A0C16] fill-current" />
                      {product.bestsellerRank}
                    </span>
                  )}
                </div>

                {/* Wishlist & Share */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                  <button
                    onClick={handleToggleWishlist}
                    aria-label="Wishlist"
                    className="w-9 h-9 rounded-full bg-[#FDF8EE] border border-[#EADFC7] shadow-xs flex items-center justify-center text-[#735A4A] hover:text-[#7A0C16] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? "text-[#7A0C16] fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: product.title, url: window.location.href });
                      }
                    }}
                    aria-label="Share"
                    className="w-9 h-9 rounded-full bg-[#FDF8EE] border border-[#EADFC7] shadow-xs flex items-center justify-center text-[#735A4A] hover:text-[#7A0C16] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Product Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImg}
                  alt={product.title}
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`aspect-square rounded-xl overflow-hidden bg-[#FAF3E0] p-2 border transition-all cursor-pointer ${
                      activeImageIdx === idx
                        ? "border-[#7A0C16] ring-2 ring-[#7A0C16]/20"
                        : "border-[#EADFC7] hover:border-[#CDB992]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImg}
                      alt="Thumbnail"
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>

              {/* Highlights Box */}
              <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#735A4A] mb-3">Key Highlights</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FDF8EE] border border-[#EADFC7] flex items-start gap-2.5">
                    <Zap className="w-5 h-5 text-[#7A0C16] shrink-0" />
                    <div>
                      <h4 className="font-bold text-[#2C1810]">Bhopal 2-Hr Express</h4>
                      <p className="text-[#735A4A] text-[11px] mt-0.5">Dispatched directly from MP Nagar Hub</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FDF8EE] border border-[#EADFC7] flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-[#7A0C16] shrink-0" />
                    <div>
                      <h4 className="font-bold text-[#2C1810]">100% Genuine</h4>
                      <p className="text-[#735A4A] text-[11px] mt-0.5">Direct manufacturer warranty</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Title, Price, Variants, Delivery & Actions */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
              {/* Product Header Card */}
              <div className="bg-[#FAF3E0] p-6 rounded-2xl shadow-2xs border border-[#EADFC7]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#7A0C16] tracking-wider uppercase">
                    {product.brand} OFFICIAL STORE
                  </span>
                  <span className="text-xs text-[#735A4A] font-medium">Bhopal Stock Verified</span>
                </div>
                <h1 className="font-serif font-bold text-2xl lg:text-3xl text-[#2C1810] leading-snug">
                  {product.title}
                </h1>

                {/* Price Strip */}
                <div className="mt-4 p-4 bg-[#FDF8EE] rounded-xl border border-[#EADFC7]">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-black text-[#2C1810]">
                      {formatPrice(currentSellingPricePaise)}
                    </span>
                    <span className="text-sm font-medium text-[#735A4A] line-through">
                      MRP {formatPrice(currentMrpPaise)}
                    </span>
                    {savingsPercent > 0 && (
                      <span className="bg-[#7A0C16] text-[#FDF8EE] text-xs px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                        Save {formatPrice(savingsPaise)} ({savingsPercent}% OFF)
                      </span>
                    )}
                  </div>
                  <p className="text-[#735A4A] text-xs mt-1">Inclusive of all taxes • GST Invoice Available</p>
                </div>
              </div>

              {/* Variants Card */}
              {product.variants.length > 1 && (
                <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7]">
                  <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wider mb-3">
                    Select Size / Capacity: <span className="text-[#7A0C16]">{selectedVariant?.capacity}</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {product.variants.map((v, idx) => {
                      const isSelected = selectedVariantIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedVariantIdx(idx)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "border-[#7A0C16] bg-[#FDF8EE] shadow-2xs ring-2 ring-[#7A0C16]/20"
                              : "border-[#EADFC7] bg-[#FAF3E0] hover:border-[#CDB992]"
                          }`}
                        >
                          <p className={`text-xs font-bold ${isSelected ? "text-[#7A0C16]" : "text-[#2C1810]"}`}>
                            {v.capacity}
                          </p>
                          <p className="text-sm font-extrabold text-[#2C1810] mt-0.5">
                            {formatPrice(v.pricePaise)}
                          </p>
                          <p className="text-[10px] text-[#735A4A] mt-0.5">{v.note}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery & Pincode Card */}
              <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2C1810]">
                    <MapPin className="w-4 h-4 text-[#7A0C16]" />
                    <span>Deliver to: {pincode} - {pincode.startsWith("462") ? "Bhopal, MP" : "India"}</span>
                  </div>
                  <button
                    onClick={() => setIsChangingPincode(!isChangingPincode)}
                    className="text-[#7A0C16] text-xs font-bold hover:underline cursor-pointer"
                  >
                    {isChangingPincode ? "Cancel" : "Change"}
                  </button>
                </div>

                {isChangingPincode && (
                  <form onSubmit={handlePincodeCheck} className="flex gap-2 mt-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit Pincode"
                      className="flex-1 rounded-lg border border-[#EADFC7] bg-[#FDF8EE] px-3 py-1.5 text-xs text-[#2C1810] focus:outline-none focus:border-[#7A0C16]"
                    />
                    <button
                      type="submit"
                      className="bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Verify
                    </button>
                  </form>
                )}

                <div className={`mt-3 p-3 rounded-xl border ${isPincodeValid ? "bg-[#FDF8EE] border-[#EADFC7] text-[#2C1810]" : "bg-red-50 border-red-200 text-red-900"} text-xs`}>
                  <div className="flex items-center gap-2 font-bold">
                    <Zap className="w-4 h-4 text-[#7A0C16] fill-current shrink-0" />
                    <span>{pincodeMessage}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Desktop */}
              <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7] flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    isAddedToCart
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                      : "border-[#7A0C16] bg-[#FDF8EE] text-[#7A0C16] hover:bg-[#FAF3E0]"
                  }`}
                >
                  {isAddedToCart ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="flex-[1.2] h-12 rounded-xl bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] text-sm font-bold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  <span>Buy Now • {formatPrice(currentSellingPricePaise)}</span>
                </button>
              </div>

              {/* Specifications Card */}
              <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7]">
                <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wider mb-3">Specifications</h3>
                <div className="divide-y divide-[#EADFC7]/60 text-xs">
                  {product.specs.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 py-2">
                      <span className="text-[#735A4A] font-medium">{item.label}</span>
                      <span className="text-[#2C1810] font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Reviews Card */}
              <div className="bg-[#FAF3E0] p-5 rounded-2xl shadow-2xs border border-[#EADFC7]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wider">Customer Reviews</h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#735A4A]">
                    <span>Verified Bhopal Buyers</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {product.reviews.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#FDF8EE] border border-[#EADFC7] text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#2C1810]">{r.name}</span>
                        <span className="text-[#735A4A] text-[10px]">{r.date}</span>
                      </div>
                      <p className="text-[#735A4A] leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        <StorefrontFooter />
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEWPORT LAYOUT (< md, Preserved 390px Experience) */}
      {/* ======================================================== */}
      <div className="md:hidden relative mx-auto min-h-screen w-full max-w-[420px] bg-[#FDF8EE] shadow-2xl flex flex-col pb-28 font-sans">
        {/* 1. TOP BAR / APP HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-[#FAF3E0]/95 backdrop-blur-md px-3.5 py-3 shadow-xs border-b border-[#EADFC7]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#2C1810] hover:bg-[#FDF8EE] active:scale-95 transition-transform cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <WondersaleLogo size="sm" showSubtitle={false} />
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#735A4A] hover:bg-[#FDF8EE] active:scale-95 transition-transform"
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
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#735A4A] hover:bg-[#FDF8EE] active:scale-95 transition-transform cursor-pointer"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              aria-label="Add to wishlist"
              onClick={handleToggleWishlist}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#735A4A] hover:bg-[#FDF8EE] active:scale-90 transition-transform cursor-pointer"
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isWishlisted ? "text-[#7A0C16] fill-current" : "text-[#735A4A]"
                }`}
              />
            </button>
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#735A4A] hover:bg-[#FDF8EE] active:scale-95 transition-transform"
            >
              <ShoppingBag className="h-5 w-5" />
              {isHydrated && cartCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7A0C16] px-1 text-[10px] font-bold text-[#FDF8EE] shadow-xs">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* 2. IMAGE GALLERY HERO */}
        <section className="relative w-full bg-[#FAF3E0] border-b border-[#EADFC7]">
          <div className="relative mx-auto flex h-72 w-full items-center justify-center overflow-hidden p-6">
            {savingsPercent > 0 && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-[#7A0C16] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#FDF8EE] shadow-2xs">
                <Flame className="h-3.5 w-3.5 fill-current" />
                <span>SAVE {savingsPercent}%</span>
              </div>
            )}

            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-[#2C1810]/80 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDF8EE]">
              <CheckCircle className="h-3 w-3 text-emerald-400" />
              <span>100% Genuine</span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImg}
              alt={product.title}
              className="h-full w-auto object-contain transition-transform duration-300 hover:scale-105"
            />

            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-[#FDF8EE] backdrop-blur-xs border border-[#EADFC7] px-2 py-0.5 text-[10px] font-semibold text-[#735A4A] shadow-xs">
              <Box className="h-3 w-3 text-[#7A0C16]" />
              <span>Verified MP Model</span>
            </div>

            <div className="absolute bottom-3 right-3 z-10 rounded-full bg-[#2C1810]/60 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-medium text-[#FDF8EE]">
              1 / 3
            </div>
          </div>
        </section>

        {/* 3. PRODUCT ESSENTIALS */}
        <section className="bg-[#FAF3E0] p-4 border-b border-[#EADFC7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A0C16]">
                {product.brand}
              </span>
              <span className="text-[#EADFC7]">•</span>
              <span className="text-[11px] font-medium text-[#735A4A]">{product.category}</span>
            </div>
            {product.bestsellerRank && (
              <span className="rounded-full bg-[#FDF8EE] border border-[#EADFC7] px-2 py-0.5 text-[10px] font-bold text-[#7A0C16]">
                {product.bestsellerRank}
              </span>
            )}
          </div>

          <h1 className="mt-1.5 text-base font-bold text-[#2C1810] leading-snug">
            {product.title}
          </h1>

          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="text-2xl font-black tracking-tight text-[#2C1810]">
              {formatPrice(currentSellingPricePaise)}
            </span>
            <span className="text-xs font-medium text-[#735A4A] line-through">
              MRP {formatPrice(currentMrpPaise)}
            </span>
            {savingsPercent > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#7A0C16] px-2 py-0.5 text-[11px] font-bold text-[#FDF8EE] shadow-2xs">
                Save {formatPrice(savingsPaise)} ({savingsPercent}% OFF)
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-[#735A4A]">
            <span>Inclusive of all taxes</span>
            <span className="font-semibold text-[#2C1810]">
              EMI from <strong className="text-[#7A0C16] font-bold">₹106/mo</strong>{" "}
              <span className="underline cursor-pointer">View Plans</span>
            </span>
          </div>
        </section>

        {/* 4. BHOPAL HYPERLOCAL DELIVERY */}
        <section className="p-3.5">
          <div className="rounded-2xl border border-[#EADFC7] bg-[#FAF3E0] p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#EADFC7]/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FDF8EE] border border-[#EADFC7] text-[#7A0C16]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-[#735A4A] uppercase tracking-wider">
                    Deliver to
                  </p>
                  <p className="text-xs font-bold text-[#2C1810]">
                    {pincode} - {pincode.startsWith("462") ? "Bhopal, MP" : "India"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChangingPincode(!isChangingPincode)}
                className="rounded-lg border border-[#EADFC7] bg-[#FDF8EE] px-2.5 py-1 text-xs font-semibold text-[#7A0C16] hover:bg-[#FAF3E0] active:scale-95 transition-all cursor-pointer"
              >
                {isChangingPincode ? "Cancel" : "Change"}
              </button>
            </div>

            {isChangingPincode && (
              <form onSubmit={handlePincodeCheck} className="flex gap-2 pt-2.5 pb-1">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit Pincode"
                  className="flex-1 rounded-lg border border-[#EADFC7] bg-[#FDF8EE] px-3 py-1 text-xs font-medium text-[#2C1810] focus:outline-none focus:border-[#7A0C16]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#5A0A10] px-3 py-1 text-xs font-bold text-[#FDF8EE] hover:bg-[#7A0C16] transition-colors cursor-pointer shadow-2xs"
                >
                  Apply
                </button>
              </form>
            )}

            <div
              className={`mt-3 rounded-lg p-2.5 border ${
                isPincodeValid
                  ? "bg-[#FDF8EE] border-[#EADFC7] text-[#2C1810]"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#7A0C16] fill-current" />
                <span className="text-xs font-bold">{pincodeMessage}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>In Stock (Bhopal MP Nagar Warehouse)</span>
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[#EADFC7]/60 pt-3 text-center">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF8EE] border border-[#EADFC7] text-[#7A0C16] mb-1">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-[#2C1810]">Cash On Delivery</span>
                <span className="text-[9px] text-[#735A4A]">Available</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF8EE] border border-[#EADFC7] text-[#7A0C16] mb-1">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-[#2C1810]">7-Day Easy Return</span>
                <span className="text-[9px] text-[#735A4A]">Doorstep</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF8EE] border border-[#EADFC7] text-[#7A0C16] mb-1">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-[#2C1810]">Brand Warranty</span>
                <span className="text-[9px] text-[#735A4A]">100% Genuine</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SIZE & VARIANT SELECTOR */}
        {product.variants.length > 1 && (
          <section className="bg-[#FAF3E0] px-4 py-3.5 border-y border-[#EADFC7]">
            <span className="text-xs font-bold text-[#2C1810]">
              Select Option: <strong className="text-[#7A0C16]">{selectedVariant?.capacity}</strong>
            </span>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {product.variants.map((v, idx) => {
                const isSelected = selectedVariantIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariantIdx(idx)}
                    className={`relative flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? "border-2 border-[#7A0C16] bg-[#FDF8EE] shadow-2xs"
                        : "border border-[#EADFC7] bg-[#FAF3E0] hover:border-[#CDB992]"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? "text-[#7A0C16]" : "text-[#2C1810]"
                      }`}
                    >
                      {v.capacity}
                    </span>
                    <span className="text-[11px] font-extrabold text-[#2C1810]">
                      {formatPrice(v.pricePaise)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. BANK OFFERS */}
        <section className="p-3.5">
          <div className="rounded-2xl border border-[#EADFC7] bg-[#FAF3E0] p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#7A0C16]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
                Available Offers &amp; Promotions
              </h2>
            </div>
            <div className="mt-2.5 space-y-2">
              <div className="flex items-start justify-between rounded-xl bg-[#FDF8EE] p-2.5 border border-[#EADFC7]">
                <div className="flex items-start gap-2">
                  <Wallet className="h-4 w-4 text-[#7A0C16] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#2C1810]">
                      Flat ₹150 OFF on UPI Transactions
                    </p>
                    <p className="text-[11px] text-[#735A4A]">
                      Applicable on PhonePe, GPay, Paytm on min. cart ₹1,999
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCoupon}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-[#FAF3E0] border border-[#EADFC7] px-2 py-1 text-[10px] font-bold text-[#7A0C16] hover:bg-[#FDF8EE] active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  <span>{copiedCoupon ? "COPIED" : "WONDER150"}</span>
                  {copiedCoupon ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 7. SPECIFICATIONS TABLE */}
        <section className="bg-[#FAF3E0] px-4 py-4 border-t border-[#EADFC7]">
          <h2 className="text-sm font-bold text-[#2C1810] pb-2 border-b border-[#EADFC7]/60">
            Product Specifications
          </h2>
          <div className="mt-3 divide-y divide-[#EADFC7]/60 text-xs">
            {product.specs.map((item, idx) => (
              <div key={idx} className="grid grid-cols-2 py-2">
                <span className="font-medium text-[#735A4A]">{item.label}</span>
                <span className="font-semibold text-[#2C1810]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 8. VERIFIED REVIEWS */}
        <section className="bg-[#FAF3E0] px-4 py-4 mt-2 border-t border-[#EADFC7]">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-bold text-[#2C1810]">Verified Customer Reviews</h2>
            <div className="flex items-center gap-1 text-xs text-[#735A4A]">
              <span>Verified Bhopal Buyers</span>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {product.reviews.map((r, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#FDF8EE] border border-[#EADFC7] p-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C1810]">{r.name}</span>
                  <span className="text-[10px] text-[#735A4A]">{r.date}</span>
                </div>
                <p className="mt-1 text-xs text-[#735A4A] leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 9. STICKY MOBILE BOTTOM ACTION BAR */}
        <div className="fixed bottom-0 inset-x-0 z-50 mx-auto w-full max-w-[420px] bg-[#FAF3E0]/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(44,24,16,0.08)] border-t border-[#EADFC7]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col shrink-0 min-w-[90px]">
              <span className="text-[10px] font-medium text-[#735A4A] leading-none">
                Total Price
              </span>
              <span className="text-lg font-black tracking-tight text-[#2C1810]">
                {formatPrice(currentSellingPricePaise)}
              </span>
              <span className="text-[9px] font-bold text-[#7A0C16] leading-tight">
                ⚡ FREE Express
              </span>
            </div>

            <div className="flex flex-1 items-center gap-2">
              <button
                onClick={handleAddToCart}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  isAddedToCart
                    ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                    : "border-[#7A0C16] bg-[#FDF8EE] text-[#7A0C16] hover:bg-[#FAF3E0]"
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
              <button
                type="button"
                onClick={handleBuyNow}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#5A0A10] py-2.5 text-xs font-extrabold text-[#FDF8EE] shadow-2xs hover:bg-[#7A0C16] active:scale-95 transition-all cursor-pointer"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Buy Now</span>
              </button>
            </div>
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
        <div className="min-h-screen bg-[#FDF8EE] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7A0C16] border-t-transparent" />
        </div>
      }
    >
      <ProductDetailContent />
    </React.Suspense>
  );
}
