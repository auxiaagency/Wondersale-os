import { successResponse, errorResponse } from "@/lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/website/trending-searches/`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }
    const data = await res.json();
    return successResponse(data);
  } catch (error) {
    return errorResponse("Failed to fetch trending searches from backend", 500, "INTERNAL_ERROR", error);
  }
}

