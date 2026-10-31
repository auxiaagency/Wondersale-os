"use client";

import React from "react";
import Link from "next/link";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { ProductCard } from "@/components/ui/ProductCard";
import {
  Fan,
  Utensils,
  Headphones,
  Coffee,
  Gamepad2,
  Cookie,
  Clock,
  Glasses,
  Zap,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  Flame,
  ArrowRight,
  Copy,
  Tag,
} from "lucide-react";

const CATEGORIES = [
  { name: "Home Appliances", slug: "home-appliances", icon: Fan },
  { name: "Kitchen", slug: "kitchen-appliances", icon: Utensils },
  { name: "Electronics", slug: "electronics-audio", icon: Headphones },
  { name: "Crockery", slug: "crockery-kitchenware", icon: Coffee },
  { name: "Toys", slug: "toys-games", icon: Gamepad2 },
  { name: "Snacks", slug: "packaged-food-snacks", icon: Cookie },
  { name: "Clocks", slug: "clocks-timepieces", icon: Clock },
  { name: "Sunglasses", slug: "sunglasses-accessories", icon: Glasses },
];

const BEST_SELLERS = [
  {
    id: "prod-boat-450",
    title: "boAt Rockerz 450 Bluetooth On-Ear Headphones with Mic",
    mrpPaise: 249900,
    sellingPricePaise: 129900,
    rating: 4.2,
    ratingCount: 2180,
  },
  {
    id: "prod-philips-750",
    title: "Philips HL7756/00 750W Mixer Grinder (3 Jars)",
    mrpPaise: 529500,
    sellingPricePaise: 329900,
    rating: 4.4,
    ratingCount: 5412,
  },
  {
    id: "prod-milton-flask",
    title: "Milton Thermosteel Flip Lid Flask 1000ml (24h Hot & Cold)",
    mrpPaise: 129900,
    sellingPricePaise: 84900,
    rating: 4.5,
    ratingCount: 1890,
  },
  {
    id: "prod-ajanta-clock",
    title: "Ajanta Quartz Luxury Wall Clock (Silent Sweep)",
    mrpPaise: 99900,
    sellingPricePaise: 49900,
    rating: 4.3,
    ratingCount: 920,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* 1. Global Header Shell */}
      <GlobalHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 space-y-6">
        {/* 2. Department Category Bubble Carousel */}
        <section aria-label="Departments">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Explore Departments
            </h2>
            <Link
              href="/categories"
              className="text-[#D91E2A] text-xs font-bold hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-3 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex flex-col items-center flex-shrink-0 w-16 group"
                >
                  <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs group-hover:border-[#D91E2A] group-hover:shadow-sm group-active:scale-95 transition-all">
                    <Icon className="w-6 h-6 text-[#D91E2A]" />
                  </div>
                  <span className="text-[11px] font-medium text-center text-slate-800 mt-1.5 leading-tight line-clamp-1 group-hover:text-[#D91E2A]">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 3. Hero Promotional Festive Banner */}
        <section aria-label="Festive Promotion">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#D91E2A] via-[#B31520] to-[#8E0E17] text-white p-5 sm:p-8 shadow-md">
            <div className="relative z-10 max-w-xl space-y-2.5">
              <span className="inline-block bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/30 text-amber-200">
                BHOPAL FESTIVE DHAMAKA
              </span>
              <h1 className="font-sans font-black text-xl sm:text-3xl leading-tight">
                Up to 60% Off on Kitchen & Home Appliances
              </h1>
              <p className="text-xs sm:text-sm font-medium text-red-100 flex items-center gap-1">
                <span>
                  ⚡ Express 2-Hour Delivery across Bhopal | Free Delivery Pan-India on ₹999+
                </span>
              </p>
              <div className="pt-2">
                <Link
                  href="/category/kitchen-appliances"
                  className="inline-flex items-center gap-1 bg-white text-[#D91E2A] hover:bg-slate-100 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <span>Shop Offers</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Local Trust & Service Ribbon */}
        <section aria-label="Trust and Highlights">
          <div className="bg-white rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 shadow-2xs border border-slate-200 text-center">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 p-1">
              <Zap className="w-5 h-5 text-[#D91E2A] flex-shrink-0" />
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                  Express Bhopal
                </span>
                <span className="text-[10px] text-slate-500">Within 2 hrs</span>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2.5 p-1 border-t sm:border-t-0 sm:border-l border-slate-100">
              <ShieldCheck className="w-5 h-5 text-[#D91E2A] flex-shrink-0" />
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                  100% Genuine
                </span>
                <span className="text-[10px] text-slate-500">Store Warranty</span>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2.5 p-1 border-t sm:border-t-0 sm:border-l border-slate-100">
              <RefreshCw className="w-5 h-5 text-[#D91E2A] flex-shrink-0" />
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                  7-Day Return
                </span>
                <span className="text-[10px] text-slate-500">Hassle Free</span>
              </div>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2.5 p-1 border-t sm:border-t-0 sm:border-l border-slate-100">
              <CreditCard className="w-5 h-5 text-[#D91E2A] flex-shrink-0" />
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                  UPI & COD
                </span>
                <span className="text-[10px] text-slate-500">Zero Extra Fee</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Section: Best Sellers in Bhopal */}
        <section aria-label="Bestsellers in Bhopal" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                Best Sellers in Bhopal
              </h2>
              <p className="text-xs text-slate-500">
                Top rated retail items with same-day delivery
              </p>
            </div>
            <div className="flex items-center gap-1 bg-red-50 text-[#D91E2A] border border-red-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>Deal of the Day</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {BEST_SELLERS.map((item) => (
              <ProductCard
                key={item.id}
                id={item.id}
                title={item.title}
                mrpPaise={item.mrpPaise}
                sellingPricePaise={item.sellingPricePaise}
                rating={item.rating}
                ratingCount={item.ratingCount}
                variant="grid"
              />
            ))}
          </div>
        </section>

        {/* 6. Spotlight Offers & Clearance Deals Banner */}
        <section aria-label="Clearance Voucher">
          <div className="rounded-xl bg-white border-2 border-dashed border-red-200 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#D91E2A] flex-shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900">Clearance Corner</span>
                  <span className="bg-[#D91E2A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    LIMITED TIME
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Flat <strong className="text-[#D91E2A]">₹200 OFF</strong> on orders above ₹1,499
                  with coupon
                </p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs font-mono font-bold text-[#D91E2A]">
                  <span>WONDER200</span>
                  <Copy className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-[#D91E2A]" />
                </div>
              </div>
            </div>

            <Link
              href="/offers"
              className="w-full sm:w-auto text-center bg-[#D91E2A] hover:bg-[#B31520] text-white text-xs font-bold px-4 py-2.5 rounded-lg active:scale-95 transition-all"
            >
              Claim Offer
            </Link>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <StorefrontFooter />

      {/* Sticky Bottom Navigation Bar (Mobile Viewports) */}
      <BottomTabBar />
    </div>
  );
}
