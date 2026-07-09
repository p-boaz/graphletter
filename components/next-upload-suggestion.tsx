"use client";

import { ArrowRight, Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ArtifactOption {
  artifact: string;
  erl_id: string;
  controls: Array<{
    scf_control_id: string;
    title: string;
  }>;
}

interface FrameworkImpactSummary {
  total_frameworks_impacted: number;
  frameworks: Array<{
    framework_name: string;
    controls_advanced: number;
  }>;
}

interface NextUploadSuggestionProps {
  /** The artifact that was just uploaded — so we can exclude it */
  justUploadedArtifact: string;
  /** Control IDs from the just-completed upload */
  completedControlIds: string[];
  /** Callback to start uploading the suggested artifact */
  onStartUpload?: (artifactName: string) => void;
  /** Assessment results for the impact summary line */
  assessmentResults?: Array<{
    scf_control_id: string;
    overall_result: "pass" | "fail" | "partial" | "not_applicable";
  }>;
}

const FRAMEWORK_SHORT_NAMES: Record<string, string> = {
  NIST_800_53_rev5: "NIST 800-53",
  NIST_CSF: "NIST CSF",
  NIST_CSF_v2: "NIST CSF v2",
  ISO_27001: "ISO 27001",
  "ISO_27001:2022": "ISO 27001:2022",
  SOC_2: "SOC 2",
  PCI_DSS_v4: "PCI DSS v4",
  HIPAA: "HIPAA",
  GDPR: "GDPR",
  CIS_v8: "CIS v8",
  CMMC_v2: "CMMC v2",
};

function getShortName(name: string): string {
  return FRAMEWORK_SHORT_NAMES[name] || name.replace(/_/g, " ");
}

export function NextUploadSuggestion({
  justUploadedArtifact,
  completedControlIds,
  onStartUpload,
  assessmentResults,
}: NextUploadSuggestionProps) {
  const [suggestion, setSuggestion] = useState<ArtifactOption | null>(null);
  const [impactSummary, setImpactSummary] = useState<FrameworkImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch artifacts and framework impact in parallel
        const [artifactsRes, impactRes] = await Promise.all([
          fetch("/api/erl/artifacts"),
          completedControlIds.length > 0
            ? fetch("/api/controls/framework-impact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ controlIds: completedControlIds }),
              })
            : null,
        ]);

        // Process impact summary
        if (impactRes?.ok) {
          const impact = (await impactRes.json()) as FrameworkImpactSummary;
          setImpactSummary(impact);
        }

        // Find next best artifact
        if (artifactsRes.ok) {
          const data = (await artifactsRes.json()) as {
            artifacts: ArtifactOption[];
          };
          const candidates = data.artifacts
            .filter((a) => a.artifact !== justUploadedArtifact)
            .sort((a, b) => b.controls.length - a.controls.length);

          if (candidates.length > 0) {
            setSuggestion(candidates[0]);
          }
        }
      } catch {
        // Non-critical — fail silently
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [justUploadedArtifact, completedControlIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }

  const passCount = assessmentResults?.filter((a) => a.overall_result === "pass").length ?? 0;
  const partialCount = assessmentResults?.filter((a) => a.overall_result === "partial").length ?? 0;

  // Top 5 frameworks by impact, deduplicated by display name
  const topFrameworks: FrameworkImpactSummary["frameworks"] = [];
  const seenNames = new Set<string>();
  for (const fw of impactSummary?.frameworks ?? []) {
    const display = getShortName(fw.framework_name);
    if (!seenNames.has(display)) {
      seenNames.add(display);
      topFrameworks.push(fw);
    }
    if (topFrameworks.length >= 5) break;
  }

  return (
    <div className="space-y-3">
      {/* Compact impact summary — replaces the full cascade */}
      {impactSummary && impactSummary.total_frameworks_impacted > 0 && (
        <div className="rounded-lg border border-slate-200 bg-ft-cream/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-ft-pink" />
            <p className="text-sm text-slate-800">
              <span className="font-semibold">
                {impactSummary.total_frameworks_impacted} frameworks
              </span>{" "}
              advanced
              {passCount > 0 && (
                <span className="text-ft-pink">
                  {" "}
                  — {passCount} control{passCount !== 1 ? "s" : ""} passed
                  {partialCount > 0 ? `, ${partialCount} partial` : ""}
                </span>
              )}
            </p>
          </div>
          {topFrameworks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {topFrameworks.map((fw, index) => (
                <Badge
                  key={`${fw.framework_name}-${index}`}
                  variant="secondary"
                  className="bg-ft-cream text-ft-black text-[10px] px-1.5 py-0"
                >
                  {getShortName(fw.framework_name)}
                </Badge>
              ))}
              {impactSummary.total_frameworks_impacted > 5 && (
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0"
                >
                  +{impactSummary.total_frameworks_impacted - 5} more
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Next upload suggestion */}
      {suggestion && (
        <div className="rounded-lg border border-slate-200 bg-ft-cream/40 p-4">
          <p className="ft-eyebrow mb-2 text-[11px]">
            Keep the momentum — your next highest-impact upload:
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-slate-900 truncate">{suggestion.artifact}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Covers {suggestion.controls.length} control
                {suggestion.controls.length !== 1 ? "s" : ""}
              </p>
            </div>
            {onStartUpload && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-slate-300 text-slate-700 hover:bg-ft-cream"
                onClick={() => onStartUpload(suggestion.artifact)}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
