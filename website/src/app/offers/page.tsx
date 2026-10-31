"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Tag,
  Copy,
  Sparkles,
  Percent,
  Gift,
  Clock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";

interface OfferDeal {
  code: string;
  badge: string;
  title: string;
  description: string;
  minOrder: string;
  validity: string;
  categoryLink: string;
  categoryLabel: string;
}

const OFFERS: OfferDeal[] = [
  {
    code: "WONDER150",
    badge: "INSTANT VOUCHER",
    title: "Flat ₹150 OFF on Kitchen Essentials",
    description: "Get flat ₹150 instant discount on pressure cookers, kettles, and mixer grinders.",
    minOrder: "Valid on orders above ₹1,499",
    validity: "Expires tonight at 11:59 PM",
    categoryLink: "/category/kitchen-appliances",
    categoryLabel: "Shop Kitchen Appliances",
  },
  {
    code: "WONDER50",
    badge: "SUPER SAVER",
    title: "Flat ₹50 OFF on Groceries & Snacks",
    description:
      "Instant discount on authentic Bhopal namkeen, dry fruits, and packaged pantry items.",
    minOrder: "Valid on orders above ₹499",
    validity: "Active for Bhopal Pincodes",
    categoryLink: "/category/packaged-food-snacks",
    categoryLabel: "Shop Snacks & Food",
  },
  {
    code: "WONDER10",
    badge: "ELECTRONICS DEAL",
    title: "10% Instant Discount on Audio & Wearables",
    description:
      "Save 10% up to ₹300 on boAt headphones, Bluetooth speakers, and Titan smart timepieces.",
    minOrder: "Valid on orders above ₹999",
    validity: "Limited time festive quota",
    categoryLink: "/category/electronics-audio",
    categoryLabel: "Shop Audio & Gadgets",
  },
  {
    code: "BHOPALEXPRESS",
    badge: "FAST TRACK",
    title: "Free 2-Hour Express Delivery in Bhopal",
    description:
      "Zero express surcharge on same-day 2-hour doorstep deliveries across Bhopal pincodes.",
    minOrder: "Valid on all orders above ₹499",
    validity: "Bhopal Municipal Region",
    categoryLink: "/categories",
    categoryLabel: "Explore All Categories",
  },
];

export default function OffersPage() {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#2C1810] flex flex-col justify-between font-sans">
      <GlobalHeader />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-6 space-y-6">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl bg-[#5A0A10] border border-[#7A0C16] text-[#FDF8EE] p-6 sm:p-8 shadow-md">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20 text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Wondersale Store Vouchers &amp; Promos</span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-4xl leading-tight text-[#FDF8EE]">
              Exclusive Bhopal &amp; Pan-India Offers
            </h1>
            <p className="text-xs sm:text-sm text-[#D8B4B8] font-medium">
              Copy any coupon code below and apply it directly at checkout for instant savings on
              real items.
            </p>
          </div>
        </div>

        {/* Coupon Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFERS.map((offer) => (
            <div
              key={offer.code}
              className="bg-[#FFFFFF] rounded-3xl border border-[#EADFC7] p-5 shadow-xs hover:shadow-md hover:border-[#D5C4A1] transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-[#FAF3E0] text-[#7A0C16] px-2.5 py-0.5 rounded-full border border-[#EADFC7]">
                    {offer.badge}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#735A4A] font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{offer.validity}</span>
                  </div>
                </div>

                <h2 className="font-bold text-base text-[#2C1810] font-serif">{offer.title}</h2>
                <p className="text-xs text-[#4A3428] leading-relaxed">{offer.description}</p>
                <p className="text-[11px] font-semibold text-[#735A4A]">{offer.minOrder}</p>
              </div>

              <div className="pt-3 border-t border-[#EADFC7] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleCopy(offer.code)}
                  className="flex items-center justify-between sm:justify-start gap-2 bg-[#F4ECDC] hover:bg-[#EADFC7] text-[#2C1810] px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer border border-[#EADFC7]"
                >
                  <span className="text-[#7A0C16] font-extrabold">{offer.code}</span>
                  <div className="flex items-center gap-1 text-[#735A4A] text-[11px] font-sans">
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedCode === offer.code ? "Copied! ✓" : "Copy"}</span>
                  </div>
                </button>

                <Link
                  href={offer.categoryLink}
                  className="inline-flex items-center justify-center gap-1 text-xs font-bold text-[#FDF8EE] bg-[#5A0A10] hover:bg-[#7A0C16] px-4 py-2 rounded-xl transition-colors active:scale-95"
                >
                  <span>{offer.categoryLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <StorefrontFooter />
      <BottomTabBar />
    </div>
  );
}
