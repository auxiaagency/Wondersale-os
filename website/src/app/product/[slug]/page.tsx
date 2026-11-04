"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Share2,
  Heart,
  ShoppingBag,
  Flame,
  CheckCircle,
  Box,
  MapPin,
  Zap,
  CreditCard,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ShoppingCart,
  Truck,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useStorefront } from "@/context/StorefrontContext";
import { WondersaleLogo } from "@/components/ui/WondersaleLogo";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { StorefrontFooter } from "@/components/layout/StorefrontFooter";
import { ProductCard } from "@/components/ui/ProductCard";
import { DEMO_PRODUCTS, getDemoProductBySlug } from "@/data/demo-products";

interface SuggestedProduct {
  id: string;
  slug: string;
  title: string;
  brand?: string;
  mrpPaise: number;
  sellingPricePaise: number;
  inStock: boolean;
  imageUrl?: string;
  badge?: string;
}

interface ProductDetailData {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: string;
  categorySlug: string;
  mrpPaise: number;
  sellingPricePaise: number;
  inStock: boolean;
  stockCount: number;
  bestsellerRank?: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  specs: { label: string; value: string }[];
  variants: { capacity: string; pricePaise: number; note: string }[];
}

const DEFAULT_PRODUCT: ProductDetailData = {
  id: "prod-default",
  slug: "product-details",
  brand: "Wondersale",
  title: "Premium Store Product",
  category: "General",
  categorySlug: "all",
  mrpPaise: 99900,
  sellingPricePaise: 79900,
  inStock: true,
  stockCount: 10,
  imageUrl: "",
  images: [],
  variants: [
    { capacity: "Standard", pricePaise: 79900, note: "In Stock" },
  ],
  specs: [
    { label: "Brand", value: "Wondersale" },
    { label: "Category", value: "General" },
    { label: "Availability", value: "In Stock" },
  ],
};

function parseSpecsFromDescription(desc: string) {
  const specs: { label: string; value: string }[] = [];
  if (!desc) return specs;

  const lines = desc.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- **") || trimmed.startsWith("* **")) {
      const match = trimmed.match(/^[-*]\s*\*\*([^*]+)\*\*:\s*(.+)$/);
      if (match) {
        specs.push({
          label: match[1].trim(),
          value: match[2].trim(),
        });
      }
    }
  }
  return specs;
}

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { addToCart, cartCount, toggleWishlist, isInWishlist, location, isHydrated } = useStorefront();

  const [product, setProduct] = useState<ProductDetailData>(() => {
    if (slug) {
      const demo = getDemoProductBySlug(slug);
      if (demo) return demo;
    }
    return DEFAULT_PRODUCT;
  });
  const [loading, setLoading] = useState(true);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [pincode, setPincode] = useState(location?.pincode || "462001");
  const [isChangingPincode, setIsChangingPincode] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState("Standard Delivery Available");
  const [isPincodeValid, setIsPincodeValid] = useState(true);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [isAddedToCart, setIsAddedToCart] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    // Try backend catalog API first
    fetch(`/api/catalog/products/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Backend product not found");
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data) {
          const p = data.data;

          const allImages: string[] = [];
          if (Array.isArray(p.images) && p.images.length > 0) {
            p.images.forEach((img: any) => {
              const url = typeof img === "string" ? img : img.url;
              if (url && !allImages.includes(url)) allImages.push(url);
            });
          }
          if (p.primary_image_url && !allImages.includes(p.primary_image_url)) {
            allImages.unshift(p.primary_image_url);
          }

          const primaryImage = allImages[0] || p.primary_image_url || "";

          const parsedSpecs = parseSpecsFromDescription(p.description || "");
          const finalSpecs = [
            { label: "Product UID", value: p.uid || String(p.id) },
            { label: "Brand", value: p.brand?.name || p.brand || "Wondersale" },
            {
              label: "Category",
              value: p.categories?.[0]?.name || p.category?.name || "General Catalog",
            },
            {
              label: "Subcategory",
              value: p.subcategories?.[0]?.name || "Standard",
            },
            {
              label: "Stock Status",
              value: (p.quantity || 0) > 0 ? `${p.quantity} Units Available` : "Out of Stock",
            },
            ...parsedSpecs,
          ];

          const sellingPricePaise = Math.round(Number(p.selling_price || 0) * 100);
          const mrpPaise = Math.round(Number(p.mrp || p.selling_price || 0) * 100);

          setProduct({
            id: String(p.id),
            slug: p.uid || String(p.id),
            brand: p.brand?.name || p.brand || "Wondersale",
            title: p.name,
            category: p.categories?.[0]?.name || p.category?.name || "Catalog",
            categorySlug: p.categories?.[0]?.slug || "all",
            mrpPaise: mrpPaise > 0 ? mrpPaise : sellingPricePaise,
            sellingPricePaise: sellingPricePaise,
            inStock: Boolean(p.in_stock ?? (p.quantity > 0)),
            stockCount: p.quantity || 0,
            imageUrl: primaryImage,
            images: allImages,
            description: p.description || "",
            variants: [
              {
                capacity: "Standard",
                pricePaise: sellingPricePaise,
                note: p.quantity > 0 ? `${p.quantity} in stock` : "Out of stock",
              },
            ],
            specs: finalSpecs,
          });

          // Fetch related products by category from backend
          const catName = p.categories?.[0]?.name || "";
          const subName = p.subcategories?.[0]?.name || "";
          const queryParams = new URLSearchParams();
          if (catName) queryParams.set("category", catName);
          else if (subName) queryParams.set("subcategory", subName);
          queryParams.set("pageSize", "8");

          fetch(`/api/catalog/products?${queryParams.toString()}`)
            .then((r) => r.json())
            .then((catData) => {
              if (catData.success && catData.data) {
                const list = Array.isArray(catData.data) ? catData.data : catData.data.results || [];
                const filtered = list
                  .filter((item: any) => String(item.id) !== String(p.id) && item.uid !== p.uid)
                  .slice(0, 6)
                  .map((item: any) => ({
                    id: String(item.id),
                    slug: item.uid || String(item.id),
                    title: item.name,
                    brand: item.brand || "Wondersale",
                    mrpPaise: Math.round(Number(item.mrp || item.selling_price || 0) * 100),
                    sellingPricePaise: Math.round(Number(item.selling_price || 0) * 100),
                    inStock: Boolean(item.in_stock),
                    imageUrl: item.primary_image_url || item.images?.[0]?.url || "",
                  }));

                if (filtered.length > 0) {
                  setSuggestedProducts(filtered);
                  return;
                }
              }
              // Fallback to related demo products if not enough backend items
              const relatedDemos = DEMO_PRODUCTS.filter(
                (d) => d.slug !== slug && (d.category.toLowerCase().includes(catName.toLowerCase()) || !catName)
              ).slice(0, 6);
              setSuggestedProducts(
                relatedDemos.map((d) => ({
                  id: d.id,
                  slug: d.slug,
                  title: d.title,
                  brand: d.brand,
                  mrpPaise: d.mrpPaise,
                  sellingPricePaise: d.sellingPricePaise,
                  inStock: d.inStock,
                  imageUrl: d.imageUrl,
                  badge: d.bestsellerRank,
                }))
              );
            })
            .catch(() => {
              const relatedDemos = DEMO_PRODUCTS.filter((d) => d.slug !== slug).slice(0, 6);
              setSuggestedProducts(
                relatedDemos.map((d) => ({
                  id: d.id,
                  slug: d.slug,
                  title: d.title,
                  brand: d.brand,
                  mrpPaise: d.mrpPaise,
                  sellingPricePaise: d.sellingPricePaise,
                  inStock: d.inStock,
                  imageUrl: d.imageUrl,
                }))
              );
            });

          setLoading(false);
          return;
        }
        throw new Error("Invalid response format");
      })
      .catch(() => {
        // Fallback to Demo catalog if backend product is not found or fails
        const demo = getDemoProductBySlug(slug) || DEMO_PRODUCTS.find((p) => p.id === slug);
        if (demo) {
          setProduct({
            id: demo.id,
            slug: demo.slug,
            brand: demo.brand,
            title: demo.title,
            category: demo.category,
            categorySlug: demo.categorySlug,
            mrpPaise: demo.mrpPaise,
            sellingPricePaise: demo.sellingPricePaise,
            inStock: demo.inStock,
            stockCount: demo.stockCount,
            bestsellerRank: demo.bestsellerRank,
            imageUrl: demo.imageUrl,
            images: [demo.imageUrl],
            description: demo.description,
            variants: demo.variants,
            specs: demo.specs,
          });

          const relatedDemos = DEMO_PRODUCTS.filter(
            (d) => d.slug !== demo.slug && d.categorySlug === demo.categorySlug
          ).slice(0, 6);
          const finalRelated = relatedDemos.length > 0
            ? relatedDemos
            : DEMO_PRODUCTS.filter((d) => d.slug !== demo.slug).slice(0, 6);

          setSuggestedProducts(
            finalRelated.map((d) => ({
              id: d.id,
              slug: d.slug,
              title: d.title,
              brand: d.brand,
              mrpPaise: d.mrpPaise,
              sellingPricePaise: d.sellingPricePaise,
              inStock: d.inStock,
              imageUrl: d.imageUrl,
              badge: d.bestsellerRank,
            }))
          );
        }
        setLoading(false);
      });
  }, [slug]);

  const isWishlisted = isInWishlist(product.id);

  const selectedVariant = product.variants[selectedVariantIdx] || product.variants[0];
  const currentSellingPricePaise = selectedVariant?.pricePaise || product.sellingPricePaise;
  const currentMrpPaise = product.mrpPaise;
  const savingsPaise = Math.max(0, currentMrpPaise - currentSellingPricePaise);
  const savingsPercent =
    currentMrpPaise > 0 ? Math.round((savingsPaise / currentMrpPaise) * 100) : 0;

  const handlePincodeCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pincode.trim();
    if (clean.length !== 6 || !/^\d+$/.test(clean)) {
      setIsPincodeValid(false);
      setPincodeMessage("Please enter a valid 6-digit Indian PIN code");
      return;
    }
    try {
      const res = await fetch(`/api/pincode/check?pincode=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.success && data.data.isDeliverable) {
        setIsPincodeValid(true);
        setPincodeMessage(`Delivery Available to ${data.data.city} (${clean})`);
        setIsChangingPincode(false);
      } else {
        setIsPincodeValid(false);
        setPincodeMessage(`Delivery currently unavailable for PIN code ${clean}`);
      }
    } catch {
      setIsPincodeValid(false);
      setPincodeMessage("Error verifying PIN code. Please retry.");
    }
  };

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText("WONDER150");
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const galleryImages =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : [];

  const currentDisplayImage = galleryImages[activeImageIdx] || product.imageUrl || "";

  const handleToggleWishlist = () => {
    toggleWishlist({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      rating: 4.5,
      ratingCount: 15,
      inStock: product.inStock,
      imageUrl: currentDisplayImage,
    });
  };

  const handleAddToCart = () => {
    addToCart({
      id: `${product.id}-${selectedVariant?.capacity || "default"}`,
      slug: product.slug,
      title: product.title,
      variantLabel: `Variant: ${selectedVariant?.capacity || "Standard"}`,
      specNote: selectedVariant?.note || "In Stock",
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      badge: undefined,
      imageUrl: currentDisplayImage,
    });
    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart({
      id: `${product.id}-${selectedVariant?.capacity || "default"}`,
      slug: product.slug,
      title: product.title,
      variantLabel: `Variant: ${selectedVariant?.capacity || "Standard"}`,
      specNote: selectedVariant?.note || "In Stock",
      mrpPaise: currentMrpPaise,
      sellingPricePaise: currentSellingPricePaise,
      badge: undefined,
      imageUrl: currentDisplayImage,
    });
    router.push("/cart");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6E9C8] flex flex-col items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#680114] border-t-transparent mb-3" />
        <p className="text-xs font-serif font-bold text-[#680114]">
          Loading product details...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6E9C8] text-[#680114] font-sans flex flex-col justify-between">
      {/* ======================================================== */}
      {/* DESKTOP VIEWPORT LAYOUT (md: and above)                  */}
      {/* ======================================================== */}
      <div className="hidden md:flex flex-col min-h-screen">
        <GlobalHeader />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 py-5">
          {/* 1. Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#735A4A] mb-5 py-1">
            <Link href="/" className="hover:text-[#680114] font-medium transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <Link href="/category/all" className="hover:text-[#680114] font-medium transition-colors">Categories</Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <Link href={`/category/${product.categorySlug || "all"}`} className="hover:text-[#680114] font-medium transition-colors">
              {product.category}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <span className="text-[#680114] font-bold truncate max-w-xs">{product.title}</span>
          </nav>

          {/* 2. Desktop Two-Column Split Layout */}
          <div className="grid grid-cols-12 gap-8 items-start mb-10">
            {/* Left Column: Image Gallery (Made slightly smaller and compact) */}
            <div className="col-span-12 lg:col-span-5 max-w-md mx-auto w-full flex flex-col gap-4 sticky top-24">
              <div className="relative w-full aspect-square bg-[#F6E9C8] rounded-2xl shadow-xs border-2 border-[#680114] overflow-hidden flex items-center justify-center group p-6">
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 items-start">
                  {savingsPercent > 0 && (
                    <span className="bg-[#680114] text-[#F6E9C8] text-xs px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                      {savingsPercent}% OFF
                    </span>
                  )}
                  {product.bestsellerRank && (
                    <span className="bg-[#F6E9C8] text-[#680114] border-2 border-[#680114] text-xs px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1 font-bold">
                      <Flame className="w-3.5 h-3.5 text-[#680114] fill-current" />
                      {product.bestsellerRank}
                    </span>
                  )}
                </div>

                {/* Wishlist & Share */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                  <button
                    onClick={handleToggleWishlist}
                    aria-label="Wishlist"
                    className="w-8 h-8 rounded-full bg-[#F6E9C8] border-2 border-[#680114] shadow-2xs flex items-center justify-center text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? "text-[#680114] fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: product.title, url: window.location.href });
                      }
                    }}
                    aria-label="Share"
                    className="w-8 h-8 rounded-full bg-[#F6E9C8] border-2 border-[#680114] shadow-2xs flex items-center justify-center text-[#680114] hover:bg-[#680114] hover:text-[#F6E9C8] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Product Image */}
                {currentDisplayImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentDisplayImage}
                    alt={product.title}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-center text-[#735A4A]">
                    <Box className="w-16 h-16 mx-auto mb-2 text-[#680114]/40" />
                    <span className="text-sm font-semibold">No Image Available</span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {galleryImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2.5">
                  {galleryImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`aspect-square rounded-xl overflow-hidden bg-[#F6E9C8] p-1.5 border-2 transition-all cursor-pointer ${
                        activeImageIdx === idx
                          ? "border-[#680114] ring-2 ring-[#680114]/30 shadow-2xs"
                          : "border-[#680114]/30 hover:border-[#680114]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Title, Price, Variants, Description & Specs, then Delivery & Actions */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
              {/* Product Header Card */}
              <div className="bg-[#F6E9C8] p-6 rounded-2xl shadow-xs border-2 border-[#680114]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#680114] tracking-wider uppercase font-serif">
                    {product.brand}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    product.inStock ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
                <h1 className="font-serif font-extrabold text-2xl lg:text-3xl text-[#680114] leading-snug">
                  {product.title}
                </h1>

                {/* Price Strip */}
                <div className="mt-4 p-4 bg-[#F6E9C8] rounded-xl border-2 border-[#680114]">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-3xl font-black text-[#680114]">
                      {formatPrice(currentSellingPricePaise)}
                    </span>
                    {currentMrpPaise > currentSellingPricePaise && (
                      <span className="text-sm font-medium text-[#735A4A] line-through">
                        MRP {formatPrice(currentMrpPaise)}
                      </span>
                    )}
                    {savingsPercent > 0 && (
                      <span className="bg-[#680114] text-[#F6E9C8] text-xs px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                        Save {formatPrice(savingsPaise)} ({savingsPercent}% OFF)
                      </span>
                    )}
                  </div>
                  <p className="text-[#735A4A] text-xs mt-1">Inclusive of all taxes • GST Invoice Available</p>
                </div>
              </div>

              {/* Variants Card */}
              {product.variants.length > 1 && (
                <div className="bg-[#F6E9C8] p-5 rounded-2xl shadow-xs border-2 border-[#680114]">
                  <h3 className="text-xs font-bold text-[#680114] uppercase tracking-wider mb-3 font-serif">
                    Select Option: <span className="text-[#680114] font-extrabold">{selectedVariant?.capacity}</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {product.variants.map((v, idx) => {
                      const isSelected = selectedVariantIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedVariantIdx(idx)}
                          className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                            isSelected
                              ? "border-[#680114] bg-[#680114] text-[#F6E9C8] shadow-2xs"
                              : "border-[#680114] bg-[#F6E9C8] text-[#680114] hover:bg-[#680114]/10"
                          }`}
                        >
                          <p className={`text-xs font-bold ${isSelected ? "text-[#F6E9C8]" : "text-[#680114]"}`}>
                            {v.capacity}
                          </p>
                          <p className={`text-sm font-extrabold mt-0.5 ${isSelected ? "text-[#F6E9C8]" : "text-[#680114]"}`}>
                            {formatPrice(v.pricePaise)}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? "text-[#F6E9C8]/80" : "text-[#735A4A]"}`}>{v.note}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description Card (Moved Before Delivery & Actions, text color deep burgundy #680114) */}
              {product.description && (
                <div className="bg-[#F6E9C8] p-5 rounded-2xl shadow-xs border-2 border-[#680114]">
                  <h3 className="text-xs font-serif font-bold text-[#680114] uppercase tracking-wider mb-2">Description</h3>
                  <div className="text-xs text-[#680114] font-medium leading-relaxed whitespace-pre-line">
                    {product.description}
                  </div>
                </div>
              )}

              {/* Specifications Card (Moved Before Delivery & Actions) */}
              {product.specs.length > 0 && (
                <div className="bg-[#F6E9C8] p-5 rounded-2xl shadow-xs border-2 border-[#680114]">
                  <h3 className="text-xs font-serif font-bold text-[#680114] uppercase tracking-wider mb-3">Specifications</h3>
                  <div className="divide-y divide-[#680114]/20 text-xs">
                    {product.specs.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-2 py-2">
                        <span className="text-[#735A4A] font-medium">{item.label}</span>
                        <span className="text-[#680114] font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery & Pincode Card (Now Placed After Description & Specifications) */}
              <div className="bg-[#F6E9C8] p-5 rounded-2xl shadow-xs border-2 border-[#680114]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#680114]">
                    <MapPin className="w-4 h-4 text-[#680114]" />
                    <span>Deliver to: {pincode}</span>
                  </div>
                  <button
                    onClick={() => setIsChangingPincode(!isChangingPincode)}
                    className="text-[#680114] text-xs font-bold hover:underline cursor-pointer"
                  >
                    {isChangingPincode ? "Cancel" : "Change"}
                  </button>
                </div>

                {isChangingPincode && (
                  <form onSubmit={handlePincodeCheck} className="flex gap-2 mt-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit Pincode"
                      className="flex-1 rounded-lg border-2 border-[#680114] bg-[#F6E9C8] px-3 py-1.5 text-xs text-[#680114] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] px-4 py-1.5 text-xs font-serif font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Verify
                    </button>
                  </form>
                )}

                <div className={`mt-3 p-3 rounded-xl border-2 ${isPincodeValid ? "bg-[#F6E9C8] border-[#680114] text-[#680114]" : "bg-red-50 border-red-300 text-red-900"} text-xs font-medium`}>
                  <div className="flex items-center gap-2 font-bold">
                    <Truck className="w-4 h-4 text-[#680114] shrink-0" />
                    <span>{pincodeMessage}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Desktop (Now Placed After Description & Specifications) */}
              <div className="bg-[#F6E9C8] p-5 rounded-2xl shadow-xs border-2 border-[#680114] flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-serif font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    !product.inStock
                      ? "opacity-50 cursor-not-allowed border-[#680114]/40 text-[#735A4A]"
                      : isAddedToCart
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                      : "border-[#680114] bg-[#F6E9C8] text-[#680114] hover:bg-[#680114]/10 shadow-2xs"
                  }`}
                >
                  {isAddedToCart ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!product.inStock}
                  className={`flex-[1.2] h-12 rounded-xl bg-[#680114] hover:bg-[#88091E] text-[#F6E9C8] text-sm font-serif font-bold flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer ${
                    !product.inStock ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <Zap className="w-5 h-5 fill-current" />
                  <span>Buy Now • {formatPrice(currentSellingPricePaise)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Related Suggested Products Section (Desktop) */}
          {suggestedProducts.length > 0 && (
            <section className="mt-12 pt-8 border-t-2 border-[#680114]/20">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#680114] text-[#F6E9C8] flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-serif font-extrabold text-xl text-[#680114]">
                      Related Products &amp; Suggestions
                    </h2>
                    <p className="text-xs text-[#735A4A]">
                      Similar items recommended for you
                    </p>
                  </div>
                </div>
                <Link
                  href={`/category/${product.categorySlug || "all"}`}
                  className="text-xs font-serif font-bold text-[#680114] hover:underline flex items-center gap-1"
                >
                  <span>View More</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                {suggestedProducts.map((sp) => (
                  <div key={sp.id} className="flex flex-col h-full">
                    <ProductCard
                      id={sp.id}
                      slug={sp.slug}
                      title={sp.title}
                      brand={sp.brand}
                      mrpPaise={sp.mrpPaise}
                      sellingPricePaise={sp.sellingPricePaise}
                      rating={4.5}
                      ratingCount={18}
                      imageUrl={sp.imageUrl}
                      inStock={sp.inStock}
                      badge={sp.badge}
                      variant="grid"
                      onAddToCart={() =>
                        addToCart({
                          id: sp.id,
                          slug: sp.slug,
                          title: sp.title,
                          sellingPricePaise: sp.sellingPricePaise,
                          mrpPaise: sp.mrpPaise,
                          imageUrl: sp.imageUrl,
                        })
                      }
                      onToggleWishlist={() =>
                        toggleWishlist({
                          id: sp.id,
                          slug: sp.slug,
                          title: sp.title,
                          sellingPricePaise: sp.sellingPricePaise,
                          mrpPaise: sp.mrpPaise,
                          imageUrl: sp.imageUrl,
                          inStock: sp.inStock,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <StorefrontFooter />
      </div>

      {/* ======================================================== */}
      {/* MOBILE VIEWPORT LAYOUT (< md)                             */}
      {/* ======================================================== */}
      <div className="md:hidden relative mx-auto min-h-screen w-full max-w-[480px] bg-[#F6E9C8] shadow-2xl flex flex-col pb-28 font-sans">
        {/* 1. TOP BAR / APP HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between bg-[#F6E9C8]/95 backdrop-blur-md px-3.5 py-3 shadow-xs border-b-2 border-[#680114]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#680114] hover:bg-[#680114]/10 active:scale-95 transition-transform cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <WondersaleLogo size="sm" showSubtitle={false} />
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#680114] hover:bg-[#680114]/10 active:scale-95 transition-transform"
            >
              <Search className="h-5 w-5" />
            </Link>
            <button
              aria-label="Share product"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.title, url: window.location.href });
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#680114] hover:bg-[#680114]/10 active:scale-95 transition-transform cursor-pointer"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              aria-label="Add to wishlist"
              onClick={handleToggleWishlist}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#680114] hover:bg-[#680114]/10 active:scale-90 transition-transform cursor-pointer"
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isWishlisted ? "text-[#680114] fill-current" : "text-[#680114]"
                }`}
              />
            </button>
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#680114] hover:bg-[#680114]/10 active:scale-95 transition-transform"
            >
              <ShoppingBag className="h-5 w-5" />
              {isHydrated && cartCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#680114] px-1 text-[10px] font-bold text-[#F6E9C8] shadow-xs">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* 2. IMAGE GALLERY HERO */}
        <section className="relative w-full bg-[#F6E9C8] border-b-2 border-[#680114]">
          <div className="relative mx-auto flex h-60 w-full items-center justify-center overflow-hidden p-4">
            {savingsPercent > 0 && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-[#680114] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#F6E9C8] shadow-2xs">
                <Flame className="h-3.5 w-3.5 fill-current" />
                <span>SAVE {savingsPercent}%</span>
              </div>
            )}

            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-[#680114] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#F6E9C8]">
              <CheckCircle className="h-3 w-3 text-emerald-300" />
              <span>100% Genuine</span>
            </div>

            {currentDisplayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentDisplayImage}
                alt={product.title}
                className="h-full w-auto max-h-52 object-contain transition-transform duration-300"
              />
            ) : (
              <div className="text-center text-[#735A4A]">
                <Box className="w-12 h-12 mx-auto mb-1 text-[#680114]/40" />
                <span className="text-xs font-semibold">No Image</span>
              </div>
            )}
          </div>

          {/* Mobile Thumbnails */}
          {galleryImages.length > 1 && (
            <div className="flex items-center gap-2 px-3 pb-3 overflow-x-auto no-scrollbar">
              {galleryImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`w-14 h-14 rounded-lg overflow-hidden bg-[#F6E9C8] p-1 border-2 shrink-0 transition-all cursor-pointer ${
                    activeImageIdx === idx ? "border-[#680114] shadow-2xs" : "border-[#680114]/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 3. PRODUCT ESSENTIALS */}
        <section className="bg-[#F6E9C8] p-4 border-b-2 border-[#680114]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-serif font-extrabold uppercase tracking-wider text-[#680114]">
                {product.brand}
              </span>
              <span className="text-[#680114]/40">•</span>
              <span className="text-[11px] font-medium text-[#735A4A]">{product.category}</span>
            </div>
            {product.bestsellerRank && (
              <span className="rounded-full bg-[#F6E9C8] border-2 border-[#680114] px-2 py-0.5 text-[10px] font-bold text-[#680114]">
                {product.bestsellerRank}
              </span>
            )}
          </div>

          <h1 className="mt-1.5 text-base font-serif font-extrabold text-[#680114] leading-snug">
            {product.title}
          </h1>

          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="text-2xl font-black tracking-tight text-[#680114]">
              {formatPrice(currentSellingPricePaise)}
            </span>
            {currentMrpPaise > currentSellingPricePaise && (
              <span className="text-xs font-medium text-[#735A4A] line-through">
                MRP {formatPrice(currentMrpPaise)}
              </span>
            )}
            {savingsPercent > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#680114] px-2 py-0.5 text-[11px] font-bold text-[#F6E9C8] shadow-2xs">
                Save {formatPrice(savingsPaise)} ({savingsPercent}% OFF)
              </span>
            )}
          </div>

          <div className="mt-1 text-[11px] text-[#735A4A]">
            <span>Inclusive of all taxes • GST Invoice Available</span>
          </div>
        </section>

        {/* 4. SIZE & VARIANT SELECTOR */}
        {product.variants.length > 1 && (
          <section className="bg-[#F6E9C8] px-4 py-3.5 border-b-2 border-[#680114]">
            <span className="text-xs font-serif font-bold text-[#680114]">
              Select Option: <strong className="text-[#680114]">{selectedVariant?.capacity}</strong>
            </span>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {product.variants.map((v, idx) => {
                const isSelected = selectedVariantIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariantIdx(idx)}
                    className={`relative flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? "border-2 border-[#680114] bg-[#680114] text-[#F6E9C8] shadow-2xs"
                        : "border-2 border-[#680114] bg-[#F6E9C8] text-[#680114] hover:bg-[#680114]/10"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? "text-[#F6E9C8]" : "text-[#680114]"
                      }`}
                    >
                      {v.capacity}
                    </span>
                    <span className={`text-[11px] font-extrabold ${isSelected ? "text-[#F6E9C8]" : "text-[#680114]"}`}>
                      {formatPrice(v.pricePaise)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. DESCRIPTION (Moved before delivery/specs as requested) */}
        {product.description && (
          <section className="bg-[#F6E9C8] px-4 py-4 border-b-2 border-[#680114]">
            <h2 className="text-sm font-serif font-bold text-[#680114] pb-2 border-b border-[#680114]/20">
              Product Overview
            </h2>
            <div className="mt-2 text-xs text-[#680114] font-medium leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </section>
        )}

        {/* 6. SPECIFICATIONS TABLE */}
        {product.specs.length > 0 && (
          <section className="bg-[#F6E9C8] px-4 py-4 border-b-2 border-[#680114]">
            <h2 className="text-sm font-serif font-bold text-[#680114] pb-2 border-b border-[#680114]/20">
              Product Specifications
            </h2>
            <div className="mt-3 divide-y divide-[#680114]/20 text-xs">
              {product.specs.map((item, idx) => (
                <div key={idx} className="grid grid-cols-2 py-2">
                  <span className="font-medium text-[#735A4A]">{item.label}</span>
                  <span className="font-semibold text-[#680114]">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. PINCODE & DELIVERY (Moved after Description and Specifications; removed Cash on Delivery, Return, Warranty badges) */}
        <section className="p-3.5">
          <div className="rounded-2xl border-2 border-[#680114] bg-[#F6E9C8] p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#680114]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6E9C8] border-2 border-[#680114] text-[#680114]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-[#735A4A] uppercase tracking-wider">
                    Deliver to
                  </p>
                  <p className="text-xs font-serif font-bold text-[#680114]">
                    {pincode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChangingPincode(!isChangingPincode)}
                className="rounded-lg border-2 border-[#680114] bg-[#F6E9C8] px-2.5 py-1 text-xs font-serif font-bold text-[#680114] hover:bg-[#680114]/10 active:scale-95 transition-all cursor-pointer"
              >
                {isChangingPincode ? "Cancel" : "Change"}
              </button>
            </div>

            {isChangingPincode && (
              <form onSubmit={handlePincodeCheck} className="flex gap-2 pt-2.5 pb-1">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit Pincode"
                  className="flex-1 rounded-lg border-2 border-[#680114] bg-[#F6E9C8] px-3 py-1 text-xs font-medium text-[#680114] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#680114] px-3 py-1 text-xs font-serif font-bold text-[#F6E9C8] hover:bg-[#88091E] transition-colors cursor-pointer shadow-2xs"
                >
                  Apply
                </button>
              </form>
            )}

            <div
              className={`mt-3 rounded-lg p-2.5 border-2 ${
                isPincodeValid
                  ? "bg-[#F6E9C8] border-[#680114] text-[#680114]"
                  : "bg-red-50 border-red-300 text-red-900"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-[#680114]" />
                <span className="text-xs font-bold">{pincodeMessage}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>{product.inStock ? "In Stock (Central Store)" : "Out of Stock"}</span>
            </div>
          </div>
        </section>

        {/* 9. SUGGESTED RELATED PRODUCTS (Mobile) */}
        {suggestedProducts.length > 0 && (
          <section className="bg-[#F6E9C8] px-3.5 py-4 border-t-2 border-[#680114] mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#680114]" />
                <h2 className="text-xs font-serif font-extrabold uppercase tracking-wider text-[#680114]">
                  You May Also Like
                </h2>
              </div>
              <Link
                href={`/category/${product.categorySlug || "all"}`}
                className="text-[11px] font-serif font-bold text-[#680114] hover:underline"
              >
                View More →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {suggestedProducts.map((sp) => (
                <div key={sp.id} className="flex flex-col h-full">
                  <ProductCard
                    id={sp.id}
                    slug={sp.slug}
                    title={sp.title}
                    brand={sp.brand}
                    mrpPaise={sp.mrpPaise}
                    sellingPricePaise={sp.sellingPricePaise}
                    rating={4.5}
                    ratingCount={18}
                    imageUrl={sp.imageUrl}
                    inStock={sp.inStock}
                    badge={sp.badge}
                    variant="grid"
                    onAddToCart={() =>
                      addToCart({
                        id: sp.id,
                        slug: sp.slug,
                        title: sp.title,
                        sellingPricePaise: sp.sellingPricePaise,
                        mrpPaise: sp.mrpPaise,
                        imageUrl: sp.imageUrl,
                      })
                    }
                    onToggleWishlist={() =>
                      toggleWishlist({
                        id: sp.id,
                        slug: sp.slug,
                        title: sp.title,
                        sellingPricePaise: sp.sellingPricePaise,
                        mrpPaise: sp.mrpPaise,
                        imageUrl: sp.imageUrl,
                        inStock: sp.inStock,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 10. STICKY MOBILE BOTTOM ACTION BAR */}
        <div className="fixed bottom-0 inset-x-0 z-50 mx-auto w-full max-w-[480px] bg-[#F6E9C8]/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(44,24,16,0.1)] border-t-2 border-[#680114]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col shrink-0 min-w-[90px]">
              <span className="text-[10px] font-medium text-[#735A4A] leading-none">
                Price
              </span>
              <span className="text-lg font-black tracking-tight text-[#680114]">
                {formatPrice(currentSellingPricePaise)}
              </span>
              <span className="text-[9px] font-bold text-[#680114] leading-tight">
                {product.inStock ? "Ready to Dispatch" : "Out of Stock"}
              </span>
            </div>

            <div className="flex flex-1 items-center gap-2">
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-xs font-serif font-bold transition-all active:scale-95 cursor-pointer ${
                  !product.inStock
                    ? "opacity-50 cursor-not-allowed border-[#680114]/40 text-[#735A4A]"
                    : isAddedToCart
                    ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                    : "border-[#680114] bg-[#F6E9C8] text-[#680114] hover:bg-[#680114]/10 shadow-2xs"
                }`}
              >
                {isAddedToCart ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    <span>Add to Cart</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!product.inStock}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#680114] py-2.5 text-xs font-serif font-extrabold text-[#F6E9C8] shadow-2xs hover:bg-[#88091E] active:scale-95 transition-all cursor-pointer ${
                  !product.inStock ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F6E9C8] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#680114] border-t-transparent" />
        </div>
      }
    >
      <ProductDetailContent />
    </React.Suspense>
  );
}
