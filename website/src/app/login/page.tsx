"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HelpCircle,
  Clock,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  X,
  ChevronRight,
  Edit2,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (cleanNumber.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: cleanNumber }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsOtpSent(true);
        setDevOtpHint(data.data.devOtp || "123456");
        setCountdown(30);
        setErrorMsg("");
      } else {
        setErrorMsg(data.error?.message || "Failed to dispatch OTP");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      val = val[val.length - 1];
    }
    const nextOtp = [...otp];
    nextOtp[index] = val;
    setOtp(nextOtp);

    // Auto-focus next input box
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const entered = otp.join("");
    if (entered.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit OTP");
      return;
    }
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: cleanNumber, code: entered }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== "undefined") {
          localStorage.setItem("wondersale_token", data.data?.token || "ws_session_token_placeholder");
          if (data.data?.user) {
            localStorage.setItem("wondersale_user", JSON.stringify(data.data.user));
          }
          window.dispatchEvent(new Event("wondersale_auth_change"));
        }
        router.push("/account");
      } else {
        setErrorMsg(data.error?.message || "Invalid OTP code");
      }
    } catch {
      setErrorMsg("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] flex flex-col font-sans selection:bg-[#680114]/20 selection:text-[#680114] justify-between">
      {/* 1. GLOBAL HEADER & BREADCRUMBS */}
      <GlobalHeader />
      <div className="bg-[#F6E9C8] border-b-2 border-[#680114]/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-2.5">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-serif font-bold text-[#680114] whitespace-nowrap overflow-x-auto no-scrollbar"
          >
            <Link
              href="/"
              className="hover:text-[#88091E] flex items-center transition-colors shrink-0"
            >
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 text-[#680114]" />
            <span className="text-[#680114] font-extrabold shrink-0">Sign In / Register</span>
          </nav>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-lg md:max-w-xl mx-auto px-4 sm:px-6 py-8 md:py-16 flex flex-col justify-center">
        
        {/* LOGIN CREDENTIAL CARD */}
        <div className="bg-[#EFE0BC] border-2 border-[#680114] rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-xs relative">
          
          {/* CARD HEADER */}
          <div className="mb-6">
            <h1 className="font-serif font-extrabold text-2xl md:text-3xl tracking-tight text-[#680114] leading-snug">
              Sign In / Register
            </h1>
            <p className="text-xs md:text-sm text-[#680114]/80 mt-1.5 leading-relaxed">
              Get access to express doorstep deliveries, live tracked orders, and exclusive store member deals.
            </p>
          </div>

          {/* AUTHENTICATION FORM */}
          <div className="space-y-4">
            {/* Step 1: Mobile Input Container */}
            <div className="bg-[#EFE0BC] border-2 border-[#680114] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-serif font-bold text-[#680114] block">
                  Enter Mobile Number
                </label>
                <span className="text-[10px] text-[#680114]/80 font-medium">
                  OTP verification code
                </span>
              </div>
              <form onSubmit={handleSendOtp} className="flex items-center gap-2">
                {/* Country Code */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#F6E9C8] border-2 border-[#680114] rounded-xl text-xs font-serif font-bold text-[#680114] shrink-0">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                {/* Number Input */}
                <div className="flex-1 flex items-center justify-between bg-[#F6E9C8] border-2 border-[#680114] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#680114] focus-within:border-[#680114] transition-all">
                  <input
                    type="tel"
                    maxLength={12}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter 10-digit number"
                    className="w-full bg-transparent p-0 text-sm font-semibold tracking-wide text-[#680114] placeholder-[#735A4A]/60 focus:outline-none border-none ring-0"
                  />
                  {phoneNumber && (
                    <button
                      type="button"
                      onClick={() => setPhoneNumber("")}
                      aria-label="Clear field"
                      className="w-5 h-5 rounded-full flex items-center justify-center bg-[#E8D7B0] text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </form>
              {errorMsg && (
                <p className="text-[11px] font-semibold text-[#88091E] mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errorMsg}
                </p>
              )}
            </div>

            {/* Step 2: OTP Verification Card */}
            {isOtpSent && (
              <div className="bg-[#EFE0BC] border-2 border-[#680114] rounded-2xl p-4 sm:p-5 shadow-xs relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-serif font-bold text-[#680114]">
                      Enter 6-digit OTP sent to
                    </span>
                    <span className="text-xs font-semibold text-[#680114] mt-0.5 tracking-wide">
                      +91 {phoneNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOtpSent(false)}
                    className="inline-flex items-center gap-1 text-xs font-serif font-bold text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] px-2.5 py-1 bg-[#F6E9C8] border-2 border-[#680114] rounded-lg transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>

                {/* 6-digit PIN Boxes */}
                <div className="flex justify-between items-center gap-1.5 sm:gap-2 my-3">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      className={`w-11 h-12 text-center rounded-xl font-bold text-lg text-[#680114] transition-all border-2 ${
                        idx === 4 && !digit
                          ? "border-[#680114] ring-2 ring-[#680114]/30 bg-[#F6E9C8]"
                          : "border-[#680114] bg-[#F6E9C8] focus:bg-white focus:border-[#680114]"
                      }`}
                    />
                  ))}
                </div>

                {/* Resend Timer */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[#680114]/80 flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5 text-[#680114]/70" />
                    Resend OTP in{" "}
                    <strong className="text-[#680114] font-bold">0:{countdown}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCountdown(30)}
                    className="font-serif font-bold text-[#680114] hover:underline cursor-pointer"
                  >
                    Resend via SMS
                  </button>
                </div>

                {/* WhatsApp Alternative */}
                <div className="mt-3 pt-2.5 border-t border-[#680114]/20 flex items-center justify-between">
                  <span className="text-[11px] text-[#680114]/80 font-medium">
                    {devOtpHint ? `Dev OTP: ${devOtpHint}` : "Didn't receive SMS?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCountdown(30)}
                    className="inline-flex items-center gap-1 text-[11px] font-serif font-bold text-[#1E824C] bg-[#EAF7EE] px-2.5 py-1 rounded-full border-2 border-[#1E824C] hover:bg-[#1E824C] hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    <MessageCircle className="h-3 w-3" />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* Primary CTA Button */}
            <button
              onClick={isOtpSent ? handleVerifyOtp : () => handleSendOtp()}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] font-serif font-bold text-sm md:text-base rounded-xl border-2 border-[#680114] shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F6E9C8] border-t-transparent" />
              ) : isOtpSent ? (
                <>
                  <span>Verify &amp; Proceed</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Get Verification Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* TRUST & LEGAL CARD FOOTER */}
          <div className="mt-6 pt-5 border-t-2 border-[#680114]/20 text-center space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6E9C8] text-[10px] md:text-[11px] font-medium text-[#680114] border-2 border-[#680114]/30 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-[#680114]" />
              <span>100% Secure authentication via official telecom SMS gateway</span>
            </div>
            <p className="text-[10px] md:text-[11px] leading-relaxed text-[#680114]/80 max-w-sm mx-auto">
              By continuing, you agree to Wondersale&apos;s{" "}
              <Link href="/terms" className="underline hover:text-[#680114] font-semibold">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-[#680114] font-semibold">
                Privacy Policy
              </Link>.
            </p>
            <div className="pt-1 text-[10px] md:text-[11px] text-[#680114] font-medium flex items-center justify-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Store Help Desk: 0755-4209999 (9 AM - 10 PM)</span>
            </div>
          </div>

        </div>
      </main>

      {/* DESKTOP FOOTER */}
      <div className="hidden md:block">
        <StorefrontFooter />
      </div>
    </div>
  );
}
