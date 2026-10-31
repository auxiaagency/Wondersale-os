"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Store,
  HelpCircle,
  Zap,
  CheckCircle,
  Phone,
  Edit2,
  Clock,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";

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
    <div className="relative mx-auto min-h-screen w-full max-w-[390px] bg-neutral-50 shadow-2xl flex flex-col font-sans">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white px-4 py-3 flex items-center justify-between shadow-xs border-b border-neutral-200">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            aria-label="Go Back"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-transform active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <WondersaleLogo size="sm" />
        </div>

        <a
          href="tel:07554209999"
          className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full bg-neutral-100 text-neutral-600 hover:text-[#D91E2A] transition-colors text-xs font-medium"
        >
          <HelpCircle className="h-3.5 w-3.5 text-[#D91E2A]" />
          <span>Help</span>
        </a>
      </header>

      {/* CONTENT BODY */}
      <div className="flex-1 px-4 pt-3 pb-8 flex flex-col">
        {/* 2. HERO WELCOME SECTION */}
        <section className="rounded-2xl p-4 bg-gradient-to-br from-red-50/60 via-white to-neutral-50 border border-red-100 shadow-xs relative overflow-hidden mb-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-[#D91E2A]">
              <Zap className="h-3 w-3 fill-current" />
              Retail Superstore
            </span>
          </div>
          <h1 className="font-extrabold text-[22px] tracking-tight text-neutral-900 leading-snug mb-1.5">
            Sign In / Register
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed mb-3">
            Get access to express doorstep deliveries, tracked orders, and exclusive store
            member deals.
          </p>

          {/* Mini Value Props Row */}
          <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-neutral-100 text-[10px] font-semibold text-neutral-800">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>2-Hr Delivery</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>₹150 Off First</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Easy Returns</span>
            </div>
          </div>
        </section>

        {/* 3. AUTHENTICATION WORKFLOW */}
        <section className="space-y-4">
          {/* Step 1: Mobile Input Container */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-900 block">
                Enter Mobile Number
              </label>
              <span className="text-[10px] text-neutral-400 font-medium">
                OTP will be sent for verification
              </span>
            </div>
            <form onSubmit={handleSendOtp} className="flex items-center gap-2">
              {/* Country Code */}
              <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-900 shrink-0">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              {/* Number Input */}
              <div className="flex-1 flex items-center justify-between bg-white border border-neutral-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#D91E2A] focus-within:border-transparent transition-all">
                <input
                  type="tel"
                  maxLength={12}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter 10-digit number"
                  className="w-full bg-transparent p-0 text-sm font-semibold tracking-wide text-neutral-900 focus:outline-none border-none ring-0"
                />
                {phoneNumber && (
                  <button
                    type="button"
                    onClick={() => setPhoneNumber("")}
                    aria-label="Clear field"
                    className="w-5 h-5 rounded-full flex items-center justify-center bg-neutral-200 text-neutral-600 hover:text-neutral-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </form>
            {errorMsg && <p className="text-[11px] text-red-600 font-medium mt-1">{errorMsg}</p>}
          </div>

          {/* Step 2: OTP Verification Card */}
          {isOtpSent && (
            <div className="bg-gradient-to-b from-neutral-50 to-white border-2 border-red-200 rounded-2xl p-4 shadow-xs relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-neutral-900">
                    Enter 6-digit OTP sent to
                  </span>
                  <span className="text-xs font-semibold text-[#D91E2A] mt-0.5 tracking-wide">
                    +91 {phoneNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#D91E2A] hover:underline px-2 py-1 bg-red-50 rounded-lg"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </button>
              </div>

              {/* 6-digit PIN Boxes */}
              <div className="flex justify-between items-center gap-1.5 my-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    className={`w-11 h-12 text-center rounded-xl font-bold text-lg text-neutral-900 border transition-all ${
                      idx === 4 && !digit
                        ? "border-2 border-[#D91E2A] ring-2 ring-red-100 bg-white"
                        : "border-neutral-300 bg-white"
                    }`}
                  />
                ))}
              </div>

              {/* Resend Timer */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-neutral-500 flex items-center gap-1 font-medium">
                  <Clock className="h-3.5 w-3.5 text-neutral-400" />
                  Resend OTP in{" "}
                  <strong className="text-neutral-800 font-semibold">0:{countdown}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCountdown(30)}
                  className="font-semibold text-[#D91E2A] hover:underline"
                >
                  Resend via SMS
                </button>
              </div>

              {/* WhatsApp Alternative */}
              <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] text-neutral-500 font-medium">
                  {devOtpHint ? `Dev OTP: ${devOtpHint}` : "Didn't receive SMS?"}
                </span>
                <button
                  type="button"
                  onClick={() => setCountdown(30)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="h-3 w-3 text-emerald-700" />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Primary CTA Button */}
          <button
            onClick={isOtpSent ? handleVerifyOtp : () => handleSendOtp()}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#D91E2A] text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[#B31520]"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
        </section>

        {/* 4. ALTERNATIVE SIGN IN */}
        <section className="mt-6 mb-2">
          <div className="relative flex items-center justify-center mb-4">
            <div className="border-t border-neutral-200 w-full absolute"></div>
            <span className="bg-neutral-50 px-3 text-[11px] font-medium text-neutral-400 relative z-10">
              Or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={() => router.push("/account")}
            className="w-full py-2.5 px-4 bg-white border border-neutral-300 rounded-xl flex items-center justify-center gap-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition-all active:scale-95 shadow-2xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="text-center mt-3">
            <Link
              href="/"
              className="text-xs font-semibold text-neutral-500 hover:text-[#D91E2A] transition-colors py-1"
            >
              Continue as Guest
            </Link>
          </div>
        </section>

        {/* 5. TRUST & LEGAL FOOTER */}
        <footer className="mt-auto pt-6 text-center space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-medium text-neutral-500 border border-neutral-200">
            <ShieldCheck className="h-3 w-3 text-[#D91E2A]" />
            <span>100% Secure authentication via official telecom SMS gateway</span>
          </div>
          <p className="text-[10px] leading-relaxed text-neutral-400 max-w-xs mx-auto">
            By continuing, you agree to Wondersale&apos;s{" "}
            <span className="underline hover:text-[#D91E2A]">Terms of Service</span> and{" "}
            <span className="underline hover:text-[#D91E2A]">Privacy Policy</span>.
          </p>
          <div className="pt-2 text-[10px] text-neutral-600 font-medium flex items-center justify-center gap-1">
            <Phone className="h-3 w-3 text-[#D91E2A]" />
            <span>Store Help Desk: 0755-4209999 (9 AM - 10 PM)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
