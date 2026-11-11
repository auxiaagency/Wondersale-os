"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  Trash2,
  ChevronRight,
  Sparkles,
  Zap,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { ProductCard } from "@/components/ui/ProductCard";
import { useStorefront, WishlistItem } from "@/context/StorefrontContext";

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist: items, removeFromWishlist, addToCart, cartCount, isHydrated } = useStorefront();

  const handleRemove = (id: string) => {
    removeFromWishlist(id);
  };

  const handleMoveToCart = (item: WishlistItem) => {
    addToCart({
      id: item.id,
      slug: item.slug,
      title: item.title,
      mrpPaise: item.mrpPaise,
      sellingPricePaise: item.sellingPricePaise,
      imageUrl: item.imageUrl,
      badge: "Moved from Wishlist",
    });
    removeFromWishlist(item.id);
  };

  return (
    <div className="min-h-screen bg-[#FDF8EE] text-[#680114] antialiased flex flex-col justify-between font-sans">
      {/* 1. Global Header (Exact same header as Home Page & Categories) */}
      <GlobalHeader />

      {/* 2. Breadcrumb Navigation */}
      <div className="bg-[#F6E9C8] border-b border-[#680114]/15">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-1.5 md:py-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base font-serif font-bold text-[#680114] whitespace-nowrap overflow-x-auto no-scrollbar">
            <Link href="/" className="hover:text-[#88091E] flex items-center transition-colors shrink-0">
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
            <span className="text-[#680114] font-extrabold shrink-0">
              My Wishlist ({items.length} {items.length === 1 ? "item" : "items"})
            </span>
          </nav>
        </div>
      </div>

      {/* 4. Main Body Content (Responsive Container: Grid on Desktop, Card Stack on Mobile) */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-6 pb-24 space-y-6">
        {/* Section Header (Desktop only) */}
        <div className="hidden md:flex items-center justify-between pb-2 border-b border-[#EADFC7]">
          <div>
            <h1 className="text-2xl font-bold text-[#680114] font-serif">
              My Saved Wishlist
            </h1>
            <p className="text-xs text-[#680114]/80 mt-1">
              Items saved here stay reserved for express doorstep delivery
            </p>
          </div>
          <span className="text-xs font-semibold bg-[#FAF3E0] text-[#7A0C16] border border-[#EADFC7] px-3 py-1.5 rounded-full">
            {items.length} {items.length === 1 ? "Item" : "Items"} Saved
          </span>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {items.map((item) => (
              <ProductCard
                key={item.id}
                id={item.id}
                slug={item.slug}
                title={item.title}
                brand={item.brand}
                mrpPaise={item.mrpPaise}
                sellingPricePaise={item.sellingPricePaise}
                rating={item.rating || 4.5}
                ratingCount={item.ratingCount || 100}
                imageUrl={item.imageUrl}
                inStock={item.inStock}
                variant="grid"
                onAddToCart={() => handleMoveToCart(item)}
                onToggleWishlist={() => handleRemove(item.id)}
                isWishlisted={true}
              />
            ))}
          </div>
        ) : (
          /* Empty State (Full width styled container) */
          <div className="bg-[#FFFFFF] rounded-3xl p-10 md:p-16 text-center border border-[#EADFC7] shadow-xs max-w-xl mx-auto my-8">
            <div className="w-20 h-20 rounded-full bg-[#FAF3E0] text-[#7A0C16] border border-[#EADFC7] flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Heart className="h-10 w-10 stroke-[1.8]" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#680114] font-serif">
              Your Wishlist is Empty
            </h2>
            <p className="text-xs md:text-sm text-[#680114]/80 max-w-md mx-auto mt-2 mb-6 leading-relaxed">
              Explore thousands of verified products across our retail departments and tap the heart icon on any product to save it for later.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[#5A0A10] px-6 py-3 text-xs md:text-sm font-bold text-[#FDF8EE] shadow-md hover:bg-[#7A0C16] active:scale-95 transition-all"
              >
                <span>Explore Home Deals</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 rounded-xl bg-[#FAF3E0] border border-[#EADFC7] hover:bg-[#F4ECDC] px-6 py-3 text-xs md:text-sm font-bold text-[#680114] transition-colors"
              >
                <span>All Departments</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* 5. Desktop Footer */}
      <div className="hidden md:block">
        <StorefrontFooter />
      </div>

      {/* 6. Mobile Bottom Tab Bar */}
      <BottomTabBar />
    </div>
  );
}
