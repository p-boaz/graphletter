"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Database,
  FileText,
  Gauge,
  Target,
} from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { InlineHelp } from "@/components/inline-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssessmentStatusBadge, ConfidenceBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ControlGroup, ControlObjective, ObjectiveDetail } from "./types";
import {
  getControlOverallConfidence,
  getControlOverallResult,
  getObjectiveResultGuidance,
  getTopGapAndRecommendation,
} from "./utils";

interface ControlRowProps {
  control: ControlGroup;
  isExpanded: boolean;
  objectiveDetails: Record<string, ObjectiveDetail>;
  onToggleExpand: (controlId: string) => void;
  onSelectControl: (controlId: string) => void;
  enableRowDetailDialog: boolean;
  showLinkedEvidence: boolean;
  showCompletedDate: boolean;
  hideSummary?: boolean;
}

export function ControlRow({
  control,
  isExpanded,
  objectiveDetails,
  onToggleExpand,
  onSelectControl,
  enableRowDetailDialog,
  showLinkedEvidence,
  showCompletedDate,
  hideSummary = false,
}: ControlRowProps) {
  const hasObjectives = control.objectives.length > 0;
  const overallResult = getControlOverallResult(control.objectives);
  const overallResultLabel = overallResult.replace(/_/g, " ").toUpperCase();
  const overallConfidence = getControlOverallConfidence(control.objectives);
  const maturityAssessment = control.maturity_assessment;
  const { topGap, topRecommendation } = getTopGapAndRecommendation(control.objectives);
  const isLowConfidence = overallConfidence < 0.6;
  // One affordance per gesture: the row (and its single chevron) toggles the
  // inline objectives view; the full-record dialog is a labeled action inside
  // the expanded panel. Two adjacent chevrons doing different things confused
  // users (QA 2026-07-09 round 5).
  const rowIsInteractive = hasObjectives || enableRowDetailDialog;
  // "Approve Assessment" approves the underlying evidence, not the assessment
  // row, so key the review stripe on the linked evidence status too — rows
  // stayed amber forever otherwise (QA 2026-07-09 round 5).
  const hasApprovedEvidence = control.linked_evidence?.some(
    (evidence) => evidence.evidence_status === "approved"
  );
  const reviewState =
    control.assessment_status === "approved" || hasApprovedEvidence
      ? "approved"
      : "awaiting_review";
  const openDetails = () => onSelectControl(control.control_id);
  const handleRowActivate = () => {
    if (hasObjectives) {
      onToggleExpand(control.control_id);
      return;
    }
    if (enableRowDetailDialog) {
      openDetails();
    }
  };
  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!rowIsInteractive) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    const target = event.target as HTMLElement;
    if (
      target.closest("[data-row-action='expand']") ||
      target.closest("[data-row-action='details']")
    ) {
      return;
    }

    event.preventDefault();
    handleRowActivate();
  };
  const formattedDate = control.completed_at
    ? new Date(control.completed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      data-testid="assessment-result-card"
      role={rowIsInteractive ? "button" : undefined}
      tabIndex={rowIsInteractive ? 0 : undefined}
      aria-label={
        rowIsInteractive
          ? hasObjectives
            ? `${isExpanded ? "Collapse" : "Expand"} assessment objectives for ${control.control_id}, verdict ${overallResultLabel}`
            : `Open assessment details for ${control.control_id}, verdict ${overallResultLabel}`
          : undefined
      }
      aria-expanded={hasObjectives ? isExpanded : undefined}
      onKeyDown={handleRowKeyDown}
      onClick={(event) => {
        if (!rowIsInteractive) {
          return;
        }
        const target = event.target as HTMLElement;
        if (
          target.closest("[data-row-action='expand']") ||
          target.closest("[data-row-action='details']")
        ) {
          return;
        }
        handleRowActivate();
      }}
      className={`border border-gray-200 rounded-lg bg-white shadow-sm ${
        rowIsInteractive
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          : ""
      }`}
    >
      {!hideSummary && (
        <div
          className={`flex items-center justify-between p-4 ${
            reviewState === "approved"
              ? "border-l-4 border-l-green-500"
              : "border-l-4 border-l-amber-500"
          }`}
        >
          <div className="flex items-center space-x-3">
            {reviewState === "approved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-semibold text-base text-gray-900">{control.control_id}</span>
                {control.domain_name && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {control.domain_name}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-700 mb-1">{control.control_title}</div>
              {(overallResult === "fail" || overallResult === "partial") &&
                (topGap || topRecommendation) && (
                  <div className="mb-1 space-y-1">
                    {topGap && (
                      <p className="text-red-700 text-xs">
                        <span className="font-medium">Top gap:</span> {topGap}
                      </p>
                    )}
                    {topRecommendation && (
                      <p className="text-green-700 text-xs">
                        <span className="font-medium">Top recommendation:</span> {topRecommendation}
                      </p>
                    )}
                  </div>
                )}
              {(formattedDate || showLinkedEvidence || maturityAssessment) && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {formattedDate && showCompletedDate && (
                    <span className="flex items-center">{formattedDate}</span>
                  )}
                  {showLinkedEvidence &&
                    control.linked_evidence &&
                    control.linked_evidence.length > 0 && (
                      <span className="flex items-center">
                        <FileText className="h-3 w-3 mr-1" />
                        {control.linked_evidence.length} evidence file
                        {control.linked_evidence.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  {maturityAssessment && (
                    <span className="flex items-center text-slate-600">
                      <Gauge className="h-3 w-3 mr-1" />
                      Level {maturityAssessment.assessed_level}
                      {typeof maturityAssessment.target_level === "number" && (
                        <span className="ml-1 text-slate-500">
                          (target {maturityAssessment.target_level}
                          {typeof maturityAssessment.target_gap === "number"
                            ? `, gap ${maturityAssessment.target_gap}`
                            : ""}
                          )
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <ConfidenceBadge confidence={overallConfidence} className="mb-1 text-xs" />
              {isLowConfidence && (
                <Badge variant="destructive" className="text-[10px] mb-1">
                  Low confidence
                </Badge>
              )}
              <AssessmentStatusBadge
                status={overallResult}
                className="justify-center text-xs"
                data-testid="assessment-result-verdict"
              />
            </div>
            {hasObjectives && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                data-row-action="expand"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} assessment objectives for ${
                  control.control_id
                }`}
                aria-expanded={isExpanded}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleExpand(control.control_id);
                }}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Expanded Objectives View */}
      {hasObjectives && isExpanded && (
        <div className={`${hideSummary ? "" : "border-t "}bg-slate-50 p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-ft-pink" />
              <h5 className="font-semibold text-sm text-gray-900">
                Assessment Objectives ({control.objectives.length})
              </h5>
            </div>
            {enableRowDetailDialog && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                data-row-action="details"
                data-testid="open-full-assessment-record"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetails();
                }}
              >
                Open full record
              </Button>
            )}
          </div>
          <div className="mb-3 rounded-md border border-slate-200 bg-ft-cream/50 p-2 text-xs text-slate-800">
            <div className="flex items-center gap-1">
              <CircleHelp className="h-3.5 w-3.5" />
              <span className="font-medium">What this section means</span>
            </div>
            <p className="mt-1">
              Each objective is a testable checkpoint for the control.{" "}
              <InlineHelp termId="assessment-objectives">Learn objective basics</InlineHelp> and{" "}
              <InlineHelp termId="result-states">result states</InlineHelp>.
            </p>
          </div>
          <div className="space-y-3">
            {control.objectives.map((objective, idx) => {
              const enrichedObjective = objective.scf_ao_id
                ? {
                    ...objective,
                    ...objectiveDetails[objective.scf_ao_id],
                  }
                : objective;

              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900 font-mono">
                      {enrichedObjective.scf_ao_id || `OBJ-${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {enrichedObjective.confidence && (
                        <ConfidenceBadge
                          confidence={enrichedObjective.confidence}
                          className="text-xs"
                        />
                      )}
                      <AssessmentStatusBadge
                        status={enrichedObjective.result}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-slate-600">
                    {getObjectiveResultGuidance(enrichedObjective.result)}{" "}
                    <InlineHelp termId="result-states">See scoring guide</InlineHelp>.
                  </p>
                  {enrichedObjective.assessment_objective && (
                    <div className="mb-2">
                      <div className="rounded-md border-l-2 border-l-green-500 bg-white p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="h-3 w-3 text-green-600" />
                          <p className="ft-eyebrow text-[11px] text-green-700">
                            SCF Assessment Objective
                          </p>
                        </div>
                        <p className="text-sm text-slate-700">
                          {enrichedObjective.assessment_objective}
                        </p>
                      </div>
                    </div>
                  )}
                  {enrichedObjective.assessment_procedure && (
                    <div className="mb-2 rounded-md border-l-2 border-l-amber-500 bg-white p-2">
                      <p className="text-xs font-medium text-amber-900">Assessment Procedure</p>
                      <p className="text-xs text-slate-700">
                        {enrichedObjective.assessment_procedure}
                      </p>
                    </div>
                  )}
                  {enrichedObjective.expected_results && (
                    <div className="mb-2 rounded-md border-l-2 border-l-slate-300 bg-white p-2">
                      <p className="text-xs font-medium text-slate-900">Expected Results</p>
                      <p className="text-xs text-slate-700">{enrichedObjective.expected_results}</p>
                    </div>
                  )}
                  <div>
                    <div className="rounded-md border-l-2 border-l-blue-500 bg-white p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="ft-eyebrow text-[11px]">Reasoning</p>
                      </div>
                      <p className="text-sm text-slate-700">{enrichedObjective.reasoning}</p>
                    </div>
                  </div>
                  {enrichedObjective.gaps && enrichedObjective.gaps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-700 mb-1">Identified Gaps:</p>
                      <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                        {enrichedObjective.gaps.map((gap: string, gapIdx: number) => (
                          <li key={gapIdx}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichedObjective.recommendations &&
                    enrichedObjective.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-green-700 mb-1">Recommendations:</p>
                        <ul className="text-sm text-green-600 list-disc list-inside space-y-1">
                          {enrichedObjective.recommendations.map((rec: string, recIdx: number) => (
                            <li key={recIdx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded Maturity View */}
      {maturityAssessment && isExpanded && (
        <div className="border-t bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-ft-pink" />
              <h5 className="ft-serif font-semibold text-sm text-ft-black">Maturity Assessment</h5>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-input px-2 py-0.5 text-xs font-mono underline decoration-dotted underline-offset-2"
                    aria-describedby="maturity-tooltip-content"
                    data-testid="maturity-level-tooltip-trigger"
                  >
                    Level {maturityAssessment.assessed_level}
                  </button>
                </TooltipTrigger>
                <TooltipContent id="maturity-tooltip-content" className="max-w-xs">
                  <p className="font-semibold">Maturity scale (1–5)</p>
                  <ol className="mt-1 list-decimal pl-4 text-xs leading-relaxed">
                    <li>Performed informally</li>
                    <li>Planned &amp; tracked</li>
                    <li>Well-defined</li>
                    <li>Quantitatively controlled</li>
                    <li>Continuously improving</li>
                  </ol>
                  <p className="mt-1 text-xs text-slate-500">
                    See{" "}
                    <Link
                      href="/docs#maturity-levels"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      How It Works
                    </Link>{" "}
                    for detail.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-slate-900 text-sm">Assessment</span>
            </div>
            <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2 mb-3">
              <div>
                <span className="font-semibold">Assessed Level:</span>{" "}
                {maturityAssessment.assessed_level}
              </div>
              <div>
                <span className="font-semibold">Confidence:</span>{" "}
                {Math.round(maturityAssessment.confidence * 100)}%
              </div>
              {typeof maturityAssessment.target_level === "number" && (
                <div>
                  <span className="font-semibold">Target Level:</span>{" "}
                  {maturityAssessment.target_level}
                  {typeof maturityAssessment.target_met === "boolean" && (
                    <Badge
                      variant={maturityAssessment.target_met ? "default" : "destructive"}
                      className="ml-2 text-[10px]"
                    >
                      {maturityAssessment.target_met ? "On Target" : "Needs Improvement"}
                    </Badge>
                  )}
                </div>
              )}
              {typeof maturityAssessment.target_gap === "number" && (
                <div>
                  <span className="font-semibold">Gap:</span>{" "}
                  {maturityAssessment.target_gap >= 0 ? "+" : ""}
                  {maturityAssessment.target_gap}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">Rationale</p>
              <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
                {maturityAssessment.rationale}
              </p>
            </div>
            {maturityAssessment.recommended_actions &&
              maturityAssessment.recommended_actions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-900 mb-1">Recommendations</p>
                  <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside">
                    {maturityAssessment.recommended_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          {maturityAssessment.referenced_level_description && (
            <div className="rounded-md border-l-2 border-l-green-500 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-900 text-sm">
                  SCF Framework Reference
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {maturityAssessment.referenced_level_description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
