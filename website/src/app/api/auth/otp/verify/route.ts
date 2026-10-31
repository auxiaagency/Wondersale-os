import { NextRequest } from "next/server";
import { otpVerifySchema, successResponse, errorResponse } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_INPUT");
    }

    const { mobile, code } = parsed.data;

    // Verify against dev code or static test credentials
    if (code !== "123456" && code !== "482910") {
      return errorResponse("Invalid or expired OTP code", 401, "INVALID_OTP");
    }

    return successResponse({
      user: {
        mobile,
        role: "CUSTOMER",
      },
      message: "Phone number verified successfully",
      token: "ws_session_token_placeholder",
    });
  } catch (error) {
    return errorResponse("Failed to verify OTP", 500, "INTERNAL_ERROR", error);
  }
}
