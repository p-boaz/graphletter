"use client";

import { Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface LeverageBadgeProps {
  controlIds: string[];
}

interface FrameworkImpact {
  total_frameworks_impacted: number;
  frameworks: Array<{
    framework_name: string;
    controls_advanced: number;
  }>;
}

// Module-level cache + in-flight dedupe. Every badge in a list used to fire
// its own POST (and re-fire when the controlIds array identity changed),
// which tripped the API rate limiter — see QA 2026-07-09 ISSUE-002.
const impactCache = new Map<string, FrameworkImpact>();
const inflightRequests = new Map<string, Promise<FrameworkImpact | null>>();

function fetchImpact(cacheKey: string, controlIds: string[]): Promise<FrameworkImpact | null> {
  const cached = impactCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) return inflight;

  const request = fetch("/api/controls/framework-impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ controlIds }),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const impact = (await res.json()) as FrameworkImpact;
      // Only successes are cached; transient failures may retry on remount.
      impactCache.set(cacheKey, impact);
      return impact;
    })
    .catch(() => null)
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

export function LeverageBadge({ controlIds }: LeverageBadgeProps) {
  const [impact, setImpact] = useState<FrameworkImpact | null>(null);
  const cacheKey = controlIds.slice().sort().join(",");

  useEffect(() => {
    if (!cacheKey) return;

    let cancelled = false;
    const ids = cacheKey.split(",");
    fetchImpact(cacheKey, ids).then((result) => {
      if (!cancelled && result) setImpact(result);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  if (!impact || impact.total_frameworks_impacted === 0) return null;

  return (
    <Badge variant="secondary" className="gap-1 bg-ft-cream text-ft-black text-xs">
      <Layers className="h-3 w-3" />
      {impact.total_frameworks_impacted} framework
      {impact.total_frameworks_impacted !== 1 ? "s" : ""}
    </Badge>
  );
}
