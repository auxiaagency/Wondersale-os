import { NextRequest } from "next/server";
import { djangoFetch } from "@/lib/django";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return errorResponse("Product identifier is required", 400, "BAD_REQUEST");
    }

    const data = await djangoFetch(`/products/${encodeURIComponent(slug)}/`);
    return successResponse(data);
  } catch (error) {
    return errorResponse("Failed to fetch product from backend", 404, "NOT_FOUND", error);
  }
}
