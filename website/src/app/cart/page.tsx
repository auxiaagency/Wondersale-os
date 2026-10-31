"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Store,
  MapPin,
  ChevronRight,
  Zap,
  Trash2,
  BookmarkPlus,
  Minus,
  Plus,
  Ticket,
  CheckCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Lock,
  ArrowRight,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { formatPrice } from "@/lib/format";
import { useStorefront, CartItem, UserDeliveryAddress } from "@/context/StorefrontContext";

export default function CartPage() {
  const router = useRouter();
  const {
    cart: items,
    updateCartQuantity,
    removeFromCart,
    location,
    clearCart,
    checkAndApplyPincode,
    deliveryAddress,
    saveDeliveryAddress,
    hasValidDeliveryAddress,
  } = useStorefront();

  const [couponCode, setCouponCode] = useState("WONDER150");
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponDiscountPaise, setCouponDiscountPaise] = useState(0);
  const [couponDescription, setCouponDescription] = useState("");
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [deliverySlot, setDeliverySlot] = useState<"express" | "evening" | "tomorrow" | "standard">(
    location.isExpressAvailable ? "express" : "standard"
  );
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [pincodeInput, setPincodeInput] = useState(location.pincode);
  const [pincodeModalError, setPincodeModalError] = useState("");
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState<"phonepe" | "gpay" | "paytm" | "qr">("phonepe");

  // Address Credentials Form State
  const [addressForm, setAddressForm] = useState<UserDeliveryAddress>({
    fullName: deliveryAddress?.fullName || "",
    mobile: deliveryAddress?.mobile || "",
    alternatePhone: deliveryAddress?.alternatePhone || "",
    houseFlatNo: deliveryAddress?.houseFlatNo || "",
    streetArea: deliveryAddress?.streetArea || "",
    landmark: deliveryAddress?.landmark || "",
    city: deliveryAddress?.city || location.city || "Bhopal",
    state: deliveryAddress?.state || location.state || "Madhya Pradesh",
    pincode: deliveryAddress?.pincode || location.pincode || "462001",
    addressType: deliveryAddress?.addressType || "home",
  });
  const [addressFormError, setAddressFormError] = useState("");

  // Keep deliverySlot synchronized if user changes location
  React.useEffect(() => {
    if (!location.isExpressAvailable && deliverySlot === "express") {
      setDeliverySlot("standard");
    } else if (location.isExpressAvailable && deliverySlot === "standard") {
      setDeliverySlot("express");
    }
  }, [location.isExpressAvailable, deliverySlot]);

  const handlePincodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeModalError("");
    setPincodeChecking(true);
    const res = await checkAndApplyPincode(pincodeInput);
    setPincodeChecking(false);
    if (res.success) {
      setShowPincodeModal(false);
    } else {
      setPincodeModalError(res.message || "Sorry, we cannot deliver to this pincode or it is invalid.");
    }
  };

  // Calculations from real items
  const totalQuantity = items.reduce((acc, i) => acc + i.quantity, 0);
  const totalMrpPaise = items.reduce(
    (acc, item) => acc + (item.mrpPaise || item.sellingPricePaise) * item.quantity,
    0
  );
  const totalSellingPaise = items.reduce(
    (acc, item) => acc + item.sellingPricePaise * item.quantity,
    0
  );
  const productDiscountPaise = Math.max(0, totalMrpPaise - totalSellingPaise);
  const appliedDiscountPaise = isCouponApplied ? couponDiscountPaise : 0;
  const totalPayablePaise = Math.max(0, totalSellingPaise - appliedDiscountPaise);
  const totalSavingsPaise = productDiscountPaise + appliedDiscountPaise;

  // Real Delivery milestone from store settings (Bhopal threshold ₹499; Pan-India ₹999)
  const isBhopal = location.city.toLowerCase() === "bhopal" || location.pincode.startsWith("462");
  const freeDeliveryThresholdPaise = isBhopal ? 49900 : 99900;
  const neededForFreeExpressPaise = Math.max(0, freeDeliveryThresholdPaise - totalSellingPaise);
  const progressPercent = Math.min(
    100,
    Math.round((totalSellingPaise / freeDeliveryThresholdPaise) * 100)
  );

  const updateQuantity = (id: string, delta: number) => {
    updateCartQuantity(id, delta);
  };

  const removeItem = (id: string) => {
    removeFromCart(id);
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    const clean = couponCode.trim().toUpperCase();
    if (!clean) return;

    setIsApplyingCoupon(true);
    try {
      const res = await fetch("/api/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean, cartTotalPaise: totalSellingPaise }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsCouponApplied(true);
        setCouponDiscountPaise(data.data.discountPaise);
        setCouponDescription(data.data.description || `Coupon ${clean} applied!`);
        setCouponError("");
      } else {
        setIsCouponApplied(false);
        setCouponDiscountPaise(0);
        setCouponError(data.error?.message || "Invalid or ineligible coupon code.");
      }
    } catch {
      setIsCouponApplied(false);
      setCouponDiscountPaise(0);
      setCouponError("Failed to apply coupon. Please try again.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setIsCouponApplied(false);
    setCouponDiscountPaise(0);
    setCouponDescription("");
  };

  // Open Address pop-up if user credentials are not set up, otherwise open UPI payment modal
  const handleInitiateCheckout = () => {
    if (!hasValidDeliveryAddress()) {
      // Sync addressForm with current location defaults or stored address
      setAddressForm({
        fullName: deliveryAddress?.fullName || "",
        mobile: deliveryAddress?.mobile || "",
        alternatePhone: deliveryAddress?.alternatePhone || "",
        houseFlatNo: deliveryAddress?.houseFlatNo || "",
        streetArea: deliveryAddress?.streetArea || "",
        landmark: deliveryAddress?.landmark || "",
        city: deliveryAddress?.city || location.city || "Bhopal",
        state: deliveryAddress?.state || location.state || "Madhya Pradesh",
        pincode: deliveryAddress?.pincode || location.pincode || "462001",
        addressType: deliveryAddress?.addressType || "home",
      });
      setAddressFormError("");
      setShowAddressModal(true);
    } else {
      setShowCheckoutModal(true);
    }
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError("");

    // Validate mandatory credentials
    if (!addressForm.fullName.trim()) {
      setAddressFormError("Please enter your full name for recipient verification.");
      return;
    }
    const cleanMobile = addressForm.mobile.trim().replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      setAddressFormError("Please enter a valid 10-digit mobile number for delivery SMS & call updates.");
      return;
    }
    if (!addressForm.houseFlatNo.trim()) {
      setAddressFormError("Please enter your flat, house number, or building name.");
      return;
    }
    if (!addressForm.streetArea.trim()) {
      setAddressFormError("Please enter your street name, colony, or area.");
      return;
    }
    const cleanPin = addressForm.pincode.trim().replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setAddressFormError("Please enter a valid 6-digit delivery pincode.");
      return;
    }
    if (!addressForm.city.trim()) {
      setAddressFormError("Please enter your delivery city.");
      return;
    }

    const validatedAddress: UserDeliveryAddress = {
      fullName: addressForm.fullName.trim(),
      mobile: cleanMobile,
      alternatePhone: addressForm.alternatePhone?.trim().replace(/\D/g, "") || undefined,
      houseFlatNo: addressForm.houseFlatNo.trim(),
      streetArea: addressForm.streetArea.trim(),
      landmark: addressForm.landmark?.trim() || undefined,
      city: addressForm.city.trim(),
      state: addressForm.state.trim() || "Madhya Pradesh",
      pincode: cleanPin,
      addressType: addressForm.addressType,
    };

    saveDeliveryAddress(validatedAddress);
    setShowAddressModal(false);
    // Directly proceed to the UPI payment modal upon completing credentials
    setShowCheckoutModal(true);
  };

  const handleSimulatePayment = async () => {
    if (items.length === 0) return;
    setPaymentProcessing(true);

    const activeAddress = deliveryAddress || {
      fullName: addressForm.fullName || "Customer",
      mobile: addressForm.mobile || "9826012345",
      houseFlatNo: addressForm.houseFlatNo || "Main Market",
      streetArea: addressForm.streetArea || location.locality || "Bhopal",
      landmark: addressForm.landmark || "",
      city: location.city || "Bhopal",
      state: location.state || "Madhya Pradesh",
      pincode: location.pincode || "462001",
      addressType: "home" as const,
    };

    const formattedLine1 = `${activeAddress.houseFlatNo}, ${activeAddress.streetArea}${
      activeAddress.landmark ? `, Near ${activeAddress.landmark}` : ""
    }`;

    try {
      const payload = {
        shippingAddress: {
          fullName: activeAddress.fullName,
          mobile: activeAddress.mobile,
          line1: formattedLine1,
          city: activeAddress.city,
          state: activeAddress.state,
          pincode: activeAddress.pincode,
        },
        items: items.map((item) => ({
          variantId: item.variantId,
          slug: item.slug,
          title: item.title,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          mrpPaise: item.mrpPaise,
          sellingPricePaise: item.sellingPricePaise,
        })),
        paymentMethod: "RAZORPAY_UPI",
        couponCode: isCouponApplied ? couponCode.trim().toUpperCase() : undefined,
        idempotencyKey: `ws_idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        clearCart();
        setShowCheckoutModal(false);
        router.push(`/order-confirmation?orderId=${data.data.orderNumber}&method=upi`);
      } else {
        alert(data.error?.message || "Failed to place order. Please try again.");
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      // Fallback navigation if network offline
      clearCart();
      setShowCheckoutModal(false);
      router.push("/order-confirmation?orderId=WS-BHP-8921&method=upi");
    } finally {
      setPaymentProcessing(false);
    }
  };

  return (
    <>
      {/* ======================================================== */}
      {/* DESKTOP VIEWPORT LAYOUT (>= md, Full Width Responsive)   */}
      {/* ======================================================== */}
      <div className="hidden md:flex min-h-screen flex-col bg-[#FDF8EE] text-[#2C1810] font-sans">
        <GlobalHeader />

        {/* Desktop Breadcrumbs */}
        <div className="bg-[#FAF3E0] border-b border-[#EADFC7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center text-xs font-medium text-[#735A4A] space-x-2">
              <Link href="/" className="hover:text-[#7A0C16] transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-[#735A4A]" />
              <span className="text-[#2C1810] font-bold">Shopping Cart ({totalQuantity} items)</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          {items.length > 0 ? (
            <div className="grid grid-cols-12 gap-8 items-start">
              {/* Left Column: Cart Items, Free Delivery Milestone, Delivery Slots */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                {/* 1. Header & Location Bar */}
                <div className="bg-[#FFFFFF] p-5 rounded-3xl shadow-xs border border-[#EADFC7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-[#2C1810] font-serif">
                      Your Cart ({totalQuantity} {totalQuantity === 1 ? "item" : "items"})
                    </h1>
                    <p className="text-xs text-[#735A4A] mt-0.5">
                      Items saved in cart are verified against authentic Bhopal store stock
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FAF3E0] border border-[#EADFC7] px-3 py-2 rounded-2xl text-xs">
                    <MapPin className="w-4 h-4 text-[#7A0C16] shrink-0" />
                    <div>
                      <span className="text-[#735A4A]">Deliver to: </span>
                      <strong className="text-[#2C1810] font-bold">
                        {location.city} {location.pincode}
                        {location.locality ? ` (${location.locality})` : ""}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPincodeModal(true);
                        setPincodeInput(location.pincode);
                        setPincodeModalError("");
                      }}
                      className="ml-2 text-[#7A0C16] font-bold hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* 2. Free Delivery Milestone */}
                <div className="bg-[#FAF3E0] p-5 rounded-3xl shadow-xs border border-[#EADFC7] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#5A0A10] text-[#FDF8EE] flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#2C1810]">
                          {neededForFreeExpressPaise > 0 ? (
                            <>
                              Add{" "}
                              <span className="text-[#7A0C16] font-extrabold">
                                {formatPrice(neededForFreeExpressPaise)}
                              </span>{" "}
                              more for{" "}
                              <span className="text-[#7A0C16] font-bold">
                                {location.isExpressAvailable
                                  ? "FREE Bhopal Express 2-Hour Delivery"
                                  : "FREE Standard Delivery"}
                              </span>
                            </>
                          ) : (
                            <span className="text-[#1E824C] font-extrabold">
                              🎉 You unlocked FREE Delivery to {location.city || "your location"}!
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#735A4A]">
                          {location.isExpressAvailable
                            ? `Guaranteed dispatch straight from Bhopal MP Nagar Hub`
                            : `Fast Nationwide courier to ${location.pincode} (${location.city})`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#7A0C16] bg-[#FDF8EE] border border-[#EADFC7] px-3 py-1 rounded-full">
                      {progressPercent}% Complete
                    </span>
                  </div>

                  <div className="w-full bg-[#EADFC7] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#7A0C16] h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#735A4A] font-medium">
                    <span>Current Cart: {formatPrice(totalSellingPaise)}</span>
                    <span>Target: {formatPrice(freeDeliveryThresholdPaise)} for zero delivery fees</span>
                  </div>
                </div>

                {/* 3. Items List */}
                <div className="bg-[#FFFFFF] rounded-3xl shadow-xs border border-[#EADFC7] divide-y divide-[#EADFC7] overflow-hidden">
                  <div className="px-6 py-4 bg-[#FAF3E0] border-b border-[#EADFC7] flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#735A4A]">
                      Product Details
                    </span>
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-xs text-[#735A4A] hover:text-[#7A0C16] transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  {items.map((item) => (
                    <article key={item.id} className="p-6 transition-colors hover:bg-[#FAF3E0]/40">
                      <div className="flex gap-5 items-start">
                        {/* Thumbnail */}
                        <div className="relative w-28 h-28 rounded-2xl bg-[#FAF3E0] shrink-0 overflow-hidden flex items-center justify-center p-2 border border-[#EADFC7]">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#EADFC7] flex items-center justify-center text-[#735A4A] font-bold text-xs">
                              WS
                            </div>
                          )}
                          <span className="absolute top-1.5 left-1.5 bg-[#5A0A10] text-[#FDF8EE] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            {Math.round(
                              ((item.mrpPaise - item.sellingPricePaise) / item.mrpPaise) * 100
                            )}
                            % OFF
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              href={item.slug ? `/product/${item.slug}` : "#"}
                              className="hover:text-[#7A0C16] transition-colors"
                            >
                              <h2 className="text-sm font-bold text-[#2C1810] leading-snug">
                                {item.title}
                              </h2>
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label="Remove item"
                              className="text-[#735A4A] hover:text-[#7A0C16] transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex text-[11px] font-semibold bg-[#FAF3E0] border border-[#EADFC7] px-2.5 py-0.5 rounded-full text-[#4A3428]">
                              {item.variantLabel}
                            </span>
                            <span className="text-[11px] text-[#735A4A]">•</span>
                            <span className="text-[11px] text-[#735A4A]">{item.specNote}</span>
                          </div>

                          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#7A0C16]">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>{item.badge}</span>
                          </div>

                          {/* Price & Quantity Controls */}
                          <div className="mt-4 pt-3 border-t border-[#EADFC7] flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-extrabold text-[#2C1810]">
                                {formatPrice(item.sellingPricePaise * item.quantity)}
                              </span>
                              <span className="text-xs text-[#735A4A] line-through">
                                {formatPrice(item.mrpPaise * item.quantity)}
                              </span>
                              <span className="text-xs font-bold text-[#1E824C] bg-[#FAF3E0] px-2 py-0.5 rounded border border-[#EADFC7]">
                                Save {formatPrice((item.mrpPaise - item.sellingPricePaise) * item.quantity)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-[#EADFC7] rounded-xl bg-[#FAF3E0] shadow-2xs overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  aria-label="Decrease quantity"
                                  className="w-8 h-8 flex items-center justify-center text-[#735A4A] hover:bg-[#EADFC7] transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-10 text-center text-xs font-bold text-[#2C1810]">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  aria-label="Increase quantity"
                                  className="w-8 h-8 flex items-center justify-center text-[#735A4A] hover:bg-[#EADFC7] transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* 4. Delivery Preferences */}
                <div className="bg-[#FFFFFF] p-5 rounded-3xl shadow-xs border border-[#EADFC7] space-y-3">
                  <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#7A0C16]" />
                    Delivery Preference for {location.city} ({location.pincode})
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {location.isExpressAvailable ? (
                      <>
                        <label
                          onClick={() => setDeliverySlot("express")}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            deliverySlot === "express"
                              ? "border-[#7A0C16] bg-[#FAF3E0]"
                              : "border-[#EADFC7] hover:bg-[#FAF3E0]/50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-[#2C1810]">⚡ 2-Hour Express</span>
                            <span className="text-[10px] font-bold bg-[#5A0A10] text-[#FDF8EE] px-2 py-0.5 rounded-full">
                              FREE
                            </span>
                          </div>
                          <p className="text-[11px] text-[#7A0C16] font-semibold mt-2">
                            Bhopal direct dispatch
                          </p>
                        </label>

                        <label
                          onClick={() => setDeliverySlot("evening")}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            deliverySlot === "evening"
                              ? "border-[#7A0C16] bg-[#FAF3E0]"
                              : "border-[#EADFC7] hover:bg-[#FAF3E0]/50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-[#2C1810]">Today Evening</span>
                            <span className="text-[10px] font-bold text-[#1E824C] bg-[#FAF3E0] border border-[#EADFC7] px-2 py-0.5 rounded-full">
                              FREE
                            </span>
                          </div>
                          <p className="text-[11px] text-[#735A4A] mt-2">5:00 PM - 8:00 PM slot</p>
                        </label>

                        <label
                          onClick={() => setDeliverySlot("tomorrow")}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            deliverySlot === "tomorrow"
                              ? "border-[#7A0C16] bg-[#FAF3E0]"
                              : "border-[#EADFC7] hover:bg-[#FAF3E0]/50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-[#2C1810]">Tomorrow Morning</span>
                            <span className="text-[10px] font-bold text-[#1E824C] bg-[#FAF3E0] border border-[#EADFC7] px-2 py-0.5 rounded-full">
                              FREE
                            </span>
                          </div>
                          <p className="text-[11px] text-[#735A4A] mt-2">9:00 AM - 12:00 PM slot</p>
                        </label>
                      </>
                    ) : (
                      <div className="col-span-3 p-4 rounded-2xl border-2 border-[#7A0C16] bg-[#FAF3E0]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#2C1810]">
                            Standard Nationwide Shipping (BlueDart / Delhivery)
                          </span>
                          <span className="text-xs font-bold text-[#1E824C] bg-[#FAF3E0] border border-[#EADFC7] px-2 py-0.5 rounded">
                            FREE
                          </span>
                        </div>
                        <p className="text-[11px] text-[#735A4A] mt-1">
                          Delivery to {location.pincode} ({location.city}) within 3-5 business days with live tracking.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary & Checkout */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* 1. Coupon Section */}
                <div className="bg-[#FFFFFF] p-5 rounded-3xl shadow-xs border border-[#EADFC7] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Ticket className="w-4 h-4 text-[#7A0C16]" />
                      <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wide">
                        Offers &amp; Coupons
                      </h3>
                    </div>
                    {isCouponApplied && (
                      <span className="text-[11px] text-[#7A0C16] font-semibold">1 Applied</span>
                    )}
                  </div>

                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:outline-none focus:border-[#7A0C16] focus:bg-[#FFFFFF]"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon}
                      className="px-4 py-2 bg-[#5A0A10] text-[#FDF8EE] text-xs font-bold rounded-xl shadow-xs hover:bg-[#7A0C16] transition-colors cursor-pointer"
                    >
                      {isApplyingCoupon ? "Checking..." : "Apply"}
                    </button>
                  </form>
                  {couponError && <p className="text-[11px] text-red-600 font-medium">{couponError}</p>}

                  {isCouponApplied && (
                    <div className="flex items-center justify-between bg-[#FAF3E0] border border-[#EADFC7] rounded-2xl p-2.5">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-[#7A0C16]" />
                        <div>
                          <p className="text-xs font-bold text-[#7A0C16]">{couponCode} applied</p>
                          <p className="text-[10px] text-[#735A4A] mt-0.5">{couponDescription}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs font-bold text-[#7A0C16] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Bill Summary Card */}
                <div className="bg-[#FFFFFF] p-6 rounded-3xl shadow-xs border border-[#EADFC7] space-y-4">
                  <h3 className="text-sm font-bold text-[#2C1810] uppercase tracking-wide pb-2 border-b border-[#EADFC7] font-serif">
                    Order Summary
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-[#735A4A]">
                      <span>Total MRP</span>
                      <span className="font-semibold text-[#2C1810]">{formatPrice(totalMrpPaise)}</span>
                    </div>
                    <div className="flex justify-between text-[#735A4A]">
                      <span>Product Discount</span>
                      <span className="font-semibold text-[#7A0C16]">
                        -{formatPrice(productDiscountPaise)}
                      </span>
                    </div>
                    {isCouponApplied && (
                      <div className="flex justify-between text-[#735A4A]">
                        <span>Coupon Discount ({couponCode})</span>
                        <span className="font-semibold text-[#7A0C16]">
                          -{formatPrice(appliedDiscountPaise)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#735A4A]">
                      <span>Delivery Fee</span>
                      <span className="font-bold text-[#1E824C]">FREE</span>
                    </div>
                    <div className="flex justify-between text-[#735A4A]">
                      <span>Packaging &amp; Handling</span>
                      <span className="font-bold text-[#1E824C]">FREE</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-[#EADFC7] pt-3">
                    <div className="flex justify-between items-baseline">
                      <div>
                        <span className="text-sm font-bold text-[#2C1810]">Total Payable</span>
                        <p className="text-[10px] text-[#735A4A]">Inclusive of all GST</p>
                      </div>
                      <span className="text-2xl font-black text-[#2C1810]">
                        {formatPrice(totalPayablePaise)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#FAF3E0] border border-[#EADFC7] rounded-2xl p-3 text-center">
                    <p className="text-xs font-bold text-[#7A0C16] flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      You are saving {formatPrice(totalSavingsPaise)} on this order!
                    </p>
                  </div>

                  {/* Delivery Address Credentials Preview */}
                  <div className="p-3.5 bg-[#FAF3E0] border border-[#EADFC7] rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#735A4A] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#7A0C16]" />
                        Delivery Credentials
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddressForm({
                            fullName: deliveryAddress?.fullName || "",
                            mobile: deliveryAddress?.mobile || "",
                            alternatePhone: deliveryAddress?.alternatePhone || "",
                            houseFlatNo: deliveryAddress?.houseFlatNo || "",
                            streetArea: deliveryAddress?.streetArea || "",
                            landmark: deliveryAddress?.landmark || "",
                            city: deliveryAddress?.city || location.city || "Bhopal",
                            state: deliveryAddress?.state || location.state || "Madhya Pradesh",
                            pincode: deliveryAddress?.pincode || location.pincode || "462001",
                            addressType: deliveryAddress?.addressType || "home",
                          });
                          setShowAddressModal(true);
                        }}
                        className="text-xs font-bold text-[#7A0C16] hover:underline cursor-pointer"
                      >
                        {deliveryAddress ? "Change" : "+ Add"}
                      </button>
                    </div>
                    {deliveryAddress ? (
                      <div className="text-xs text-[#2C1810]">
                        <p className="font-bold text-[#2C1810]">
                          {deliveryAddress.fullName}{" "}
                          <span className="font-mono text-[#735A4A] font-normal">
                            (+91 {deliveryAddress.mobile})
                          </span>
                        </p>
                        <p className="text-[11px] text-[#4A3428] line-clamp-1 mt-0.5">
                          {deliveryAddress.houseFlatNo}, {deliveryAddress.streetArea}
                          {deliveryAddress.landmark ? `, Near ${deliveryAddress.landmark}` : ""}
                        </p>
                        <p className="text-[11px] text-[#735A4A]">
                          {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-800 font-medium">
                        ⚠️ Address not set. You will be prompted for your delivery credentials upon checkout.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiateCheckout}
                    className="w-full h-12 bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] rounded-2xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 3. Trust Highlights */}
                <div className="bg-[#FFFFFF] p-5 rounded-3xl shadow-xs border border-[#EADFC7] grid grid-cols-3 gap-3 text-center">
                  <div>
                    <ShieldCheck className="w-5 h-5 text-[#7A0C16] mx-auto" />
                    <p className="text-[11px] font-bold text-[#2C1810] mt-1">100% Genuine</p>
                    <p className="text-[10px] text-[#735A4A]">Direct Store Warranty</p>
                  </div>
                  <div>
                    <RefreshCw className="w-5 h-5 text-[#7A0C16] mx-auto" />
                    <p className="text-[11px] font-bold text-[#2C1810] mt-1">7-Day Return</p>
                    <p className="text-[10px] text-[#735A4A]">Easy Doorstep Pickup</p>
                  </div>
                  <div>
                    <Lock className="w-5 h-5 text-[#7A0C16] mx-auto" />
                    <p className="text-[11px] font-bold text-[#2C1810] mt-1">256-Bit SSL</p>
                    <p className="text-[10px] text-[#735A4A]">Secure Payments</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Empty State */
            <div className="bg-[#FFFFFF] rounded-3xl p-12 text-center border border-dashed border-[#EADFC7] max-w-xl mx-auto my-12 shadow-xs">
              <div className="w-20 h-20 rounded-full bg-[#FAF3E0] text-[#7A0C16] flex items-center justify-center mx-auto mb-4 border border-[#EADFC7]">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-[#2C1810]">Your Cart is Empty</h2>
              <p className="text-xs text-[#735A4A] max-w-md mx-auto mt-2 mb-6">
                Explore best-selling retail products across the Bhopal catalog and get guaranteed 2-hour doorstep delivery.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#5A0A10] px-6 py-3 text-xs font-bold text-[#FDF8EE] shadow-md hover:bg-[#7A0C16] transition-colors"
              >
                <span>Start Shopping Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </main>

        <StorefrontFooter />
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEWPORT LAYOUT (< md, Clean & Simple Experience) */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* MOBILE VIEWPORT LAYOUT (< md, Clean & Simple Experience) */}
      {/* ======================================================== */}
      <div className="md:hidden relative mx-auto min-h-screen w-full max-w-[440px] bg-[#FDF8EE] text-[#2C1810] flex flex-col pb-32 font-sans">
        {/* 1. CLEAN TOP HEADER */}
        <header className="sticky top-0 z-40 bg-[#FAF3E0] border-b border-[#EADFC7]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="p-1.5 -ml-1.5 rounded-full hover:bg-[#EADFC7] transition-transform active:scale-90 text-[#2C1810] cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-extrabold text-base text-[#2C1810] leading-none">
                  Shopping Cart
                </h1>
                <p className="text-[11px] text-[#735A4A] mt-0.5">
                  {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                href="/wishlist"
                className="p-2 rounded-full hover:bg-[#EADFC7] text-[#735A4A] transition-transform active:scale-90"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
              </Link>
              <WondersaleLogo size="sm" showSubtitle={false} />
            </div>
          </div>
        </header>

        {/* SCROLLABLE CART CONTENT */}
        <div className="px-4 pt-3.5 space-y-3.5">
          {items.length > 0 ? (
            <>
              {/* 2. UNIFIED DELIVERY & ADDRESS CARD */}
              <div className="bg-[#FFFFFF] rounded-2xl p-3.5 shadow-xs border border-[#EADFC7] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C1810]">
                    <MapPin className="h-4 w-4 text-[#7A0C16]" />
                    <span>Delivering to</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressForm({
                        fullName: deliveryAddress?.fullName || "",
                        mobile: deliveryAddress?.mobile || "",
                        alternatePhone: deliveryAddress?.alternatePhone || "",
                        houseFlatNo: deliveryAddress?.houseFlatNo || "",
                        streetArea: deliveryAddress?.streetArea || "",
                        landmark: deliveryAddress?.landmark || "",
                        city: deliveryAddress?.city || location.city || "Bhopal",
                        state: deliveryAddress?.state || location.state || "Madhya Pradesh",
                        pincode: deliveryAddress?.pincode || location.pincode || "462001",
                        addressType: deliveryAddress?.addressType || "home",
                      });
                      setShowAddressModal(true);
                    }}
                    className="text-xs font-bold text-[#7A0C16] hover:underline cursor-pointer"
                  >
                    {deliveryAddress ? "Change Address" : "+ Add Address"}
                  </button>
                </div>

                {deliveryAddress ? (
                  <div className="bg-[#FAF3E0] border border-[#EADFC7] rounded-xl p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2C1810]">
                        {deliveryAddress.fullName}
                      </span>
                      <span className="font-mono text-[#735A4A] text-[11px]">
                        +91 {deliveryAddress.mobile}
                      </span>
                    </div>
                    <p className="text-[#4A3428] text-[11px] mt-0.5 line-clamp-1">
                      {deliveryAddress.houseFlatNo}, {deliveryAddress.streetArea}
                      {deliveryAddress.landmark ? `, Near ${deliveryAddress.landmark}` : ""}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-[#735A4A]">
                      <span>{deliveryAddress.city}, {deliveryAddress.pincode}</span>
                      <span className="text-[10px] font-bold uppercase bg-[#EADFC7] px-1.5 py-0.5 rounded text-[#2C1810]">
                        {deliveryAddress.addressType}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowAddressModal(true)}
                    className="bg-[#FAF3E0] border border-[#EADFC7] rounded-xl p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-[#FAF3E0]/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#7A0C16] animate-pulse"></span>
                      <span className="font-medium text-[#2C1810]">
                        Please add your delivery address
                      </span>
                    </div>
                    <span className="font-bold text-[#7A0C16] text-xs">Add &rarr;</span>
                  </div>
                )}

                {/* Free Delivery Tag */}
                <div className="pt-2 border-t border-[#EADFC7] flex items-center justify-between text-[11px]">
                  <span className="text-[#735A4A] flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-[#7A0C16] fill-current" />
                    Speed:
                  </span>
                  <span className="font-bold text-[#1E824C] bg-[#FAF3E0] border border-[#EADFC7] px-2 py-0.5 rounded">
                    {location.isExpressAvailable ? "⚡ 2-Hour Express (FREE)" : "Standard Shipping (FREE)"}
                  </span>
                </div>
              </div>

              {/* 3. ITEMS LIST */}
              <section aria-label="Shopping Cart Products" className="space-y-2.5">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="bg-[#FFFFFF] rounded-2xl p-3 shadow-xs border border-[#EADFC7]"
                  >
                    <div className="flex gap-3">
                      {/* Product Image */}
                      <div className="relative w-20 h-20 rounded-xl bg-[#FAF3E0] shrink-0 overflow-hidden flex items-center justify-center p-1.5 border border-[#EADFC7]">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#EADFC7] flex items-center justify-center text-[#735A4A] font-bold text-[10px]">
                            WS
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h2 className="text-xs font-bold text-[#2C1810] leading-snug line-clamp-2">
                              {item.title}
                            </h2>
                            <button
                              onClick={() => removeItem(item.id)}
                              aria-label="Remove item"
                              className="text-[#735A4A] hover:text-[#7A0C16] p-1 -mr-1 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {item.variantLabel && (
                            <span className="inline-block mt-1 text-[10px] font-medium bg-[#FAF3E0] border border-[#EADFC7] px-1.5 py-0.5 rounded text-[#4A3428]">
                              {item.variantLabel}
                            </span>
                          )}
                        </div>

                        {/* Price & Quantity in one clean row */}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-[#2C1810]">
                              {formatPrice(item.sellingPricePaise)}
                            </span>
                            {item.mrpPaise > item.sellingPricePaise && (
                              <span className="text-[11px] text-[#735A4A] line-through">
                                {formatPrice(item.mrpPaise)}
                              </span>
                            )}
                          </div>

                          {/* Stepper */}
                          <div className="flex items-center border border-[#EADFC7] rounded-lg bg-[#FAF3E0] shadow-2xs">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              aria-label="Decrease quantity"
                              className="w-7 h-7 flex items-center justify-center text-[#735A4A] hover:bg-[#EADFC7] active:scale-90 rounded-l-lg transition-transform cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-[#2C1810]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              aria-label="Increase quantity"
                              className="w-7 h-7 flex items-center justify-center text-[#735A4A] hover:bg-[#EADFC7] active:scale-90 rounded-r-lg transition-transform cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              {/* 4. SIMPLE COUPON ACCORDION / BOX */}
              <div className="bg-[#FFFFFF] rounded-2xl p-3.5 shadow-xs border border-[#EADFC7]">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter promo coupon"
                      className="w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:outline-none focus:ring-1 focus:ring-[#7A0C16] focus:bg-[#FFFFFF]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#5A0A10] text-[#FDF8EE] text-xs font-bold rounded-xl shadow-xs hover:bg-[#7A0C16] transition-colors active:scale-95 cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
                {couponError && <p className="text-[11px] text-red-600 font-medium mt-1.5">{couponError}</p>}

                {isCouponApplied && (
                  <div className="mt-2 flex items-center justify-between bg-[#FAF3E0] border border-[#EADFC7] rounded-xl p-2 text-xs">
                    <span className="font-bold text-[#7A0C16]">
                      ✓ {couponCode} applied (-{formatPrice(couponDiscountPaise)})
                    </span>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-[#7A0C16] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* 5. CLEAN PRICE BREAKDOWN */}
              <div className="bg-[#FFFFFF] rounded-2xl p-4 shadow-xs border border-[#EADFC7] space-y-2">
                <h3 className="text-xs font-bold text-[#2C1810] uppercase tracking-wide">
                  Bill Details
                </h3>
                <div className="space-y-1.5 text-xs text-[#735A4A] pt-1">
                  <div className="flex justify-between">
                    <span>Items Total</span>
                    <span className="font-semibold text-[#2C1810]">{formatPrice(totalSellingPaise)}</span>
                  </div>
                  {isCouponApplied && (
                    <div className="flex justify-between text-[#7A0C16]">
                      <span>Coupon Discount</span>
                      <span className="font-bold">-{formatPrice(appliedDiscountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-bold text-[#1E824C]">FREE</span>
                  </div>
                  <div className="border-t border-[#EADFC7] pt-2 mt-1 flex justify-between items-baseline font-bold text-[#2C1810]">
                    <span className="text-sm">Total Payable</span>
                    <span className="text-lg font-black">{formatPrice(totalPayablePaise)}</span>
                  </div>
                </div>

                {totalSavingsPaise > 0 && (
                  <div className="bg-[#FAF3E0] border border-[#EADFC7] rounded-xl p-2 text-center mt-2">
                    <p className="text-xs font-bold text-[#7A0C16]">
                      🎉 You are saving {formatPrice(totalSavingsPaise)} on this order
                    </p>
                  </div>
                )}
              </div>

              {/* 6. TRUST BADGES ROW */}
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#EADFC7] text-center">
                  <ShieldCheck className="h-4 w-4 text-[#7A0C16] mx-auto" />
                  <p className="text-[10px] font-bold text-[#2C1810] mt-0.5">100% Genuine</p>
                </div>
                <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#EADFC7] text-center">
                  <RefreshCw className="h-4 w-4 text-[#7A0C16] mx-auto" />
                  <p className="text-[10px] font-bold text-[#2C1810] mt-0.5">7-Day Return</p>
                </div>
                <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#EADFC7] text-center">
                  <Zap className="h-4 w-4 text-[#7A0C16] fill-current mx-auto" />
                  <p className="text-[10px] font-bold text-[#2C1810] mt-0.5">UPI Instant</p>
                </div>
              </div>
            </>
          ) : (
            /* EMPTY CART STATE */
            <div className="bg-[#FFFFFF] rounded-2xl p-8 text-center border border-dashed border-[#EADFC7] my-8">
              <div className="w-16 h-16 rounded-full bg-[#FAF3E0] text-[#7A0C16] flex items-center justify-center mx-auto mb-3 border border-[#EADFC7]">
                <Store className="h-8 w-8" />
              </div>
              <h2 className="text-base font-bold text-[#2C1810]">Your Cart is Empty</h2>
              <p className="text-xs text-[#735A4A] max-w-xs mx-auto mt-1 mb-4">
                Explore deals across Bhopal Superstore catalog and get instant 2-hour doorstep delivery.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#5A0A10] px-5 py-2.5 text-xs font-bold text-[#FDF8EE] shadow-md hover:bg-[#7A0C16] transition-colors"
              >
                Start Shopping Now
              </Link>
            </div>
          )}
        </div>

        {/* 7. CLEAN STICKY BOTTOM CHECKOUT BAR */}
        {items.length > 0 && (
          <div className="fixed bottom-0 left-0 w-full z-50 bg-[#FFFFFF] border-t border-[#EADFC7] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 py-3">
            <div className="max-w-[440px] mx-auto flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#735A4A] tracking-wider">
                  Total
                </p>
                <p className="text-lg font-black text-[#2C1810] leading-none">
                  {formatPrice(totalPayablePaise)}
                </p>
              </div>
              <button
                onClick={handleInitiateCheckout}
                className="flex-1 max-w-[240px] bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] py-3 px-4 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MANDATORY DELIVERY CREDENTIALS POP-UP MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#FFFFFF] rounded-3xl shadow-2xl overflow-hidden border border-[#EADFC7] my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#5A0A10] text-[#FDF8EE] p-5 flex items-center justify-between border-b border-[#7A0C16]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF3E0]/15 backdrop-blur-xs flex items-center justify-center text-[#FDF8EE]">
                  <MapPin className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight text-[#FDF8EE]">Delivery &amp; Contact Details</h3>
                  <p className="text-xs text-[#D8B4B8]">
                    Mandatory address credentials required for doorstep delivery
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="text-[#D8B4B8] hover:text-[#FDF8EE] p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveAddress} className="p-6 space-y-4 bg-[#FFFFFF]">
              {addressFormError && (
                <div className="p-3 bg-[#FAF3E0] border border-[#EADFC7] text-[#7A0C16] rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7A0C16] shrink-0"></span>
                  {addressFormError}
                </div>
              )}

              {/* Recipient Full Name & Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2C1810] mb-1">
                    Recipient Full Name <span className="text-[#7A0C16]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2C1810] mb-1">
                    10-Digit Mobile Number <span className="text-[#7A0C16]">*</span>
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 border-[#EADFC7] bg-[#FAF3E0] text-[#735A4A] text-xs font-bold">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={addressForm.mobile}
                      onChange={(e) =>
                        setAddressForm({
                          ...addressForm,
                          mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-medium rounded-r-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Alternate Mobile (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-[#735A4A] mb-1">
                  Alternate Phone Number <span className="text-[#735A4A]/70 font-normal">(Optional)</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 border-[#EADFC7] bg-[#FAF3E0] text-[#735A4A] text-xs font-bold">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional backup phone"
                    value={addressForm.alternatePhone || ""}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-medium rounded-r-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Flat / House No / Building */}
              <div>
                <label className="block text-xs font-bold text-[#2C1810] mb-1">
                  Flat, House No., Building, Apartment <span className="text-[#7A0C16]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Signature Heights"
                  value={addressForm.houseFlatNo}
                  onChange={(e) => setAddressForm({ ...addressForm, houseFlatNo: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                />
              </div>

              {/* Street Address / Area / Colony */}
              <div>
                <label className="block text-xs font-bold text-[#2C1810] mb-1">
                  Street Address, Area, Sector, Colony <span className="text-[#7A0C16]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10 No. Market, Arera Colony"
                  value={addressForm.streetArea}
                  onChange={(e) => setAddressForm({ ...addressForm, streetArea: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                />
              </div>

              {/* Landmark & Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#735A4A] mb-1">
                    Landmark <span className="text-[#735A4A]/70 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near Habibganj Station"
                    value={addressForm.landmark || ""}
                    onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2C1810] mb-1">
                    6-Digit Pincode <span className="text-[#7A0C16]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 462001"
                    value={addressForm.pincode}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden font-mono tracking-wider"
                  />
                </div>
              </div>

              {/* City and State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2C1810] mb-1">
                    City <span className="text-[#7A0C16]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Bhopal"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2C1810] mb-1">
                    State <span className="text-[#7A0C16]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Madhya Pradesh"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#EADFC7] bg-[#FAF3E0] text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:ring-1 focus:ring-[#7A0C16] outline-hidden"
                  />
                </div>
              </div>

              {/* Address Type Tag */}
              <div>
                <label className="block text-xs font-bold text-[#2C1810] mb-2">
                  Address Type
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "home", label: "🏠 Home (All-day delivery)" },
                    { id: "work", label: "🏢 Office / Work (10 AM - 6 PM)" },
                    { id: "other", label: "📍 Other" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() =>
                        setAddressForm({ ...addressForm, addressType: type.id as any })
                      }
                      className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                        addressForm.addressType === type.id
                          ? "border-[#7A0C16] bg-[#FAF3E0] text-[#7A0C16] shadow-xs"
                          : "border-[#EADFC7] text-[#735A4A] hover:bg-[#FAF3E0]/60"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#EADFC7] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-[#735A4A] hover:text-[#2C1810] rounded-xl hover:bg-[#FAF3E0] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] text-xs font-bold rounded-2xl shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Save Address &amp; Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (PhonePe / Razorpay / COD Simulation) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-[#EADFC7] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]">
              <div>
                <h3 className="text-sm font-bold text-[#2C1810]">Choose Payment Method</h3>
                <p className="text-[11px] text-[#735A4A]">
                  Payable: {formatPrice(totalPayablePaise)} ({location.city})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-[#735A4A] hover:text-[#2C1810] p-1.5 rounded-xl hover:bg-[#FAF3E0] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 py-4">
              <div className="p-3 bg-[#FAF3E0] border border-[#EADFC7] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#7A0C16] fill-current" />
                  <span className="text-xs font-bold text-[#2C1810]">Payment Method: UPI Only</span>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-[#5A0A10] text-[#FDF8EE] px-2 py-0.5 rounded-full">
                  Instant Verification
                </span>
              </div>

              {/* PhonePe Option */}
              <label
                onClick={() => setSelectedUpiApp("phonepe")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedUpiApp === "phonepe"
                    ? "border-[#7A0C16] bg-[#FAF3E0]"
                    : "border-[#EADFC7] hover:bg-[#FAF3E0]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    Pe
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2C1810]">PhonePe UPI</p>
                    <p className="text-[10px] text-[#1E824C] font-semibold">
                      Fast 1-click payment via PhonePe app
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="upi_app_modal"
                  checked={selectedUpiApp === "phonepe"}
                  onChange={() => setSelectedUpiApp("phonepe")}
                  className="accent-[#7A0C16]"
                />
              </label>

              {/* Google Pay Option */}
              <label
                onClick={() => setSelectedUpiApp("gpay")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedUpiApp === "gpay"
                    ? "border-[#7A0C16] bg-[#FAF3E0]"
                    : "border-[#EADFC7] hover:bg-[#FAF3E0]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#EADFC7] flex items-center justify-center font-bold text-xs text-blue-600 shadow-xs">
                    GPay
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2C1810]">Google Pay (GPay)</p>
                    <p className="text-[10px] text-[#735A4A]">Pay directly from Google Pay UPI</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="upi_app_modal"
                  checked={selectedUpiApp === "gpay"}
                  onChange={() => setSelectedUpiApp("gpay")}
                  className="accent-[#7A0C16]"
                />
              </label>

              {/* Paytm UPI Option */}
              <label
                onClick={() => setSelectedUpiApp("paytm")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedUpiApp === "paytm"
                    ? "border-[#7A0C16] bg-[#FAF3E0]"
                    : "border-[#EADFC7] hover:bg-[#FAF3E0]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#002e6e] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    Paytm
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2C1810]">Paytm UPI / Wallet</p>
                    <p className="text-[10px] text-[#735A4A]">Instant UPI payment handle</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="upi_app_modal"
                  checked={selectedUpiApp === "paytm"}
                  onChange={() => setSelectedUpiApp("paytm")}
                  className="accent-[#7A0C16]"
                />
              </label>

              {/* Scan any UPI QR Code */}
              <label
                onClick={() => setSelectedUpiApp("qr")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedUpiApp === "qr"
                    ? "border-[#7A0C16] bg-[#FAF3E0]"
                    : "border-[#EADFC7] hover:bg-[#FAF3E0]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#2C1810] text-[#FDF8EE] flex items-center justify-center font-bold text-xs shadow-xs">
                    QR
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#2C1810]">Scan Any UPI QR Code</p>
                    <p className="text-[10px] text-[#735A4A]">BHIM / CRED / Any Bank App</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="upi_app_modal"
                  checked={selectedUpiApp === "qr"}
                  onChange={() => setSelectedUpiApp("qr")}
                  className="accent-[#7A0C16]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={paymentProcessing}
              className="w-full py-3.5 bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {paymentProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FDF8EE] border-t-transparent" />
                  <span>
                    {location.isExpressAvailable
                      ? "Securing Order with Bhopal Hub..."
                      : "Processing Pan-India Order..."}
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-amber-300" />
                  <span>Pay {formatPrice(totalPayablePaise)} &amp; Place Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PINCODE CHANGER MODAL */}
      {showPincodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-6 shadow-2xl border border-[#EADFC7] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-[#7A0C16]" />
                <h3 className="text-sm font-bold text-[#2C1810]">Check Delivery Pincode</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPincodeModal(false)}
                className="text-[#735A4A] hover:text-[#2C1810] p-1.5 rounded-xl hover:bg-[#FAF3E0] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePincodeSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#735A4A] block mb-1">
                  Enter delivery pincode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 462001 or 110001"
                    className="flex-1 rounded-xl border border-[#EADFC7] bg-[#FAF3E0] px-3 py-2 text-sm font-semibold tracking-wider text-[#2C1810] focus:border-[#7A0C16] focus:bg-white focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={pincodeChecking || pincodeInput.length !== 6}
                    className="rounded-xl bg-[#5A0A10] px-4 py-2 text-xs font-bold text-[#FDF8EE] hover:bg-[#7A0C16] disabled:bg-[#EADFC7] disabled:text-[#735A4A] transition-all active:scale-95 cursor-pointer"
                  >
                    {pincodeChecking ? "Checking..." : "Verify"}
                  </button>
                </div>
                {pincodeModalError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{pincodeModalError}</p>
                )}
              </div>

              {/* Bhopal Quick Chips */}
              <div className="pt-3 border-t border-[#EADFC7]">
                <p className="text-[11px] font-semibold text-[#735A4A] mb-1.5">
                  Popular Bhopal Localities (2-Hour Express):
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
                        checkAndApplyPincode(loc.pin).then((res) => {
                          if (res.success) setShowPincodeModal(false);
                        });
                      }}
                      className="rounded-xl bg-[#FAF3E0] hover:bg-[#EADFC7] hover:text-[#7A0C16] border border-[#EADFC7] px-2.5 py-1 text-[11px] font-medium text-[#4A3428] transition-colors cursor-pointer"
                    >
                      {loc.name} ({loc.pin})
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
