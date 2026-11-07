"use client";

import React, { useState } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MobileNumberInput } from "@/components/ui/MobileNumberInput";
import { OtpInput } from "@/components/ui/OtpInput";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { ProductCard } from "@/components/ui/ProductCard";
import { PriceBreakdownCard } from "@/components/ui/PriceBreakdownCard";
import { OrderTimeline } from "@/components/ui/OrderTimeline";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("4829");
  const [quantity, setQuantity] = useState(2);
  const [filterSelected, setFilterSelected] = useState(true);
  const [timelineStep, setTimelineStep] = useState<"ordered" | "packed" | "shipped" | "delivered">(
    "shipped"
  );
  const [wishlisted, setWishlisted] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-[#680114] pb-20">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <WondersaleLogo size="sm" subtitle="Stitch MCP Token & Component Verification" />
          </div>
          <Badge variant="error" size="sm">
            DEV ONLY
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
        {/* Section 1: Buttons */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              1. Buttons & Touch Action Targets (≥44px)
            </h2>
            <p className="text-xs text-slate-500">
              Primary (#D91E2A), Outline, Ghost, Disabled, and Loading states
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Primary Default</Button>
            <Button variant="primary" className="bg-[#B31520]">
              Pressed State
            </Button>
            <Button variant="primary" isLoading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="outline" size="icon" aria-label="Icon target">
              ★
            </Button>
          </div>
        </section>

        {/* Section 2: Form Inputs */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              2. Form Inputs & Selectors
            </h2>
            <p className="text-xs text-slate-500">
              Indian Mobile Number, OTP Box Grid, Standard & Validation Error States
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <MobileNumberInput
              value={mobileNumber}
              onChange={setMobileNumber}
              label="Customer Mobile (+91)"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                OTP Verification Grid
              </label>
              <OtpInput length={6} value={otp} onChange={setOtp} />
            </div>

            <Input
              label="Customer Full Name"
              placeholder="e.g. Rahul Sharma"
              defaultValue="Aarav Sharma"
            />

            <Input
              label="Delivery Email Address"
              placeholder="e.g. name@example.com"
              defaultValue="invalid-email"
              error="Please enter a valid email address with domain."
            />
          </div>

          <div className="pt-2 flex flex-wrap gap-6 items-center border-t border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Quantity Stepper
              </span>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Timeline Step Switcher
              </span>
              <div className="flex gap-1.5">
                {(["ordered", "packed", "shipped", "delivered"] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setTimelineStep(step)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize cursor-pointer ${
                      timelineStep === step
                        ? "bg-[#D91E2A] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Badges, Chips & Status */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              3. Status Badges & Filter Chips
            </h2>
            <p className="text-xs text-slate-500">
              Semantic notifications, discount ribbons, and filter chips
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 items-center">
            <Badge variant="success">Delivered (Success)</Badge>
            <Badge variant="warning">Only 2 Left (Warning)</Badge>
            <Badge variant="error">Out of Stock (Error)</Badge>
            <Badge variant="info">Free Delivery (Info)</Badge>
            <Badge variant="brand" size="sm">
              SAVE 45%
            </Badge>
            <Badge variant="neutral">Prime Assured</Badge>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 items-center">
            <Chip
              label="Price: Under ₹999"
              selected={filterSelected}
              onToggle={() => setFilterSelected(!filterSelected)}
              onRemove={() => setFilterSelected(false)}
            />
            <Chip label="Rating 4★+" selected={false} />
            <Chip label="Home & Kitchen" selected={false} />
            <Chip label="Electronics" selected={false} />
          </div>
        </section>

        {/* Section 4: Product Cards */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              4. Product Card Variants
            </h2>
            <p className="text-xs text-slate-500">
              Grid, horizontal, and out-of-stock variations with Indian price formatting
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">
                Grid Card (In Stock)
              </span>
              <ProductCard
                id="demo-1"
                title="boAt Rockerz 450 Bluetooth On Ear Headphones"
                mrpPaise={249000}
                sellingPricePaise={129900}
                rating={4.2}
                ratingCount={2140}
                isWishlisted={wishlisted}
                onToggleWishlist={() => setWishlisted(!wishlisted)}
                variant="grid"
              />
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">
                Grid Card (Out of Stock)
              </span>
              <ProductCard
                id="demo-2"
                title="Stainless Steel Vacuum Flask 1L - Insulated"
                mrpPaise={89900}
                sellingPricePaise={64900}
                rating={4.5}
                ratingCount={380}
                inStock={false}
                variant="grid"
              />
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">
                Horizontal List Card
              </span>
              <ProductCard
                id="demo-3"
                title="Premium Non-Stick Kitchen Cookware Pan"
                mrpPaise={199900}
                sellingPricePaise={149900}
                rating={4.8}
                ratingCount={612}
                variant="horizontal"
              />
            </div>
          </div>
        </section>

        {/* Section 5: Order Timeline & Price Breakdown */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              5. Commerce Details: Timeline & Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Step tracker and GST-inclusive price calculation card
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-700 block mb-3">
                Order Tracking Status
              </span>
              <OrderTimeline currentStep={timelineStep} />
            </div>

            <PriceBreakdownCard
              itemTotalPaise={249800}
              deliveryFeePaise={0}
              gstPaise={22400}
              couponDiscountPaise={25000}
              couponCode="WONDER50"
            />
          </div>
        </section>

        {/* Section 6: Brand Gyroscopic 3D Loading Spinner */}
        <section className="bg-[#F6E9C8] p-6 rounded-2xl border-2 border-[#680114] shadow-sm space-y-4">
          <div className="border-b border-[#680114]/20 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#680114]">
              6. Brand Gyroscopic 3D Loading Spinner
            </h2>
            <p className="text-xs text-[#735A4A]">
              Pure CSS 3D gyroscopic spinning rings with solid and dashed burgundy lines on cream background
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-6 overflow-hidden">
            <div className="text-center">
              <span className="text-xs font-serif font-bold text-[#680114] block mb-2">
                Responsive (160px Mobile / 250px Desktop, 3.5px lines)
              </span>
              <LoadingSpinner text="Loading Products..." />
            </div>

            <div className="text-center">
              <span className="text-xs font-serif font-bold text-[#680114] block mb-2">
                Compact (100px)
              </span>
              <LoadingSpinner size={100} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
