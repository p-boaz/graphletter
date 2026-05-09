"use client";

import {
  AlertCircle,
  Bot,
  Brain,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const overallConfidence = getControlOverallConfidence(control.objectives);
  const maturityAssessment = control.maturity_assessment;
  const { topGap, topRecommendation } = getTopGapAndRecommendation(control.objectives);
  const isLowConfidence = overallConfidence < 0.6;
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
      className="border border-gray-200 rounded-lg bg-white shadow-sm"
      data-testid="assessment-result-card"
      onClick={(event) => {
        if (!enableRowDetailDialog) {
          return;
        }
        const target = event.target as HTMLElement;
        if (
          target.closest("[data-row-action='expand']") ||
          target.closest("[data-row-action='details']")
        ) {
          return;
        }
        onSelectControl(control.control_id);
      }}
    >
      {!hideSummary && (
        <div
          className={`flex items-center justify-between p-4 ${
            overallResult === "pass"
              ? "border-l-4 border-l-green-500"
              : overallResult === "fail"
                ? "border-l-4 border-l-red-500"
                : overallResult === "partial"
                  ? "border-l-4 border-l-yellow-500"
                  : "border-l-4 border-l-gray-400"
          }`}
        >
          <div className="flex items-center space-x-3">
            {overallResult === "pass" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : overallResult === "fail" ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : overallResult === "partial" ? (
              <Clock className="h-5 w-5 text-yellow-600" />
            ) : (
              <Target className="h-5 w-5 text-gray-600" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-semibold text-base text-gray-900">{control.control_id}</span>
                {control.domain_name && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {control.domain_name}
                  </Badge>
                )}
                {control.ai_generated && (
                  <Badge variant="secondary" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    AI Generated
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
                      <p className="text-emerald-700 text-xs">
                        <span className="font-medium">Top recommendation:</span> {topRecommendation}
                      </p>
                    )}
                  </div>
                )}
              {(formattedDate || showLinkedEvidence || maturityAssessment) && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {formattedDate && showCompletedDate && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formattedDate}
                    </span>
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
                    <span className="flex items-center text-purple-700">
                      <Gauge className="h-3 w-3 mr-1" />
                      Level {maturityAssessment.assessed_level}
                      {typeof maturityAssessment.target_level === "number" && (
                        <span className="ml-1 text-purple-600">
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
              <Badge
                variant={
                  overallConfidence > 0.8
                    ? "default"
                    : overallConfidence > 0.6
                      ? "secondary"
                      : "destructive"
                }
                className="text-xs mb-1"
              >
                {Math.round(overallConfidence * 100)}% confidence
              </Badge>
              {isLowConfidence && (
                <Badge variant="destructive" className="text-[10px] mb-1">
                  Low confidence
                </Badge>
              )}
              <div
                className={`font-semibold text-sm ${
                  overallResult === "pass"
                    ? "text-green-600"
                    : overallResult === "fail"
                      ? "text-red-600"
                      : overallResult === "partial"
                        ? "text-yellow-600"
                        : "text-gray-600"
                }`}
              >
                {overallResult.toUpperCase()}
              </div>
            </div>
            {enableRowDetailDialog && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-row-action="details"
                data-testid="assessment-row-detail-button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectControl(control.control_id);
                }}
              >
                View details
              </Button>
            )}
            {hasObjectives && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                data-row-action="expand"
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
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <h5 className="font-semibold text-sm text-gray-900">
              Assessment Objectives ({control.objectives.length})
            </h5>
          </div>
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
            <div className="flex items-center gap-1">
              <CircleHelp className="h-3.5 w-3.5" />
              <span className="font-medium">What this section means</span>
            </div>
            <p className="mt-1">
              Each objective is a testable checkpoint for the control.{" "}
              <Link
                href="/how-it-works#assessment-objectives"
                className="underline underline-offset-4"
              >
                Learn objective basics
              </Link>{" "}
              and{" "}
              <Link href="/how-it-works#result-states" className="underline underline-offset-4">
                result states
              </Link>
              .
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
                <div key={idx} className="bg-white border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900 font-mono">
                      {enrichedObjective.scf_ao_id || `OBJ-${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {enrichedObjective.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(enrichedObjective.confidence * 100)}%
                        </Badge>
                      )}
                      <Badge
                        variant={enrichedObjective.result === "pass" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {enrichedObjective.result.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-slate-600">
                    {getObjectiveResultGuidance(enrichedObjective.result)}{" "}
                    <Link
                      href="/how-it-works#result-states"
                      className="underline underline-offset-4"
                    >
                      See scoring guide
                    </Link>
                    .
                  </p>
                  {enrichedObjective.assessment_objective && (
                    <div className="mb-2">
                      <div className="bg-green-50 rounded-md p-2 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="h-3 w-3 text-green-600" />
                          <p className="text-sm font-medium text-green-900">
                            SCF Assessment Objective
                          </p>
                        </div>
                        <p className="text-sm text-green-800">
                          {enrichedObjective.assessment_objective}
                        </p>
                      </div>
                    </div>
                  )}
                  {enrichedObjective.assessment_procedure && (
                    <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                      <p className="text-xs font-medium text-amber-900">Assessment Procedure</p>
                      <p className="text-xs text-amber-800">
                        {enrichedObjective.assessment_procedure}
                      </p>
                    </div>
                  )}
                  {enrichedObjective.expected_results && (
                    <div className="mb-2 rounded-md border border-teal-200 bg-teal-50 p-2">
                      <p className="text-xs font-medium text-teal-900">Expected Results</p>
                      <p className="text-xs text-teal-800">{enrichedObjective.expected_results}</p>
                    </div>
                  )}
                  <div>
                    <div className="bg-blue-50 rounded-md p-2 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-3 w-3 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">AI Assessment</p>
                      </div>
                      <p className="text-sm text-blue-800">{enrichedObjective.reasoning}</p>
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
        <div className="border-t bg-purple-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-purple-600" />
              <h5 className="font-semibold text-sm text-purple-900">Maturity Assessment</h5>
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
                    <Link href="/how-it-works#maturity-levels" className="underline">
                      How It Works
                    </Link>{" "}
                    for detail.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="bg-blue-50 rounded-md p-3 border border-blue-200 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-blue-900 text-sm">AI Assessment</span>
            </div>
            <div className="grid gap-2 text-xs text-blue-800 sm:grid-cols-2 mb-3">
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
              <p className="text-sm font-medium text-blue-900 mb-1">AI Rationale</p>
              <p className="text-sm text-blue-800 bg-white/70 p-2 rounded">
                {maturityAssessment.rationale}
              </p>
            </div>
            {maturityAssessment.recommended_actions &&
              maturityAssessment.recommended_actions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-blue-900 mb-1">AI Recommendations</p>
                  <ul className="space-y-1 text-sm text-blue-800 list-disc list-inside">
                    {maturityAssessment.recommended_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          {maturityAssessment.referenced_level_description && (
            <div className="bg-green-50 rounded-md p-3 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-900 text-sm">
                  SCF Framework Reference
                </span>
              </div>
              <p className="text-sm text-green-800">
                {maturityAssessment.referenced_level_description}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
