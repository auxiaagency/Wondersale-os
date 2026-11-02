"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Store,
  Phone,
  HelpCircle,
  ChevronRight,
  Package,
} from "lucide-react";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useStorefront } from "@/context/StorefrontContext";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export default function ShippingPolicyPage() {
  const { location, checkAndApplyPincode } = useStorefront();
  const [pincodeInput, setPincodeInput] = useState(location.pincode);
  const [checking, setChecking] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleCheckPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pincodeInput.length !== 6) return;
    setChecking(true);
    setResultMessage(null);

    const res = await checkAndApplyPincode(pincodeInput);
    setChecking(false);
    if (res.success) {
      setResultMessage(
        pincodeInput.startsWith("462")
          ? `✓ Verified! Pincode ${pincodeInput} is eligible for 2-Hour Express Delivery.`
          : `✓ Verified! Pincode ${pincodeInput} is covered under Pan-India Standard Tracked Courier.`
      );
    } else {
      setResultMessage(res.message || "Pincode check failed.");
    }
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-28 font-sans">
      {/* 1. STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              aria-label="Back to Home"
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-800 hover:bg-neutral-100 transition-colors active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <WondersaleLogo size="sm" showSubtitle={false} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-[#D91E2A] uppercase tracking-wider">
                Policy
              </span>
            </div>
          </div>

          <a
            href="tel:07554209999"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-800 transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-[#D91E2A]" />
            <span className="text-[11px]">Help Desk</span>
          </a>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 px-3.5 py-3 space-y-3.5">
        {/* Pincode Estimator Card */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-[#D91E2A]" />
            <h2 className="text-xs font-bold text-[#680114]">
              Check Delivery Speed in Your Area
            </h2>
          </div>
          <p className="text-[11px] text-neutral-500 mb-2.5">
            Enter your 6-digit postal pincode to see express speed, delivery slots, and thresholds.
          </p>

          <form onSubmit={handleCheckPincode} className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={pincodeInput}
              onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 462001 or 110001"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold tracking-wider text-[#680114] focus:outline-hidden focus:border-[#D91E2A]"
            />
            <button
              type="submit"
              disabled={checking || pincodeInput.length !== 6}
              className="rounded-lg bg-[#D91E2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#B31520] disabled:bg-neutral-300 transition-all active:scale-95"
            >
              {checking ? "Checking..." : "Verify"}
            </button>
          </form>

          {resultMessage && (
            <p className="mt-2 text-[11px] font-medium text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
              {resultMessage}
            </p>
          )}

          {/* Quick Chips */}
          <div className="mt-3 pt-2.5 border-t border-neutral-100">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Popular Localities (2-Hr Express):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "Arera Colony", pin: "462001" },
                { name: "MP Nagar", pin: "462011" },
                { name: "Kolar Road", pin: "462042" },
                { name: "TT Nagar", pin: "462003" },
              ].map((loc) => (
                <button
                  key={loc.pin}
                  type="button"
                  onClick={() => {
                    setPincodeInput(loc.pin);
                    checkAndApplyPincode(loc.pin);
                  }}
                  className="rounded-md bg-neutral-100 hover:bg-red-50 hover:text-[#D91E2A] hover:border-red-200 border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 transition-colors"
                >
                  {loc.name} ({loc.pin})
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 3 Delivery Tiers */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider px-1">
            Delivery Methods &amp; Fulfillment
          </h2>

          {/* Tier 1: Express 2-Hour */}
          <div className="bg-white rounded-xl p-3.5 shadow-xs border-2 border-red-200 relative">
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-[#D91E2A] text-white flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                </div>
                <h3 className="text-xs font-bold text-[#680114]">Hyperlocal 2-Hour Express</h3>
              </div>
              <span className="text-[10px] font-bold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                Express Zone
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
              Rapid doorstep dispatch from Wondersale Fulfillment Hub for orders
              placed between 8:00 AM – 8:00 PM. Tamper-evident seal verified.
            </p>
          </div>

          {/* Tier 2: Same-Day Evening */}
          <div className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold text-[#680114]">Scheduled Evening Delivery</h3>
              </div>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                6:00 PM – 9:00 PM
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
              Order before 4:00 PM for scheduled evening delivery straight to your residential
              doorstep across serviceable zones.
            </p>
          </div>

          {/* Tier 3: Pan-India Standard */}
          <div className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold text-[#680114]">Standard Pan-India Shipping</h3>
              </div>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                3–5 Business Days
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
              Tracked air and surface logistics across 19,000+ Indian postal codes via BlueDart,
              Delhivery, and Express courier partners.
            </p>
          </div>
        </section>

        {/* Free Delivery Thresholds Breakdown */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <h2 className="text-xs font-bold text-[#680114] mb-2">Free Delivery Thresholds</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 text-center">
              <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                Express Zone
              </span>
              <span className="font-extrabold text-sm text-[#D91E2A] mt-0.5 block">FREE ₹499+</span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                ₹49 on smaller orders
              </span>
            </div>
            <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 text-center">
              <span className="text-[10px] font-bold text-neutral-500 uppercase block">
                Rest of India
              </span>
              <span className="font-extrabold text-sm text-[#D91E2A] mt-0.5 block">FREE ₹999+</span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                ₹79 on smaller orders
              </span>
            </div>
          </div>
        </section>

        {/* Security & COD Policies */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-2.5 text-xs text-neutral-600">
          <h2 className="font-bold text-xs text-[#680114]">Order Security &amp; Payment Rules</h2>
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#D91E2A] shrink-0 mt-0.5" />
            <p>
              <strong>Cash on Delivery (COD):</strong> Supported up to ₹5,000 cart total. Riders
              carry dynamic QR code scanners for instant PhonePe/GPay UPI on delivery.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong>Tamper-Proof Seal:</strong> All parcels are sealed with Wondersale security
              tape. Do not accept packages with broken or tampered seals.
            </p>
          </div>
        </section>

        {/* Help & Navigation */}
        <section className="space-y-2 pt-1">
          <Link
            href="/"
            className="w-full py-3 px-4 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <span>Explore Deals &amp; Shop Now</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 text-center">
            <p className="text-[11px] text-neutral-500">Need specific shipping assistance?</p>
            <a
              href="tel:07554209999"
              className="text-xs font-bold text-[#D91E2A] hover:underline block mt-0.5"
            >
              Wondersale Helpdesk: 0755-4209999
            </a>
          </div>
        </section>
      </main>

      <BottomTabBar />
    </div>
  );
}
