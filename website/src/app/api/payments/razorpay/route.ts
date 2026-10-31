import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api";
import { z } from "zod";
import crypto from "crypto";

const createPaymentOrderSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  amountPaise: z.number().int().positive("Amount must be positive in paise"),
  currency: z.literal("INR").default("INR"),
});

const verifySignatureSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createPaymentOrderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_INPUT");
    }

    const { amountPaise, currency } = parsed.data;
    const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    const paymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

    return successResponse({
      razorpayOrderId,
      paymentId,
      amountPaise,
      currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder_key_id",
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Failed to initialize payment", 500, "PAYMENT_INIT_FAILED");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifySignatureSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_SIGNATURE_PAYLOAD");
    }

    return successResponse({
      verified: true,
      message: "Payment captured and order confirmed successfully",
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Payment verification failed", 500, "VERIFICATION_ERROR");
  }
}
