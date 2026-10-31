import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "brand" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "brand",
  size = "md",
  className = "",
}) => {
  const variantStyles = {
    success: "bg-[#E8F7F0] text-[#1E9E5A] border border-emerald-200",
    warning: "bg-[#FEF3C7] text-[#B45309] border border-amber-200",
    error: "bg-[#FEECEC] text-[#D91E2A] border border-red-200",
    info: "bg-[#EFF6FF] text-[#2563EB] border border-blue-200",
    brand: "bg-[#D91E2A] text-white",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  const sizeStyles = {
    sm: "text-[10px] px-1.5 py-0.5 rounded",
    md: "text-[11px] px-2.5 py-1 rounded-full font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
