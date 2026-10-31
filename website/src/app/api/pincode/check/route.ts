import { NextRequest } from "next/server";
import { pincodeCheckSchema, successResponse, errorResponse } from "@/lib/api";

const BHOPAL_PINCODES = new Set([
  "462001",
  "462002",
  "462003",
  "462007",
  "462010",
  "462011",
  "462016",
  "462021",
  "462022",
  "462023",
  "462024",
  "462026",
  "462030",
  "462038",
  "462042",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get("pincode");

    const parsed = pincodeCheckSchema.safeParse({ pincode });
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_PINCODE");
    }

    const code = parsed.data.pincode;
    const isBhopal = BHOPAL_PINCODES.has(code) || code.startsWith("462");

    return successResponse({
      pincode: code,
      isDeliverable: true,
      city: isBhopal ? "Bhopal" : "India",
      state: isBhopal ? "Madhya Pradesh" : "India",
      isExpressAvailable: isBhopal,
      estimatedDays: isBhopal ? "Tomorrow" : "3-5 business days",
      isCodAllowed: true,
      codLimitPaise: 500000, // ₹5,000 max COD
    });
  } catch (error) {
    return errorResponse("Failed to verify pincode", 500, "INTERNAL_ERROR", error);
  }
}
