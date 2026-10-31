import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://wondersale.in";

  const categories = [
    "kitchen-appliances",
    "home-appliances",
    "electronics-audio",
    "crockery-kitchenware",
    "toys-games",
    "packaged-food-snacks",
    "clocks-timepieces",
    "sunglasses-accessories",
  ];

  const categoryEntries = categories.map((slug) => ({
    url: `${baseUrl}/category/${slug}`,
    lastModified: new Date("2026-10-16"),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "always" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/track-order`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/shipping`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/returns`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-10-16"),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    ...categoryEntries,
  ];
}
