import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/inventory/categories/`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }
    const categories = await res.json();
    return successResponse(categories);
  } catch (error) {
    return errorResponse("Failed to fetch categories from backend", 500, "INTERNAL_ERROR", error);
  }
}
