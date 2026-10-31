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

  // Dimension mapping calibrated directly to the official Wondersale brandlockup:
  // Icon aspect ratio is 400x300 (4:3), and the font cap height aligns precisely with the icon top and bottom
  const dimensions = {
    sm: { imgW: 38, imgH: 28, title: "text-[22px]", gap: "gap-2" },
    md: { imgW: 48, imgH: 36, title: "text-[28px]", gap: "gap-2.5" },
    lg: { imgW: 60, imgH: 45, title: "text-[36px]", gap: "gap-3" },
  }[size];

  const content = (
    <div className={`inline-flex items-center ${dimensions.gap} group select-none ${className}`}>
      {/* Brand Icon Badge with original Logo Graphic */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-200"
        style={{ width: dimensions.imgW, height: dimensions.imgH }}
      >
        <Image
          src="/logo.png"
          alt="Wondersale Brand Logo"
          width={dimensions.imgW * 2}
          height={dimensions.imgH * 2}
          priority
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Wordmark */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className={`font-sans font-black tracking-[-0.03em] uppercase leading-none transition-colors ${
            dimensions.title
          } ${
            isDark
              ? "text-[#FDF8EE] group-hover:text-amber-200"
              : "text-[#5A0A10] group-hover:text-[#7A0C16]"
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
