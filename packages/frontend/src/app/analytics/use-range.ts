"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_RANGE, isRangeKey, type RangeKey } from "./api";

/** Global date range, persisted in the `?range=` query string. */
export function useRange(): [RangeKey, (next: RangeKey) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = searchParams?.get("range");
  const range = isRangeKey(raw) ? raw : DEFAULT_RANGE;

  const setRange = useCallback(
    (next: RangeKey) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("range", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [range, setRange];
}
