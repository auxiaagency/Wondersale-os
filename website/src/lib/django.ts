/**
 * Typed API Client for WonderSale Django Backend
 * Connects Next.js Storefront to Django REST API (http://localhost:8000/api/website)
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface DjangoApiResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
  data?: T;
  [key: string]: unknown;
}

export interface WebsiteProduct {
  id: number;
  uid: string;
  name: string;
  selling_price: string;
  mrp: string;
  description: string;
  quantity: number;
  in_stock: boolean;
  categories: Array<{ id: number; name: string }>;
  subcategories: Array<{ id: number; name: string }>;
  images: Array<{ id: number; url: string; is_primary: boolean; order: number }>;
  primary_image_url: string | null;
  created_at: string;
}

export interface WebsiteCategory {
  id: number;
  name: string;
  description: string;
  subcategories: Array<{ id: number; name: string }>;
  items_count: number;
}

export async function djangoFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}/api/website${cleanEndpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: options.cache || "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = `Django API returned HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errorDetail = parsed.detail || parsed.message || errorDetail;
    } catch {
      // ignore parse error
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
