import React from "react";
import { formatPrice, calculateDiscountPercentage } from "@/lib/format";

export interface ProductCardProps {
  id: string;
  title: string;
  mrpPaise: number;
  sellingPricePaise: number;
  rating?: number;
  ratingCount?: number;
  imageUrl?: string;
  inStock?: boolean;
  variant?: "grid" | "horizontal";
  onAddToCart?: (id: string) => void;
  onToggleWishlist?: (id: string) => void;
  isWishlisted?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  mrpPaise,
  sellingPricePaise,
  rating = 4.0,
  ratingCount = 0,
  imageUrl,
  inStock = true,
  variant = "grid",
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
}) => {
  const discount = calculateDiscountPercentage(mrpPaise, sellingPricePaise);

  if (variant === "horizontal") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex space-x-3 items-center">
        <div className="w-24 h-24 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
          {discount > 0 && (
            <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded z-10">
              {discount}% OFF
            </span>
          )}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
              WS
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 mb-0.5">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
              {rating.toFixed(1)} ★
            </span>
            {ratingCount > 0 && <span className="text-[10px] text-slate-400">({ratingCount})</span>}
          </div>
          <h4 className="text-xs font-semibold text-slate-800 truncate mb-1">{title}</h4>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-slate-900">
                {formatPrice(sellingPricePaise)}
              </span>
              {discount > 0 && (
                <span className="text-[10px] text-slate-400 line-through ml-1">
                  {formatPrice(mrpPaise)}
                </span>
              )}
            </div>
            {inStock ? (
              <button
                type="button"
                onClick={() => onAddToCart?.(id)}
                className="h-8 px-3 bg-red-50 text-[#D91E2A] hover:bg-[#D91E2A] hover:text-white border border-red-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Add
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">Out of Stock</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: Vertical Grid Card
  return (
    <div
      className={`w-full bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs relative flex flex-col justify-between ${
        !inStock ? "opacity-75" : ""
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          {discount > 0 && inStock ? (
            <span className="bg-[#D91E2A] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
              SAVE {discount}%
            </span>
          ) : !inStock ? (
            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
              OUT OF STOCK
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => onToggleWishlist?.(id)}
            className={`w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center transition-colors cursor-pointer ${
              isWishlisted ? "text-[#D91E2A]" : "text-slate-400 hover:text-[#D91E2A]"
            }`}
            aria-label="Wishlist"
          >
            <svg
              className="w-3.5 h-3.5"
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
        </div>

        <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="text-slate-400 flex flex-col items-center">
              <svg
                className="w-8 h-8 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span className="text-[9px] font-medium text-slate-500 mt-1">Wondersale</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 mb-1">
          <div className="flex items-center bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] font-bold text-emerald-700">
            <span>{rating.toFixed(1)}</span>
            <span className="text-amber-500 ml-0.5">★</span>
          </div>
          {ratingCount > 0 && <span className="text-[10px] text-slate-400">({ratingCount})</span>}
        </div>

        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug mb-1.5 min-h-[32px]">
          {title}
        </h3>
      </div>

      <div>
        <div className="flex items-baseline space-x-1.5 mb-2.5">
          <span className="text-sm font-extrabold text-slate-900">
            {formatPrice(sellingPricePaise)}
          </span>
          {discount > 0 && (
            <span className="text-[11px] text-slate-400 line-through">{formatPrice(mrpPaise)}</span>
          )}
        </div>

        {inStock ? (
          <button
            type="button"
            onClick={() => onAddToCart?.(id)}
            className="w-full h-9 bg-[#D91E2A] hover:bg-[#B31520] text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 shadow-sm transition-colors cursor-pointer"
          >
            <span>+ Add to Cart</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full h-9 bg-slate-100 text-slate-400 text-xs font-medium rounded-lg flex items-center justify-center cursor-not-allowed border border-slate-200"
          >
            Out of Stock
          </button>
        )}
      </div>
    </div>
  );
};
