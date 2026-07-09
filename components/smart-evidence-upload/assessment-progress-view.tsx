"use client";

import { AlertCircle, CheckCircle2, FileText, Play, RefreshCw, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AssessmentStatusBadge } from "@/components/ui/status-badge";
import type { UploadOnlyResult } from "@/lib/client/smart-evidence-workflow";
import type { LiveAssessmentProgress } from "./types";
import { formatEta, formatResultLabel, pluralize } from "./utils";

interface AssessmentProgressViewProps {
  uploadOnlyResult: UploadOnlyResult;
  assessing: boolean;
  liveAssessmentProgress: LiveAssessmentProgress;
  processingStage: string;
  graphExtractionLimited: boolean;
  graphExtractionSkipReason: string | null;
  failedControls: Array<{ control_id: string; error: string }>;
  retrying: boolean;
  onStartAssessment: () => void;
  onRetryFailed?: () => void;
  onUploadDifferentFile: () => void;
  onClose: () => void;
}

const SKIP_REASON_DESCRIPTIONS: Record<string, string> = {
  graph_content_empty_content: "The file appears to contain no readable text.",
  graph_content_extraction_failed: "Text could not be extracted from this file format.",
  graph_content_limited: "Only limited text could be extracted from this file.",
  no_atoms_created: "No usable statements could be identified in the extracted text.",
  no_discovered_controls: "No matching controls were found for this document type.",
};

function describeSkipReason(reason: string | null): string | null {
  if (!reason) return null;
  return SKIP_REASON_DESCRIPTIONS[reason] ?? null;
}

function formatEvidenceStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AssessmentProgressView({
  uploadOnlyResult,
  assessing,
  liveAssessmentProgress,
  processingStage,
  graphExtractionLimited,
  graphExtractionSkipReason,
  failedControls,
  retrying,
  onStartAssessment,
  onRetryFailed,
  onUploadDifferentFile,
  onClose,
}: AssessmentProgressViewProps) {
  const totalControlCount = Math.max(
    1,
    liveAssessmentProgress.totalControls || uploadOnlyResult.discovered_controls.length
  );

  return (
    <div className="space-y-6">
      {/* Upload Success Header */}
      <div className="rounded-lg bg-green-50 p-4 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
        <h3 className="mb-1 font-medium text-green-900">Evidence Uploaded Successfully!</h3>
        <p className="text-green-700 text-sm">
          {`Found ${pluralize(uploadOnlyResult.discovered_controls.length, "relevant control")} for "${uploadOnlyResult.documentation_artifact}"`}
        </p>
      </div>

      {graphExtractionLimited ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-900">
                We couldn't reliably read the text in this file
              </p>
              <p className="text-amber-800">
                The assessment can still run, but findings won't be traceable back to specific
                passages until you upload a text-readable version (for example, a PDF or Word file
                instead of a scanned image).
              </p>
              {describeSkipReason(graphExtractionSkipReason) ? (
                <p className="text-[11px] text-amber-700">
                  {describeSkipReason(graphExtractionSkipReason)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Evidence Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {uploadOnlyResult.evidence.file_name}
          </CardTitle>
          <CardDescription>
            {formatEvidenceStatus(uploadOnlyResult.evidence.evidence_status)} — ready for assessment
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Controls to be assessed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Controls to Assess ({uploadOnlyResult.discovered_controls.length})
          </CardTitle>
          <CardDescription>
            These SCF controls will be evaluated when you start the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-h-48 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {uploadOnlyResult.controls_details.map((control) => (
              <div key={control.scf_control_id} className="rounded-lg bg-gray-50 p-3">
                <h4 className="font-medium text-gray-900 text-sm">{control.scf_control_id}</h4>
                <p className="mt-1 line-clamp-2 text-gray-600 text-xs">{control.title}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assessment Action */}
      <div className="rounded-lg bg-ft-cream/60 p-6 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-ft-pink" />
        <h3 className="ft-serif mb-2 font-semibold text-ft-black">
          {assessing ? "Assessment in progress" : "Ready to assess"}
        </h3>
        {assessing ? (
          <div className="mx-auto mt-4 max-w-2xl space-y-3 text-left">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900 text-sm">
                  {liveAssessmentProgress.currentControlId
                    ? `Assessing ${liveAssessmentProgress.currentControlId}`
                    : "Preparing first control assessment..."}
                </p>
                <span className="ft-mono font-semibold text-slate-700 text-sm">
                  {liveAssessmentProgress.completedControls}/{totalControlCount}
                </span>
              </div>
              <Progress
                value={
                  Math.round(
                    (liveAssessmentProgress.completedControls / totalControlCount) * 100
                  ) || 0
                }
                className="h-2 bg-ft-grey-1"
              />
              <div className="mt-2 flex items-center justify-between text-slate-600 text-xs">
                <span>
                  {liveAssessmentProgress.completedControls} of{" "}
                  {pluralize(totalControlCount, "control")} complete
                </span>
                <span>{formatEta(liveAssessmentProgress.estimatedRemainingMs)}</span>
              </div>
              {processingStage && <p className="mt-2 text-slate-500 text-xs">{processingStage}</p>}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="ft-eyebrow mb-2 text-[11px]">Per-control outcomes</p>
              {liveAssessmentProgress.results.length === 0 ? (
                <p className="text-slate-600 text-xs">
                  Pass/fail outcomes will appear here as each control completes.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {liveAssessmentProgress.results
                    .slice(-8)
                    .reverse()
                    .map((controlResult) => (
                      <div
                        key={controlResult.controlId}
                        className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1"
                      >
                        <span className="font-mono text-[11px] text-slate-800">
                          {controlResult.controlId}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {controlResult.result === "error" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {formatResultLabel(controlResult.result)}
                            </Badge>
                          ) : (
                            <AssessmentStatusBadge
                              status={controlResult.result}
                              className="text-[10px]"
                            />
                          )}
                          {typeof controlResult.confidence === "number" && (
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(controlResult.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="mb-4 text-slate-600 text-sm">
              Click the button below to run AI assessment against all{" "}
              {pluralize(uploadOnlyResult.discovered_controls.length, "relevant SCF control")}
            </p>
            <Button
              onClick={onStartAssessment}
              disabled={assessing}
              data-testid="start-ai-assessment-button"
            >
              <Play className="mr-2 h-4 w-4" />
              Start assessment
            </Button>
          </>
        )}
      </div>

      {/* Failed Controls — Retry Section */}
      {!assessing && !retrying && failedControls.length > 0 && onRetryFailed && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
            <div>
              <p className="font-medium text-red-900 text-sm">
                {failedControls.length} control
                {failedControls.length > 1 ? "s" : ""} failed assessment
              </p>
              <p className="mt-1 text-red-700 text-xs">
                These controls encountered errors during AI assessment and can be retried.
              </p>
            </div>
          </div>
          <div className="mb-3 max-h-32 space-y-1 overflow-y-auto">
            {failedControls.map((fc) => (
              <div
                key={fc.control_id}
                className="flex items-center justify-between rounded border border-red-100 bg-white px-2 py-1"
              >
                <span className="font-mono text-[11px] text-red-900">{fc.control_id}</span>
                <span className="max-w-[200px] truncate text-[10px] text-red-600">{fc.error}</span>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetryFailed}
            className="border-red-300 text-red-700 hover:bg-red-100"
            data-testid="retry-failed-controls-button"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry Failed Controls
          </Button>
        </div>
      )}

      {retrying && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-600" />
          <p className="font-medium text-amber-900 text-sm">Retrying failed controls...</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadDifferentFile} disabled={assessing || retrying}>
          Upload Different File
        </Button>
        <Button variant="outline" onClick={onClose} disabled={assessing || retrying}>
          Close
        </Button>
      </div>
    </div>
  );
}
