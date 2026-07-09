"use client";

import { Download, Eye, ThumbsDown, ThumbsUp } from "lucide-react";
import { FrameworkImpactCascade } from "@/components/framework-impact-cascade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AssessmentStatusBadge,
  ConfidenceBadge,
  MaturityBadge,
} from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AssessmentReviewResult } from "./types";
import type { DistributionSegment } from "./utils";
import { getAssessmentConfidence, getOverallScore, getTopGapAndRecommendation } from "./utils";

interface SummaryViewProps {
  result: AssessmentReviewResult;
  distributionSegments: DistributionSegment[];
  controlIds?: string[];
  rejectionReason: string;
  isProcessing: boolean;
  onRejectionReasonChange: (reason: string) => void;
  onShowDetailed: () => void;
  onExportJson: () => void;
  onApprove: () => void;
  onReject: () => void;
  description: string;
}

export function SummaryView({
  result,
  distributionSegments,
  controlIds,
  rejectionReason,
  isProcessing,
  onRejectionReasonChange,
  onShowDetailed,
  onExportJson,
  onApprove,
  onReject,
  description,
}: SummaryViewProps) {
  const controlCountLabel = `${result.assessments.length} ${
    result.assessments.length === 1 ? "control" : "controls"
  }`;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">{result.source.name}</CardTitle>
          <CardDescription>
            Assessment completed • {getOverallScore(result)}% weighted overall score • Awaiting
            review
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Assessment Results ({controlCountLabel})
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <p className="font-medium text-gray-700 text-xs">Result Distribution</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="flex h-full w-full">
                {distributionSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className={segment.barClass}
                    style={{
                      width: `${(segment.count / result.assessments.length) * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {distributionSegments.map((segment) => (
                <span key={`${segment.key}-label`} className={`font-medium ${segment.textClass}`}>
                  {segment.label}: {segment.count}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.assessments.map((assessment) => {
              const confidence = getAssessmentConfidence(assessment);
              const isLowConfidence = confidence < 60;
              const { topGap, topRecommendation } = getTopGapAndRecommendation(assessment);
              const isFailedOrPartial =
                assessment.overall_result === "fail" || assessment.overall_result === "partial";

              return (
                <div
                  key={assessment.id}
                  className={`flex items-start justify-between rounded-lg p-3 ${
                    assessment.overall_result === "pass"
                      ? "bg-green-50 border border-green-200"
                      : assessment.overall_result === "fail"
                        ? "bg-red-50 border border-red-200"
                        : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div>
                      <span className="font-medium text-sm">{assessment.scf_control_id}</span>
                      <div className="text-xs text-gray-600">{assessment.control_title}</div>
                      {isFailedOrPartial && (topGap || topRecommendation) && (
                        <div className="mt-1.5 space-y-1">
                          {topGap && (
                            <p className="text-red-700 text-xs">
                              <span className="font-medium">Top gap:</span> {topGap}
                            </p>
                          )}
                          {topRecommendation && (
                            <p className="text-green-700 text-xs">
                              <span className="font-medium">Top recommendation:</span>{" "}
                              {topRecommendation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <AssessmentStatusBadge status={assessment.overall_result} className="text-xs" />
                    <ConfidenceBadge confidence={confidence} className="text-xs" />
                    {isLowConfidence && (
                      <Badge variant="destructive" className="text-[10px]">
                        Low confidence
                      </Badge>
                    )}
                    {assessment.maturity_assessment && (
                      <MaturityBadge
                        level={assessment.maturity_assessment.assessed_level}
                        className="text-xs"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {controlIds && controlIds.length > 0 && (
        <FrameworkImpactCascade
          controlIds={controlIds}
          assessmentResults={result.assessments.map((a) => ({
            scf_control_id: a.scf_control_id,
            overall_result: a.overall_result,
          }))}
        />
      )}

      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            onClick={onShowDetailed}
            variant="outline"
            className="flex items-center justify-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>View Detailed Results</span>
          </Button>
          <Button
            onClick={onExportJson}
            variant="outline"
            className="flex items-center justify-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export JSON</span>
          </Button>
        </div>
        <div className="flex space-x-3">
          <div className="flex-1">
            <Textarea
              placeholder="Optional: Reason for rejection"
              value={rejectionReason}
              onChange={(e) => onRejectionReasonChange(e.target.value)}
              className="min-h-[60px] text-sm mb-2"
              rows={2}
            />
            <Button
              onClick={onReject}
              disabled={isProcessing || !rejectionReason.trim()}
              variant="outline"
              data-testid="reject-assessment-button"
              className="flex items-center justify-center space-x-2 w-full border-red-300 text-red-700 hover:bg-red-50"
            >
              <ThumbsDown className="h-4 w-4" />
              <span>Reject Assessment</span>
            </Button>
          </div>
          <div className="flex-1 flex items-end">
            <Button
              onClick={onApprove}
              disabled={isProcessing}
              data-testid="approve-assessment-button"
              className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 w-full h-[60px]"
            >
              <ThumbsUp className="h-4 w-4" />
              <span>Approve Assessment</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
