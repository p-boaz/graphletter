import type { ReactNode } from "react";
import type {
  AssessmentWorkflowResponse,
  SmartUploadResult,
  UploadOnlyResult,
} from "@/lib/client/smart-evidence-workflow";

export type { AssessmentWorkflowResponse, SmartUploadResult, UploadOnlyResult };

export interface DocumentationArtifact {
  erl_id?: string;
  artifact: string;
  controls: Array<{
    scf_control_id: string;
    title: string;
    description: string;
  }>;
}

export interface ExistingEvidence {
  id: string;
  file_name: string;
  version: number;
  submitted_at: string;
  evidence_status: string;
}

export interface EvidenceHistoryItem {
  id: string;
  file_name: string;
  version?: number | null;
  submitted_at: string;
  evidence_status: string;
  metadata?: { documentation_artifact?: string };
}

export interface SmartEvidenceUploadProps {
  onEvidenceProcessed?: (result: SmartUploadResult) => void;
  defaultDocumentationArtifact?: string;
  defaultDescription?: string;
  defaultControlIds?: string[];
  defaultFrameworkId?: string;
  defaultEvidenceType?: string;
  /** Controlled open state. When provided, the component becomes controlled. */
  open?: boolean;
  /** Called when the dialog requests to open or close. Required with `open`. */
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger button. Useful when the parent opens the dialog programmatically. */
  hideTrigger?: boolean;
  /** Override the default dialog title ("Upload evidence"). */
  dialogTitle?: ReactNode;
}

export type LiveAssessmentResult = "pass" | "fail" | "partial" | "not_applicable" | "error";

export interface LiveControlResult {
  controlId: string;
  result: LiveAssessmentResult;
  confidence: number | null;
  status: string | null;
  completedAt: string;
}

export interface LiveAssessmentProgress {
  totalControls: number;
  completedControls: number;
  currentControlId: string | null;
  currentControlNumber: number;
  averageControlDurationMs: number | null;
  estimatedRemainingMs: number | null;
  results: LiveControlResult[];
}
