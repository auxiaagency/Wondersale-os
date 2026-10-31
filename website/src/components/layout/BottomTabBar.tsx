"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid, Tag, ShoppingBag, User } from "lucide-react";

export interface BottomTabBarProps {
  cartCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ cartCount = 3 }) => {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Categories", href: "/categories", icon: Grid },
    { label: "Offers", href: "/offers", icon: Tag, badge: "HOT" },
    { label: "Cart", href: "/cart", icon: ShoppingBag, count: cartCount },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-md mx-auto flex justify-around items-center px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 w-14 transition-all duration-150 relative select-none ${
                isActive
                  ? "text-[#D91E2A] font-bold"
                  : "text-slate-500 hover:text-slate-900 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-[#D91E2A] text-white text-[8px] font-black px-1 rounded-full uppercase leading-tight">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#D91E2A] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
