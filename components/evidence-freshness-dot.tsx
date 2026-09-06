"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FreshnessStatus } from "@/lib/compliance/freshness-engine";

interface EvidenceFreshnessDotProps {
  status: FreshnessStatus;
  daysUntilExpiry: number;
}

const DOT_STYLES: Record<FreshnessStatus, string> = {
  fresh: "bg-green-500",
  expiring: "bg-yellow-500",
  stale: "bg-red-500",
};

function freshnessLabel(status: FreshnessStatus, daysUntilExpiry: number): string {
  if (status === "stale") {
    return `Stale (expired ${Math.abs(daysUntilExpiry)} days ago)`;
  }
  if (status === "expiring") {
    return `Expiring in ${daysUntilExpiry} days`;
  }
  return `Fresh (expires in ${daysUntilExpiry} days)`;
}

export function EvidenceFreshnessDot({ status, daysUntilExpiry }: EvidenceFreshnessDotProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="evidence-freshness-dot"
          data-freshness={status}
          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_STYLES[status]}`}
          aria-label={freshnessLabel(status, daysUntilExpiry)}
        />
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {freshnessLabel(status, daysUntilExpiry)}
      </TooltipContent>
    </Tooltip>
  );
}
