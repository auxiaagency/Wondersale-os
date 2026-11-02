"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  QrCode,
  Phone,
  MessageCircle,
  Clock,
  MapPin,
  Check,
  Zap,
  ShoppingBag,
  Download,
  AlertCircle,
  Store,
  Lock,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { formatPrice } from "@/lib/format";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

interface TrackedOrder {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  itemTotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  grandTotalPaise: number;
  createdAt: string;
  address: {
    fullName: string;
    mobile: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: {
    id: string;
    productName: string;
    variantTitle: string;
    quantity: number;
    pricePaise: number;
    mrpPaise: number;
    totalPaise: number;
  }[];
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get("orderId") || "WS-20261016-6870";
  const { location } = useStorefront();

  const [orderInput, setOrderInput] = useState(initialOrderId);
  const [activeOrder, setActiveOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchOrderDetails = async (orderId: string) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const cleanId = orderId.trim();
      const res = await fetch(`/api/orders/${cleanId}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setActiveOrder(data.data);
      } else {
        setErrorMessage(
          data.error?.message || "Order not found. Showing latest verified shipment."
        );
        setActiveOrder(null);
      }
    } catch {
      setErrorMessage("Could not connect to tracking server. Showing offline details.");
      setActiveOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails(initialOrderId);
  }, [initialOrderId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderInput.trim()) return;
    router.push(`/track-order?orderId=${encodeURIComponent(orderInput.trim())}`);
    fetchOrderDetails(orderInput.trim());
  };

  const isBhopal =
    activeOrder?.address?.city?.toLowerCase() === "bhopal" ||
    activeOrder?.address?.pincode?.startsWith("462") ||
    location.isExpressAvailable;

  const displayOrderNumber = activeOrder?.orderNumber || orderInput || "WS-20261016-6870";
  const deliveryOtp = displayOrderNumber.replace(/\D/g, "").slice(-4) || "4921";

  // Fallback demo items if order not in local dev DB
  const items =
    activeOrder?.items && activeOrder.items.length > 0
      ? activeOrder.items
      : [
          {
            id: "item-1",
            productName: "Prestige Svachh Deluxe Alpha Stainless Steel 5L",
            variantTitle: "5L Pressure Cooker",
            quantity: 1,
            pricePaise: 219900,
            mrpPaise: 345000,
            totalPaise: 219900,
          },
          {
            id: "item-2",
            productName: "Bajaj Majesty KKN 1.5L Cordless Electric Kettle",
            variantTitle: "1.5L Kettle",
            quantity: 1,
            pricePaise: 84900,
            mrpPaise: 129900,
            totalPaise: 84900,
          },
        ];

  const totalMrpPaise = items.reduce((sum, it) => sum + it.mrpPaise * it.quantity, 0);
  const itemsSellingPaise =
    activeOrder?.itemTotalPaise ?? items.reduce((sum, it) => sum + it.totalPaise, 0);
  const discountPaise = activeOrder?.discountPaise ?? 15000;
  const deliveryFeePaise = activeOrder?.deliveryFeePaise ?? 0;
  const grandTotalPaise =
    activeOrder?.grandTotalPaise ?? itemsSellingPaise + deliveryFeePaise - discountPaise;

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-neutral-50 shadow-2xl flex flex-col pb-28 font-sans">
      {/* 1. STICKY MOBILE HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/account"
              aria-label="Back to Account"
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-800 hover:bg-neutral-100 transition-colors active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <WondersaleLogo size="sm" showSubtitle={false} />
            </div>
          </div>

          <a
            href="tel:07554209999"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-800 transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-[#D91E2A]" />
            <span className="text-[11px]">24x7 Help</span>
          </a>
        </div>

        {/* Live Status Sub-strip */}
        <div className="mt-2.5 pt-2 flex items-center justify-between border-t border-neutral-100 text-xs">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>
              {activeOrder?.status
                ? `Status: ${activeOrder.status.replace(/_/g, " ")}`
                : "Live Status: Out for Delivery"}
            </span>
          </div>
          <span className="text-[10px] font-medium text-neutral-500">
            Fulfillment Hub Dispatch
          </span>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 px-3.5 py-3 space-y-3.5">
        {/* Quick Shipment Switcher Card */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100">
            <span className="text-xs font-semibold text-neutral-600">Quick Shipment Switcher</span>
            <span className="text-[10px] font-bold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded border border-red-100">
              {isBhopal ? "Express 2-Hour Delivery" : "Pan-India Courier"}
            </span>
          </div>

          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Order Tracking ID
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  placeholder="e.g. WS-20261016-6870"
                  className="w-full bg-neutral-50 text-[#680114] text-xs font-semibold pl-3 pr-16 py-2 rounded-lg border border-neutral-300 focus:outline-hidden focus:border-[#D91E2A]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-1 px-3 py-1 bg-[#D91E2A] hover:bg-[#B31520] text-white text-[11px] font-bold rounded-md transition-all active:scale-95"
                >
                  {loading ? "..." : "Track"}
                </button>
              </div>
            </div>
          </form>

          {errorMessage && (
            <p className="mt-2 text-[11px] font-medium text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </section>

        {/* Live Status Summary & Route Map Card */}
        <section className="bg-white rounded-xl overflow-hidden shadow-xs border border-neutral-200">
          <div className="p-3.5 bg-gradient-to-r from-[#D91E2A] to-[#B31520] text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-red-100 font-bold">
                  Estimated Arrival
                </p>
                <h2 className="text-xl font-black tracking-tight mt-0.5">
                  {isBhopal ? "Today by 4:15 PM" : "In 3-5 Business Days"}
                </h2>
                <p className="text-xs font-medium text-red-50 flex items-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {isBhopal
                      ? "Rider Mukesh is ~1.4 km away (Est. 18 mins away)"
                      : "Shipment in transit via Central Logistics"}
                  </span>
                </p>
              </div>
              <div className="bg-white/20 rounded-lg px-2.5 py-1.5 backdrop-blur-md text-right border border-white/20">
                <div className="text-[9px] uppercase font-bold text-red-100">Destination</div>
                <div className="text-xs font-bold text-white truncate max-w-[110px]">
                  {activeOrder?.address?.city || location.locality || "Your City"}
                </div>
              </div>
            </div>
          </div>

          {/* Styled SVG Route Map */}
          <div className="relative bg-neutral-100 p-3">
            <div className="w-full h-32 bg-white rounded-lg border border-neutral-200 relative overflow-hidden flex flex-col justify-between p-3 shadow-inner">
              <svg
                className="absolute inset-0 w-full h-full stroke-neutral-200 fill-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line strokeWidth="6" x1="0" x2="400" y1="35" y2="35" />
                <line
                  className="stroke-neutral-300"
                  strokeDasharray="8 6"
                  strokeWidth="8"
                  x1="0"
                  x2="400"
                  y1="85"
                  y2="85"
                />
                <path
                  className="opacity-75"
                  d="M 30 90 Q 180 20 360 40"
                  stroke="#d91e2a"
                  strokeDasharray="6 4"
                  strokeWidth="4"
                />
              </svg>

              <div className="relative z-10 flex justify-between items-start text-[10px]">
                <div className="bg-white/90 backdrop-blur px-2 py-0.5 rounded shadow-xs border border-neutral-200 font-semibold text-neutral-800">
                  <span className="w-2 h-2 rounded-full bg-[#D91E2A] inline-block mr-1"></span>
                  <span>Fulfillment Hub</span>
                </div>
                <div className="bg-white/90 backdrop-blur px-2 py-0.5 rounded shadow-xs border border-neutral-200 font-semibold text-neutral-800">
                  <MapPin className="h-3 w-3 text-[#D91E2A] inline-block mr-0.5" />
                  <span>{activeOrder?.address?.line1 || "Customer Address"}</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-center my-auto">
                <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-md border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-[#D91E2A] animate-ping"></span>
                  <span className="text-xs font-bold text-[#680114] flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-[#D91E2A] fill-current" />
                    <span>
                      {isBhopal ? "Express Rider on Route" : "In Flight with Courier"}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 rounded">
                    {isBhopal ? "1.4 km left" : "On Schedule"}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex justify-between items-end text-[10px] text-neutral-500 font-medium">
                <span>Via Link Road No. 1</span>
                <span className="bg-red-50 text-[#D91E2A] font-bold px-1.5 py-0.5 rounded">
                  Traffic: Clear
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Dedicated Delivery Partner & Secure OTP Card */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full bg-neutral-200 border-2 border-red-200 flex items-center justify-center font-bold text-xs text-neutral-700">
                {isBhopal ? "MS" : "WS"}
                <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white p-0.5 rounded-full border border-white">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-[#680114]">
                    {isBhopal ? "Mukesh S." : "Wondersale Express Fleet"}
                  </h3>
                  <span className="text-[9px] font-bold bg-red-50 text-[#D91E2A] px-1.5 py-0.2 rounded border border-red-100">
                    Express Partner
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                  <span className="text-amber-600 font-bold">
                    ★ 4.8 <span className="font-normal text-neutral-400">(1,240 deliveries)</span>
                  </span>
                  <span>•</span>
                  <span>EV: MP-04-ZY-8841</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href="tel:+919826012345"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs rounded-lg transition-colors border border-neutral-200 active:scale-95"
            >
              <Phone className="h-3.5 w-3.5 text-[#D91E2A]" />
              <span>Call Rider</span>
            </a>
            <a
              href="https://wa.me/919826012345"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg transition-colors border border-emerald-200 active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Secure Handover OTP Box */}
          <div className="bg-red-50/60 rounded-lg p-2.5 border border-red-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-xs font-bold text-[#680114]">
                <Lock className="h-3.5 w-3.5 text-[#D91E2A]" />
                <span>Handover Delivery OTP</span>
              </div>
              <p className="text-[10px] text-neutral-500">
                Share this 4-digit code ONLY when package arrives
              </p>
            </div>
            <div className="bg-white px-3 py-1 rounded-md shadow-2xs border border-red-200">
              <span className="font-mono text-base font-black tracking-widest text-[#D91E2A]">
                {deliveryOtp}
              </span>
            </div>
          </div>
        </section>

        {/* Detailed Timeline */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#680114]">
              Timeline &amp; Milestones
            </h3>
            <span className="text-[10px] font-semibold text-neutral-400">
              #{displayOrderNumber}
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-3 before:w-0.5 before:bg-neutral-200">
            <div className="relative">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-[#680114]">Order Placed</span>
                <span className="text-[10px] text-neutral-400">01:15 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Payment via PhonePe UPI Verified
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-[#680114]">
                  Order Confirmed &amp; Packed
                </span>
                <span className="text-[10px] text-neutral-400">01:30 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Packed at Central Fulfillment Hub
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-[#680114]">Dispatched with Rider</span>
                <span className="text-[10px] text-neutral-400">01:50 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Handed to Mukesh S. via EV Scooter MP-04-ZY-8841
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-[#D91E2A] text-white flex items-center justify-center animate-pulse">
                <Zap className="h-3 w-3 fill-current" />
              </div>
              <div className="bg-red-50 p-2.5 rounded-lg border border-red-200">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[#D91E2A]">Out for Delivery</span>
                  <span className="text-[10px] font-bold text-[#D91E2A]">Active</span>
                </div>
                <p className="text-[11px] text-neutral-800 mt-0.5">
                  Moving along Chetak Bridge to Arera Colony
                </p>
              </div>
            </div>

            <div className="relative opacity-60">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center">
                <MapPin className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-neutral-800">Delivered</span>
                <span className="text-[10px] text-neutral-400">Est. 4:15 PM</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Handover OTP required upon arrival: <strong>{deliveryOtp}</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Item Summary Card */}
        <section className="bg-white rounded-xl p-3.5 shadow-xs border border-neutral-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-100">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-[#D91E2A]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#680114]">
                Items in Delivery ({items.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-[#D91E2A]">#{displayOrderNumber}</span>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 p-1 shrink-0 flex items-center justify-center text-[10px] font-bold text-[#D91E2A] text-center">
                  {item.variantTitle || "Item"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#680114] truncate">
                    {item.productName}
                  </h4>
                  <p className="text-[10px] text-neutral-500">Qty: {item.quantity}</p>
                  <div className="text-xs font-bold text-[#680114] mt-0.5">
                    {formatPrice(item.pricePaise)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3.5 pt-3 border-t border-neutral-100 text-xs space-y-1.5">
            <div className="flex justify-between text-neutral-600">
              <span>Items Total (MRP)</span>
              <span>{formatPrice(totalMrpPaise)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Savings &amp; Coupons</span>
              <span>
                -{formatPrice(discountPaise + Math.max(0, totalMrpPaise - itemsSellingPaise))}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200 font-bold text-sm text-[#680114]">
              <span>Total Paid</span>
              <span className="text-base text-[#D91E2A] font-black">
                {formatPrice(grandTotalPaise)}
              </span>
            </div>
          </div>
        </section>

        {/* Support & Actions */}
        <section className="space-y-2 pt-1">
          <Link
            href="/order-confirmation"
            className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 border border-neutral-200 transition-all"
          >
            <Download className="h-4 w-4 text-[#D91E2A]" />
            <span>Download Invoice (PDF)</span>
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

export default function TrackOrderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-md min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D91E2A] border-t-transparent" />
        </div>
      }
    >
      <TrackOrderContent />
    </React.Suspense>
  );
}
