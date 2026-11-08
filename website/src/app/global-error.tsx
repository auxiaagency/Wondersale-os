"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Global application boundary caught error", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans text-[#680114]">
        <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold tracking-tight mb-2">Something went wrong</h1>
          <p className="text-sm text-[#680114] mb-6">
            We encountered an unexpected error. Our engineering team has been notified.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-[#680114] font-medium text-sm transition-colors inline-block text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
