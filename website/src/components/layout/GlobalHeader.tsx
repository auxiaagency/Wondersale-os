"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  Mic,
  X,
  AlertCircle,
  User,
  SlidersHorizontal,
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
  const { cartCount, wishlistCount, location, checkAndApplyPincode, isHydrated, toggleCategoryMenu } = useStorefront();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [inputPincode, setInputPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Formatted Cart Count (e.g. 0, 5, 99, 99+)
  const displayCartCount = !isHydrated ? 0 : cartCount > 99 ? "99+" : cartCount;

  useEffect(() => {
    const checkAuth = () => {
      try {
        const hasToken = Boolean(
          localStorage.getItem("wondersale_token") ||
          localStorage.getItem("token") ||
          localStorage.getItem("wondersale_user") ||
          (typeof document !== "undefined" && document.cookie.includes("wondersale_token"))
        );
        setIsLoggedIn(hasToken);
      } catch {
        setIsLoggedIn(false);
      }
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("wondersale_auth_change", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("wondersale_auth_change", checkAuth);
    };
  }, [isHydrated]);

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
      <header id="wondersale-global-header" className="sticky top-0 z-40 bg-[#680114] shadow-md shadow-black/20">
        {/* ======================================================== */}
        {/* DESKTOP VIEWPORT NAVBAR (md:flex, lg, xl - Enhanced)   */}
        {/* ======================================================== */}
        <div className="hidden md:block w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12">
          <div className="h-20 flex items-center justify-between gap-8">
            {/* 1. Brand Logo (dark variant: #F6E9C8 cream text, no hover effect) */}
            <WondersaleLogo size="md" variant="dark" />

            {/* 2. Central Extended Search Bar */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-3xl">
              <Search className="w-4 h-4 text-[#680114] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands and appliances..."
                className="w-full h-11 text-sm bg-[#F6E9C8] text-[#5A0A10] placeholder:text-[#8C7355] rounded-full pl-11 pr-12 border border-[#DFCBA0] focus:outline-none focus:ring-2 focus:ring-[#FAF3E0] transition-all shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#680114]">
                <button
                  type="button"
                  aria-label="Voice Search"
                  className="p-1 hover:text-[#88091E] hover:scale-110 rounded-md transition-all cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* 3. Desktop Navigation Links (exact cream #F6E9C8 with underline animation) */}
            <nav className="flex items-center gap-7 text-base font-serif font-bold text-[#F6E9C8] shrink-0">
              <Link
                href="/"
                className="hover:opacity-90 py-1 transition-opacity relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#F6E9C8] hover:after:w-full after:transition-all"
              >
                Home
              </Link>
              <button
                type="button"
                onClick={toggleCategoryMenu}
                className="hover:opacity-90 py-1 transition-opacity relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#F6E9C8] hover:after:w-full after:transition-all cursor-pointer font-serif font-bold text-[#F6E9C8] text-base"
              >
                Categories
              </button>
            </nav>

            {/* 4. Quick Actions (Login/Profile Pill & Cart Pill) */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                aria-label={isLoggedIn ? "My Profile" : "Login"}
                className="group relative inline-flex items-center justify-center gap-2 px-4 h-10 rounded-2xl bg-[#F6E9C8] hover:bg-[#FAF3E0] text-[#5A0A10] border border-[#DFCBA0] transition-all shadow-md font-serif whitespace-nowrap"
              >
                <User className="w-4.5 h-4.5 shrink-0 group-hover:scale-110 transition-transform stroke-[2.2]" />
                <span className="text-base font-bold leading-normal translate-y-[-0.5px]">{isLoggedIn ? "Profile" : "Login"}</span>
              </Link>

              <Link
                href="/cart"
                aria-label="Shopping Cart"
                className="group relative inline-flex items-center justify-center gap-2 px-4 h-10 rounded-2xl bg-[#F6E9C8] hover:bg-[#FAF3E0] text-[#5A0A10] border border-[#DFCBA0] transition-all shadow-md font-serif whitespace-nowrap"
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <ShoppingBag className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-base font-bold leading-normal translate-y-[-0.5px]">Cart ({displayCartCount})</span>
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
            <WondersaleLogo size="sm" variant="dark" />

            {/* Quick Actions (Account & Cart) */}
            <div className="flex items-center gap-1.5">
              <Link
                href="/account"
                aria-label="Account"
                className="relative p-2 rounded-full text-[#F6E9C8] hover:bg-white/10 transition-colors"
              >
                <User className="w-5 h-5" />
              </Link>

              <Link
                href="/cart"
                aria-label="Shopping Cart"
                className="relative p-2 rounded-full text-[#F6E9C8] hover:bg-white/10 transition-colors"
              >
                <div className="relative flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                  {isHydrated && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-[#F6E9C8] text-[#680114] border border-[#680114] text-[9.5px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-xs leading-none">
                      {displayCartCount}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          </div>

          {/* Search Bar Component */}
          <div className="px-4 py-2.5 bg-[#680114]">
            <form onSubmit={handleSearch} className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-[#680114] absolute left-3.5 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands and more..."
                className="w-full bg-[#F6E9C8] text-[#5A0A10] placeholder:text-[#8C7355] text-xs rounded-full pl-9 pr-10 py-2.5 border border-[#DFCBA0] focus:outline-none focus:ring-1 focus:ring-[#FAF3E0] transition-all shadow-inner"
              />
              <div className="absolute right-3 flex items-center text-[#680114]">
                <button
                  type="button"
                  aria-label="Voice Search"
                  className="p-1 hover:text-[#88091E] transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Pincode Modal Bottom Sheet */}
      {showPincodeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#EFE0BC] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom duration-200 border border-[#DBC599]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DBC599]">
              <h3 className="text-sm font-bold text-[#680114]">Select Delivery Location</h3>
              <button
                onClick={() => setShowPincodeModal(false)}
                className="p-1 text-[#88091E] hover:text-[#680114] rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#88091E] mt-2">
              Enter your 6-digit Indian PIN code to check instant express delivery & nationwide shipping.
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
                  className="w-full h-11 px-3 bg-[#F6E9C8] border border-[#C4AA78] rounded-lg text-sm text-[#680114] focus:outline-none focus:border-[#680114] focus:ring-1 focus:ring-[#680114]"
                />
              </div>

              {pincodeError && (
                <div className="flex items-center gap-1.5 text-xs text-[#680114] bg-[#FAEBEF] p-2 rounded-lg border border-[#F4D3D8]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pincodeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={inputPincode.length !== 6 || isSubmitting}
                className="w-full h-11 bg-[#680114] hover:bg-[#88091E] disabled:opacity-50 text-[#F6E9C8] text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
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
