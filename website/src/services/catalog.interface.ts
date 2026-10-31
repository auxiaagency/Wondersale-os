export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  displayOrder: number;
  imageUrl?: string | null;
  subcategories?: CatalogCategory[];
}

export interface CatalogVariant {
  id: string;
  sku: string;
  title: string;
  mrpPaise: number;
  sellingPricePaise: number;
  stockQuantity: number;
  inStock: boolean;
  images: { id: string; url: string; altText?: string | null; isThumbnail: boolean }[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: { id: string; name: string; slug: string };
  brand?: { id: string; name: string; slug: string } | null;
  variants: CatalogVariant[];
  ratingAverage: number;
  reviewCount: number;
}

export interface CatalogFilterOptions {
  categoryId?: string;
  categorySlug?: string;
  brandSlug?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  inStockOnly?: boolean;
  searchQuery?: string;
  sortBy?: "popularity" | "price_asc" | "price_desc" | "newest" | "rating";
  page?: number;
  pageSize?: number;
}

export interface CatalogSearchResult {
  products: CatalogProduct[];
  totalCount: number;
  page: number;
  totalPages: number;
  availableBrands: { id: string; name: string; slug: string; count: number }[];
  priceRange: { minPaise: number; maxPaise: number };
}

export interface ICatalogService {
  getCategories(): Promise<CatalogCategory[]>;
  getCategoryBySlug(slug: string): Promise<CatalogCategory | null>;
  searchProducts(filters: CatalogFilterOptions): Promise<CatalogSearchResult>;
  getProductBySlug(slug: string): Promise<CatalogProduct | null>;
  getProductById(id: string): Promise<CatalogProduct | null>;
}

export interface IInventoryService {
  checkStock(
    variantId: string,
    requestedQuantity: number
  ): Promise<{ available: boolean; stock: number }>;
  reserveStock(
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ): Promise<{ success: boolean; error?: string }>;
  releaseStock(
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ): Promise<{ success: boolean }>;
}
