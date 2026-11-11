"use client";

import React, { useState, useEffect } from "react";
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
  X,
  User as UserIcon,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useStorefront } from "@/context/StorefrontContext";

export default function AccountPage() {
  const router = useRouter();
  const { location } = useStorefront();

  // User Profile State with LocalStorage persistence
  const [profile, setProfile] = useState({
    name: "Rohit Verma",
    phone: "9826012345",
    email: "rohit.verma@example.com",
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("wondersale_user");
        if (stored) {
          const u = JSON.parse(stored);
          setProfile((prev) => ({
            name: u.name || prev.name,
            phone: u.mobile || u.phone || prev.phone,
            email: u.email || prev.email,
          }));
        }
      } catch (err) {
        console.error("Failed to read user from localStorage", err);
      }
    }
  }, []);

  const handleOpenEditModal = () => {
    setFormName(profile.name);
    setFormPhone(profile.phone);
    setFormEmail(profile.email);
    setErrorMsg("");
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setErrorMsg("");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanPhone = formPhone.replace(/\D/g, "");
    const cleanEmail = formEmail.trim();

    if (!cleanName) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    const updated = {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    };

    setProfile(updated);

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("wondersale_user");
        const existing = stored ? JSON.parse(stored) : {};
        const merged = { ...existing, ...updated, mobile: cleanPhone };
        localStorage.setItem("wondersale_user", JSON.stringify(merged));
        window.dispatchEvent(new Event("wondersale_auth_change"));
      } catch (err) {
        console.error("Failed to persist user profile", err);
      }
    }

    setIsEditModalOpen(false);
    setSuccessToast("Profile updated successfully!");
    setTimeout(() => setSuccessToast(""), 3000);
  };

  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "WS";

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] antialiased flex flex-col justify-between font-sans selection:bg-[#680114]/20 selection:text-[#680114]">
      {/* 1. Global Header (Identical across Home, Product, Account, Cart) */}
      <GlobalHeader />

      {/* Breadcrumb Strip */}
      <div className="bg-[#F6E9C8] border-b-2 border-[#680114]/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm font-serif font-bold text-[#680114] whitespace-nowrap overflow-x-auto no-scrollbar">
            <Link href="/" className="hover:text-[#88091E] flex items-center transition-colors shrink-0">
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 text-[#680114]" />
            <span className="text-[#680114] font-extrabold shrink-0">My Account</span>
          </nav>
        </div>
      </div>

      {/* MAIN CONTENT STREAM */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-5 pb-24 space-y-4">
        {/* 2. USER PROFILE SUMMARY CARD */}
        <section className="bg-[#EFE0BC] rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-xs border-2 border-[#680114] relative overflow-hidden">
          <div className="flex items-start gap-3.5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#680114] text-[#F6E9C8] font-bold font-serif text-lg flex items-center justify-center border-2 border-[#680114] shadow-xs">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-700 text-[#F6E9C8] p-0.5 rounded-full ring-2 ring-[#EFE0BC] flex items-center justify-center">
                <Check className="h-3 w-3" />
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h2 className="font-serif font-extrabold text-base sm:text-lg text-[#680114] truncate">
                  {profile.name}
                </h2>
                <button
                  onClick={handleOpenEditModal}
                  className="text-xs font-serif font-bold text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] px-2.5 py-1 rounded-lg border border-[#680114]/40 bg-[#F6E9C8] flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <span>Edit</span>
                  <Edit2 className="h-2.5 w-2.5" />
                </button>
              </div>

              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#F6E9C8] text-[#680114] rounded-md text-[10px] sm:text-[11px] font-serif font-bold border border-[#680114]/30 shadow-2xs">
                <span>Verified Wondersale Member</span>
              </div>

              <div className="mt-2 text-xs text-[#680114]/85 space-y-0.5 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3.5 w-3.5 text-[#680114] shrink-0" />
                  <span>+91 {profile.phone}</span>
                </div>
                {profile.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 text-[#680114] shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Loyalty Club Tier Progress */}
          <div className="mt-4 pt-3 border-t-2 border-[#680114]/20 bg-[#F6E9C8] rounded-xl p-3 border border-[#680114]/30">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[#680114] font-bold text-sm">⭐</span>
                <span className="text-xs font-serif font-extrabold text-[#680114] tracking-tight">
                  Wondersale Club Gold
                </span>
              </div>
              <span className="text-[11px] font-serif font-bold text-[#F6E9C8] bg-[#680114] px-2 py-0.5 rounded-full shadow-2xs">
                Saved ₹4,290
              </span>
            </div>
            <div className="w-full bg-[#EFE0BC] h-2 rounded-full overflow-hidden border border-[#680114]/30">
              <div
                className="bg-[#680114] h-full rounded-full"
                style={{ width: "72%" }}
              ></div>
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-[#680114]/80 font-medium">
              <span>₹5,710 spent in 2026</span>
              <span className="font-serif font-bold text-[#680114]">
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
            className="bg-[#EFE0BC] p-3 sm:p-3.5 rounded-2xl border-2 border-[#680114] shadow-xs flex flex-col justify-between active:scale-95 transition-all hover:bg-[#E8D7B0]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#680114] flex items-center justify-center text-[#F6E9C8] shadow-2xs">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="bg-[#680114] text-[#F6E9C8] text-[9px] sm:text-[10px] font-serif font-bold px-2 py-0.5 rounded-full shadow-2xs">
                1 In Transit
              </span>
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#680114]">My Orders</div>
              <div className="text-[11px] text-[#680114]/80 font-medium">Track shipments &amp; history</div>
            </div>
          </Link>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            className="bg-[#EFE0BC] p-3 sm:p-3.5 rounded-2xl border-2 border-[#680114] shadow-xs flex flex-col justify-between active:scale-95 transition-all hover:bg-[#E8D7B0]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#680114] flex items-center justify-center text-[#F6E9C8] shadow-2xs">
                <Heart className="h-4 w-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-serif font-bold text-[#680114] bg-[#F6E9C8] border border-[#680114]/30 px-2 py-0.5 rounded-full shadow-2xs">
                4 items
              </span>
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#680114]">Wishlist</div>
              <div className="text-[11px] text-[#680114]/80 font-medium">Saved for later</div>
            </div>
          </Link>

          {/* Addresses */}
          <div className="bg-[#EFE0BC] p-3 sm:p-3.5 rounded-2xl border-2 border-[#680114] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#680114] flex items-center justify-center text-[#F6E9C8] shadow-2xs">
                <Home className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-serif font-bold text-[#680114] bg-[#F6E9C8] border border-[#680114]/30 px-1.5 py-0.5 rounded shadow-2xs">
                Default
              </span>
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#680114] truncate">
                {location.locality || location.city} ({location.pincode})
              </div>
              <div className="text-[11px] text-[#680114]/80 font-medium">
                {location.isExpressAvailable
                  ? "Express Doorstep Zone"
                  : "Standard Shipping"}
              </div>
            </div>
          </div>

          {/* Wallet / Credits */}
          <div className="bg-[#EFE0BC] p-3 sm:p-3.5 rounded-2xl border-2 border-[#680114] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#680114] flex items-center justify-center text-[#F6E9C8] shadow-2xs">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-serif font-bold text-[#680114] bg-[#F6E9C8] border border-[#680114]/30 px-1.5 py-0.5 rounded shadow-2xs">
                3 Coupons
              </span>
            </div>
            <div className="mt-3">
              <div className="font-serif font-bold text-xs sm:text-sm text-[#680114]">₹350 Credits</div>
              <div className="text-[11px] text-[#680114]/80 font-medium">Wondersale Pay Balance</div>
            </div>
          </div>
        </section>

        {/* 4. ACTIVE IN-TRANSIT ORDER CARD */}
        <section className="bg-[#EFE0BC] rounded-2xl p-4 border-2 border-[#680114] shadow-xs relative">
          <div className="flex items-center justify-between pb-2.5 border-b-2 border-[#680114]/20">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#680114] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#680114]"></span>
              </span>
              <span className="font-serif font-bold text-xs sm:text-sm text-[#680114] tracking-tight">
                Active Delivery
              </span>
              <span className="text-[11px] font-medium text-[#680114]/80">#WS-ORD-8921</span>
            </div>
            <span className="text-[10px] font-serif font-bold text-[#F6E9C8] bg-[#680114] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs">
              <Zap className="h-3 w-3 fill-current" /> Express
            </span>
          </div>

          {/* Description */}
          <div className="py-3">
            <p className="text-xs sm:text-sm font-serif font-bold text-[#680114] truncate">
              Prestige 5L Cooker + Bajaj Electric Kettle
            </p>
            <p className="text-[11px] text-[#680114] font-bold mt-0.5">Expected Today by 4:30 PM</p>
            <p className="text-[10px] text-[#680114]/80 font-medium">
              Packed at Wondersale Fulfillment Hub
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="py-1">
            <div className="relative flex items-center justify-between text-center">
              <div className="absolute left-3 right-3 top-2.5 -translate-y-1/2 h-1 bg-[#F6E9C8] border border-[#680114]/30 z-0">
                <div className="h-full bg-[#680114] rounded-full" style={{ width: "50%" }}></div>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#680114] text-[#F6E9C8] flex items-center justify-center text-[10px] font-bold border border-[#680114]">
                  ✓
                </div>
                <span className="text-[9px] font-bold text-[#680114] mt-1">Confirmed</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#680114] text-[#F6E9C8] flex items-center justify-center text-[10px] font-bold ring-2 ring-[#680114]/30 border border-[#680114]">
                  ⚡
                </div>
                <span className="text-[9px] font-bold text-[#680114] mt-1">Packed</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#F6E9C8] text-[#680114] border border-[#680114]/50 flex items-center justify-center text-[10px] font-bold">
                  3
                </div>
                <span className="text-[9px] font-medium text-[#680114]/75 mt-1">On the way</span>
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#F6E9C8] text-[#680114] border border-[#680114]/50 flex items-center justify-center text-[10px] font-bold">
                  4
                </div>
                <span className="text-[9px] font-medium text-[#680114]/75 mt-1">Delivered</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t-2 border-[#680114]/20">
            <Link
              href="/track-order?orderId=WS-ORD-8921"
              className="flex-1 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] py-2 px-3 rounded-xl text-xs font-serif font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <span>Track Live Delivery</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* 5. STORE PERKS */}
        <section className="bg-[#EFE0BC] rounded-2xl p-4 border-2 border-[#680114] shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#680114] flex items-center justify-center text-[#F6E9C8] shadow-2xs">
                <Building className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xs sm:text-sm text-[#680114]">Retail Member Desk</h3>
                <p className="text-[10px] text-[#680114]/80 font-medium">Exclusive Store Privileges</p>
              </div>
            </div>
            <span className="text-[10px] font-serif font-bold text-[#680114] bg-[#F6E9C8] px-2.5 py-0.5 rounded-full border border-[#680114]/40 shadow-2xs">
              Store Active
            </span>
          </div>
          <div className="mt-3 bg-[#F6E9C8] rounded-xl p-3 text-xs text-[#680114] space-y-2 border border-[#680114]/30">
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <Zap className="h-3.5 w-3.5 text-[#680114] shrink-0 fill-current" />
              <span>
                Free <strong>Express Delivery</strong> on eligible store orders
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <Award className="h-3.5 w-3.5 text-[#680114] shrink-0" />
              <span>
                Exclusive member rewards &amp; instant warranty support
              </span>
            </div>
          </div>
        </section>

        {/* 6. ACCOUNT SETTINGS LIST */}
        <section className="bg-[#EFE0BC] rounded-2xl border-2 border-[#680114] shadow-xs overflow-hidden divide-y-2 divide-[#680114]/20">
          <div className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Home className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">Saved Addresses</div>
                <div className="text-[10px] text-[#680114]/80 font-medium">
                  Manage primary and office delivery addresses
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </div>

          <div className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">
                  Payment Methods &amp; UPI
                </div>
                <div className="text-[10px] text-[#680114]/80 font-medium">
                  PhonePe, Google Pay &amp; Cards
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </div>

          <div className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">App Language</div>
                <div className="text-[10px] text-[#680114]/80 font-medium">
                  English (हिंदी / Hindi available)
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </div>

          <Link
            href="/shipping"
            className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">
                  Shipping &amp; Delivery Coverage
                </div>
                <div className="text-[10px] text-[#680114]/80 font-medium">
                  Express delivery zones &amp; shipping rules
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </Link>

          <Link
            href="/returns"
            className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">
                  Returns &amp; Replacement
                </div>
                <div className="text-[10px] text-[#680114]/80 font-medium">
                  7-Day doorstep replacement guarantee
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </Link>

          <a
            href="tel:07554209999"
            className="flex items-center justify-between p-3.5 hover:bg-[#E8D7B0] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-[#680114]" />
              <div>
                <div className="text-xs font-serif font-bold text-[#680114]">
                  Help &amp; 24/7 Support
                </div>
                <div className="text-[10px] text-[#680114]/80 font-medium">Call Support Desk: 0755-4209999</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#680114]" />
          </a>
        </section>

        {/* LOG OUT BUTTON */}
        <div className="pt-2 pb-4">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("wondersale_token");
                localStorage.removeItem("token");
                localStorage.removeItem("wondersale_user");
                window.dispatchEvent(new Event("wondersale_auth_change"));
              }
              router.push("/login");
            }}
            className="w-full py-3 px-4 rounded-xl border-2 border-[#680114] text-[#F6E9C8] bg-[#680114] hover:bg-[#88091E] active:scale-95 transition-all font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out from Account</span>
          </button>
          <p className="text-center text-[10px] font-medium text-[#680114]/80 mt-2.5">
            Wondersale Superstore • Bhopal &amp; Online Pan-India
          </p>
        </div>
      </main>

      {/* SUCCESS TOAST NOTIFICATION */}
      {successToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#680114] text-[#F6E9C8] px-4 py-2.5 rounded-xl border-2 border-[#EFE0BC] shadow-lg flex items-center gap-2 text-xs font-serif font-bold animate-in fade-in slide-in-from-bottom duration-200">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* EDIT PROFILE MODAL POPUP */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-md bg-[#EFE0BC] border-2 border-[#680114] rounded-3xl p-5 sm:p-7 shadow-2xl text-[#680114] animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b-2 border-[#680114]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#680114] text-[#F6E9C8] flex items-center justify-center shadow-2xs">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="edit-profile-title" className="text-base font-serif font-extrabold text-[#680114] leading-tight">
                    Edit Profile Details
                  </h3>
                  <p className="text-[11px] text-[#680114]/80 font-medium">
                    Update your account name and contacts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                aria-label="Close edit profile dialog"
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F6E9C8] border-2 border-[#680114] text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
              {/* Full Name Field */}
              <div>
                <label className="text-xs font-serif font-bold text-[#680114] block mb-1.5">
                  Full Name <span className="text-red-700">*</span>
                </label>
                <div className="flex items-center bg-[#F6E9C8] border-2 border-[#680114] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#680114]">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#680114] placeholder-[#680114]/40 focus:outline-none border-none ring-0 p-0"
                    autoFocus
                  />
                </div>
              </div>

              {/* Mobile Phone Field */}
              <div>
                <label className="text-xs font-serif font-bold text-[#680114] block mb-1.5">
                  Mobile Number <span className="text-red-700">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-2 bg-[#F6E9C8] border-2 border-[#680114] rounded-xl text-xs font-serif font-bold text-[#680114] shrink-0">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <div className="flex-1 flex items-center bg-[#F6E9C8] border-2 border-[#680114] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#680114]">
                    <input
                      type="tel"
                      maxLength={10}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="10-digit number"
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#680114] placeholder-[#680114]/40 focus:outline-none border-none ring-0 p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Email Address Field */}
              <div>
                <label className="text-xs font-serif font-bold text-[#680114] block mb-1.5">
                  Email Address <span className="text-[10px] text-[#680114]/70 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center bg-[#F6E9C8] border-2 border-[#680114] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#680114]">
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="yourname@example.com"
                    className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#680114] placeholder-[#680114]/40 focus:outline-none border-none ring-0 p-0"
                  />
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="text-[11px] font-semibold text-[#88091E] bg-[#F6E9C8] border border-[#88091E]/30 rounded-lg p-2 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 py-2.5 px-4 bg-[#F6E9C8] hover:bg-[#E8D7B0] border-2 border-[#680114] text-[#680114] font-serif font-bold text-xs rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] border-2 border-[#680114] font-serif font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Footer */}
      <div className="hidden md:block">
        <StorefrontFooter />
      </div>

      {/* 7. DOCKED BOTTOM NAVIGATION */}
      <BottomTabBar />
    </div>
  );
}
