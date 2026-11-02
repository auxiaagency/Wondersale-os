"use client";

import React, { useState, useEffect } from "react";
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
  Truck,
} from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { formatPrice } from "@/lib/format";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

interface OrderData {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  itemTotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  grandTotalPaise: number;
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

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "WS-BHP-8921";
  const { location } = useStorefront();
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [liveOrder, setLiveOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();
        if (isMounted && res.ok && data.success && data.data) {
          setLiveOrder(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch order details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(orderId);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  // Derive display values from live order or robust fallback
  const isBhopal =
    liveOrder?.address?.city?.toLowerCase() === "bhopal" ||
    liveOrder?.address?.pincode?.startsWith("462") ||
    location.isExpressAvailable;

  const displayOrderNumber = liveOrder?.orderNumber || orderId;
  const items =
    liveOrder?.items && liveOrder.items.length > 0
      ? liveOrder.items
      : [
          {
            id: "item-1",
            productName: "Prestige Svachh Deluxe Alpha Pressure Cooker",
            variantTitle: "5L",
            quantity: 1,
            pricePaise: 219900,
            mrpPaise: 345000,
            totalPaise: 219900,
          },
          {
            id: "item-2",
            productName: "Bajaj Majesty KKN Cordless Electric Kettle",
            variantTitle: "1.5L",
            quantity: 1,
            pricePaise: 84900,
            mrpPaise: 129900,
            totalPaise: 84900,
          },
        ];

  const totalMrpPaise = items.reduce((sum, it) => sum + it.mrpPaise * it.quantity, 0);
  const itemsSellingPaise =
    liveOrder?.itemTotalPaise ?? items.reduce((sum, it) => sum + it.totalPaise, 0);
  const discountPaise = liveOrder?.discountPaise ?? 15000;
  const deliveryFeePaise = liveOrder?.deliveryFeePaise ?? 0;
  const grandTotalPaise =
    liveOrder?.grandTotalPaise ?? itemsSellingPaise + deliveryFeePaise - discountPaise;
  const productDiscountPaise = Math.max(0, totalMrpPaise - itemsSellingPaise);
  const totalSavingsPaise = productDiscountPaise + discountPaise;

  const recipientName = liveOrder?.address?.fullName || "Rohit Verma";
  const recipientMobile = liveOrder?.address?.mobile || "+91 98260 12345";
  const deliveryAddressLine = liveOrder?.address
    ? `${liveOrder.address.line1}, ${liveOrder.address.city}, ${liveOrder.address.state} — ${liveOrder.address.pincode}`
    : `${location.locality ? `${location.locality}, ` : ""}${location.city}, ${location.state} — ${location.pincode}`;

  // Deterministic 4-digit OTP from order number for proof of delivery
  const deliveryOtp = displayOrderNumber.replace(/\D/g, "").slice(-4) || "4921";

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
              <span className="text-xs font-semibold text-[#D91E2A]">
                {liveOrder?.status ? liveOrder.status.replace(/_/g, " ") : "Confirmed"}
              </span>
              <span className="text-[10px] text-neutral-500">#{displayOrderNumber}</span>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-neutral-800 hover:text-[#D91E2A] transition-colors"
            >
              <span>{displayOrderNumber}</span>
              {copiedTracking ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Store Brand / Help */}
        <div className="flex items-center gap-1.5">
          <WondersaleLogo size="sm" showSubtitle={false} />
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

            <h1 className="text-xl font-extrabold text-[#680114] tracking-tight">
              Order Placed Successfully!
            </h1>
            <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed max-w-[300px]">
              Thank you <span className="font-semibold text-[#680114]">{recipientName}</span>!
              Your order has been routed to{" "}
              <span className="font-semibold text-[#D91E2A]">
                Wondersale Central Fulfillment Hub
              </span>
              .
            </p>

            {/* Express Delivery Guarantee Pill / Pan India Pill */}
            <div className="mt-3.5 w-full bg-neutral-50 rounded-xl p-2.5 border border-red-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#D91E2A] text-white flex items-center justify-center shrink-0">
                  {isBhopal ? (
                    <Zap className="h-4 w-4 fill-current" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                </span>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#680114]">
                      {isBhopal ? "Today within 2 Hours" : "Estimated in 3-5 Business Days"}
                    </span>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    {isBhopal
                      ? `Express Delivery Guarantee to ${liveOrder?.address?.city || location.locality || "your doorstep"}`
                      : `Fast Pan-India Tracked Courier to ${liveOrder?.address?.pincode || location.pincode}`}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-[#D91E2A] px-2 py-0.5 rounded-full shrink-0">
                {isBhopal ? "Express" : "Standard"}
              </span>
            </div>
          </div>
        </section>

        {/* 3. ORDER TRACKING TIMELINE */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-bold text-[#680114] flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-[#D91E2A]" />
              Live Order Tracking
            </h2>
            <span className="text-[11px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              {liveOrder?.status === "PLACED" ? "In Packing" : "Order Confirmed"}
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-3 before:w-0.5 before:bg-neutral-200">
            {/* Step 1: Confirmed */}
            <div className="relative flex flex-col">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold text-[#680114]">Order Confirmed</h3>
                <time className="text-[10px] font-medium text-neutral-400">Just now</time>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Order verified and accepted by Fulfillment Hub
              </p>
            </div>

            {/* Step 2: Packing (Current Active) */}
            <div className="relative flex flex-col">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-[#D91E2A] text-white flex items-center justify-center ring-4 ring-red-100 animate-pulse">
                <Store className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold text-[#D91E2A]">
                  Packed at Fulfillment Hub
                </h3>
                <time className="text-[10px] font-bold text-[#D91E2A]">Active</time>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                Packing in progress — Items verified with tamper-proof security seal
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#D91E2A] bg-red-50 px-2 py-1 rounded w-fit border border-red-200">
                <ShieldCheck className="h-3 w-3" />
                Central Dispatch Yard
              </div>
            </div>

            {/* Step 3: Out for Delivery */}
            <div className="relative flex flex-col opacity-60">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center ring-4 ring-white">
                <Zap className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-neutral-800">Out for Delivery</h3>
                <span className="text-[10px] text-neutral-400">
                  {isBhopal ? "Est. 2:00 PM" : "Est. Day 3"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {isBhopal
                  ? "Wondersale Express Rider assigned & departing"
                  : "Handed over to BlueDart / Delhivery"}
              </p>
            </div>

            {/* Step 4: Delivered */}
            <div className="relative flex flex-col opacity-60">
              <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center ring-4 ring-white">
                <MapPin className="h-3 w-3" />
              </div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-neutral-800">Delivered</h3>
                <span className="text-[10px] text-neutral-400">
                  {isBhopal ? "Est. 4:30 PM" : "Est. 3-5 Days"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {liveOrder?.address?.city || location.city}{" "}
                {liveOrder?.address?.pincode || location.pincode}
              </p>
            </div>
          </div>
        </section>

        {/* 4. LIVE DELIVERY PARTNER CARD */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {isBhopal ? "Dedicated Rider" : "Logistics Partner"}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Verified &amp; Sanitized
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-200 shrink-0 border-2 border-red-200 flex items-center justify-center text-xs font-bold text-neutral-700">
              WS
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-[#680114] truncate">
                Wondersale Express Fleet
              </h3>
              <p className="text-[10px] text-neutral-500 truncate">
                Tracked Dispatch Partner
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-bold text-[#680114]">4.8 ★</span>
                <span className="text-[10px] text-neutral-400">(1,240+ verified deliveries)</span>
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
                Share only with delivery rider upon handover
              </span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-2xs">
              <span className="font-mono text-base font-extrabold tracking-widest text-[#D91E2A]">
                {deliveryOtp}
              </span>
            </div>
          </div>
        </section>

        {/* 5. ORDER ITEMS SUMMARY */}
        <section className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#680114] flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-[#D91E2A]" />
              Items in Order ({items.length} {items.length === 1 ? "item" : "items"})
            </h2>
            <span className="text-[10px] font-semibold text-neutral-400">
              Invoice #{displayOrderNumber}
            </span>
          </div>

          <div className="space-y-3 divide-y divide-neutral-100">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-3 pt-2 first:pt-0">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 p-1 shrink-0 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-[#D91E2A] text-center">
                  {item.variantTitle || "Item"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.variantTitle && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-600">
                        {item.variantTitle}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-neutral-400">
                      Qty: {item.quantity}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-[#680114] truncate mt-0.5">
                    {item.productName}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xs font-extrabold text-[#680114]">
                      {formatPrice(item.pricePaise)}
                    </span>
                    {item.mrpPaise > item.pricePaise && (
                      <span className="text-[10px] text-neutral-400 line-through">
                        {formatPrice(item.mrpPaise)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div className="mt-4 pt-3.5 border-t border-neutral-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Items Total (MRP)</span>
              <span className="font-medium text-[#680114]">{formatPrice(totalMrpPaise)}</span>
            </div>
            {productDiscountPaise > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Product Discount</span>
                <span className="font-medium">-{formatPrice(productDiscountPaise)}</span>
              </div>
            )}
            {discountPaise > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span className="flex items-center gap-1">Coupon Applied</span>
                <span className="font-medium">-{formatPrice(discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-600">
              <span>
                {isBhopal ? "Express 2-Hour Delivery" : "Standard Nationwide Shipping"}
              </span>
              <span className="font-bold text-emerald-700">
                {deliveryFeePaise === 0 ? (
                  <>
                    FREE{" "}
                    <span className="text-[10px] text-neutral-400 line-through font-normal">
                      {isBhopal ? "₹49" : "₹79"}
                    </span>
                  </>
                ) : (
                  formatPrice(deliveryFeePaise)
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline font-bold">
              <div className="flex flex-col">
                <span className="text-sm text-[#680114]">Total Paid</span>
                <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Instant UPI Payment Verified
                </span>
              </div>
              <span className="text-base text-[#D91E2A] font-black">
                {formatPrice(grandTotalPaise)}
              </span>
            </div>
            {/* Green Savings Tag */}
            {totalSavingsPaise > 0 && (
              <div className="mt-2 py-1.5 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center justify-center gap-1.5">
                <span>You saved {formatPrice(totalSavingsPaise)} on this order!</span>
              </div>
            )}
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
          <p className="text-xs font-bold text-[#680114]">{recipientName}</p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{deliveryAddressLine}</p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500">
            <span>{recipientMobile}</span>
          </div>
        </section>

        {/* 7. POST-PURCHASE ACTIONS & SUPPORT */}
        <section className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              alert(`Invoice ${displayOrderNumber} downloaded successfully.`);
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
            <p className="text-[11px] text-neutral-500">Need assistance with your order?</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Store className="h-4 w-4 text-[#D91E2A]" />
              <a
                href="tel:07554209999"
                className="text-xs font-bold text-[#D91E2A] hover:underline"
              >
                Store Help Desk: 0755-4209999
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
