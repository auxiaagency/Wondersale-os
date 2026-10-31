"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Settings,
  MapPin,
  Check,
  Edit2,
  Phone,
  Mail,
  ShoppingBag,
  Heart,
  Wallet,
  Zap,
  Building,
  Home,
  CreditCard,
  Award,
  Globe,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useStorefront } from "@/context/StorefrontContext";

export default function AccountPage() {
  const router = useRouter();
  const { location } = useStorefront();

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#2C1810] antialiased flex flex-col justify-between font-sans">
      {/* 1. Desktop Global Header */}
      <div className="hidden md:block">
        <GlobalHeader />
      </div>

      {/* Mobile Top Bar Header */}
      <header className="md:hidden flex flex-col w-full px-4 pt-3 pb-2 sticky top-0 z-40 bg-[#FDF8EE] shadow-xs border-b border-[#EADFC7]">
        <div className="flex items-center justify-between">
          <WondersaleLogo size="sm" showSubtitle={false} />
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              aria-label="Notifications"
              className="relative p-2 rounded-full hover:bg-[#F4ECDC] text-[#735A4A] transition-transform active:scale-95"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-[#7A0C16] text-[10px] font-bold text-[#FDF8EE] leading-none">
                2
              </span>
            </button>
            {/* Settings */}
            <button
              aria-label="Settings"
              className="p-2 rounded-full hover:bg-[#F4ECDC] text-[#735A4A] transition-transform active:scale-95"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <h1 className="font-bold text-lg text-[#2C1810] tracking-tight font-serif">My Account</h1>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#735A4A] bg-[#FAF3E0] px-2.5 py-0.5 rounded-full border border-[#EADFC7]">
            <MapPin className="h-3 w-3 text-[#7A0C16]" />
            <span>Active Account</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT STREAM (Responsive max width on desktop) */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        {/* 2. USER PROFILE SUMMARY CARD */}
        <section className="bg-[#FFFFFF] rounded-3xl p-5 shadow-xs border border-[#EADFC7] relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-[#5A0A10] text-[#FDF8EE] font-bold text-lg flex items-center justify-center border-2 border-[#7A0C16]">
                RV
              </div>
              <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-0.5 rounded-full ring-2 ring-[#FFFFFF] flex items-center justify-center">
                <Check className="h-3 w-3" />
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h2 className="font-bold text-base text-[#2C1810] font-serif truncate">Rohit Verma</h2>
                <button className="text-xs font-semibold text-[#7A0C16] hover:underline flex items-center gap-0.5">
                  Edit <Edit2 className="h-3 w-3" />
                </button>
              </div>

              <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-[#FAF3E0] text-[#7A0C16] rounded-md text-[11px] font-semibold border border-[#EADFC7]">
                <span>Verified Wondersale Member</span>
              </div>

              <div className="mt-2 text-xs text-neutral-500 space-y-0.5 font-normal">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3.5 w-3.5 text-neutral-400" />
                  <span>+91 98260 12345</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="truncate">rohit.verma@example.com</span>
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty Club Tier Progress */}
          <div className="mt-4 pt-3 border-t border-neutral-100 bg-gradient-to-r from-amber-50/50 via-white to-neutral-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500 font-bold text-sm">⭐</span>
                <span className="text-xs font-bold text-neutral-900 tracking-tight">
                  Wondersale Club Gold
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                Saved ₹4,290
              </span>
            </div>
            <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-[#D91E2A] h-full rounded-full"
                style={{ width: "72%" }}
              ></div>
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-neutral-500">
              <span>₹5,710 spent in 2026</span>
              <span className="font-medium text-neutral-800">
                ₹2,290 away from <strong>Platinum Tier</strong>
              </span>
            </div>
          </div>
        </section>

        {/* 3. QUICK ACTION HUB (2x2 Grid) */}
        <section className="grid grid-cols-2 gap-2.5">
          {/* Orders */}
          <Link
            href="/track-order"
            className="bg-white p-3 rounded-lg border border-neutral-200 shadow-2xs flex flex-col justify-between active:scale-98 transition-transform hover:border-neutral-300"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#D91E2A]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="bg-[#D91E2A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                1 In Transit
              </span>
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-xs text-neutral-900">My Orders</div>
              <div className="text-[11px] text-neutral-500">Track shipments &amp; history</div>
            </div>
          </Link>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            className="bg-white p-3 rounded-lg border border-neutral-200 shadow-2xs flex flex-col justify-between active:scale-98 transition-transform hover:border-neutral-300"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-rose-600">
                <Heart className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                4 items
              </span>
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-xs text-neutral-900">Wishlist</div>
              <div className="text-[11px] text-neutral-500">Saved for later</div>
            </div>
          </Link>

          {/* Addresses */}
          <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-2xs flex flex-col justify-between active:scale-98 transition-transform hover:border-neutral-300">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                <Home className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                Default
              </span>
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-xs text-neutral-900 truncate">
                {location.locality || location.city} ({location.pincode})
              </div>
              <div className="text-[11px] text-neutral-500">
                {location.isExpressAvailable
                  ? "Express Doorstep Zone"
                  : "Standard Shipping"}
              </div>
            </div>
          </div>

          {/* Wallet / Coupons */}
          <div className="bg-white p-3 rounded-lg border border-neutral-200 shadow-2xs flex flex-col justify-between active:scale-98 transition-transform hover:border-neutral-300">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                3 Coupons
              </span>
            </div>
            <div className="mt-2.5">
              <div className="font-bold text-xs text-neutral-900">₹350 Credits</div>
              <div className="text-[11px] text-neutral-500">Wondersale Pay Balance</div>
            </div>
          </div>
        </section>

        {/* 4. ACTIVE IN-TRANSIT ORDER CARD */}
        <section className="bg-white rounded-xl p-3.5 border-2 border-red-200 shadow-xs relative">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D91E2A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D91E2A]"></span>
              </span>
              <span className="font-bold text-xs text-neutral-900 tracking-tight">
                Active Delivery
              </span>
              <span className="text-[11px] font-medium text-neutral-500">#WS-ORD-8921</span>
            </div>
            <span className="text-[10px] font-bold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-red-100">
              <Zap className="h-3 w-3 fill-current" /> Express Delivery
            </span>
          </div>

          {/* Description */}
          <div className="py-3">
            <p className="text-xs font-semibold text-neutral-900 truncate">
              Prestige 5L Cooker + Bajaj Electric Kettle
            </p>
            <p className="text-[11px] text-[#D91E2A] font-bold mt-0.5">Expected Today by 4:30 PM</p>
            <p className="text-[10px] text-neutral-500">
              Packed at Wondersale Fulfillment Hub
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="py-1">
            <div className="relative flex items-center justify-between text-center">
              <div className="absolute left-3 right-3 top-2.5 -translate-y-1/2 h-1 bg-neutral-200 z-0">
                <div className="h-full bg-[#D91E2A] rounded-full" style={{ width: "50%" }}></div>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#D91E2A] text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
                <span className="text-[9px] font-semibold text-neutral-900 mt-1">Confirmed</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#D91E2A] text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-red-100">
                  ⚡
                </div>
                <span className="text-[9px] font-bold text-[#D91E2A] mt-1">Packed</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center text-[10px] font-medium">
                  3
                </div>
                <span className="text-[9px] font-medium text-neutral-400 mt-1">On the way</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center text-[10px] font-medium">
                  4
                </div>
                <span className="text-[9px] font-medium text-neutral-400 mt-1">Delivered</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-100">
            <Link
              href="/track-order?orderId=WS-ORD-8921"
              className="flex-1 bg-[#D91E2A] hover:bg-[#B31520] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <span>Track Live Delivery</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* 5. STORE PERKS */}
        <section className="bg-white rounded-xl p-3.5 border border-neutral-200 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center text-[#D91E2A]">
                <Building className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-neutral-900">Retail Member Desk</h3>
                <p className="text-[10px] text-neutral-500">Exclusive Store Privileges</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Online &amp; Store Active
            </span>
          </div>
          <div className="mt-3 bg-neutral-50 rounded-lg p-2.5 text-xs text-neutral-800 space-y-2 border border-neutral-100">
            <div className="flex items-center gap-2 text-[11px]">
              <Zap className="h-3.5 w-3.5 text-[#D91E2A] shrink-0 fill-current" />
              <span>
                Free <strong>Express Delivery</strong> on eligible orders
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <Award className="h-3.5 w-3.5 text-[#D91E2A] shrink-0" />
              <span>
                Exclusive member rewards &amp; instant warranty support
              </span>
            </div>
          </div>
        </section>

        {/* 6. ACCOUNT SETTINGS LIST */}
        <section className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden divide-y divide-neutral-100">
          <div className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Home className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">Saved Addresses</div>
                <div className="text-[10px] text-neutral-500">
                  Manage primary and office delivery addresses
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </div>

          <div className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">
                  Payment Methods &amp; UPI
                </div>
                <div className="text-[10px] text-neutral-500">
                  PhonePe, Google Pay &amp; Cards
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </div>

          <div className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">App Language</div>
                <div className="text-[10px] text-neutral-500">
                  English (हिंदी / Hindi available)
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </div>

          <Link
            href="/shipping"
            className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">
                  Shipping &amp; Delivery Coverage
                </div>
                <div className="text-[10px] text-neutral-500">
                  Express delivery zones &amp; shipping rules
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </Link>

          <Link
            href="/returns"
            className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">
                  Returns &amp; Replacement
                </div>
                <div className="text-[10px] text-neutral-500">
                  7-Day doorstep replacement guarantee
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </Link>

          <a
            href="tel:07554209999"
            className="flex items-center justify-between p-3.5 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-xs font-semibold text-neutral-900">
                  Help &amp; 24/7 Support
                </div>
                <div className="text-[10px] text-neutral-500">Call Support Desk: 0755-4209999</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </a>
        </section>

        {/* LOG OUT BUTTON */}
        <div className="pt-1 pb-4">
          <button
            onClick={() => router.push("/login")}
            className="w-full py-2.5 px-4 rounded-lg border border-red-200 text-[#D91E2A] bg-red-50/50 hover:bg-red-100/50 active:scale-98 transition-all font-semibold text-xs flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out from Account</span>
          </button>
          <p className="text-center text-[10px] text-neutral-400 mt-2">
            Wondersale v4.8.2 • Built with ❤️ for India
          </p>
        </div>
      </main>

      {/* Desktop Footer */}
      <div className="hidden md:block">
        <StorefrontFooter />
      </div>

      {/* 7. DOCKED BOTTOM NAVIGATION */}
      <BottomTabBar />
    </div>
  );
}
