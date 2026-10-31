import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#D91E2A",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/next.svg" />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-red-100 selection:text-red-700">
        {children}
      </body>
    </html>
  );
}
