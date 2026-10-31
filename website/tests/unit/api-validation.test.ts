import { describe, it, expect } from "vitest";
import {
  otpRequestSchema,
  otpVerifySchema,
  pincodeCheckSchema,
  couponApplySchema,
  addressCreateSchema,
} from "@/lib/api";

describe("API & Domain Validation Schemas", () => {
  it("validates 10-digit Indian mobile numbers starting with 6-9", () => {
    expect(otpRequestSchema.safeParse({ mobile: "9876543210" }).success).toBe(true);
    expect(otpRequestSchema.safeParse({ mobile: "8123456789" }).success).toBe(true);
    expect(otpRequestSchema.safeParse({ mobile: "7000000000" }).success).toBe(true);

    // Invalid numbers
    expect(otpRequestSchema.safeParse({ mobile: "1234567890" }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ mobile: "987654321" }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ mobile: "98765432100" }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ mobile: "abcdefghij" }).success).toBe(false);
  });

  it("validates 6-digit OTP codes", () => {
    expect(otpVerifySchema.safeParse({ mobile: "9876543210", code: "123456" }).success).toBe(true);
    expect(otpVerifySchema.safeParse({ mobile: "9876543210", code: "12345" }).success).toBe(false);
    expect(otpVerifySchema.safeParse({ mobile: "9876543210", code: "1234567" }).success).toBe(
      false
    );
  });

  it("validates 6-digit Indian PIN codes", () => {
    expect(pincodeCheckSchema.safeParse({ pincode: "462001" }).success).toBe(true);
    expect(pincodeCheckSchema.safeParse({ pincode: "462016" }).success).toBe(true);
    expect(pincodeCheckSchema.safeParse({ pincode: "46200" }).success).toBe(false);
    expect(pincodeCheckSchema.safeParse({ pincode: "4620012" }).success).toBe(false);
    expect(pincodeCheckSchema.safeParse({ pincode: "Bhopal" }).success).toBe(false);
  });

  it("validates coupon apply payloads", () => {
    expect(couponApplySchema.safeParse({ code: "WONDER50", cartTotalPaise: 49900 }).success).toBe(
      true
    );
    expect(couponApplySchema.safeParse({ code: "", cartTotalPaise: 49900 }).success).toBe(false);
    expect(couponApplySchema.safeParse({ code: "WONDER50", cartTotalPaise: -100 }).success).toBe(
      false
    );
  });

  it("validates address fields with Bhopal defaults", () => {
    const valid = addressCreateSchema.safeParse({
      fullName: "Pooja Sharma",
      mobile: "9826012345",
      line1: "Plot 12, Arera Colony",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462016",
    });
    expect(valid.success).toBe(true);

    const invalid = addressCreateSchema.safeParse({
      fullName: "P",
      mobile: "123",
      line1: "A",
      pincode: "12",
    });
    expect(invalid.success).toBe(false);
  });
});
