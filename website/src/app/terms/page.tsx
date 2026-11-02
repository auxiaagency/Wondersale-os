"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, FileText, CheckCircle2, Store, ChevronRight } from "lucide-react";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export default function TermsPage() {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-28 font-sans">
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
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 uppercase tracking-wider">
                Legal
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

      <main className="flex-1 px-3.5 py-3 space-y-3.5 text-xs text-neutral-700 leading-relaxed">
        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-[#680114]">1. Commercial Terms &amp; Scope</h2>
          <p>
            These Terms of Service govern the retail purchase and delivery of products through the
            Wondersale storefront, operated by <strong>Wondersale Retail Private Limited</strong>.
          </p>
          <p>
            By placing an order on Wondersale, you agree to these terms, our Shipping Policy, and
            our Returns &amp; Replacement terms.
          </p>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-[#680114]">2. Pricing, GST &amp; Currency</h2>
          <p>
            All listed prices are strictly in <strong>Indian Rupees (INR)</strong> and computed with{" "}
            <strong>integer paise precision</strong>. All retail product prices are inclusive of
            Goods &amp; Services Tax (GST) as applicable under Indian commercial taxation.
          </p>
          <p>
            A GST-compliant tax invoice with itemized HSN codes is provided with every fulfilled
            shipment.
          </p>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-[#680114]">
            3. Hyperlocal Delivery &amp; Handover
          </h2>
          <p>
            Express 2-Hour Delivery applies to serviceable express pincodes during operational store
            hours (8:00 AM – 8:00 PM). A <strong>secure 4-digit handover OTP</strong> must be
            provided to the delivery rider upon arrival.
          </p>
          <p>
            Cash on Delivery (COD) is permitted for orders up to ₹5,000. For security, orders
            exceeding ₹5,000 must be prepaid via digital gateway (UPI, Cards, Netbanking).
          </p>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-[#680114]">
            4. Jurisdiction &amp; Dispute Resolution
          </h2>
          <p>
            Any disputes arising out of purchases from Wondersale shall be subject to the exclusive
            jurisdiction of the competent courts in <strong>Bhopal, Madhya Pradesh</strong>, India.
          </p>
        </section>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full py-2.5 px-3 bg-[#D91E2A] hover:bg-[#B31520] text-white rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <span>Back to Store</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
