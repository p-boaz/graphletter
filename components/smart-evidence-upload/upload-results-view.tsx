"use client";

import { CheckCircle2, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { AssessmentResultsDisplay } from "@/components/assessment-results-display";
import { NextUploadSuggestion } from "@/components/next-upload-suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SmartUploadResult } from "./types";

interface FrameworkImpact {
  total_frameworks_impacted: number;
  frameworks: Array<{
    id: string;
    framework_name: string;
    framework_version?: string | null;
    controls_advanced: number;
    control_ids?: string[];
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

interface UploadResultsViewProps {
  uploadResult: SmartUploadResult;
  onStartUploadForArtifact: (artifactName: string) => void;
  onClose: () => void;
}

export function UploadResultsView({
  uploadResult,
  onStartUploadForArtifact,
  onClose,
}: UploadResultsViewProps) {
  const [frameworkImpact, setFrameworkImpact] = useState<FrameworkImpact | null>(null);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState("all");

  useEffect(() => {
    if (uploadResult.discovered_controls.length === 0) return;

    const fetchImpact = async () => {
      try {
        const res = await fetch("/api/controls/framework-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            controlIds: uploadResult.discovered_controls,
          }),
        });
        if (res.ok) {
          setFrameworkImpact((await res.json()) as FrameworkImpact);
        }
      } catch {
        // Non-critical
      }
    };

    fetchImpact();
  }, [uploadResult.discovered_controls]);

  useEffect(() => {
    if (
      selectedFrameworkId !== "all" &&
      !frameworkImpact?.frameworks.some((framework) => framework.id === selectedFrameworkId)
    ) {
      setSelectedFrameworkId("all");
    }
  }, [frameworkImpact, selectedFrameworkId]);

  // Top 4 frameworks for the badge, deduped by display name
  const topFrameworks: string[] = [];
  const seenNames = new Set<string>();
  for (const fw of frameworkImpact?.frameworks ?? []) {
    const display = getShortName(fw.framework_name);
    if (!seenNames.has(display)) {
      seenNames.add(display);
      topFrameworks.push(display);
    }
    if (topFrameworks.length >= 4) break;
  }
  const extraCount = Math.max(
    0,
    (frameworkImpact?.total_frameworks_impacted ?? 0) - topFrameworks.length
  );
  const selectedFramework =
    selectedFrameworkId === "all"
      ? null
      : frameworkImpact?.frameworks.find((framework) => framework.id === selectedFrameworkId);
  const selectedControlIds = selectedFramework?.control_ids
    ? new Set(selectedFramework.control_ids)
    : null;
  const displayedAssessments = selectedControlIds
    ? uploadResult.assessments.filter((assessment) =>
        selectedControlIds.has(assessment.scf_control_id)
      )
    : uploadResult.assessments;

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="rounded-lg bg-green-50 p-4 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
        <h3 className="mb-1 font-medium text-green-900">Evidence Uploaded Successfully!</h3>
        <p className="text-green-700 text-sm">
          Assessed {uploadResult.discovered_controls.length} controls for &quot;
          {uploadResult.documentation_artifact}
          &quot;
        </p>

        {/* One Upload, Many Frameworks badge */}
        {frameworkImpact && frameworkImpact.total_frameworks_impacted > 0 && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-800">
              <Layers className="h-4 w-4" />
              This upload advanced {frameworkImpact.total_frameworks_impacted} framework
              {frameworkImpact.total_frameworks_impacted !== 1 ? "s" : ""}
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {topFrameworks.map((name) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0"
                >
                  {name}
                </Badge>
              ))}
              {extraCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-600 text-[10px] px-1.5 py-0"
                >
                  +{extraCount} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Impact summary + next upload suggestion */}
      <NextUploadSuggestion
        justUploadedArtifact={uploadResult.documentation_artifact}
        completedControlIds={uploadResult.discovered_controls}
        assessmentResults={uploadResult.assessments.map((a) => ({
          scf_control_id: a.scf_control_id,
          overall_result: a.overall_result,
        }))}
        onStartUpload={onStartUploadForArtifact}
      />

      {/* Assessment Results */}
      {uploadResult.assessments.length > 0 && (
        <div className="space-y-3">
          {frameworkImpact && frameworkImpact.frameworks.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">Assessment results</p>
                <p className="text-gray-500 text-xs">
                  Showing {displayedAssessments.length} of {uploadResult.assessments.length}{" "}
                  controls
                </p>
              </div>
              <Select value={selectedFrameworkId} onValueChange={setSelectedFrameworkId}>
                <SelectTrigger
                  className="w-full sm:w-56"
                  data-testid="results-framework-filter-trigger"
                >
                  <SelectValue placeholder="All frameworks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All frameworks</SelectItem>
                  {frameworkImpact.frameworks.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {getShortName(framework.framework_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AssessmentResultsDisplay
            assessments={displayedAssessments.map((assessment) => ({
              id: assessment.id,
              scf_control_id: assessment.scf_control_id,
              overall_result: assessment.overall_result,
              overall_confidence: assessment.overall_confidence,
              summary: assessment.summary,
              control_title: assessment.control_title,
              control_description: assessment.control_description,
              control_guidance: assessment.control_guidance,
              domain_name: assessment.domain_name,
              ai_generated: true,
              objective_results: assessment.objective_results,
              maturity_assessment: assessment.maturity_assessment,
              maturity_levels: assessment.maturity_levels,
            }))}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
