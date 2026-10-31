import React from "react";
import Link from "next/link";
import {
  Store,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  Truck,
} from "lucide-react";

export const StorefrontFooter: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-10 pb-24 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        {/* Value Proposition Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-800 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#D91E2A] flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Express Bhopal Delivery</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                2-hour delivery across Bhopal municipal limits
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#D91E2A] flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">100% Genuine Retail</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Direct retail store stock with brand warranties
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#D91E2A] flex-shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">7-Day Easy Replacement</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hassle-free replacement for defective products
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#D91E2A] flex-shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">UPI & COD Available</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Secure payment via UPI, cards, and Cash on Delivery
              </p>
            </div>
          </div>
        </div>

        {/* Links & Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#D91E2A] flex items-center justify-center text-white font-bold">
                <Store className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-base tracking-tight">WONDERSALE</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Wondersale is Bhopal’s preferred retail superstore offering electronics, appliances,
              toys, snacks, and homeware directly to your doorstep.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D91E2A] flex-shrink-0" />
                <span>Zone-I, MP Nagar, Bhopal, Madhya Pradesh 462011</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D91E2A] flex-shrink-0" />
                <span>+91 755 4000000 (10 AM - 9 PM)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D91E2A] flex-shrink-0" />
                <span>support@wondersale.in</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Shop Departments
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/category/home-appliances"
                  className="hover:text-white transition-colors"
                >
                  Home Appliances
                </Link>
              </li>
              <li>
                <Link
                  href="/category/kitchen-appliances"
                  className="hover:text-white transition-colors"
                >
                  Kitchen Appliances
                </Link>
              </li>
              <li>
                <Link
                  href="/category/electronics-audio"
                  className="hover:text-white transition-colors"
                >
                  Electronics & Audio
                </Link>
              </li>
              <li>
                <Link
                  href="/category/crockery-kitchenware"
                  className="hover:text-white transition-colors"
                >
                  Crockery & Kitchenware
                </Link>
              </li>
              <li>
                <Link href="/category/toys-games" className="hover:text-white transition-colors">
                  Toys & Games
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Customer Support & Policies
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/track-order" className="hover:text-white transition-colors">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-white transition-colors">
                  Shipping & Pincode Coverage
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors">
                  Returns & Replacement Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy & DPDP Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          © 2026 Wondersale Retail Private Limited. All rights reserved. Prices inclusive of GST.
        </div>
      </div>
    </footer>
  );
};
