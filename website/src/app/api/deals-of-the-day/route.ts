import { successResponse, errorResponse } from "@/lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/website/deals-of-the-day/`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }
    const deals = await res.json();
    return successResponse(deals);
  } catch (error) {
    return errorResponse("Failed to fetch deals of the day from backend", 500, "INTERNAL_ERROR", error);
  }
}
