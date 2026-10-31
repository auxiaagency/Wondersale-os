import { NextRequest } from "next/server";
import { otpRequestSchema, successResponse, errorResponse } from "@/lib/api";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = otpRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_MOBILE");
    }

    const { mobile } = parsed.data;

    // Fixed test OTP for local dev or generated 6-digit in prod
    const otpCode =
      process.env.NODE_ENV !== "production"
        ? "123456"
        : Math.floor(100000 + Math.random() * 900000).toString();

    logger.info("SMS OTP dispatched", {
      mobile: `${mobile.slice(0, 2)}******${mobile.slice(8)}`,
      provider: "console",
      ...(process.env.NODE_ENV !== "production" ? { devOtpCode: otpCode } : {}),
    });

    return successResponse({
      mobile,
      message: "OTP sent successfully to your mobile number",
      expiresInSeconds: 300,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otpCode } : {}),
    });
  } catch (error) {
    return errorResponse("Failed to send OTP", 500, "INTERNAL_ERROR", error);
  }
}
