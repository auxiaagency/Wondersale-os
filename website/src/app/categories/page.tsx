"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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

  return <LoadingSpinner fullScreen text="Loading category catalog..." />;
}

export default function CategoriesRedirectPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen text="Loading category catalog..." />}>
      <CategoriesRedirectContent />
    </Suspense>
  );
}
