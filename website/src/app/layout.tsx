import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#5A0A10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Wondersale | Bhopal's Retail & Online Superstore",
    template: "%s | Wondersale Bhopal",
  },
  description:
    "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour delivery across Bhopal, MP.",
  applicationName: "Wondersale",
  authors: [{ name: "Wondersale Retail Private Limited" }],
  generator: "Next.js",
  keywords: [
    "Wondersale",
    "Bhopal e-commerce",
    "Bhopal retail superstore",
    "express delivery Bhopal",
    "pressure cooker Bhopal",
    "kitchen appliances Bhopal",
    "MP Nagar electronics",
    "Arera Colony delivery",
  ],
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://wondersale.in",
    siteName: "Wondersale",
    title: "Wondersale | Bhopal's Retail & Online Superstore",
    description:
      "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour delivery across Bhopal.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wondersale | Bhopal's Retail & Online Superstore",
    description:
      "Shop kitchen appliances, electronics, crockery, toys, snacks, and clocks with nationwide delivery and express 2-hour delivery across Bhopal.",
  },
};

import { StorefrontProvider } from "@/context/StorefrontContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/next.svg" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[#FDF8EE] text-[#2C1810] antialiased selection:bg-[#7A0C16]/20 selection:text-[#7A0C16]">
        <StorefrontProvider>{children}</StorefrontProvider>
      </body>
    </html>
  );
}
