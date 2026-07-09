"use client";

import { AlertCircle, CheckCircle2, Clock, Circle, Gauge } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AssessmentStatus = "pass" | "partial" | "fail" | "not_applicable" | "pending";
export type EvidenceReviewStatus = "approved" | "under_review" | "pending" | "rejected";

type StatusConfig = {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
};

export const assessmentStatusStyles: Record<AssessmentStatus, StatusConfig> = {
  pass: {
    label: "PASS",
    className: "border-green-200 bg-green-50 text-green-800",
    icon: CheckCircle2,
  },
  partial: {
    label: "PARTIAL",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  fail: {
    label: "FAIL",
    className: "border-red-200 bg-red-50 text-red-800",
    icon: AlertCircle,
  },
  not_applicable: {
    label: "N/A",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Circle,
  },
  pending: {
    label: "PENDING",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Clock,
  },
};

export const evidenceStatusStyles: Record<EvidenceReviewStatus, StatusConfig> = {
  approved: {
    label: "Approved",
    className: "border-green-200 bg-green-50 text-green-800",
    icon: CheckCircle2,
  },
  under_review: {
    label: "Under review",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  pending: {
    label: "Pending",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Clock,
  },
  rejected: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-800",
    icon: AlertCircle,
  },
};

export const neutralBadgeStyles = {
  confidence: "border-slate-200 bg-white text-slate-700",
  maturity: "border-slate-200 bg-white text-slate-700",
};

export function normalizeAssessmentStatus(status?: string | null): AssessmentStatus {
  if (status === "pass" || status === "partial" || status === "fail") return status;
  if (status === "not_applicable") return "not_applicable";
  return "pending";
}

export function AssessmentStatusBadge({
  status,
  className,
  ...props
}: {
  status?: string | null;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const config = assessmentStatusStyles[normalizeAssessmentStatus(status)];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.className, className)} {...props}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export function EvidenceStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const normalized = (status || "pending").toLowerCase();
  const knownStatus = normalized as EvidenceReviewStatus;
  const config =
    evidenceStatusStyles[knownStatus] ||
    (normalized === "assessed"
      ? evidenceStatusStyles.under_review
      : normalized === "submitted"
        ? evidenceStatusStyles.pending
        : evidenceStatusStyles.pending);
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.className, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const value = confidence > 1 ? Math.round(confidence) : Math.round(confidence * 100);
  return (
    <Badge
      variant="outline"
      title="Confidence"
      className={cn(neutralBadgeStyles.confidence, className)}
    >
      {value}% confidence
    </Badge>
  );
}

export function MaturityBadge({ level, className }: { level: number; className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Maturity level"
      className={cn("gap-1", neutralBadgeStyles.maturity, className)}
    >
      <Gauge className="h-3 w-3" aria-hidden="true" />L{level}
    </Badge>
  );
}
