import { NextRequest } from "next/server";
import { djangoFetch } from "@/lib/django";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const subcategory = searchParams.get("subcategory") || "";
    const search = searchParams.get("q") || searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "";
    const inStock = searchParams.get("in_stock") || "";
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || searchParams.get("page_size") || "24";

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
    if (search) params.set("q", search);
    if (sort) params.set("sort", sort);
    if (inStock) params.set("in_stock", inStock);
    if (page) params.set("page", page);
    if (pageSize) params.set("page_size", pageSize);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await djangoFetch(`/products/${queryString}`);

    return successResponse(data);
  } catch (error) {
    return errorResponse("Failed to fetch products from backend", 500, "INTERNAL_ERROR", error);
  }
}
