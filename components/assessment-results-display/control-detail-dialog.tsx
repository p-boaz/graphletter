"use client";

import { ObjectiveAssessmentList } from "@/components/objective-assessment-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ControlGroup, ControlObjective } from "./types";

export interface AssessmentGroup {
  assessmentId: string;
  objectives: ControlObjective[];
  linkedEvidence: NonNullable<ControlGroup["linked_evidence"]>;
  completedAt?: string;
}

interface ControlDetailDialogProps {
  selectedControl: ControlGroup | null;
  assessmentGroups: AssessmentGroup[];
  onClose: () => void;
}

export function ControlDetailDialog({
  selectedControl,
  assessmentGroups,
  onClose,
}: ControlDetailDialogProps) {
  return (
    <Dialog
      open={selectedControl !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-[85vh] max-w-4xl overflow-y-auto"
        data-testid="assessment-detail-dialog"
      >
        <DialogHeader className="border-b border-slate-200 pb-4">
          <p className="ft-eyebrow text-slate-500">Assessment Record</p>
          <DialogTitle>
            Assessment details
            {selectedControl ? ` · ${selectedControl.control_id}` : ""}
          </DialogTitle>
          <DialogDescription>
            Objective-level status, confidence, and AI reasoning for this control.
          </DialogDescription>
        </DialogHeader>

        {selectedControl && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900 text-sm">
                {selectedControl.control_title || selectedControl.control_id}
              </p>
              {selectedControl.control_description && (
                <p className="mt-1 text-slate-700 text-sm">{selectedControl.control_description}</p>
              )}
            </div>

            {selectedControl.objectives.length === 0 ? (
              <ObjectiveAssessmentList objectives={[]} />
            ) : (
              <div className="space-y-3">
                {assessmentGroups.map((group, groupIndex) => (
                  <div
                    key={group.assessmentId}
                    className="rounded-lg border border-slate-300 bg-slate-50 p-4"
                    data-testid="assessment-detail-run-group"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 text-sm">
                          Assessment run {groupIndex + 1}
                        </p>
                        {group.linkedEvidence.length > 0 && (
                          <p className="text-slate-600 text-xs">
                            Evidence:{" "}
                            {group.linkedEvidence.map((evidence) => evidence.file_name).join(", ")}
                          </p>
                        )}
                        {group.completedAt && (
                          <p className="text-slate-500 text-xs">
                            Completed: {new Date(group.completedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <ObjectiveAssessmentList
                      objectives={group.objectives.map((objective) => ({
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
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
