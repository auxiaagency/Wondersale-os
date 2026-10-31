"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Store,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export default function ReturnsPolicyPage() {
  const [activeTab, setActiveTab] = useState<"replacement" | "refund" | "process">("replacement");

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
                Guaranteed
              </span>
            </div>
          </div>

          <a
            href="tel:07554209999"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-800 transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-[#D91E2A]" />
            <span className="text-[11px]">Helpdesk</span>
          </a>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 px-3.5 py-3 space-y-3.5">
        {/* Hero Assurance Banner */}
        <section className="bg-gradient-to-r from-[#D91E2A] to-[#B31520] text-white rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-100">
              100% Peace of Mind
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight">7-Day Doorstep Replacement</h2>
          <p className="text-xs text-red-50 mt-1 leading-relaxed">
            Received a damaged, defective, or incorrect product? Get an instant doorstep replacement
            verified by our local Bhopal rider fleet or free courier pickup.
          </p>
        </section>

        {/* Category Eligibility Matrix */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-2.5">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-900">
            Category Replacement Window
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <div>
                <span className="font-bold text-neutral-900 block">
                  Kitchen &amp; Home Appliances
                </span>
                <span className="text-[10px] text-neutral-500">
                  Cookers, Kettles, Irons, Mixers
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                7 Days Replacement
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <div>
                <span className="font-bold text-neutral-900 block">Electronics &amp; Audio</span>
                <span className="text-[10px] text-neutral-500">
                  Headphones, Wall Clocks, Gadgets
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                7 Days Replacement
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <div>
                <span className="font-bold text-neutral-900 block">Toys &amp; Games</span>
                <span className="text-[10px] text-neutral-500">Educational Toys, Board Games</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                7 Days Replacement
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <div>
                <span className="font-bold text-neutral-900 block">Packaged Food &amp; Snacks</span>
                <span className="text-[10px] text-neutral-500">Hygiene &amp; Consumables</span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Damage on Arrival Only
              </span>
            </div>
          </div>
        </section>

        {/* 3 Step Return Process */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-900 mb-3">
            How It Works (3 Simple Steps)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 text-[#D91E2A] flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <strong className="text-neutral-900 block">Initiate via App or Helpline</strong>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Go to{" "}
                  <Link href="/account" className="text-[#D91E2A] font-semibold underline">
                    Account &gt; My Orders
                  </Link>{" "}
                  or dial 0755-4209999 with your order number.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 text-[#D91E2A] flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div>
                <strong className="text-neutral-900 block">Quick Doorstep Verification</strong>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Our rider verifies the original box, brand MRP tags, and intact manufacturer
                  accessories.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 text-[#D91E2A] flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <strong className="text-neutral-900 block">Instant Swap or Refund</strong>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Fresh unit handed over immediately, or UPI refund credited to your source account
                  within 24–48 hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* In-Store Swap at Chetak Bridge */}
        <section className="bg-red-50/50 rounded-xl p-3 border border-red-200 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-[#D91E2A]" />
            <strong className="text-neutral-900">Prefer Instant In-Store Exchange?</strong>
          </div>
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Walk into our retail store at{" "}
            <strong>Zone-I, MP Nagar, Bhopal (Near Chetak Bridge)</strong> with your tax invoice for
            an immediate on-the-spot replacement or store credit.
          </p>
        </section>

        {/* Contact CTA */}
        <section className="space-y-2 pt-1">
          <Link
            href="/track-order"
            className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 border border-neutral-200 transition-all"
          >
            <span>Track Existing Order</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="w-full py-2.5 px-3 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <span>Continue Shopping</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <BottomTabBar />
    </div>
  );
}
