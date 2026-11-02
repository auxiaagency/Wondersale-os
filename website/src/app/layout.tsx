import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#680114",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Wondersale | Retail & Online Superstore",
    template: "%s | Wondersale",
  },
  description:
    "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour doorstep delivery.",
  applicationName: "Wondersale",
  authors: [{ name: "Wondersale Retail Private Limited" }],
  generator: "Next.js",
  keywords: [
    "Wondersale",
    "retail superstore",
    "express delivery",
    "kitchen appliances",
    "cookware",
    "electronics",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://wondersale.in",
    siteName: "Wondersale",
    title: "Wondersale | Retail & Online Superstore",
    description:
      "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour doorstep delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wondersale | Retail & Online Superstore",
    description:
      "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour doorstep delivery.",
  },
};

import { StorefrontProvider } from "@/context/StorefrontContext";
import { CategoryTreeMenuModal } from "@/components/navigation/CategoryTreeMenuModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[#F6E9C8] text-[#680114] antialiased selection:bg-[#680114]/20 selection:text-[#680114]">
        <StorefrontProvider>
          {children}
          <CategoryTreeMenuModal />
        </StorefrontProvider>
      </body>
    </html>
  );
}
