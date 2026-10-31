"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  Mic,
  Camera,
  X,
  AlertCircle,
  User,
} from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export interface GlobalHeaderProps {
  onPincodeChangeClick?: () => void;
  onSearchSubmit?: (query: string) => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  onPincodeChangeClick,
  onSearchSubmit,
}) => {
  const router = useRouter();
  const { cartCount, wishlistCount, location, checkAndApplyPincode, isHydrated } = useStorefront();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [inputPincode, setInputPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearchSubmit) {
        onSearchSubmit(searchQuery.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  const handlePincodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPincode.length !== 6) return;

    setIsSubmitting(true);
    setPincodeError("");
    const res = await checkAndApplyPincode(inputPincode);
    setIsSubmitting(false);

    if (res.success) {
      setShowPincodeModal(false);
      setInputPincode("");
    } else {
      setPincodeError(res.message || "Failed to set delivery location");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FDF8EE] border-b border-[#EADFC7]/80 shadow-xs">
        {/* ======================================================== */}
        {/* DESKTOP VIEWPORT NAVBAR (md:flex, lg, xl - Enhanced)   */}
        <div className="hidden md:block w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12">
          <div className="h-20 flex items-center justify-between gap-8">
            {/* 1. Brand Logo */}
            <WondersaleLogo size="md" />

            {/* 2. Central Extended Search Bar */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-3xl">
              <Search className="w-4 h-4 text-[#D8B4B8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands and appliances..."
                className="w-full h-11 bg-[#5A0A10] text-sm text-[#FDF8EE] placeholder:text-[#C59A9F] rounded-full pl-11 pr-20 border border-[#7A0C16] focus:outline-none focus:ring-2 focus:ring-[#7A0C16] transition-all shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#D8B4B8]">
                <button
                  type="button"
                  aria-label="Voice Search"
                  className="p-1 hover:text-white rounded-md transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Image Lens Search"
                  className="p-1 hover:text-white rounded-md transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* 3. Desktop Navigation Links */}
            <nav className="flex items-center gap-6 text-sm font-semibold text-[#3D2517] shrink-0">
              <Link
                href="/"
                className="hover:text-[#7A0C16] py-1 transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#7A0C16] hover:after:w-full after:transition-all"
              >
                Home
              </Link>
              <Link
                href="/categories"
                className="hover:text-[#7A0C16] py-1 transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#7A0C16] hover:after:w-full after:transition-all"
              >
                Categories
              </Link>
              <Link
                href="/account"
                aria-label="Account"
                title="Account"
                className="p-2 rounded-full hover:bg-[#FAF3E0] text-[#735A4A] hover:text-[#7A0C16] transition-colors flex items-center justify-center"
              >
                <User className="w-5 h-5" />
              </Link>
            </nav>

            {/* 4. Quick Actions (Cart Pill) */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/cart"
                aria-label="Shopping Cart"
                className="group relative flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] transition-all shadow-sm"
              >
                <div className="relative">
                  <ShoppingBag className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                  {isHydrated && cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-400 text-[#5A0A10] text-[10px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-sans">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold">Cart</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE VIEWPORT NAVBAR (< md) - Preserved Mobile-First   */}
        {/* ======================================================== */}
        <div className="md:hidden">
          {/* Top Brand & Actions Cluster */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <WondersaleLogo size="sm" />

            {/* Quick Actions (Account & Cart) */}
            <div className="flex items-center gap-1.5">
              <Link
                href="/account"
                aria-label="Account"
                className="relative p-2 rounded-full hover:bg-[#FAF3E0] text-[#735A4A] hover:text-[#7A0C16] transition-colors"
              >
                <User className="w-5 h-5" />
              </Link>

              <Link
                href="/cart"
                aria-label="Shopping Cart"
                className="relative p-2 rounded-full hover:bg-[#FAF3E0] text-[#735A4A] hover:text-[#7A0C16] transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {isHydrated && cartCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#7A0C16] text-[#FDF8EE] text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Search Bar Component */}
          <div className="px-4 py-2.5 bg-[#FDF8EE] border-b border-[#EADFC7]">
            <form onSubmit={handleSearch} className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-[#D8B4B8] absolute left-3.5 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products across Bhopal..."
                className="w-full bg-[#5A0A10] text-xs rounded-full pl-9 pr-16 py-2.5 text-[#FDF8EE] placeholder:text-[#C59A9F] focus:outline-none focus:ring-1 focus:ring-[#7A0C16] border border-[#7A0C16] transition-all shadow-inner"
              />
              <div className="absolute right-3 flex items-center gap-1 text-[#D8B4B8]">
                <button
                  type="button"
                  aria-label="Voice Search"
                  className="p-1 hover:text-[#D91E2A] transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Image Lens Search"
                  className="p-1 hover:text-[#D91E2A] transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Pincode Modal Bottom Sheet */}
      {showPincodeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Select Delivery Location</h3>
              <button
                onClick={() => setShowPincodeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-2">
              Enter your 6-digit Indian PIN code to check instant 2-hour delivery in Bhopal &
              nationwide shipping.
            </p>

            <form onSubmit={handlePincodeSubmit} className="mt-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={inputPincode}
                  onChange={(e) => {
                    setInputPincode(e.target.value.replace(/\D/g, ""));
                    setPincodeError("");
                  }}
                  placeholder="e.g. 462001"
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D91E2A] focus:ring-1 focus:ring-[#D91E2A]"
                />
              </div>

              {pincodeError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pincodeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={inputPincode.length !== 6 || isSubmitting}
                className="w-full h-11 bg-[#D91E2A] hover:bg-[#B31520] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting ? "Checking Serviceability..." : "Apply PIN Code"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
