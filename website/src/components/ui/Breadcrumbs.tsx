"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isTag?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  sticky?: boolean;
}

export function Breadcrumbs({ items, className = "", sticky = false }: BreadcrumbsProps) {
  const containerClasses = sticky
    ? "sticky top-[118px] md:top-20 z-30 bg-[#F6E9C8] py-1.5 md:py-2 px-1 mb-2 border-b border-[#680114]/15"
    : "bg-[#F6E9C8] py-2 md:py-2.5 px-1 mb-3 border-b border-[#680114]/15";

  return (
    <div className={`${containerClasses} ${className}`.trim()}>
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-base font-serif font-bold text-[#680114] whitespace-nowrap overflow-x-auto no-scrollbar"
      >
        <Link
          href="/"
          className="hover:text-[#88091E] flex items-center transition-colors shrink-0"
        >
          <span>Home</span>
        </Link>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60 shrink-0 text-[#680114]" />
              {item.isTag ? (
                <span className="text-[#680114] font-bold bg-[#EFE0BC] border border-[#680114]/30 px-2 py-0.5 rounded-full text-[11px] sm:text-sm shrink-0">
                  {item.label}
                </span>
              ) : isLast || !item.href ? (
                <span className="text-[#680114] font-extrabold shrink-0 truncate max-w-xs sm:max-w-md">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-[#88091E] transition-colors shrink-0"
                >
                  {item.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}

