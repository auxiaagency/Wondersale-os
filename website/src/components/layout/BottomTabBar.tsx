"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Search, ShoppingBag, User } from "lucide-react";
import { useStorefront } from "@/context/StorefrontContext";

export const BottomTabBar: React.FC = () => {
  const pathname = usePathname();
  const { cartCount, isHydrated } = useStorefront();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Categories", href: "/categories", icon: Grid },
    { label: "Search", href: "/search", icon: Search },
    { label: "Cart", href: "/cart", icon: ShoppingBag, count: isHydrated ? cartCount : 0 },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50 pb-[env(safe-area-inset-bottom,0px)] bg-[#FDF8EE]/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(90,10,16,0.08)] border-t border-[#EADFC7]"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative min-w-[44px] ${
                isActive
                  ? "text-[#7A0C16] font-bold text-xs"
                  : "text-[#735A4A] hover:text-[#2C1810] font-medium text-xs"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#7A0C16] text-[#FDF8EE] text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-0.5">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
              {isActive && <span className="w-1 h-1 bg-[#7A0C16] rounded-full mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

