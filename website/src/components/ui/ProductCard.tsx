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
  onBuyNow?: (id: string) => void;
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
  onBuyNow,
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
            <div className="w-10 h-10 rounded-full bg-[#E8D7B0] flex items-center justify-center text-[#680114]/80 font-bold text-xs">
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
                <span className="text-[10px] text-[#680114]/80 line-through ml-1">
                  {formatPrice(mrpPaise)}
                </span>
              )}
            </div>
            {inStock ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onAddToCart?.(id)}
                  className="h-8 px-2.5 bg-transparent hover:bg-[#680114]/10 text-[#680114] border border-[#680114]/60 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => onBuyNow ? onBuyNow(id) : onAddToCart?.(id)}
                  className="h-8 px-3.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  Buy Now
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-semibold text-[#680114]/80">Out of Stock</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: Vertical Grid Card
  return (
    <div
      className={`w-full h-full bg-[#F6E9C8] rounded-xl border-2 p-1 sm:p-1.5 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between group overflow-hidden ${
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
          {/* Top Left Discount Tag */}
          {discount > 0 && inStock ? (
            <div className="absolute top-1 left-1 z-10 flex items-center">
              <span className="h-4 sm:h-5 px-1 sm:px-1.5 bg-[#680114] text-[#F6E9C8] text-[7px] sm:text-[8.5px] font-bold rounded-full shadow-xs flex items-center justify-center leading-none tracking-tight">
                {discount}% OFF
              </span>
            </div>
          ) : badge && inStock ? (
            <div className="absolute top-1 left-1 z-10 flex items-center">
              <span className="h-4 sm:h-5 px-1 sm:px-1.5 bg-[#520210] text-[#F6E9C8] text-[7px] sm:text-[8.5px] font-bold rounded-full shadow-xs flex items-center justify-center leading-none tracking-tight">
                {badge}
              </span>
            </div>
          ) : null}

          {/* Top Right Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWishlist?.(id);
            }}
            className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[#680114] hover:scale-115 active:scale-90 transition-all z-10 cursor-pointer"
            aria-label="Wishlist"
          >
            <Heart
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-all ${
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
              className="w-full h-full flex items-center justify-center p-0.5 sm:p-1 select-none"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className={`w-full h-full object-contain pointer-events-none select-none transition-transform duration-200 ${
                    !inStock ? "opacity-60 contrast-95" : "group-hover:scale-105"
                  }`}
                />
              ) : (
                <div className="text-[#680114]/80 flex flex-col items-center">
                  <span className="text-[10px] font-bold">WS</span>
                </div>
              )}
            </Link>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              draggable={false}
              className={`w-full h-full object-contain p-0.5 sm:p-1 pointer-events-none select-none ${
                !inStock ? "opacity-60 contrast-95" : ""
              }`}
            />
          ) : (
            <div className="text-[#680114]/80 flex flex-col items-center">
              <span className="text-[10px] font-bold">WS</span>
            </div>
          )}

          {/* Out of Stock Pill Over Bottom Center of Image */}
          {!inStock && (
            <div className="absolute inset-x-0 bottom-1 flex justify-center z-15 pointer-events-none px-1">
              <span className="bg-[#680114]/90 backdrop-blur-xs text-[#F6E9C8] font-serif font-bold text-[7px] sm:text-[8.5px] tracking-wide px-1.5 py-0.5 rounded-full shadow-md border border-[#F6E9C8]/30">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Title: Uniform 2-line box height */}
        <div className="pt-1 sm:pt-1.5 pb-0.5 flex items-start h-[26px] sm:h-[32px] overflow-hidden">
          {slug ? (
            <Link href={`/product/${slug}`} className="hover:text-[#7A0C16] transition-colors w-full">
              <h3 className={`text-[9.5px] sm:text-[10.5px] md:text-[11px] font-semibold line-clamp-2 leading-tight ${
                !inStock ? "text-[#680114]/80" : "text-[#680114]"
              }`}>
                {title}
              </h3>
            </Link>
          ) : (
            <h3 className={`text-[9.5px] sm:text-[10.5px] md:text-[11px] font-semibold line-clamp-2 leading-tight w-full ${
              !inStock ? "text-[#680114]/80" : "text-[#680114]"
            }`}>
              {title}
            </h3>
          )}
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-baseline gap-1 min-w-0 flex-wrap pt-0.5">
        <span className={`text-[11px] sm:text-[12.5px] md:text-[13.5px] font-black leading-tight tracking-tight whitespace-nowrap ${
          !inStock ? "text-[#680114]/60" : "text-[#680114]"
        }`}>
          {formatPrice(sellingPricePaise)}
        </span>
        {discount > 0 && (
          <span className="text-[8px] sm:text-[9.5px] font-medium text-[#680114]/80 line-through leading-tight opacity-80 whitespace-nowrap">
            {formatPrice(mrpPaise)}
          </span>
        )}
      </div>

      {/* Action Buttons: Buy Now (Bigger, Primary) + Add (Smaller, Secondary) */}
      <div className="pt-1 sm:pt-1.5 mt-auto">
        {inStock ? (
          <div className="flex items-center gap-1 w-full">
            <button
              type="button"
              onClick={() => onAddToCart?.(id)}
              className="shrink-0 h-5 sm:h-6 px-1.5 bg-transparent hover:bg-[#680114]/10 text-[#680114] border border-[#680114]/50 text-[7.5px] sm:text-[8.5px] md:text-[9px] font-bold rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer whitespace-nowrap tracking-tight leading-none"
              title="Add to Cart"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => onBuyNow ? onBuyNow(id) : onAddToCart?.(id)}
              className="flex-1 min-w-0 h-5 sm:h-6 px-1.5 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] text-[8px] sm:text-[9.5px] md:text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-2xs active:scale-95 transition-all cursor-pointer truncate tracking-tight leading-none"
              title="Buy Now"
            >
              Buy Now
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="w-full h-5 sm:h-6 px-1 bg-[#680114]/10 text-[#680114]/50 text-[7.5px] sm:text-[8.5px] font-bold rounded-full flex items-center justify-center cursor-not-allowed border border-[#680114]/20 leading-none"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
};
