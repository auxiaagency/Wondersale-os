import { prisma } from "@/db/prisma";
import {
  ICatalogService,
  IInventoryService,
  CatalogCategory,
  CatalogProduct,
  CatalogFilterOptions,
  CatalogSearchResult,
} from "./catalog.interface";

export class PrismaCatalogService implements ICatalogService {
  async getCategories(): Promise<CatalogCategory[]> {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { displayOrder: "asc" },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId,
      displayOrder: cat.displayOrder,
      imageUrl: cat.imageUrl,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        parentId: sub.parentId,
        displayOrder: sub.displayOrder,
        imageUrl: sub.imageUrl,
      })),
    }));
  }

  async getCategoryBySlug(slug: string): Promise<CatalogCategory | null> {
    const cat = await prisma.category.findUnique({
      where: { slug, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
    if (!cat) return null;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId,
      displayOrder: cat.displayOrder,
      imageUrl: cat.imageUrl,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        parentId: sub.parentId,
        displayOrder: sub.displayOrder,
        imageUrl: sub.imageUrl,
      })),
    };
  }

  async searchProducts(filters: CatalogFilterOptions): Promise<CatalogSearchResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    // Build Prisma query condition
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    } else if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.brandSlug) {
      where.brand = { slug: filters.brandSlug };
    }

    if (filters.searchQuery) {
      where.OR = [
        { name: { contains: filters.searchQuery, mode: "insensitive" } },
        { description: { contains: filters.searchQuery, mode: "insensitive" } },
      ];
    }

    const [totalCount, rawProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          variants: {
            where: { isActive: true },
            include: { images: true },
          },
          reviews: {
            where: { isApproved: true },
            select: { rating: true },
          },
        },
      }),
    ]);

    const products: CatalogProduct[] = rawProducts.map((p) => {
      const reviewCount = p.reviews.length;
      const ratingAverage =
        reviewCount > 0 ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount : 0;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        brand: p.brand,
        variants: p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          mrpPaise: v.mrpPaise,
          sellingPricePaise: v.sellingPricePaise,
          stockQuantity: v.stockQuantity,
          inStock: v.stockQuantity > 0,
          images: v.images.map((img) => ({
            id: img.id,
            url: img.url,
            altText: img.altText,
            isThumbnail: img.isThumbnail,
          })),
        })),
        ratingAverage,
        reviewCount,
      };
    });

    return {
      products,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / pageSize),
      availableBrands: [],
      priceRange: { minPaise: 0, maxPaise: 1000000 },
    };
  }

  async getProductBySlug(slug: string): Promise<CatalogProduct | null> {
    const p = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          include: { images: true },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
      },
    });

    if (!p) return null;

    const reviewCount = p.reviews.length;
    const ratingAverage =
      reviewCount > 0 ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount : 0;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.category,
      brand: p.brand,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        mrpPaise: v.mrpPaise,
        sellingPricePaise: v.sellingPricePaise,
        stockQuantity: v.stockQuantity,
        inStock: v.stockQuantity > 0,
        images: v.images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isThumbnail: img.isThumbnail,
        })),
      })),
      ratingAverage,
      reviewCount,
    };
  }

  async getProductById(id: string): Promise<CatalogProduct | null> {
    const p = await prisma.product.findUnique({
      where: { id, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          include: { images: true },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
      },
    });

    if (!p) return null;

    const reviewCount = p.reviews.length;
    const ratingAverage =
      reviewCount > 0 ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount : 0;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.category,
      brand: p.brand,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        mrpPaise: v.mrpPaise,
        sellingPricePaise: v.sellingPricePaise,
        stockQuantity: v.stockQuantity,
        inStock: v.stockQuantity > 0,
        images: v.images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isThumbnail: img.isThumbnail,
        })),
      })),
      ratingAverage,
      reviewCount,
    };
  }
}

export class PrismaInventoryService implements IInventoryService {
  async checkStock(
    variantId: string,
    requestedQuantity: number
  ): Promise<{ available: boolean; stock: number }> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQuantity: true },
    });
    const current = variant?.stockQuantity ?? 0;
    return {
      available: current >= requestedQuantity,
      stock: current,
    };
  }

  /**
   * Atomic stock reservation using database transaction to prevent race conditions or overselling.
   */
  async reserveStock(
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ): Promise<{ success: boolean; error?: string }> {
    return await prisma
      .$transaction(async (tx) => {
        for (const item of items) {
          // Read current stock inside transaction
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stockQuantity: true, title: true },
          });

          if (!variant || variant.stockQuantity < item.quantity) {
            throw new Error(
              `Insufficient stock for variant "${variant?.title ?? item.variantId}". Available: ${
                variant?.stockQuantity ?? 0
              }, Requested: ${item.quantity}`
            );
          }

          const newStock = variant.stockQuantity - item.quantity;

          // Atomically decrement
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: newStock },
          });

          // Record stock audit log
          await tx.stockLog.create({
            data: {
              variantId: item.variantId,
              quantityDelta: -item.quantity,
              previousStock: variant.stockQuantity,
              newStock,
              reason: "ORDER_RESERVATION",
              referenceId,
            },
          });
        }
        return { success: true };
      })
      .catch((err) => {
        return { success: false, error: (err as Error).message };
      });
  }

  async releaseStock(
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ): Promise<{ success: boolean }> {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stockQuantity: true },
        });

        if (variant) {
          const newStock = variant.stockQuantity + item.quantity;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: newStock },
          });

          await tx.stockLog.create({
            data: {
              variantId: item.variantId,
              quantityDelta: item.quantity,
              previousStock: variant.stockQuantity,
              newStock,
              reason: "CANCEL_RESTOCK",
              referenceId,
            },
          });
        }
      }
    });
    return { success: true };
  }
}

export const catalogService: ICatalogService = new PrismaCatalogService();
export const inventoryService: IInventoryService = new PrismaInventoryService();
