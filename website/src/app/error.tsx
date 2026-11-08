"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Segment error boundary caught error", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4 text-center">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 font-semibold">
          !
        </div>
        <h2 className="text-lg font-bold mb-2">Unable to load content</h2>
        <p className="text-sm text-[#680114] mb-5">
          An error occurred while loading this section. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
