"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Store,
  MapPin,
  ChevronRight,
  Zap,
  Trash2,
  BookmarkPlus,
  Minus,
  Plus,
  Ticket,
  CheckCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

interface CartItem {
  id: string;
  slug: string;
  title: string;
  variantLabel: string;
  specNote: string;
  mrpPaise: number;
  sellingPricePaise: number;
  quantity: number;
  badge: string;
  imageUrl: string;
}

const INITIAL_CART_ITEMS: CartItem[] = [
  {
    id: "item-1",
    slug: "prestige-svachh-deluxe-alpha-5l",
    title: "Prestige Svachh Deluxe Alpha Stainless Steel 5L Pressure Cooker",
    variantLabel: "Capacity: 5 Litre",
    specNote: "Alpha SS Base",
    mrpPaise: 345000,
    sellingPricePaise: 219900,
    quantity: 1,
    badge: "⚡ Bhopal 2-Hr Express Delivery Ready",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwD9TPlEtuCmhz0cV6XwCoydv46QKplJ3rYrlOAHZjnEPJCL56XR7xRcRHKeAUIYqbIyOnWXh6ECTTd_wJJ_UarOzAR1mK0z50bkbDbLIkzEAoDXQZc-hV4QwuA5NCvr1Ob5a3IH_zY4uEAQ4hnK527Ydz5sDb_91kIA6Aj5ywjpN43zgArNRJs8C_UgGJxzToPz9FqYxomTOG35fu5bblv6wgnRbCqlffJI6u4AKAW01tusb4f5g_ld16V-trax0R9UJo3gyXlw",
  },
  {
    id: "item-2",
    slug: "bajaj-majesty-kkn-kettle",
    title: "Bajaj Majesty KKN 1.5L Cordless Electric Kettle (SS Body)",
    variantLabel: "Volume: 1.5 Litre",
    specNote: "Auto Cut-off",
    mrpPaise: 129900,
    sellingPricePaise: 84900,
    quantity: 1,
    badge: "⚡ In Stock at MP Nagar Hub",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCUnC2gPMknviGbefVtlS-qfPN-Y-OhJjRVPmV6qirbZv7yCo83QljbyuKBsKnVqUys0guhWVKqyRgV3RkEVbR-UtEL8s4w6NvFYNT0i77Mf-vm05ovapZFdf25a2eQwlKW47bxipUyxT-fURExPAhJnIKxGVtZxbkSurhDFS3WIxJrZiW43hdyK4N7DFs0Cw3laQfDJPCG1acfxWS35Bf9yN4nUNkTdDWaC_spQDvIBwzWxKTbZ4DJJLEyCGo7Vxev03N7EDGowg",
  },
];

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>(INITIAL_CART_ITEMS);
  const [couponCode, setCouponCode] = useState("WONDER150");
  const [isCouponApplied, setIsCouponApplied] = useState(true);
  const [couponDiscountPaise, setCouponDiscountPaise] = useState(15000);
  const [couponError, setCouponError] = useState("");
  const [deliverySlot, setDeliverySlot] = useState<"express" | "evening" | "tomorrow">("express");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"upi" | "card" | "cod">("upi");

  // Calculations
  const totalMrpPaise = items.reduce((acc, item) => acc + item.mrpPaise * item.quantity, 0);
  const totalSellingPaise = items.reduce(
    (acc, item) => acc + item.sellingPricePaise * item.quantity,
    0
  );
  const productDiscountPaise = totalMrpPaise - totalSellingPaise;
  const appliedDiscountPaise = isCouponApplied ? couponDiscountPaise : 0;
  const totalPayablePaise = Math.max(0, totalSellingPaise - appliedDiscountPaise);
  const totalSavingsPaise = productDiscountPaise + appliedDiscountPaise;

  // Free delivery milestone (Threshold ₹3,200)
  const freeDeliveryThresholdPaise = 320000;
  const neededForFreeExpressPaise = Math.max(0, freeDeliveryThresholdPaise - totalSellingPaise);
  const progressPercent = Math.min(
    100,
    Math.round((totalSellingPaise / freeDeliveryThresholdPaise) * 100)
  );

  const updateQuantity = (id: string, delta: number) => {
    setItems(
      (prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const newQty = item.quantity + delta;
              return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    const clean = couponCode.trim().toUpperCase();
    if (clean === "WONDER150") {
      setIsCouponApplied(true);
      setCouponDiscountPaise(15000);
    } else if (clean === "WONDER200") {
      setIsCouponApplied(true);
      setCouponDiscountPaise(20000);
    } else {
      setCouponError("Invalid coupon code. Try WONDER150");
    }
  };

  const handleRemoveCoupon = () => {
    setIsCouponApplied(false);
    setCouponDiscountPaise(0);
  };

  const handleSimulatePayment = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      setPaymentProcessing(false);
      setShowCheckoutModal(false);
      router.push("/order-confirmation?orderId=WS-BHP-8921");
    }, 1500);
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-36 font-sans">
      {/* 1. TOP BAR HEADER */}
      <header className="sticky top-0 z-40 bg-white shadow-xs">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="p-1 rounded-full hover:bg-neutral-100 transition-transform active:scale-95 text-neutral-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-base text-neutral-900 leading-tight">
                Shopping Cart ({items.reduce((acc, i) => acc + i.quantity, 0)} items)
              </h1>
              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <span>Wondersale Retail Bhopal</span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#D91E2A]"></span>
                <span className="text-[#D91E2A] font-semibold">Express Hub</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Link
              href="/wishlist"
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-600 transition-transform active:scale-90"
            >
              <Heart className="h-5 w-5" />
            </Link>
            <div className="p-2 rounded-full text-neutral-600">
              <Store className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Bhopal Location Banner Chip */}
        <div className="px-4 pb-2.5 pt-0.5">
          <div className="bg-neutral-100 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              <MapPin className="h-4 w-4 text-[#D91E2A] shrink-0" />
              <div className="truncate text-xs">
                <span className="text-neutral-500">Deliver to: </span>
                <strong className="font-semibold text-neutral-900">
                  Bhopal 462001 (Arera Colony)
                </strong>
              </div>
            </div>
            <span className="text-xs text-[#D91E2A] font-semibold flex items-center gap-0.5 ml-2 shrink-0 cursor-pointer">
              Change <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </header>

      {/* SCROLLABLE CART CONTENT */}
      <div className="px-3.5 pt-3 space-y-3.5">
        {items.length > 0 ? (
          <>
            {/* 2. FREE DELIVERY MILESTONE PROGRESS BANNER */}
            <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 text-[#D91E2A]">
                    <Zap className="h-5 w-5 fill-current" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      {neededForFreeExpressPaise > 0 ? (
                        <>
                          Add{" "}
                          <span className="text-[#D91E2A] font-extrabold">
                            {formatPrice(neededForFreeExpressPaise)}
                          </span>{" "}
                          more for{" "}
                          <span className="text-[#D91E2A]">FREE Express 2-Hr Delivery</span>
                        </>
                      ) : (
                        <span className="text-emerald-700 font-extrabold">
                          🎉 You unlocked FREE Express 2-Hour Delivery to Bhopal!
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Instant delivery straight to Arera Colony &amp; MP Nagar
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                  {progressPercent}% Reached
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#D91E2A] h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-neutral-500 mt-1.5 font-medium">
                <span>Current: {formatPrice(totalSellingPaise)}</span>
                <span>Target: {formatPrice(freeDeliveryThresholdPaise)} for 0-fee priority</span>
              </div>
            </section>

            {/* 3. CART ITEMS LIST */}
            <section aria-label="Shopping Cart Products" className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 rounded-lg bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center p-1 border border-neutral-200">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <span className="absolute top-1 left-1 bg-white/90 backdrop-blur-xs text-[9px] font-bold px-1 py-0.2 rounded text-[#D91E2A]">
                        {Math.round(
                          ((item.mrpPaise - item.sellingPricePaise) / item.mrpPaise) * 100
                        )}
                        % OFF
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h2 className="text-xs font-semibold text-neutral-900 leading-snug line-clamp-2">
                          {item.title}
                        </h2>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove item"
                          className="text-neutral-400 hover:text-[#D91E2A] active:scale-90 transition-transform p-1 -mr-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Variant */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex text-[10px] font-medium bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">
                          {item.variantLabel}
                        </span>
                        <span className="text-[10px] text-neutral-400">{item.specNote}</span>
                      </div>

                      {/* Price Row */}
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-neutral-900">
                          {formatPrice(item.sellingPricePaise)}
                        </span>
                        <span className="text-[11px] text-neutral-400 line-through">
                          {formatPrice(item.mrpPaise)}
                        </span>
                        <span className="text-[10px] font-bold text-[#D91E2A]">
                          Save {formatPrice(item.mrpPaise - item.sellingPricePaise)}
                        </span>
                      </div>

                      {/* Bhopal Express Badge */}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#D91E2A]">
                        <Zap className="h-3 w-3 fill-current" />
                        <span>{item.badge}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between">
                    <button
                      type="button"
                      className="inline-flex items-center text-xs font-medium text-neutral-600 hover:text-[#D91E2A] transition-colors active:scale-95"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                      Move to Wishlist
                    </button>

                    {/* Stepper */}
                    <div className="flex items-center border border-neutral-300 rounded-lg bg-white shadow-2xs">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:scale-90 rounded-l-lg transition-transform"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-neutral-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        aria-label="Increase quantity"
                        className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 active:scale-90 rounded-r-lg transition-transform"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {/* 4. COUPONS & PROMO CODES */}
            <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Ticket className="h-4 w-4 text-[#D91E2A]" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                    Offers &amp; Coupons
                  </h3>
                </div>
                {isCouponApplied && (
                  <span className="text-[11px] text-[#D91E2A] font-semibold">1 Applied</span>
                )}
              </div>

              {/* Input Box & Apply */}
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg border border-neutral-300 bg-neutral-50 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#D91E2A] focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-[#D91E2A] transition-colors active:scale-95"
                >
                  Apply
                </button>
              </form>
              {couponError && <p className="text-[11px] text-red-600 font-medium">{couponError}</p>}

              {/* Active Applied Coupon Pill */}
              {isCouponApplied && (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-[#D91E2A] fill-red-100" />
                    <div>
                      <p className="text-xs font-bold text-[#D91E2A] leading-none">
                        {couponCode} applied
                      </p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">
                        {formatPrice(couponDiscountPaise)} instant discount unlocked on this order
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-[#D91E2A] hover:underline px-1 py-0.5"
                  >
                    Remove
                  </button>
                </div>
              )}
            </section>

            {/* 5. BHOPAL DELIVERY SLOT SELECTION */}
            <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#D91E2A]" />
                Choose Delivery Preference (Bhopal 462001)
              </h3>

              <div className="space-y-2">
                {/* Option 1: Express */}
                <label
                  onClick={() => setDeliverySlot("express")}
                  className={`flex items-center justify-between p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                    deliverySlot === "express"
                      ? "border-[#D91E2A] bg-red-50/40"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="radio"
                      name="delivery_slot"
                      checked={deliverySlot === "express"}
                      onChange={() => setDeliverySlot("express")}
                      className="mt-0.5 text-[#D91E2A] focus:ring-[#D91E2A]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-neutral-900">
                          Bhopal Express (Within 2 Hours)
                        </span>
                        <span className="text-[9px] font-extrabold bg-[#D91E2A] text-white px-1.5 py-0.2 rounded">
                          FREE
                        </span>
                      </div>
                      <p className="text-[11px] text-[#D91E2A] font-semibold mt-0.5">
                        Guaranteed delivery by 4:30 PM today
                      </p>
                    </div>
                  </div>
                  <Zap className="h-4 w-4 text-[#D91E2A] fill-current" />
                </label>

                {/* Option 2: Today Evening */}
                <label
                  onClick={() => setDeliverySlot("evening")}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    deliverySlot === "evening"
                      ? "border-[#D91E2A] bg-red-50/40"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="radio"
                      name="delivery_slot"
                      checked={deliverySlot === "evening"}
                      onChange={() => setDeliverySlot("evening")}
                      className="mt-0.5 text-[#D91E2A] focus:ring-[#D91E2A]"
                    />
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">
                        Today Evening (5:00 PM - 8:00 PM)
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Eco-friendly combined van delivery
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-neutral-500">FREE</span>
                </label>

                {/* Option 3: Tomorrow Morning */}
                <label
                  onClick={() => setDeliverySlot("tomorrow")}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    deliverySlot === "tomorrow"
                      ? "border-[#D91E2A] bg-red-50/40"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="radio"
                      name="delivery_slot"
                      checked={deliverySlot === "tomorrow"}
                      onChange={() => setDeliverySlot("tomorrow")}
                      className="mt-0.5 text-[#D91E2A] focus:ring-[#D91E2A]"
                    />
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">
                        Tomorrow Morning (9:00 AM - 12:00 PM)
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Convenient morning drop-off
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-neutral-500">FREE</span>
                </label>
              </div>
            </section>

            {/* 6. BILL SUMMARY */}
            <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-2.5">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide pb-1 border-b border-neutral-100">
                Bill Summary
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Items Total (MRP)</span>
                  <span className="font-medium text-neutral-900">{formatPrice(totalMrpPaise)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Product Discount</span>
                  <span className="font-semibold text-[#D91E2A]">
                    -{formatPrice(productDiscountPaise)}
                  </span>
                </div>
                {isCouponApplied && (
                  <div className="flex justify-between text-neutral-600">
                    <span className="flex items-center gap-1">
                      Coupon Discount ({couponCode})
                      <CheckCircle className="h-3 w-3 text-[#D91E2A]" />
                    </span>
                    <span className="font-semibold text-[#D91E2A]">
                      -{formatPrice(appliedDiscountPaise)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Bhopal Express 2-Hr Delivery</span>
                  <div>
                    <span className="text-[10px] text-neutral-400 line-through mr-1">₹49</span>
                    <span className="font-bold text-emerald-700">FREE</span>
                  </div>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Packaging &amp; Handling</span>
                  <div>
                    <span className="text-[10px] text-neutral-400 line-through mr-1">₹19</span>
                    <span className="font-bold text-emerald-700">FREE</span>
                  </div>
                </div>
              </div>

              {/* Total Row */}
              <div className="border-t border-dashed border-neutral-200 pt-2 mt-2">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-bold text-neutral-900">Total Amount to Pay</span>
                    <p className="text-[10px] text-neutral-500">(Inclusive of all taxes)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-neutral-900">
                      {formatPrice(totalPayablePaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings Highlight */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center mt-2">
                <p className="text-xs font-bold text-[#D91E2A] flex items-center justify-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  You are saving a total of {formatPrice(totalSavingsPaise)} on this order!
                </p>
              </div>
            </section>

            {/* 7. TRUST STRIP */}
            <section className="grid grid-cols-3 gap-2 px-1 py-1 text-center">
              <div className="bg-white p-2 rounded-lg border border-neutral-200 shadow-2xs">
                <ShieldCheck className="h-5 w-5 text-[#D91E2A] mx-auto" />
                <p className="text-[10px] font-bold text-neutral-900 mt-1 leading-tight">
                  100% Genuine
                </p>
                <p className="text-[9px] text-neutral-500">Brand Warranty</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-neutral-200 shadow-2xs">
                <RefreshCw className="h-5 w-5 text-[#D91E2A] mx-auto" />
                <p className="text-[10px] font-bold text-neutral-900 mt-1 leading-tight">
                  7-Day Return
                </p>
                <p className="text-[9px] text-neutral-500">Doorstep Pickup</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-neutral-200 shadow-2xs">
                <Lock className="h-5 w-5 text-[#D91E2A] mx-auto" />
                <p className="text-[10px] font-bold text-neutral-900 mt-1 leading-tight">
                  256-Bit SSL
                </p>
                <p className="text-[9px] text-neutral-500">Secure Payments</p>
              </div>
            </section>
          </>
        ) : (
          /* EMPTY CART STATE */
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-neutral-300 my-8">
            <div className="w-16 h-16 rounded-full bg-red-50 text-[#D91E2A] flex items-center justify-center mx-auto mb-3">
              <Store className="h-8 w-8" />
            </div>
            <h2 className="text-base font-bold text-neutral-900">Your Cart is Empty</h2>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-1 mb-4">
              Explore deals across Bhopal Superstore catalog and get instant 2-hour doorstep
              delivery.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D91E2A] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#B31520] transition-colors"
            >
              Start Shopping Now
            </Link>
          </div>
        )}
      </div>

      {/* 8. STICKY BOTTOM ACTION BAR */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-neutral-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-[420px] mx-auto px-4 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wide">
                Total Payable
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-black text-neutral-900">
                  {formatPrice(totalPayablePaise)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="bg-[#D91E2A] hover:bg-[#B31520] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center space-x-1.5"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (PhonePe / Razorpay / COD Simulation) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-[420px] bg-white rounded-t-2xl p-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Choose Payment Method</h3>
                <p className="text-[11px] text-neutral-500">
                  Payable: {formatPrice(totalPayablePaise)} (Bhopal Express)
                </p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 py-3">
              <label
                onClick={() => setSelectedPaymentMethod("upi")}
                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPaymentMethod === "upi"
                    ? "border-[#D91E2A] bg-red-50/50"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    UPI
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      PhonePe / Google Pay / Paytm
                    </p>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      Instant verification &amp; 2-Hr Express dispatch
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="pay_method"
                  checked={selectedPaymentMethod === "upi"}
                  onChange={() => setSelectedPaymentMethod("upi")}
                  className="text-[#D91E2A] focus:ring-[#D91E2A]"
                />
              </label>

              <label
                onClick={() => setSelectedPaymentMethod("card")}
                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPaymentMethod === "card"
                    ? "border-[#D91E2A] bg-red-50/50"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    Card
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      Credit / Debit Card / Netbanking
                    </p>
                    <p className="text-[10px] text-neutral-500">Razorpay 256-bit secure gateway</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="pay_method"
                  checked={selectedPaymentMethod === "card"}
                  onChange={() => setSelectedPaymentMethod("card")}
                  className="text-[#D91E2A] focus:ring-[#D91E2A]"
                />
              </label>

              <label
                onClick={() => setSelectedPaymentMethod("cod")}
                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPaymentMethod === "cod"
                    ? "border-[#D91E2A] bg-red-50/50"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    COD
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">Cash on Delivery</p>
                    <p className="text-[10px] text-neutral-500">
                      Pay cash or scan QR upon rider arrival
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="pay_method"
                  checked={selectedPaymentMethod === "cod"}
                  onChange={() => setSelectedPaymentMethod("cod")}
                  className="text-[#D91E2A] focus:ring-[#D91E2A]"
                />
              </label>
            </div>

            <button
              onClick={handleSimulatePayment}
              disabled={paymentProcessing}
              className="w-full py-3 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
            >
              {paymentProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Securing Order with Bhopal Hub...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Pay {formatPrice(totalPayablePaise)} &amp; Place Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Docked bottom nav */}
      <BottomTabBar />
    </div>
  );
}
