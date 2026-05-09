"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the authenticated user's evidence count from /api/evidence/count.
 * Returns null while loading, then a non-negative number.
 * On error or unauthenticated response, resolves to 0 so callers can treat
 * the user as a first-run user and render empty states.
 */
export function useEvidenceCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/evidence/count");
        if (!response.ok) {
          if (!cancelled) setCount(0);
          return;
        }
        const data = (await response.json()) as { count?: number };
        if (!cancelled) {
          setCount(typeof data.count === "number" ? data.count : 0);
        }
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
