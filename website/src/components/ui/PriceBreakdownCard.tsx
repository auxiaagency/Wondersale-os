import React from "react";
import { formatPrice } from "@/lib/format";

export interface PriceBreakdownCardProps {
  itemTotalPaise: number;
  deliveryFeePaise: number;
  gstPaise: number;
  couponDiscountPaise?: number;
  couponCode?: string;
  className?: string;
}

export const PriceBreakdownCard: React.FC<PriceBreakdownCardProps> = ({
  itemTotalPaise,
  deliveryFeePaise,
  gstPaise,
  couponDiscountPaise = 0,
  couponCode,
  className = "",
}) => {
  const grandTotalPaise = Math.max(
    0,
    itemTotalPaise + deliveryFeePaise + gstPaise - couponDiscountPaise
  );

  return (
    <div
      className={`bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs ${className}`}
    >
      <div className="flex justify-between text-[#680114]">
        <span>Item Total</span>
        <span className="font-medium text-[#680114]">{formatPrice(itemTotalPaise)}</span>
      </div>
      <div className="flex justify-between text-[#680114]">
        <span>Delivery Fee</span>
        {deliveryFeePaise === 0 ? (
          <span className="text-[#1E9E5A] font-semibold">FREE</span>
        ) : (
          <span className="font-medium text-[#680114]">{formatPrice(deliveryFeePaise)}</span>
        )}
      </div>
      <div className="flex justify-between text-[#680114]">
        <span>Taxes & GST (Included)</span>
        <span className="font-medium text-[#680114]">{formatPrice(gstPaise)}</span>
      </div>
      {couponDiscountPaise > 0 && (
        <div className="flex justify-between text-[#D91E2A] font-medium bg-red-50 p-1.5 rounded">
          <span>Coupon Savings {couponCode ? `(${couponCode})` : ""}</span>
          <span>−{formatPrice(couponDiscountPaise)}</span>
        </div>
      )}
      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-[#680114]">
        <span>Grand Total</span>
        <span className="text-[#D91E2A] text-base">{formatPrice(grandTotalPaise)}</span>
      </div>
    </div>
  );
};
