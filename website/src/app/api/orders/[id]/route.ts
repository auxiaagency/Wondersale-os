import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api";
import { djangoFetch } from "@/lib/django";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return errorResponse("Order identifier required", 400, "MISSING_ID");
    }

    try {
      const djangoOrder = await djangoFetch<any>(`/orders/track/${encodeURIComponent(id)}/`);
      if (djangoOrder && (djangoOrder.order_number || djangoOrder.id)) {
        return successResponse({
          orderNumber: djangoOrder.order_number,
          trackingId: djangoOrder.tracking_id,
          status: djangoOrder.status,
          totalAmount: djangoOrder.total_amount,
          customerName: djangoOrder.customer_name,
          customerMobile: djangoOrder.customer_mobile,
          deliveryAddress: djangoOrder.delivery_address,
          items: djangoOrder.items,
          createdAt: djangoOrder.created_at,
        });
      }
    } catch {
      // Fallback response for demo or offline orders
    }

    // Default mock response for tracking demonstration
    return successResponse({
      orderNumber: id,
      trackingId: `TRK-${id.replace(/^WS-/, "")}`,
      status: "CONFIRMED",
      estimatedDelivery: "Today, Express 2-Hour Delivery (Bhopal)",
      createdAt: new Date().toISOString(),
      items: [],
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Failed to fetch order", 500, "ORDER_FETCH_FAILED");
  }
}
