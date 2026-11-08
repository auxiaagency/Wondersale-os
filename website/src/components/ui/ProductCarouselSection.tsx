"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { DemoProduct } from "@/data/demo-products";

interface ProductCarouselSectionProps {
  id?: string;
  icon?: string | React.ReactNode;
  title: string | React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
  products: DemoProduct[];
  isLoading?: boolean;
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
  isLoading = false,
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

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const momentumRafRef = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    stopMomentum();
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    lastXRef.current = e.pageX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;

    // Temporarily disable CSS snapping and smooth behavior while mouse is down for 1:1 fluid tracking
    scrollRef.current.style.scrollSnapType = "none";
    scrollRef.current.style.scrollBehavior = "auto";
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const distance = x - startXRef.current;
    if (Math.abs(distance) > 4) {
      hasMovedRef.current = true;
    }

    // Direct 1:1 scroll without multipliers to mimic finger drag
    scrollRef.current.scrollLeft = scrollLeftRef.current - distance;

    // Calculate instantaneous velocity for release momentum
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    if (dt > 10) {
      const dx = e.pageX - lastXRef.current;
      velocityRef.current = dx / dt;
      lastXRef.current = e.pageX;
      lastTimeRef.current = now;
    }
    checkScroll();
  };

  const handleMouseUpOrLeave = () => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    isDraggingRef.current = false;
    const container = scrollRef.current;
    container.style.cursor = "grab";
    container.style.removeProperty("user-select");

    // Inertial kinetic coasting (matches mobile touch release)
    let currentVelocity = velocityRef.current * 16; // px per frame
    if (Math.abs(currentVelocity) > 2) {
      const decay = () => {
        if (!scrollRef.current || isDraggingRef.current) return;
        scrollRef.current.scrollLeft -= currentVelocity;
        currentVelocity *= 0.94; // Smooth friction decay
        checkScroll();

        if (Math.abs(currentVelocity) > 0.5) {
          momentumRafRef.current = requestAnimationFrame(decay);
        } else {
          // Re-enable native snapping once momentum settles
          if (scrollRef.current) {
            scrollRef.current.style.removeProperty("scroll-snap-type");
            scrollRef.current.style.scrollBehavior = "smooth";
          }
        }
      };
      momentumRafRef.current = requestAnimationFrame(decay);
    } else {
      container.style.removeProperty("scroll-snap-type");
      container.style.scrollBehavior = "smooth";
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user dragged more than 4px, prevent card clicks
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      stopMomentum();
      scrollRef.current.style.removeProperty("scroll-snap-type");
      scrollRef.current.style.scrollBehavior = "smooth";
      const cardWidth = 190;
      const distance = direction === "left" ? -cardWidth * 3 : cardWidth * 3;
      scrollRef.current.scrollBy({ left: distance, behavior: "smooth" });
    }
  };

  if (!isLoading && (!products || products.length === 0)) return null;

  const isCleanBackground = bgClass.includes("border-0") || bgClass.includes("border-none");
  const borderStyle = isCleanBackground
    ? ""
    : "border-2 border-[#680114]";

  const paddingStyle = isCleanBackground
    ? "px-0 pt-0 pb-2 sm:pb-3"
    : "p-4 sm:p-5 md:p-6";

  return (
    <section
      id={id}
      className={`w-full rounded-2xl md:rounded-3xl shadow-xs transition-all ${borderStyle} ${paddingStyle} ${bgClass}`}
    >
      {/* Header with Title, Badges, and Navigation Arrows */}
      <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-4.5 px-1">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {icon && typeof icon === "string" ? (
            <span className="text-xl sm:text-2xl select-none">{icon}</span>
          ) : icon ? (
            <div className="text-[#680114] shrink-0 flex items-center">{icon}</div>
          ) : null}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl md:text-3xl text-[#680114] font-serif font-bold tracking-tight leading-none truncate">
                {title}
              </h2>
              <div className="flex items-center">{badge}</div>
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-[#680114]/80 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action & Controls: View All + Prev/Next Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {actionHref && actionText && (
            <Link
              href={actionHref}
              className="text-xs sm:text-sm text-[#680114] font-serif font-bold py-0.5 transition-opacity relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#680114] hover:after:w-full after:transition-all flex items-center gap-1"
            >
              <span>{actionText}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {/* Swipe / Scroll Buttons (Unified brand burgundy & cream color scheme) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                canScrollLeft
                  ? "bg-[#680114] hover:bg-[#88091E] border-[#5A0A10] text-[#F6E9C8] shadow-xs hover:scale-105 active:scale-95"
                  : "bg-[#680114]/15 border-[#680114]/20 text-[#680114]/40 cursor-not-allowed"
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
                  ? "bg-[#680114] hover:bg-[#88091E] border-[#5A0A10] text-[#F6E9C8] shadow-xs hover:scale-105 active:scale-95"
                  : "bg-[#680114]/15 border-[#680114]/20 text-[#680114]/40 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track with Native Snapping, Touch Support & Smooth Mouse Drag */}
      {isLoading ? (
        <div className="flex items-stretch gap-2 sm:gap-3 overflow-hidden py-1 px-0.5 -mx-0.5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`carousel-skel-${idx}`}
              className="w-[102px] xs:w-[110px] sm:w-[175px] md:w-[190px] lg:w-[195px] shrink-0 flex flex-col p-2.5 rounded-2xl bg-[#EFE0BC]/50 border border-[#680114]/15 animate-pulse"
            >
              <div className="w-full aspect-square rounded-xl bg-[#DFCBA0]/50 mb-2.5" />
              <div className="w-3/4 h-3 bg-[#DFCBA0]/60 rounded mb-1.5" />
              <div className="w-1/2 h-2.5 bg-[#DFCBA0]/40 rounded mb-2.5" />
              <div className="w-1/3 h-3.5 bg-[#DFCBA0]/60 rounded mt-auto" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="w-full py-8 px-4 rounded-2xl bg-[#EFE0BC]/40 border border-[#680114]/15 flex flex-col items-center justify-center text-center">
          <p className="text-xs sm:text-sm font-serif font-bold text-[#680114]/80">
            No products are here at this moment
          </p>
          <p className="text-[11px] sm:text-xs text-[#680114]/60 mt-0.5">
            Check back soon as we restock new inventory daily.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onClickCapture={handleClickCapture}
          className="flex items-stretch gap-2 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1 px-0.5 -mx-0.5 cursor-grab select-none active:cursor-grabbing"
        >
          {products.map((item) => (
            <div
              key={item.id}
              onDragStart={(e) => e.preventDefault()}
              className="w-[102px] xs:w-[110px] sm:w-[175px] md:w-[190px] lg:w-[195px] shrink-0 snap-start flex flex-col select-none"
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
      )}
    </section>
  );
};
