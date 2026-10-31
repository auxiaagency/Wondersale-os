"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  Zap,
  Phone,
  MessageCircle,
  ShoppingBag,
  Download,
  MapPin,
  Store,
  ShieldCheck,
} from "lucide-react";

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "WS-BHP-8921";
  const [copiedTracking, setCopiedTracking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(orderId);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-16 font-sans">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-xs border-b border-neutral-200">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Home"
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-800 hover:bg-neutral-100 transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#D91E2A]">Confirmed</span>
              <span className="text-[10px] text-neutral-500">#{orderId}</span>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-neutral-800 hover:text-[#D91E2A] transition-colors"
            >
              <span>{orderId}</span>
              {copiedTracking ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Store Contact & Help */}
        <div className="flex items-center gap-1.5">
          <a
            href="tel:07554209999"
            title="Call Store"
            className="p-1.5 rounded-full text-neutral-600 hover:bg-neutral-100 transition-all active:scale-95"
          >
            <Store className="h-5 w-5" />
          </a>
        </div>
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 flex flex-col px-4 pt-3 space-y-4">
        {/* 2. CELEBRATORY SUCCESS BANNER */}
        <section className="relative rounded-2xl p-4 overflow-hidden border border-neutral-200 bg-white shadow-xs">
          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Success Ring */}
            <div className="relative mb-3 flex items-center justify-center">
              <span className="absolute w-14 h-14 rounded-full bg-emerald-500/20 animate-ping"></span>
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                <Check className="h-7 w-7 stroke-[3]" />
              </div>
            </div>

            <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">
              Order Placed Successfully!
            </h1>
            <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed max-w-[300px]">
              Thank you <span className="font-semibold text-neutral-900">Rohit</span>! Your order
              has been routed to{" "}
              <span className="font-semibold text-[#D91E2A]">Wondersale Superstore</span>, MP Nagar,
              Bhopal.
            </p>

            {/* Express Delivery Guarantee Pill */}
            <div className="mt-3.5 w-full bg-neutral-50 rounded-xl p-2.5 border border-red-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#D91E2A] text-white flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 fill-current" />
                </span>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-neutral-900">Today by 4:30 PM</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Bhopal Express 2-Hour Delivery Guarantee
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-[#D91E2A] px-2 py-0.5 rounded-full shrink-0">
                Express
              </span>
            </div>
          </div>
        </section>

        {/* 3. ORDER TRACKING TIMELINE */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-[#D91E2A]" />
              Live Order Tracking
            </h2>
            <span className="text-[11px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              In Packing
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-3 before:w-0.5 before:bg-neutral-200">
            {/* Step 1: Confirmed */}
            <div className="relative flex flex-col">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold text-neutral-900">Order Confirmed</h3>
                <time className="text-[10px] font-medium text-neutral-400">12:45 PM</time>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Order verified and accepted by Bhopal Hub
              </p>
            </div>

            {/* Step 2: Packing (Current Active) */}
            <div className="relative flex flex-col">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-[#D91E2A] text-white flex items-center justify-center ring-4 ring-red-100 animate-pulse">
                <Store className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold text-[#D91E2A]">Packed at Bhopal Warehouse Hub</h3>
                <time className="text-[10px] font-bold text-[#D91E2A]">1:10 PM</time>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                Packing in progress — Items verified with tamper-proof security seal
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-1 rounded w-fit border border-red-200">
                <ShieldCheck className="h-3 w-3" />
                Zone A-4, Chetak Bridge Logistics Yard
              </div>
            </div>

            {/* Step 3: Out for Delivery */}
            <div className="relative flex flex-col opacity-60">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center ring-4 ring-white">
                <Zap className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-neutral-800">Out for Delivery</h3>
                <span className="text-[10px] text-neutral-400">Est. 2:00 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Wondersale Express Rider assigned &amp; departing
              </p>
            </div>

            {/* Step 4: Delivered */}
            <div className="relative flex flex-col opacity-60">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center ring-4 ring-white">
                <MapPin className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-neutral-800">Delivered</h3>
                <span className="text-[10px] text-neutral-400">Est. 4:30 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">Arera Colony, Bhopal 462001</p>
            </div>
          </div>
        </section>

        {/* 4. LIVE DELIVERY PARTNER CARD */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Dedicated Rider
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Vaccinated &amp; Sanitized
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-200 shrink-0 border-2 border-red-200 flex items-center justify-center text-xs font-bold text-neutral-700">
              MS
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-neutral-900 truncate">Mukesh S.</h3>
              <p className="text-[10px] text-neutral-500 truncate">Wondersale Express Partner</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-bold text-neutral-900">4.8 ★</span>
                <span className="text-[10px] text-neutral-400">(1,240 deliveries in Bhopal)</span>
              </div>
            </div>
          </div>

          {/* Rider Actions */}
          <div className="grid grid-cols-2 gap-2 mt-3.5">
            <a
              href="tel:+919826012345"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-all active:scale-95 border border-neutral-200"
            >
              <Phone className="h-3.5 w-3.5 text-[#D91E2A]" />
              Call Rider
            </a>
            <a
              href="https://wa.me/919826012345"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold transition-all active:scale-95 border border-emerald-200"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
              WhatsApp
            </a>
          </div>

          {/* Secure Delivery OTP Box */}
          <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 border-2 border-dashed border-red-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Secure Handover OTP
              </span>
              <span className="text-[10px] text-neutral-600">
                Share only with Mukesh upon delivery
              </span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-2xs">
              <span className="font-mono text-base font-extrabold tracking-widest text-[#D91E2A]">
                4921
              </span>
            </div>
          </div>
        </section>

        {/* 5. ORDER ITEMS SUMMARY */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-[#D91E2A]" />
              Items in Order (2 items)
            </h2>
            <span className="text-[10px] font-semibold text-neutral-400">Invoice #{orderId}</span>
          </div>

          <div className="space-y-3 divide-y divide-neutral-100">
            {/* Item 1 */}
            <div className="flex items-center gap-3 pt-2 first:pt-0">
              <div className="w-12 h-12 rounded-lg bg-neutral-100 p-1 shrink-0 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-[#D91E2A]">
                5L Cooker
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-600">
                    5L
                  </span>
                  <span className="text-[10px] font-medium text-neutral-400">Qty: 1</span>
                </div>
                <h3 className="text-xs font-semibold text-neutral-900 truncate mt-0.5">
                  Prestige Svachh Deluxe Alpha Pressure Cooker
                </h3>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xs font-extrabold text-neutral-900">₹2,199</span>
                  <span className="text-[10px] text-neutral-400 line-through">₹3,450</span>
                </div>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-center gap-3 pt-3">
              <div className="w-12 h-12 rounded-lg bg-neutral-100 p-1 shrink-0 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-[#D91E2A]">
                1.5L Kettle
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-600">
                    1.5L
                  </span>
                  <span className="text-[10px] font-medium text-neutral-400">Qty: 1</span>
                </div>
                <h3 className="text-xs font-semibold text-neutral-900 truncate mt-0.5">
                  Bajaj Majesty KKN Cordless Electric Kettle
                </h3>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xs font-extrabold text-neutral-900">₹849</span>
                  <span className="text-[10px] text-neutral-400 line-through">₹1,299</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="mt-4 pt-3.5 border-t border-neutral-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Items Total (MRP)</span>
              <span className="font-medium text-neutral-900">₹4,749</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Product Discount</span>
              <span className="font-medium">-₹1,701</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span className="flex items-center gap-1">
                Coupon{" "}
                <span className="font-mono font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  WONDER150
                </span>
              </span>
              <span className="font-medium">-₹150</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Bhopal Express 2-Hr Delivery</span>
              <span className="font-bold text-emerald-700">
                FREE{" "}
                <span className="text-[10px] text-neutral-400 line-through font-normal">₹49</span>
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline font-bold">
              <div className="flex flex-col">
                <span className="text-sm text-neutral-900">Total Paid</span>
                <span className="text-[10px] font-normal text-neutral-500">
                  PhonePe UPI (Txn: UPI/6289104821)
                </span>
              </div>
              <span className="text-base text-[#D91E2A] font-black">₹2,898</span>
            </div>
            {/* Green Savings Tag */}
            <div className="mt-2 py-1.5 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center justify-center gap-1.5">
              <span>You saved ₹1,851 on this order!</span>
            </div>
          </div>
        </section>

        {/* 6. DELIVERY ADDRESS CARD */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#D91E2A]" />
              Delivering To
            </h2>
            <span className="text-[10px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              Home
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-900">Rohit Verma</p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
            Flat 302, Green Meadows, E-7 Arera Colony, Bhopal, MP 462001
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500">
            <span>+91 98260 12345</span>
          </div>
        </section>

        {/* 7. POST-PURCHASE ACTIONS & SUPPORT */}
        <section className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              alert("Invoice WS-BHP-8921 downloaded successfully.");
            }}
            className="w-full py-3 px-4 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Download Invoice (PDF)
          </button>
          <Link
            href="/"
            className="w-full py-3 px-4 bg-transparent hover:bg-neutral-100 text-[#D91E2A] border-2 border-[#D91E2A] rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Link>
          <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 text-center">
            <p className="text-[11px] text-neutral-500">Need assistance with your Bhopal order?</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Store className="h-4 w-4 text-[#D91E2A]" />
              <a
                href="tel:07554209999"
                className="text-xs font-bold text-[#D91E2A] hover:underline"
              >
                Wondersale Bhopal Store Desk: 0755-4209999
              </a>
            </div>
            <span className="text-[10px] text-neutral-500 block mt-0.5">
              Available daily (9:00 AM - 10:00 PM)
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-md min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D91E2A] border-t-transparent" />
        </div>
      }
    >
      <OrderConfirmationContent />
    </React.Suspense>
  );
}
