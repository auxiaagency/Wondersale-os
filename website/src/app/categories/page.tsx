"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CategoriesRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const selected = searchParams.get("selected");
    const sub = searchParams.get("subcategory");
    let target = "/category/all";
    if (selected) {
      target = `/category/${encodeURIComponent(selected)}`;
      if (sub) {
        target += `?subcategory=${encodeURIComponent(sub)}`;
      }
    }
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#FDF8EE] flex items-center justify-center text-[#680114] font-serif font-bold text-sm">
      Loading department catalog...
    </div>
  );
}

export default function CategoriesRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDF8EE] flex items-center justify-center text-[#680114] font-serif font-bold text-sm">
          Loading department catalog...
        </div>
      }
    >
      <CategoriesRedirectContent />
    </Suspense>
  );
}
