"use client";

import React from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { useStorefront } from "@/context/StorefrontContext";

const MAP_SHARE_URL = "https://maps.google.com/?q=Wonder+Sale+Bhopal+Plaza+Hamidia+Road+Bhopal";
const MAP_EMBED_URL = "https://maps.google.com/maps?q=Wonder%20Sale,%20Bhopal%20Plaza,%20Hamidia%20Road,%20Bhopal&t=&z=15&ie=UTF8&iwloc=&output=embed";

export const StorefrontFooter: React.FC = () => {
  const { openCategoryMenu } = useStorefront();
  return (
    <footer className="bg-[#42060B] text-[#FDF8EE] pt-6 sm:pt-12 pb-20 md:pb-8 border-t border-[#7A0C16]">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 space-y-6 sm:space-y-8">
        {/* Main Grid: Brand + Categories + Customer Support + Google Map */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-6 lg:gap-8 items-start">
          {/* 1. Brand Logo, Mission & Contact Info */}
          <div className="md:col-span-4 lg:col-span-4">
            <div className="mb-2 sm:mb-3.5">
              <div className="block md:hidden">
                <WondersaleLogo size="sm" variant="dark" />
              </div>
              <div className="hidden md:block">
                <WondersaleLogo size="md" variant="dark" />
              </div>
            </div>
            <p className="text-xs text-[#D8B4B8] leading-relaxed mb-3 sm:mb-4">
              Wondersale is your trusted retail superstore offering electronics, appliances,
              toys, snacks, and homeware directly to your doorstep with express delivery.
            </p>
            <div className="space-y-1.5 text-xs text-[#D8B4B8]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>Bhopal Plaza, Hamidia Road, Ghora Nakkas, Bhopal, MP 462001</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-300 shrink-0" />
                <span>+91 97550 04996 / 0755 4000000 (10 AM - 9 PM)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-300 shrink-0" />
                <span>support@wondersale.in</span>
              </div>
            </div>
          </div>

          {/* 2 & 3. Navigation Links Grouped Together: Shop Categories + Customer Support */}
          <div className="md:col-span-5 lg:col-span-5 grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FDF8EE] mb-2.5 sm:mb-3">
                Shop Categories
              </h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={openCategoryMenu}
                    className="hover:text-amber-200 transition-colors font-medium text-amber-300 text-left cursor-pointer"
                  >
                    View All Categories →
                  </button>
                </li>
                <li>
                  <Link
                    href="/search?category=Electronics"
                    className="hover:text-amber-200 transition-colors"
                  >
                    Electronics
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search?category=Home%20%26%20Kitchen"
                    className="hover:text-amber-200 transition-colors"
                  >
                    Home & Kitchen
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search?category=Fashion%20%26%20Accessories"
                    className="hover:text-amber-200 transition-colors"
                  >
                    Fashion & Accessories
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search?category=Food%20Items"
                    className="hover:text-amber-200 transition-colors"
                  >
                    Food Items
                  </Link>
                </li>
                <li>
                  <Link
                    href="/search?category=Personal%20Care%20%26%20Beauty"
                    className="hover:text-amber-200 transition-colors"
                  >
                    Personal Care & Beauty
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FDF8EE] mb-2.5 sm:mb-3">
                Customer Support & Policies
              </h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs">
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

          {/* 4. Google Maps Location Embed (Right column on desktop, stacked on mobile) */}
          <div className="md:col-span-3 lg:col-span-3 w-full">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FDF8EE] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-300" />
                Store Location
              </h4>
              <a
                href={MAP_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-300 hover:text-amber-200 hover:underline inline-flex items-center gap-0.5 font-sans"
              >
                <span>Directions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-[#7A0C16] shadow-sm bg-[#2C0407]">
              <iframe
                title="Wondersale Store Location"
                src={MAP_EMBED_URL}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full grayscale-[25%] contrast-105"
              />
            </div>
            <p className="text-[10px] text-[#D8B4B8]/80 mt-1.5">
              4th Floor, Bhopal Plaza, Hamidia Road, Bhopal
            </p>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-5 sm:pt-8 border-t border-[#5A0A10] text-center text-xs text-[#D8B4B8]/80">
          © 2026 Wondersale Retail Private Limited. All rights reserved. Prices inclusive of GST.
        </div>
      </div>
    </footer>
  );
};
