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
  showSubtitle = true,
  subtitle = "Bhopal Store & Online Pan-India",
  href = "/",
  variant = "light",
  className = "",
}) => {
  const isDark = variant === "dark";

  // Dimension mapping
  const dimensions = {
    sm: { img: 26, title: "text-base tracking-tight", sub: "text-[9px]" },
    md: { img: 34, title: "text-xl tracking-tight", sub: "text-[10px]" },
    lg: { img: 42, title: "text-2xl tracking-tight", sub: "text-xs" },
  }[size];

  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* Brand Icon Badge with original Logo Graphic */}
      <div
        className={`relative shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-200`}
        style={{ width: dimensions.img, height: dimensions.img }}
      >
        <Image
          src="/logo.png"
          alt="Wondersale Brand Logo"
          width={dimensions.img * 2}
          height={dimensions.img * 2}
          priority
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Wordmark & Tagline */}
      <div className="flex flex-col leading-none">
        <span
          className={`font-sans font-black uppercase leading-none transition-colors ${
            dimensions.title
          } ${
            isDark
              ? "text-[#FDF8EE] group-hover:text-amber-200"
              : "text-[#7A0C16] group-hover:text-[#5A0A10]"
          }`}
        >
          WONDERSALE
        </span>
        {showSubtitle && (
          <span
            className={`font-medium tracking-wide mt-1 leading-none ${dimensions.sub} ${
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
