"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck, CheckCircle2, Store, ChevronRight } from "lucide-react";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export default function PrivacyPage() {
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
                Compliance
              </span>
            </div>
          </div>
          <a
            href="tel:07554209999"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-800 transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-[#D91E2A]" />
            <span className="text-[11px]">Bhopal Desk</span>
          </a>
        </div>
      </header>

      <main className="flex-1 px-3.5 py-3 space-y-3.5 text-xs text-neutral-700 leading-relaxed">
        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="font-bold text-sm text-neutral-900">DPDP Act 2023 Compliance</h2>
          </div>
          <p>
            Wondersale strictly complies with India&apos;s{" "}
            <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>. We collect only
            necessary customer data required to fulfill orders, process payments, and provide
            delivery tracking updates.
          </p>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-neutral-900">1. Data We Collect</h2>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            <li>
              10-digit mobile phone numbers for OTP authentication and delivery rider communication.
            </li>
            <li>Shipping addresses (Line, City, State, 6-digit Pincode) for route optimization.</li>
            <li>Transactional order records (items, quantities, locked-in paise prices).</li>
          </ul>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-neutral-900">2. Security &amp; Encryption</h2>
          <p>
            Payment transactions are processed through <strong>Razorpay</strong> over 256-bit SSL
            encrypted connections. Wondersale does not store complete card numbers, CVVs, or UPI
            PINs on its local servers.
          </p>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-xs border border-neutral-200 space-y-2">
          <h2 className="font-bold text-sm text-neutral-900">3. Data Grievance Redressal</h2>
          <p>
            To request data deletion or raise privacy concerns, contact our designated Grievance
            Officer at:
          </p>
          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-[11px]">
            <p>
              <strong>Grievance Officer:</strong> Wondersale Legal &amp; Data Protection
            </p>
            <p>
              <strong>Email:</strong> privacy@wondersale.in
            </p>
            <p>
              <strong>Address:</strong> Zone-I, MP Nagar, Bhopal, MP 462011
            </p>
          </div>
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
