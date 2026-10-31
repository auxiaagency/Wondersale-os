import { catalogService } from "@/services/catalog.service";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const categories = await catalogService.getCategories();
    return successResponse(categories);
  } catch (error) {
    return errorResponse("Failed to fetch categories", 500, "INTERNAL_ERROR", error);
  }
}
