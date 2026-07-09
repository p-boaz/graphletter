"use client";

import { CheckCircle2, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FrameworkImpact {
  id: string;
  framework_name: string;
  framework_version: string | null;
  total_framework_mappings: number;
  controls_advanced: number;
  unique_requirements_touched: number;
}

interface FrameworkImpactData {
  total_frameworks_impacted: number;
  total_controls_submitted: number;
  frameworks: FrameworkImpact[];
}

interface FrameworkImpactCascadeProps {
  controlIds: string[];
  assessmentResults?: Array<{
    scf_control_id: string;
    overall_result: "pass" | "fail" | "partial" | "not_applicable";
  }>;
}

// Readable names for common frameworks
const FRAMEWORK_DISPLAY_NAMES: Record<string, string> = {
  NIST_800_53_rev5: "NIST 800-53",
  NIST_800_171_rev2: "NIST 800-171",
  NIST_800_171_rev3: "NIST 800-171 r3",
  NIST_CSF: "NIST CSF",
  NIST_CSF_v2: "NIST CSF v2",
  ISO_27001: "ISO 27001",
  "ISO_27001:2022": "ISO 27001:2022",
  ISO_27002: "ISO 27002",
  "ISO_27002:2022": "ISO 27002:2022",
  SOC_2: "SOC 2",
  PCI_DSS_v4: "PCI DSS v4",
  PCI_DSS_v3_2_1: "PCI DSS v3.2.1",
  HIPAA: "HIPAA",
  GDPR: "GDPR",
  CIS_v8: "CIS v8",
  CIS_v8_1: "CIS v8.1",
  CMMC_v2: "CMMC v2",
  FedRAMP: "FedRAMP",
  CCPA: "CCPA",
  GLBA: "GLBA",
  FERPA: "FERPA",
  FISMA: "FISMA",
  COSO: "COSO",
  COBIT: "COBIT",
  CSA_CCM_v4: "CSA CCM v4",
  SWIFT_CSCF: "SWIFT CSCF",
  NERC_CIP: "NERC CIP",
  AICPA_TSC: "AICPA TSC",
};

function getDisplayName(frameworkName: string): string {
  return FRAMEWORK_DISPLAY_NAMES[frameworkName] || frameworkName.replace(/_/g, " ");
}

// Tier classification for visual emphasis
function getTier(fw: FrameworkImpact): "major" | "notable" | "standard" {
  if (fw.controls_advanced >= 3 || fw.unique_requirements_touched >= 5) return "major";
  if (fw.controls_advanced >= 2 || fw.unique_requirements_touched >= 3) return "notable";
  return "standard";
}

export function FrameworkImpactCascade({
  controlIds,
  assessmentResults,
}: FrameworkImpactCascadeProps) {
  const [data, setData] = useState<FrameworkImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Fetch framework impact data
  useEffect(() => {
    if (controlIds.length === 0) return;

    const fetchImpact = async () => {
      try {
        const response = await fetch("/api/controls/framework-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlIds }),
        });

        if (!response.ok) throw new Error("Failed to fetch framework impact");

        const result = (await response.json()) as FrameworkImpactData;
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, [controlIds]);

  // Cascade animation — reveal frameworks one by one
  useEffect(() => {
    if (!data || data.frameworks.length === 0) return;

    const total = showAll ? data.frameworks.length : Math.min(data.frameworks.length, 12);
    if (visibleCount >= total) return;

    const delay = visibleCount < 5 ? 120 : visibleCount < 10 ? 80 : 40;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [data, visibleCount, showAll]);

  // Counter animation — count up the headline number in sync with cascade
  useEffect(() => {
    if (!data || data.total_frameworks_impacted === 0) return;
    if (displayedTotal >= data.total_frameworks_impacted) return;

    const step = Math.max(1, Math.floor(data.total_frameworks_impacted / 20));
    const timer = setTimeout(() => {
      setDisplayedTotal((c) => Math.min(c + step, data.total_frameworks_impacted));
    }, 60);

    return () => clearTimeout(timer);
  }, [data, displayedTotal]);

  // Count passing controls
  const passCount = assessmentResults?.filter((a) => a.overall_result === "pass").length ?? 0;
  const partialCount = assessmentResults?.filter((a) => a.overall_result === "partial").length ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-ft-pink" />
        <span className="text-slate-600 text-sm">Computing cross-framework impact...</span>
      </div>
    );
  }

  if (error || !data || data.frameworks.length === 0) {
    return null; // Fail silently — this is an enhancement, not a blocker
  }

  const displayFrameworks = showAll ? data.frameworks : data.frameworks.slice(0, 12);
  const hiddenCount = data.frameworks.length - 12;

  return (
    <div className="space-y-4">
      {/* The headline number */}
      <div className="rounded-xl border border-slate-200 bg-ft-cream/50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ft-pink">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="ft-serif font-bold text-2xl text-ft-black tabular-nums">
                {displayedTotal}
              </span>
              <span className="text-slate-600 text-sm">compliance frameworks advanced</span>
            </div>
            <p className="mt-1 text-slate-500 text-xs leading-relaxed">
              {passCount > 0 && (
                <span>
                  {passCount} control{passCount !== 1 ? "s" : ""} passed
                </span>
              )}
              {passCount > 0 && partialCount > 0 && <span>, </span>}
              {partialCount > 0 && <span>{partialCount} partial</span>}
              {(passCount > 0 || partialCount > 0) && <span> — </span>}
              this evidence reaches across your compliance programs
            </p>
          </div>
        </div>
      </div>

      {/* Framework cascade grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {displayFrameworks.map((fw, index) => {
          const tier = getTier(fw);
          const isVisible = index < visibleCount;

          return (
            <div
              key={fw.id}
              className={cn(
                "rounded-lg border p-2.5 transition-all duration-300",
                !isVisible && "scale-95 opacity-0",
                isVisible && "scale-100 opacity-100",
                tier === "major" && "border-slate-300 bg-ft-cream/70",
                tier === "notable" && "border-slate-200 bg-slate-50",
                tier === "standard" && "border-slate-200 bg-slate-50/60"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    "font-medium text-xs leading-tight",
                    tier === "major" && "text-ft-black",
                    tier === "notable" && "text-slate-800",
                    tier === "standard" && "text-slate-700"
                  )}
                >
                  {getDisplayName(fw.framework_name)}
                </span>
                {tier === "major" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ft-pink" />}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "px-1.5 py-0 text-[10px] font-medium",
                    tier === "major" && "bg-ft-cream text-ft-black",
                    tier === "notable" && "bg-slate-100 text-slate-700",
                    tier === "standard" && "bg-slate-100 text-slate-600"
                  )}
                >
                  {fw.unique_requirements_touched} requirement
                  {fw.unique_requirements_touched !== 1 ? "s" : ""}
                </Badge>
                {fw.controls_advanced > 1 && (
                  <span className="text-[10px] text-slate-500">
                    via {fw.controls_advanced} controls
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more / summary */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => {
            setShowAll(true);
            // visibleCount will auto-increment via the effect
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-slate-500 text-xs hover:border-slate-400 hover:text-slate-600 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />+{hiddenCount} more framework
          {hiddenCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
