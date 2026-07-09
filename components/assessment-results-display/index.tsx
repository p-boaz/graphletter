"use client";

import { Target } from "lucide-react";
import { useState } from "react";
import { type AssessmentGroup, ControlDetailDialog } from "./control-detail-dialog";
import { ControlRow } from "./control-row";
import type { AssessmentResultsDisplayProps, ControlObjective, ObjectiveDetail } from "./types";
import { buildControlGroups } from "./utils";

export type { UnifiedAssessmentResult } from "./types";

export function AssessmentResultsDisplay({
  assessments,
  loading = false,
  showLinkedEvidence = false,
  showCompletedDate = false,
  maxHeight = "max-h-96",
  enableRowDetailDialog = false,
  hideSummary = false,
}: AssessmentResultsDisplayProps) {
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [objectiveDetails, setObjectiveDetails] = useState<Record<string, ObjectiveDetail>>({});
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);

  const controlGroups = buildControlGroups(assessments);

  const toggleControlExpanded = async (controlId: string) => {
    const newExpanded = new Set(expandedControls);
    if (newExpanded.has(controlId)) {
      newExpanded.delete(controlId);
    } else {
      newExpanded.add(controlId);

      // Batch fetch objective details when expanding a control
      const control = controlGroups[controlId];
      if (control?.objectives) {
        const objectiveIdsToFetch = control.objectives
          .filter((objective) => objective.scf_ao_id && !objectiveDetails[objective.scf_ao_id])
          .map((objective) => objective.scf_ao_id);

        if (objectiveIdsToFetch.length > 0) {
          try {
            const response = await fetch("/api/scf/assessment-objectives", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                objective_ids: objectiveIdsToFetch,
              }),
            });

            if (response.ok) {
              const objectiveMap = await response.json();
              setObjectiveDetails((prev) => ({
                ...prev,
                ...objectiveMap,
              }));
            }
          } catch (error) {
            console.error("Failed to batch fetch objective details:", error);
          }
        }
      }
    }
    setExpandedControls(newExpanded);
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-ft-pink border-t-transparent" />
        <span className="text-gray-600 text-sm">Loading assessment results...</span>
      </div>
    );
  }

  const controlGroupsArray = Object.values(controlGroups);
  const selectedControl = selectedControlId ? controlGroups[selectedControlId] : null;

  const selectedControlAssessmentGroups: AssessmentGroup[] = selectedControl
    ? Array.from(
        selectedControl.objectives.reduce((groups, objective) => {
          if (!groups.has(objective.assessment_id)) {
            groups.set(objective.assessment_id, []);
          }
          groups.get(objective.assessment_id)?.push(objective);
          return groups;
        }, new Map<string, ControlObjective[]>())
      )
        .map(([assessmentId, objectives]) => {
          const completedAt = selectedControl.completedAtByAssessmentId[assessmentId];
          return {
            assessmentId,
            objectives: [...objectives].sort((a, b) =>
              (a.scf_ao_id || "").localeCompare(b.scf_ao_id || "")
            ),
            linkedEvidence: selectedControl.evidenceByAssessmentId[assessmentId] || [],
            completedAt,
          };
        })
        .sort((a, b) => {
          const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return timeB - timeA;
        })
    : [];

  if (controlGroupsArray.length === 0) {
    return (
      <div className="py-8 text-center">
        <Target className="mx-auto mb-3 h-12 w-12 text-gray-400" />
        <p className="text-gray-600">No assessment results found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 overflow-y-auto ${maxHeight}`}>
      {controlGroupsArray.map((control) => (
        <ControlRow
          key={control.control_id}
          control={control}
          isExpanded={hideSummary || expandedControls.has(control.control_id)}
          objectiveDetails={objectiveDetails}
          onToggleExpand={(id) => void toggleControlExpanded(id)}
          onSelectControl={setSelectedControlId}
          enableRowDetailDialog={enableRowDetailDialog}
          showLinkedEvidence={showLinkedEvidence}
          showCompletedDate={showCompletedDate}
          hideSummary={hideSummary}
        />
      ))}

      <ControlDetailDialog
        selectedControl={selectedControl}
        assessmentGroups={selectedControlAssessmentGroups}
        onClose={() => setSelectedControlId(null)}
      />
    </div>
  );
}
