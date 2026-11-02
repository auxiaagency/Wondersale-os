import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
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
          {slug ? (
            <Link href={`/product/${slug}`} className="hover:text-[#680114] transition-colors">
              <h4 className="text-xs font-semibold text-[#680114] truncate mb-1">{title}</h4>
            </Link>
          ) : (
            <h4 className="text-xs font-semibold text-[#680114] truncate mb-1">{title}</h4>
          )}
          <div className="flex items-center justify-between mt-1">
            <div>
              <span className="text-xs font-extrabold text-[#680114]">
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
      className={`w-full bg-[#F6E9C8] rounded-xl border-2 p-1.5 sm:p-2 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between group overflow-hidden ${
        !inStock
          ? "border-[#680114]/40 bg-[#EDE4CE]"
          : "border-[#680114]"
      }`}
    >
      <div className="flex flex-col flex-1">
        {/* Product Image Frame */}
        <div className={`w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden relative border ${
          !inStock
            ? "bg-[#E6DCC4] border-[#680114]/15"
            : "bg-[#F6E9C8] border-[#680114]/20"
        }`}>
          {/* Top Left Discount Tag (Mirrors Heart Button: absolute top-1 left-1 sm:top-2 sm:left-2) */}
          {discount > 0 && inStock ? (
            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex items-center">
              <span className="h-3.5 sm:h-6 px-1 sm:px-2 bg-[#680114] text-[#F6E9C8] text-[6.5px] sm:text-[9.5px] font-bold rounded-full shadow-xs flex items-center justify-center leading-none tracking-tight">
                {discount}% OFF
              </span>
            </div>
          ) : badge && inStock ? (
            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 flex items-center">
              <span className="h-3.5 sm:h-6 px-1 sm:px-2 bg-[#520210] text-[#F6E9C8] text-[6.5px] sm:text-[9.5px] font-bold rounded-full shadow-xs flex items-center justify-center leading-none tracking-tight">
                {badge}
              </span>
            </div>
          ) : null}

          {/* Top Right Wishlist Button (Mirrors Discount Tag: absolute top-1 right-1 sm:top-2 sm:right-2) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist?.(id);
            }}
            className="absolute top-1 right-1 sm:top-2 sm:right-2 w-4 h-4 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[#680114] hover:scale-115 active:scale-90 transition-all z-10 cursor-pointer"
            aria-label="Wishlist"
          >
            <Heart
              className={`w-3 h-3 sm:w-4 sm:h-4 transition-all ${
                isWishlisted
                  ? "fill-[#680114] text-[#680114] stroke-[2]"
                  : "fill-transparent text-[#680114] stroke-[2] hover:fill-[#680114]/20"
              }`}
            />
          </button>

          {/* Image */}
          {slug ? (
            <Link
              href={`/product/${slug}`}
              draggable={false}
              className="w-full h-full flex items-center justify-center p-1 select-none"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={title}
                  draggable={false}
                  className={`w-full h-full object-contain pointer-events-none select-none transition-transform duration-200 ${
                    !inStock ? "opacity-60 contrast-95" : "group-hover:scale-105"
                  }`}
                />
              ) : (
                <div className="text-[#735A4A] flex flex-col items-center">
                  <span className="text-[10px] font-bold">WS</span>
                </div>
              )}
            </Link>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              draggable={false}
              className={`w-full h-full object-contain p-1 pointer-events-none select-none ${
                !inStock ? "opacity-60 contrast-95" : ""
              }`}
            />
          ) : (
            <div className="text-[#735A4A] flex flex-col items-center">
              <span className="text-[10px] font-bold">WS</span>
            </div>
          )}

          {/* Out of Stock Pill Over Bottom Center of Image */}
          {!inStock && (
            <div className="absolute inset-x-0 bottom-1 sm:bottom-2 flex justify-center z-15 pointer-events-none px-1 sm:px-2">
              <span className="bg-[#680114]/90 backdrop-blur-xs text-[#F6E9C8] font-serif font-bold text-[7.5px] sm:text-[10px] tracking-wide px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md border border-[#F6E9C8]/30">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Title: Visually balanced spacing between image bottom and price/button row */}
        <div className="pt-1.5 sm:pt-2 pb-1 sm:pb-1.5 flex items-center min-h-[30px] sm:min-h-[34px]">
          {slug ? (
            <Link href={`/product/${slug}`} className="hover:text-[#7A0C16] transition-colors w-full">
              <h3 className={`text-[10px] sm:text-[11px] font-semibold line-clamp-2 leading-tight ${
                !inStock ? "text-[#735A4A]" : "text-[#680114]"
              }`}>
                {title}
              </h3>
            </Link>
          ) : (
            <h3 className={`text-[10px] sm:text-[11px] font-semibold line-clamp-2 leading-tight w-full ${
              !inStock ? "text-[#735A4A]" : "text-[#680114]"
            }`}>
              {title}
            </h3>
          )}
        </div>
      </div>

      {/* Bottom Row: Price (Larger) + Horizontal Cut MRP (Smaller on the right) & Inline Add Button */}
      <div className="flex items-center justify-between pt-0.5 sm:pt-1 gap-1 sm:gap-1.5 mt-auto">
        <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0 flex-wrap">
          <span className={`text-[11px] sm:text-[15px] font-black leading-none ${
            !inStock ? "text-[#680114]/60" : "text-[#680114]"
          }`}>
            {formatPrice(sellingPricePaise)}
          </span>
          {discount > 0 && (
            <span className="text-[8px] sm:text-[11px] font-medium text-[#735A4A] line-through leading-none opacity-80">
              {formatPrice(mrpPaise)}
            </span>
          )}
        </div>

        {inStock ? (
          <button
            type="button"
            onClick={() => onAddToCart?.(id)}
            className="h-5 sm:h-6 px-1.5 sm:px-2.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] text-[8.5px] sm:text-[10px] font-bold rounded-md flex items-center justify-center shadow-xs transition-colors cursor-pointer shrink-0"
          >
            + Add
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="h-5 sm:h-6 px-1 sm:px-2 bg-[#680114]/10 text-[#680114]/50 text-[7.5px] sm:text-[9px] font-bold rounded-md flex items-center justify-center cursor-not-allowed border border-[#680114]/20 shrink-0"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
};
