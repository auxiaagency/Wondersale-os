import React from "react";
import Image from "next/image";
import Link from "next/link";

export interface WondersaleLogoProps {
  /**
   * Size presets:
   * - 'sm': mobile headers, subpages (height ~28px)
   * - 'md': default desktop header (height ~36px)
   * - 'lg': footer / splash / auth hero (height ~44px)
   */
  size?: "sm" | "md" | "lg";
  /** Whether to show the subtitle tag line */
  showSubtitle?: boolean;
  /** Custom subtitle text (defaults to 'Bhopal Store & Online Pan-India') */
  subtitle?: string;
  /** Whether to wrap the logo in a Next.js Link to "/" */
  href?: string | null;
  /** Variant for dark backgrounds (e.g. footer) */
  variant?: "light" | "dark";
  /** Optional custom class name for the wrapper */
  className?: string;
}

export const WondersaleLogo: React.FC<WondersaleLogoProps> = ({
  size = "md",
  showSubtitle = false,
  subtitle = "",
  href = "/",
  variant = "light",
  className = "",
}) => {
  const isDark = variant === "dark";

  // Dimension mapping calibrated with tighter spacing and prominent logo badge
  const dimensions = {
    sm: { imgW: 56, imgH: 42, title: "text-[22px]", gap: "gap-1.5" },
    md: { imgW: 78, imgH: 58, title: "text-[28px]", gap: "gap-2" },
    lg: { imgW: 96, imgH: 72, title: "text-[36px]", gap: "gap-2.5" },
  }[size];

  const content = (
    <div className={`inline-flex items-center ${dimensions.gap} select-none ${className}`}>
      {/* Brand Icon Badge - Shifted slightly up with tighter text proximity */}
      <div
        className="relative shrink-0 flex items-center justify-center -translate-y-0.5"
        style={{ width: dimensions.imgW, height: dimensions.imgH }}
      >
        <Image
          src={isDark ? "/logo-cream-badge.png" : "/logo.png"}
          alt="Wondersale Brand Logo"
          width={dimensions.imgW * 2}
          height={dimensions.imgH * 2}
          priority
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Wordmark - Clean brand cream #F6E9C8 */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className={`font-sans font-black tracking-[-0.03em] uppercase leading-none ${
            dimensions.title
          } ${
            isDark
              ? "text-[#F6E9C8]"
              : "text-[#5A0A10]"
          }`}
          style={{ letterSpacing: "-0.02em" }}
        >
          WONDERSALE
        </span>
        {showSubtitle && subtitle && (
          <span
            className={`font-medium tracking-wide mt-1 leading-none text-[10px] ${
              isDark ? "text-[#EADFC7]" : "text-[#735A4A]"
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A0C16] rounded-md">
        {content}
      </Link>
    );
  }

  return content;
};
