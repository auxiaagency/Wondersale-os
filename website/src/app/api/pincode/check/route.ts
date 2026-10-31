import { NextRequest } from "next/server";
import { pincodeCheckSchema, successResponse, errorResponse } from "@/lib/api";
import { checkPincodeServiceability } from "@/services/pincode.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get("pincode");

    const parsed = pincodeCheckSchema.safeParse({ pincode });
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_PINCODE");
    }

    const result = await checkPincodeServiceability(parsed.data.pincode);
    return successResponse(result);
  } catch (error) {
    return errorResponse("Failed to verify pincode", 500, "INTERNAL_ERROR", error);
  }
}
