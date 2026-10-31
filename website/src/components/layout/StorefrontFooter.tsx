import React from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

export const StorefrontFooter: React.FC = () => {
  return (
    <footer className="bg-[#42060B] text-[#FDF8EE] pt-12 pb-24 border-t border-[#7A0C16]">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        {/* Links & Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-3.5">
              <WondersaleLogo size="md" variant="dark" />
            </div>
            <p className="text-xs text-[#D8B4B8] leading-relaxed mb-4">
              Wondersale is Bhopal’s preferred retail superstore offering electronics, appliances,
              toys, snacks, and homeware directly to your doorstep.
            </p>
            <div className="space-y-1.5 text-xs text-[#D8B4B8]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>Zone-I, MP Nagar, Bhopal, Madhya Pradesh 462011</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>+91 755 4000000 (10 AM - 9 PM)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>support@wondersale.in</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FDF8EE] mb-3">
              Shop Departments
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/category/home-appliances"
                  className="hover:text-amber-200 transition-colors"
                >
                  Home Appliances
                </Link>
              </li>
              <li>
                <Link
                  href="/category/kitchen-appliances"
                  className="hover:text-amber-200 transition-colors"
                >
                  Kitchen Appliances
                </Link>
              </li>
              <li>
                <Link
                  href="/category/electronics-audio"
                  className="hover:text-amber-200 transition-colors"
                >
                  Electronics & Audio
                </Link>
              </li>
              <li>
                <Link
                  href="/category/crockery-kitchenware"
                  className="hover:text-amber-200 transition-colors"
                >
                  Crockery & Kitchenware
                </Link>
              </li>
              <li>
                <Link href="/category/toys-games" className="hover:text-amber-200 transition-colors">
                  Toys & Games
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FDF8EE] mb-3">
              Customer Support & Policies
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/track-order" className="hover:text-amber-200 transition-colors">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-amber-200 transition-colors">
                  Shipping & Pincode Coverage
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-amber-200 transition-colors">
                  Returns & Replacement Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-amber-200 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-amber-200 transition-colors">
                  Privacy & DPDP Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#5A0A10] text-center text-xs text-[#D8B4B8]/80">
          © 2026 Wondersale Retail Private Limited. All rights reserved. Prices inclusive of GST.
        </div>
      </div>
    </footer>
  );
};
