"use client";

import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { pluralize } from "./utils";

interface ImpactPreviewBannerProps {
  controlIds: string[];
  frameworkId?: string;
}

interface ImpactData {
  currentScore: number;
  projectedScore: number;
  improvementPct: number;
}

export function ImpactPreviewBanner({ controlIds, frameworkId }: ImpactPreviewBannerProps) {
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (controlIds.length === 0) {
      setImpact(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/compliance/impact-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controlIds, frameworkId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.preview && data.preview.improvementPct > 0) {
          setImpact(data.preview);
        } else {
          setImpact(null);
        }
      })
      .catch(() => {
        if (!cancelled) setImpact(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [controlIds, frameworkId]);

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-lg border border-blue-100 bg-blue-50 p-3"
        data-testid="impact-preview-banner"
      >
        <div className="h-4 w-3/4 rounded bg-blue-100" />
      </div>
    );
  }

  if (!impact) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
      data-testid="impact-preview-banner"
    >
      <TrendingUp className="h-5 w-5 shrink-0 text-slate-600" />
      <div className="text-sm">
        <p className="font-medium text-slate-900">
          Covers {pluralize(controlIds.length, "control")}
          {frameworkId ? " in the selected framework" : " across mapped frameworks"}
        </p>
        {impact.improvementPct >= 0.1 && (
          <p className="mt-0.5 text-slate-600 text-xs">
            Projected posture:{" "}
            <span className="font-semibold" data-testid="impact-preview-score">
              {impact.currentScore.toFixed(1)}%
            </span>{" "}
            to <span className="font-semibold">{impact.projectedScore.toFixed(1)}%</span>{" "}
            <span className="font-medium text-slate-700">
              (+{impact.improvementPct.toFixed(1)}%)
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
