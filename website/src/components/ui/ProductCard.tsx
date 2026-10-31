import React from "react";
import Link from "next/link";
import { formatPrice, calculateDiscountPercentage } from "@/lib/format";

export interface ProductCardProps {
  id: string;
  slug?: string;
  title: string;
  brand?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  rating?: number;
  ratingCount?: number;
  imageUrl?: string;
  inStock?: boolean;
  badge?: string;
  express2Hr?: boolean;
  variant?: "grid" | "horizontal";
  onAddToCart?: (id: string) => void;
  onToggleWishlist?: (id: string) => void;
  isWishlisted?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  title,
  brand,
  mrpPaise,
  sellingPricePaise,
  rating = 4.0,
  ratingCount = 0,
  imageUrl,
  inStock = true,
  badge,
  express2Hr = true,
  variant = "grid",
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
}) => {
  const discount = calculateDiscountPercentage(mrpPaise, sellingPricePaise);

  if (variant === "horizontal") {
    return (
      <div className="bg-[#F6E9C8] rounded-2xl border-2 border-[#680114] p-3 shadow-2xs hover:shadow-xs transition-all flex space-x-3 items-center group">
        <div className="w-24 h-24 bg-[#F6E9C8] rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden border border-[#680114]/30">
          {discount > 0 ? (
            <span className="absolute top-1 left-1 bg-[#680114] text-[#F6E9C8] text-[9px] font-bold px-1.5 py-0.5 rounded-md z-10 shadow-2xs">
              {discount}% OFF
            </span>
          ) : badge ? (
            <span className="absolute top-1 left-1 bg-[#520210] text-[#F6E9C8] text-[9px] font-bold px-1.5 py-0.5 rounded-md z-10 shadow-2xs">
              {badge}
            </span>
          ) : null}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-200" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#E8D7B0] flex items-center justify-center text-[#735A4A] font-bold text-xs">
              WS
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {express2Hr && (
            <div className="flex items-center justify-end mb-0.5">
              <span className="text-[9px] font-bold text-[#680114] bg-[#FAEBEF] px-1.5 py-0.5 rounded">
                ⚡ 2-Hr
              </span>
            </div>
          )}
          {brand && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#735A4A] block truncate">
              {brand}
            </span>
          )}
          {slug ? (
            <Link href={`/product/${slug}`} className="hover:text-[#680114] transition-colors">
              <h4 className="text-xs font-semibold text-[#2C1810] truncate mb-1">{title}</h4>
            </Link>
          ) : (
            <h4 className="text-xs font-semibold text-[#2C1810] truncate mb-1">{title}</h4>
          )}
          <div className="flex items-center justify-between mt-1">
            <div>
              <span className="text-xs font-extrabold text-[#2C1810]">
                {formatPrice(sellingPricePaise)}
              </span>
              {discount > 0 && (
                <span className="text-[10px] text-[#735A4A] line-through ml-1">
                  {formatPrice(mrpPaise)}
                </span>
              )}
            </div>
            {inStock ? (
              <button
                type="button"
                onClick={() => onAddToCart?.(id)}
                className="h-8 px-3.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Add
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-[#735A4A]">Out of Stock</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: Vertical Grid Card
  return (
    <div
      className={`w-full bg-[#F6E9C8] rounded-xl border-2 border-[#680114] p-2 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between group ${
        !inStock ? "opacity-75" : ""
      }`}
    >
      <div>
        {/* Product Image Frame with Overlaid Badges to save vertical height */}
        <div className="w-full aspect-square bg-[#F6E9C8] rounded-lg flex items-center justify-center overflow-hidden mb-1.5 relative border border-[#680114]/20">
          {/* Top Left Discount Tag */}
          {discount > 0 && inStock ? (
            <span className="absolute top-1 left-1 bg-[#680114] text-[#F6E9C8] text-[8px] font-extrabold px-1 py-0.5 rounded shadow-2xs z-10 leading-none">
              {discount}% OFF
            </span>
          ) : badge && inStock ? (
            <span className="absolute top-1 left-1 bg-[#520210] text-[#F6E9C8] text-[8px] font-bold px-1 py-0.5 rounded shadow-2xs z-10 leading-none">
              {badge}
            </span>
          ) : !inStock ? (
            <span className="absolute top-1 left-1 bg-[#E8D7B0] text-[#735A4A] text-[8px] font-bold px-1 py-0.5 rounded z-10 leading-none">
              OUT
            </span>
          ) : null}

          {/* Top Right Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist?.(id);
            }}
            className={`absolute top-1 right-1 w-5 h-5 rounded-full bg-[#F6E9C8] border border-[#680114]/40 flex items-center justify-center transition-all z-10 hover:scale-110 cursor-pointer shadow-2xs ${
              isWishlisted ? "text-[#680114]" : "text-[#735A4A] hover:text-[#680114]"
            }`}
            aria-label="Wishlist"
          >
            <svg
              className="w-2.5 h-2.5"
              fill={isWishlisted ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>

          {/* Image */}
          {slug ? (
            <Link href={`/product/${slug}`} className="w-full h-full flex items-center justify-center p-1">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="text-[#735A4A] flex flex-col items-center">
                  <span className="text-[10px] font-bold">WS</span>
                </div>
              )}
            </Link>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} className="w-full h-full object-contain p-1" />
          ) : (
            <div className="text-[#735A4A] flex flex-col items-center">
              <span className="text-[10px] font-bold">WS</span>
            </div>
          )}
        </div>

        {/* Brand / Delivery Tag Inline */}
        <div className="flex items-center justify-between text-[9px] text-[#735A4A] mb-1 leading-none">
          {brand ? (
            <span className="font-bold uppercase tracking-wider truncate max-w-[65%]">
              {brand}
            </span>
          ) : <span />}
          {express2Hr && (
            <span className="font-semibold text-[#7A0C16] shrink-0">
              ⚡ 2-Hr
            </span>
          )}
        </div>

        {/* Product Title */}
        {slug ? (
          <Link href={`/product/${slug}`} className="hover:text-[#7A0C16] transition-colors block">
            <h3 className="text-[11px] font-semibold text-[#2C1810] line-clamp-2 leading-tight mb-1.5 min-h-[26px]">
              {title}
            </h3>
          </Link>
        ) : (
          <h3 className="text-[11px] font-semibold text-[#2C1810] line-clamp-2 leading-tight mb-1.5 min-h-[26px]">
            {title}
          </h3>
        )}
      </div>

      {/* Bottom Row: Price & Inline Add Button */}
      <div className="flex items-center justify-between pt-1 border-t border-[#EADFC7]/70 gap-1 mt-auto">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-extrabold text-[#2C1810] leading-none">
            {formatPrice(sellingPricePaise)}
          </span>
          {discount > 0 && (
            <span className="text-[9px] text-[#735A4A] line-through mt-0.5 leading-none">
              {formatPrice(mrpPaise)}
            </span>
          )}
        </div>

        {inStock ? (
          <button
            type="button"
            onClick={() => onAddToCart?.(id)}
            className="h-6 px-2 bg-[#5A0A10] hover:bg-[#7A0C16] text-[#FDF8EE] text-[10px] font-bold rounded-md flex items-center justify-center shadow-xs transition-colors cursor-pointer shrink-0"
          >
            + Add
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="h-6 px-1.5 bg-[#F4ECDC] text-[#735A4A] text-[9px] font-medium rounded-md flex items-center justify-center cursor-not-allowed border border-[#EADFC7] shrink-0"
          >
            Out
          </button>
        )}
      </div>
    </div>
  );
};
