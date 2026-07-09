"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  Eye,
  Play,
  Target,
} from "lucide-react";

// Re-exported from shared types for backwards compatibility
export type { UserAssessment } from "@/lib/types/assessment";

export interface AssessmentStats {
  total_assessments: number;
  by_status: Record<string, number>;
  by_result: Record<string, number>;
  by_implementation: Record<string, number>;
  by_risk: Record<string, number>;
  pending_assessments: number;
  overdue_assessments: number;
  due_soon: number;
  compliance_rate: number;
  implementation_rate: number;
}

export interface AssessmentExecutionProps {
  controlId?: string;
}

export function getStatusColor(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "completed":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "under_review":
      return "bg-ft-cream text-ft-black border-slate-200";
    case "requires_remediation":
      return "bg-red-100 text-red-800 border-red-200";
    case "not_started":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getResultColor(result: string) {
  switch (result) {
    case "met":
      return "bg-green-100 text-green-800 border-green-200";
    case "partially_met":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "not_met":
      return "bg-red-100 text-red-800 border-red-200";
    case "not_applicable":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "not_tested":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4" />;
    case "completed":
      return <CheckSquare className="h-4 w-4" />;
    case "in_progress":
      return <Clock className="h-4 w-4" />;
    case "under_review":
      return <Eye className="h-4 w-4" />;
    case "requires_remediation":
      return <AlertTriangle className="h-4 w-4" />;
    case "not_started":
      return <Play className="h-4 w-4" />;
    default:
      return <ClipboardList className="h-4 w-4" />;
  }
}

export function getRiskIcon(risk: string) {
  switch (risk) {
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case "high":
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case "medium":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "low":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    default:
      return <Target className="h-4 w-4 text-gray-600" />;
  }
}
