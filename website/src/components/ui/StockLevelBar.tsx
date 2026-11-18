"use client";

import React from "react";

export interface StockLevelBarProps {
  inStock?: boolean;
  stockCount?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * Dynamic smooth stock status bar.
 * - Out of stock (or stockCount <= 0): Emptied & grayed out.
 * - Very low stock (1 - 3 units): Red dynamic bar (~25% width) + "Only X Left - Order Now!" high urgency.
 * - Low stock (4 - 10 units): Yellow dynamic bar (~55% width) + "Limited Stock - Selling Fast" medium urgency.
 * - In stock (> 10 units or inStock=true with unconstrained count): Green full smooth bar (~90-100% width) + "In Stock - Ready to Ship" positive reassurance.
 */
export const StockLevelBar: React.FC<StockLevelBarProps> = ({
  inStock = true,
  stockCount,
  className = "",
  size = "md",
  showLabel = true,
}) => {
  // Determine availability
  const isAvailable = inStock && (stockCount === undefined || stockCount > 0);

  let status: "out_of_stock" | "very_low" | "low" | "in_stock" = "in_stock";
  let percent = 100;
  let label = "In Stock";
  let subMessage = "Ready to Ship";
  let barGradient = "bg-gradient-to-r from-emerald-500 to-green-600";
  let textColor = "text-emerald-800";
  let subColor = "text-emerald-700";
  let dotColor = "bg-emerald-500";
  let trackColor = "bg-emerald-100/70 border-emerald-300";

  if (!isAvailable) {
    status = "out_of_stock";
    percent = 0;
    label = "Out of Stock";
    subMessage = "Currently Unavailable";
    barGradient = "bg-gray-400";
    textColor = "text-gray-500";
    subColor = "text-gray-400";
    dotColor = "bg-gray-400";
    trackColor = "bg-gray-200/80 border-gray-300";
  } else if (stockCount !== undefined) {
    if (stockCount <= 3) {
      status = "very_low";
      percent = Math.max(18, Math.min(30, (stockCount / 3) * 30));
      label = "Very Low Stock";
      subMessage = "⚡ Almost Gone - Order Now!";
      barGradient = "bg-gradient-to-r from-rose-500 to-red-600";
      textColor = "text-red-700 font-extrabold";
      subColor = "text-red-600 font-bold animate-pulse";
      dotColor = "bg-red-500";
      trackColor = "bg-red-100/70 border-red-300";
    } else if (stockCount <= 10) {
      status = "low";
      percent = Math.max(40, Math.min(65, (stockCount / 10) * 65));
      label = "Low Stock";
      subMessage = "⏳ Limited Stock - Selling Fast";
      barGradient = "bg-gradient-to-r from-amber-400 to-amber-500";
      textColor = "text-amber-800 font-bold";
      subColor = "text-amber-700 font-medium";
      dotColor = "bg-amber-500";
      trackColor = "bg-amber-100/70 border-amber-300";
    } else {
      status = "in_stock";
      percent = 100;
      label = "In Stock";
      subMessage = "✓ Verified Store Stock";
      barGradient = "bg-gradient-to-r from-emerald-500 to-green-600";
      textColor = "text-emerald-800 font-bold";
      subColor = "text-emerald-700 font-medium";
      dotColor = "bg-emerald-500";
      trackColor = "bg-emerald-100/70 border-emerald-300";
    }
  }

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-2.5",
  }[size];

  const textSizeClasses = {
    sm: "text-[10px]",
    md: "text-[11px]",
    lg: "text-xs",
  }[size];

  return (
    <div className={`w-full flex flex-col gap-1.5 select-none ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              {status !== "out_of_stock" && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
                />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
            </span>
            <span className={`font-bold ${textSizeClasses} ${textColor}`}>
              {label}
            </span>
          </div>
          <span className={`text-[9.5px] sm:text-[10px] tracking-tight truncate ${subColor}`}>
            {subMessage}
          </span>
        </div>
      )}

      {/* Progress Track */}
      <div
        className={`w-full rounded-full overflow-hidden border p-[1px] ${trackColor} ${heightClasses} transition-all duration-300`}
      >
        <div
          className={`h-full rounded-full ${barGradient} transition-all duration-700 ease-out shadow-xs`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

