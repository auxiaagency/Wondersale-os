"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  Heart,
  ShoppingBag,
  MapPin,
  ChevronDown,
  Search,
  Mic,
  Camera,
  X,
} from "lucide-react";

export interface GlobalHeaderProps {
  cartCount?: number;
  wishlistCount?: number;
  currentPincode?: string;
  onPincodeChangeClick?: () => void;
  onSearchSubmit?: (query: string) => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  cartCount = 3,
  wishlistCount = 2,
  currentPincode = "462001",
  onPincodeChangeClick,
  onSearchSubmit,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [inputPincode, setInputPincode] = useState(currentPincode);
  const [activePincode, setActivePincode] = useState(currentPincode);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit && searchQuery.trim()) {
      onSearchSubmit(searchQuery.trim());
    }
  };

  const handlePincodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPincode.length === 6) {
      setActivePincode(inputPincode);
      setShowPincodeModal(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        {/* Top Brand & Actions Cluster */}
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-[#D91E2A] text-white flex items-center justify-center shadow-xs group-hover:bg-[#B31520] transition-colors">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-black tracking-tight text-xl text-[#D91E2A] leading-none">
                WONDERSALE
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wide mt-0.5">
                Bhopal Store & Online Pan-India
              </span>
            </div>
          </Link>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 hover:text-[#D91E2A] transition-colors"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#D91E2A] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 hover:text-[#D91E2A] transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#D91E2A] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Pincode Delivery Strip */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate max-w-[280px]">
            <MapPin className="w-3.5 h-3.5 text-[#D91E2A] flex-shrink-0" />
            <span className="text-slate-700 font-medium truncate">
              Deliver to{" "}
              <strong className="font-bold text-slate-900">Bhopal {activePincode}</strong> - MP
              Nagar
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPincodeModal(true);
              onPincodeChangeClick?.();
            }}
            className="text-[#D91E2A] font-bold flex items-center gap-0.5 text-xs hover:underline cursor-pointer flex-shrink-0 ml-1"
          >
            <span>Change</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Bar Component */}
        <div className="px-4 py-2 bg-white">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 50,000+ products (Fans, Mixers, boAt, Milton...)"
              className="w-full bg-slate-100 text-xs rounded-lg pl-9 pr-16 py-2.5 border-none text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#D91E2A] focus:bg-white transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1 text-slate-400">
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
              Enter your 6-digit PIN code to check product availability and delivery options in
              Bhopal & Pan-India.
            </p>

            <form onSubmit={handlePincodeSubmit} className="mt-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={inputPincode}
                  onChange={(e) => setInputPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 462001"
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#D91E2A] focus:ring-1 focus:ring-[#D91E2A]"
                />
              </div>
              <button
                type="submit"
                disabled={inputPincode.length !== 6}
                className="w-full h-11 bg-[#D91E2A] hover:bg-[#B31520] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Apply Pincode
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
