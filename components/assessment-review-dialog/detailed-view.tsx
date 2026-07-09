"use client";

import { CircleHelp, Gauge } from "lucide-react";
import { InlineHelp } from "@/components/inline-help";
import { ObjectiveAssessmentList } from "@/components/objective-assessment-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AssessmentStatusBadge,
  ConfidenceBadge,
  MaturityBadge,
} from "@/components/ui/status-badge";
import type { AssessmentReviewResult } from "./types";
import { getAssessmentConfidence, getObjectiveResultGuidance, getOverallScore } from "./utils";

interface DetailedViewProps {
  result: AssessmentReviewResult;
}

export function DetailedView({ result }: DetailedViewProps) {
  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
        Review the AI&apos;s reasoning and evidence for each control assessment. Weighted overall
        score: <span className="font-bold text-slate-900">{getOverallScore(result)}%</span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex items-center gap-1">
          <CircleHelp className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-900">Need a quick refresher?</span>
        </div>
        <p className="mt-1">
          Use the{" "}
          <InlineHelp termId="assessment-objectives">assessment objective explainer</InlineHelp> and{" "}
          <InlineHelp termId="result-states">result-state guide</InlineHelp>.
        </p>
      </div>
      <div className="space-y-6">
        {result.assessments.map((assessment) => {
          const confidence = getAssessmentConfidence(assessment);
          const isLowConfidence = confidence < 60;

          return (
            <Card key={assessment.id} className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="ft-serif text-xl text-slate-950">
                      {assessment.scf_control_id}
                    </CardTitle>
                    <CardDescription>{assessment.control_title}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AssessmentStatusBadge status={assessment.overall_result} />
                    <ConfidenceBadge confidence={confidence} />
                    {isLowConfidence && (
                      <Badge variant="destructive" className="text-[10px]">
                        Low confidence
                      </Badge>
                    )}
                    {assessment.maturity_assessment && (
                      <MaturityBadge level={assessment.maturity_assessment.assessed_level} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {assessment.summary && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="ft-eyebrow text-[11px] text-slate-500">Summary</p>
                    <p className="mt-1 text-slate-700 text-sm leading-relaxed">
                      {assessment.summary}
                    </p>
                  </div>
                )}

                {assessment.maturity_assessment && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold text-slate-900">
                        <Gauge className="h-4 w-4 text-slate-600" />
                        Maturity assessment
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <MaturityBadge level={assessment.maturity_assessment.assessed_level} />
                        <ConfidenceBadge
                          confidence={assessment.maturity_assessment.confidence}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    {typeof assessment.maturity_assessment.target_level === "number" && (
                      <p className="text-xs text-slate-600">
                        Target level: {assessment.maturity_assessment.target_level}
                        {typeof assessment.maturity_assessment.target_gap === "number" && (
                          <span className="ml-2">
                            Gap {assessment.maturity_assessment.target_gap >= 0 ? "+" : ""}
                            {assessment.maturity_assessment.target_gap}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-3 text-slate-700 text-sm leading-relaxed">
                      <span className="font-medium text-slate-900">Rationale:</span>{" "}
                      {assessment.maturity_assessment.rationale}
                    </p>
                    {assessment.maturity_assessment.recommended_actions &&
                      assessment.maturity_assessment.recommended_actions.length > 0 && (
                        <div className="mt-3">
                          <p className="font-medium text-slate-900 text-sm">Recommendations</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                            {assessment.maturity_assessment.recommended_actions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {assessment.maturity_assessment.referenced_level_description && (
                      <div className="mt-3 border-l-2 border-l-green-500 pl-3">
                        <p className="ft-eyebrow text-[11px] text-green-700">
                          SCF Framework Reference
                        </p>
                        <p className="mt-1 text-slate-700 text-sm leading-relaxed">
                          {assessment.maturity_assessment.referenced_level_description}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <ObjectiveAssessmentList
                  objectives={(assessment.objective_results || []).map((objective) => ({
                    id: objective.scf_ao_id,
                    objective: objective.assessment_objective,
                    procedure: objective.assessment_procedure,
                    expectedResults: objective.expected_results,
                    result: objective.result,
                    confidence: objective.confidence,
                    reasoning: objective.reasoning,
                    evidenceQuotes: objective.evidence_quotes,
                    gaps: objective.gaps,
                    recommendations: objective.recommendations,
                  }))}
                  getGuidance={getObjectiveResultGuidance}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
