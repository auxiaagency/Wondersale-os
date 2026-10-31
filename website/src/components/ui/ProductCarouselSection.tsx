"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { DemoProduct } from "@/data/demo-products";

interface ProductCarouselSectionProps {
  id?: string;
  icon?: string | React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
  products: DemoProduct[];
  accentBorderColor?: string;
  bgClass?: string;
  onAddToCart: (item: DemoProduct) => void;
  onToggleWishlist: (item: DemoProduct) => void;
  isInWishlist: (id: string) => boolean;
}

export const ProductCarouselSection: React.FC<ProductCarouselSectionProps> = ({
  id,
  icon,
  title,
  subtitle,
  badge,
  actionText,
  actionHref,
  products,
  bgClass = "bg-[#FAF3E0]/70",
  onAddToCart,
  onToggleWishlist,
  isInWishlist,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [products]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const cardWidth = 190; // Approx card width + gap
      const distance = direction === "left" ? -cardWidth * 3 : cardWidth * 3;
      scrollRef.current.scrollBy({ left: distance, behavior: "smooth" });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section
      id={id}
      className={`w-full rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 shadow-xs border border-[#EADFC7]/90 transition-all ${bgClass}`}
    >
      {/* Header with Title, Badges, and Navigation Arrows */}
      <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-4.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && typeof icon === "string" ? (
            <span className="text-xl sm:text-2xl select-none">{icon}</span>
          ) : icon ? (
            <div className="text-[#7A0C16] shrink-0">{icon}</div>
          ) : null}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg md:text-xl text-[#2C1810] font-bold tracking-tight truncate">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-[#735A4A] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action & Controls: View All + Prev/Next Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {actionHref && actionText && (
            <Link
              href={actionHref}
              className="text-xs text-[#7A0C16] hover:text-[#5A0A10] font-bold flex items-center gap-0.5 hover:underline mr-1"
            >
              <span>{actionText}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {/* Swipe / Scroll Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                canScrollLeft
                  ? "bg-[#FAF3E0] hover:bg-[#EADFC7] border-[#D5C4A1] text-[#2C1810] shadow-xs hover:scale-105 active:scale-95"
                  : "bg-neutral-100/60 border-neutral-200 text-neutral-400 opacity-40 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                canScrollRight
                  ? "bg-[#5A0A10] hover:bg-[#7A0C16] border-[#42060B] text-[#FDF8EE] shadow-xs hover:scale-105 active:scale-95"
                  : "bg-neutral-100/60 border-neutral-200 text-neutral-400 opacity-40 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track with Native Snapping and Touch Support */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1 px-0.5 -mx-0.5"
      >
        {products.map((item) => (
          <div
            key={item.id}
            className="w-[160px] sm:w-[175px] md:w-[190px] lg:w-[195px] shrink-0 snap-start flex flex-col"
          >
            <ProductCard
              id={item.id}
              slug={item.slug}
              title={item.title}
              brand={item.brand}
              mrpPaise={item.mrpPaise}
              sellingPricePaise={item.sellingPricePaise}
              rating={item.rating}
              ratingCount={item.ratingCount}
              imageUrl={item.imageUrl}
              inStock={item.inStock}
              badge={item.bestsellerRank ? "Top Seller" : undefined}
              variant="grid"
              onAddToCart={() => onAddToCart(item)}
              onToggleWishlist={() => onToggleWishlist(item)}
              isWishlisted={isInWishlist(item.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
