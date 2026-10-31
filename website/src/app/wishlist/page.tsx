"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

interface WishlistItem {
  id: string;
  slug: string;
  title: string;
  brand: string;
  mrpPaise: number;
  sellingPricePaise: number;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  imageUrl: string;
}

const INITIAL_WISHLIST: WishlistItem[] = [
  {
    id: "prestige-svachh-5l",
    slug: "prestige-svachh-deluxe-alpha-5l",
    brand: "Prestige",
    title: "Prestige Svachh Deluxe Alpha Stainless Steel 5L Pressure Cooker",
    mrpPaise: 345000,
    sellingPricePaise: 219900,
    rating: 4.4,
    ratingCount: 3410,
    inStock: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwD9TPlEtuCmhz0cV6XwCoydv46QKplJ3rYrlOAHZjnEPJCL56XR7xRcRHKeAUIYqbIyOnWXh6ECTTd_wJJ_UarOzAR1mK0z50bkbDbLIkzEAoDXQZc-hV4QwuA5NCvr1Ob5a3IH_zY4uEAQ4hnK527Ydz5sDb_91kIA6Aj5ywjpN43zgArNRJs8C_UgGJxzToPz9FqYxomTOG35fu5bblv6wgnRbCqlffJI6u4AKAW01tusb4f5g_ld16V-trax0R9UJo3gyXlw",
  },
  {
    id: "bajaj-majesty-kettle",
    slug: "bajaj-majesty-kkn-kettle",
    brand: "Bajaj",
    title: "Bajaj Majesty KKN 1.5L Cordless Electric Kettle",
    mrpPaise: 129900,
    sellingPricePaise: 84900,
    rating: 4.5,
    ratingCount: 2840,
    inStock: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCUnC2gPMknviGbefVtlS-qfPN-Y-OhJjRVPmV6qirbZv7yCo83QljbyuKBsKnVqUys0guhWVKqyRgV3RkEVbR-UtEL8s4w6NvFYNT0i77Mf-vm05ovapZFdf25a2eQwlKW47bxipUyxT-fURExPAhJnIKxGVtZxbkSurhDFS3WIxJrZiW43hdyK4N7DFs0Cw3laQfDJPCG1acfxWS35Bf9yN4nUNkTdDWaC_spQDvIBwzWxKTbZ4DJJLEyCGo7Vxev03N7EDGowg",
  },
  {
    id: "titan-wall-clock",
    slug: "titan-round-wall-clock",
    brand: "Titan",
    title: "Titan Contemporary Round Silent Sweep Wall Clock (30cm)",
    mrpPaise: 199500,
    sellingPricePaise: 149500,
    rating: 4.6,
    ratingCount: 920,
    inStock: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwD9TPlEtuCmhz0cV6XwCoydv46QKplJ3rYrlOAHZjnEPJCL56XR7xRcRHKeAUIYqbIyOnWXh6ECTTd_wJJ_UarOzAR1mK0z50bkbDbLIkzEAoDXQZc-hV4QwuA5NCvr1Ob5a3IH_zY4uEAQ4hnK527Ydz5sDb_91kIA6Aj5ywjpN43zgArNRJs8C_UgGJxzToPz9FqYxomTOG35fu5bblv6wgnRbCqlffJI6u4AKAW01tusb4f5g_ld16V-trax0R9UJo3gyXlw",
  },
  {
    id: "fastrack-aviator",
    slug: "fastrack-polarized-aviator",
    brand: "Fastrack",
    title: "Fastrack Polarized Pilot Sunglasses with 100% UV Protection",
    mrpPaise: 249900,
    sellingPricePaise: 149900,
    rating: 4.3,
    ratingCount: 1450,
    inStock: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCUnC2gPMknviGbefVtlS-qfPN-Y-OhJjRVPmV6qirbZv7yCo83QljbyuKBsKnVqUys0guhWVKqyRgV3RkEVbR-UtEL8s4w6NvFYNT0i77Mf-vm05ovapZFdf25a2eQwlKW47bxipUyxT-fURExPAhJnIKxGVtZxbkSurhDFS3WIxJrZiW43hdyK4N7DFs0Cw3laQfDJPCG1acfxWS35Bf9yN4nUNkTdDWaC_spQDvIBwzWxKTbZ4DJJLEyCGo7Vxev03N7EDGowg",
  },
];

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>(INITIAL_WISHLIST);

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleMoveToCart = (item: WishlistItem) => {
    handleRemove(item.id);
    router.push("/cart");
  };

  return (
    <div className="w-full max-w-[390px] mx-auto min-h-screen bg-neutral-50 relative flex flex-col pb-24 shadow-2xl font-sans">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-40 bg-white px-4 py-3 flex items-center justify-between shadow-xs border-b border-neutral-200">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-transform active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-base text-neutral-900 leading-tight">My Wishlist</h1>
            <p className="text-[11px] text-neutral-500">{items.length} Saved Items</p>
          </div>
        </div>

        <Link
          href="/cart"
          className="relative p-2 rounded-full hover:bg-neutral-100 text-neutral-600 transition-transform active:scale-95"
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-[#D91E2A] text-[10px] font-bold text-white leading-none">
            2
          </span>
        </Link>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 p-3.5 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-xl p-3 shadow-xs border border-neutral-200 flex gap-3 relative"
            >
              {/* Product Thumbnail */}
              <div className="w-20 h-20 rounded-lg bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center p-1 border border-neutral-200">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-bold text-[#D91E2A] uppercase tracking-wider">
                      {item.brand}
                    </span>
                    <button
                      onClick={() => handleRemove(item.id)}
                      aria-label="Remove from wishlist"
                      className="text-neutral-400 hover:text-[#D91E2A] transition-colors p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h2 className="text-xs font-semibold text-neutral-900 leading-snug line-clamp-2 mt-0.5">
                    {item.title}
                  </h2>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-neutral-900">
                      {formatPrice(item.sellingPricePaise)}
                    </span>
                    <span className="text-[10px] text-neutral-400 line-through">
                      {formatPrice(item.mrpPaise)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleMoveToCart(item)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#D91E2A] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#B31520] active:scale-95 transition-all shadow-2xs"
                  >
                    <ShoppingBag className="h-3 w-3" />
                    <span>Move to Cart</span>
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-neutral-300 my-8">
            <div className="w-16 h-16 rounded-full bg-red-50 text-[#D91E2A] flex items-center justify-center mx-auto mb-3">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="text-base font-bold text-neutral-900">Your Wishlist is Empty</h2>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-1 mb-4">
              Explore products across Bhopal retail superstore and tap the heart icon to save them.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D91E2A] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#B31520] transition-colors"
            >
              Explore Products
            </Link>
          </div>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
