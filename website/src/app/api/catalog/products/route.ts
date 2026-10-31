import { NextRequest } from "next/server";
import { catalogService } from "@/services/catalog.service";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category") || undefined;
    const brandSlug = searchParams.get("brand") || undefined;
    const searchQuery = searchParams.get("q") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1;
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 20;

    const result = await catalogService.searchProducts({
      categorySlug,
      brandSlug,
      searchQuery,
      page,
      pageSize,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse("Failed to fetch products", 500, "INTERNAL_ERROR", error);
  }
}
