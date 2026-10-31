import { z } from "zod";
import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    },
    { status }
  );
}

// Zod schemas for API routes
export const otpRequestSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

export const otpVerifySchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  code: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 numeric digits"),
});

export const pincodeCheckSchema = z.object({
  pincode: z
    .string()
    .length(6, "Indian postal PIN code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Pincode must only contain digits"),
});

export const couponApplySchema = z.object({
  code: z.string().min(1, "Coupon code is required").toUpperCase(),
  cartTotalPaise: z.number().int().nonnegative(),
});

export const addressCreateSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  line1: z.string().min(5, "Address line 1 is required"),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().default("Bhopal"),
  state: z.string().default("Madhya Pradesh"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  isDefault: z.boolean().default(false),
});

export const orderCreateSchema = z.object({
  addressId: z.string().min(1, "Delivery address is required"),
  paymentMethod: z.enum([
    "COD",
    "RAZORPAY_UPI",
    "RAZORPAY_CARD",
    "RAZORPAY_NETBANKING",
    "RAZORPAY_WALLET",
  ]),
  couponCode: z.string().optional(),
  customerGstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export function sanitizeSearchQuery(input: string): string {
  if (!input) return "";
  return input
    .replace(/[<>'"\\;]/g, "")
    .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT|EXEC)\b/gi, "")
    .trim();
}
