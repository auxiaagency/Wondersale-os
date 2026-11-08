"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Search, ShoppingBag, User } from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";

export const BottomTabBar: React.FC = () => {
  const pathname = usePathname();
  const {
    cartCount,
    isHydrated,
    toggleCategoryMenu,
    isCategoryMenuOpen,
    isSearchModalOpen,
    openSearchModal,
    closeSearchModal,
  } = useStorefront();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Categories", href: "#categories-menu", icon: Grid, isMenuTrigger: true },
    { label: "Search", href: "#search-drawer", icon: Search, isSearchTrigger: true },
    { label: "Cart", href: "/cart", icon: ShoppingBag, count: isHydrated ? cartCount : 0 },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50 pb-[env(safe-area-inset-bottom,0px)] bg-[#5A0A10] shadow-[0_-4px_24px_rgba(0,0,0,0.35)] border-t border-[#7A0C16]"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = item.isMenuTrigger
            ? isCategoryMenuOpen
            : item.isSearchTrigger
            ? isSearchModalOpen
            : pathname === item.href;
          const Icon = item.icon;

          if (item.isMenuTrigger || item.isSearchTrigger) {
            const handleTriggerClick = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.isMenuTrigger) {
                toggleCategoryMenu();
              } else {
                if (isSearchModalOpen) {
                  closeSearchModal();
                } else {
                  openSearchModal();
                }
              }
            };
            return (
              <button
                key={item.label}
                type="button"
                onClick={handleTriggerClick}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all relative min-w-[44px] cursor-pointer ${
                  isActive
                    ? "text-[#FDF8EE] font-extrabold"
                    : "text-[#EADFC7]/85 hover:text-[#FDF8EE] font-bold"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? "stroke-[2.8] scale-110 text-[#FDF8EE]" : "stroke-[2.4] text-[#EADFC7]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] mt-1 leading-tight tracking-wide ${
                    isActive ? "text-[#FDF8EE] font-extrabold" : "text-[#EADFC7] font-bold"
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 bg-[#FEC501] rounded-full mt-0.5 shadow-xs" />
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all relative min-w-[44px] ${
                isActive
                  ? "text-[#FDF8EE] font-extrabold"
                  : "text-[#EADFC7]/85 hover:text-[#FDF8EE] font-bold"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "stroke-[2.8] scale-110 text-[#FDF8EE]" : "stroke-[2.4] text-[#EADFC7]"
                  }`}
                />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#F6E9C8] text-[#680114] text-[9.5px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-xs border border-[#680114] leading-none">
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 leading-tight tracking-wide ${
                  isActive ? "text-[#FDF8EE] font-extrabold" : "text-[#EADFC7] font-bold"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-[#FEC501] rounded-full mt-0.5 shadow-xs" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
