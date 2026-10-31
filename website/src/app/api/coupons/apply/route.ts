import { NextRequest } from "next/server";
import { couponApplySchema, successResponse, errorResponse } from "@/lib/api";

const ACTIVE_COUPONS = [
  {
    code: "WONDER150",
    description: "Flat ₹150 off on orders above ₹1,499",
    discountType: "FLAT_AMOUNT",
    discountValuePaise: 15000,
    minOrderPaise: 149900,
  },
  {
    code: "WONDER50",
    description: "Flat ₹50 off on orders above ₹499",
    discountType: "FLAT_AMOUNT",
    discountValuePaise: 5000,
    minOrderPaise: 49900,
  },
  {
    code: "WONDER10",
    description: "10% off up to ₹300",
    discountType: "PERCENTAGE",
    discountValuePercent: 10,
    maxDiscountPaise: 30000,
    minOrderPaise: 99900,
  },
  {
    code: "BHOPALEXPRESS",
    description: "Flat ₹100 off on Bhopal orders above ₹999",
    discountType: "FLAT_AMOUNT",
    discountValuePaise: 10000,
    minOrderPaise: 99900,
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = couponApplySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400, "INVALID_INPUT");
    }

    const { code, cartTotalPaise } = parsed.data;
    const coupon = ACTIVE_COUPONS.find((c) => c.code === code);

    if (!coupon) {
      return errorResponse("Invalid or expired coupon code", 404, "COUPON_NOT_FOUND");
    }

    if (cartTotalPaise < coupon.minOrderPaise) {
      return errorResponse(
        `Minimum order total of ₹${coupon.minOrderPaise / 100} required for this coupon`,
        400,
        "MIN_ORDER_UNMET"
      );
    }

    let discountPaise = 0;
    if (coupon.discountType === "FLAT_AMOUNT") {
      discountPaise = coupon.discountValuePaise ?? 0;
    } else if (coupon.discountType === "PERCENTAGE") {
      const computed = Math.round((cartTotalPaise * (coupon.discountValuePercent ?? 0)) / 100);
      discountPaise = coupon.maxDiscountPaise
        ? Math.min(computed, coupon.maxDiscountPaise)
        : computed;
    }

    return successResponse({
      code: coupon.code,
      discountPaise,
      description: coupon.description,
      finalTotalPaise: Math.max(0, cartTotalPaise - discountPaise),
    });
  } catch (error) {
    return errorResponse("Failed to apply coupon", 500, "INTERNAL_ERROR", error);
  }
}
