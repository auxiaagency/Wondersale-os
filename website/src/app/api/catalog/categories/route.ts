import { djangoFetch } from "@/lib/django";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const categories = await djangoFetch("/categories/");
    return successResponse(categories);
  } catch (error) {
    return errorResponse("Failed to fetch categories from backend", 500, "INTERNAL_ERROR", error);
  }
}
