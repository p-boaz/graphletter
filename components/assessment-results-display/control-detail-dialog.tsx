"use client";

import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { ControlGroup, ControlObjective } from "./types";
import { getObjectiveResultGuidance } from "./utils";

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
				<DialogHeader>
					<DialogTitle>
						Assessment details
						{selectedControl ? ` · ${selectedControl.control_id}` : ""}
					</DialogTitle>
					<DialogDescription>
						Objective-level status, confidence, and AI reasoning for this
						control.
					</DialogDescription>
				</DialogHeader>

				{selectedControl && (
					<div className="space-y-4">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
							<p className="font-semibold text-slate-900 text-sm">
								{selectedControl.control_title || selectedControl.control_id}
							</p>
							{selectedControl.control_description && (
								<p className="mt-1 text-slate-700 text-sm">
									{selectedControl.control_description}
								</p>
							)}
						</div>

						{selectedControl.objectives.length === 0 ? (
							<div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600 text-sm">
								No objective-level details are available for this control yet.
							</div>
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
														{group.linkedEvidence
															.map((evidence) => evidence.file_name)
															.join(", ")}
													</p>
												)}
												{group.completedAt && (
													<p className="text-slate-500 text-xs">
														Completed:{" "}
														{new Date(group.completedAt).toLocaleString()}
													</p>
												)}
											</div>
											<Badge
												variant="outline"
												className="font-mono text-[10px]"
											>
												{group.assessmentId}
											</Badge>
										</div>
										<div className="space-y-2">
											{group.objectives.map((objective, idx) => (
												<div
													key={`${group.assessmentId}-${objective.scf_ao_id || idx}`}
													className="rounded-lg border border-slate-200 bg-white p-4"
												>
													<div className="mb-2 flex items-center justify-between">
														<span className="font-mono text-slate-700 text-xs">
															{objective.scf_ao_id || `Objective ${idx + 1}`}
														</span>
														<div className="flex items-center gap-2">
															<Badge variant="outline" className="text-xs">
																{Math.round(objective.confidence * 100)}%
															</Badge>
															<Badge
																variant={
																	objective.result === "pass"
																		? "default"
																		: objective.result === "partial"
																			? "secondary"
																			: "destructive"
																}
																className="text-xs"
															>
																{objective.result.toUpperCase()}
															</Badge>
														</div>
													</div>
													<p className="text-slate-600 text-xs">
														{getObjectiveResultGuidance(objective.result)}
													</p>
													{objective.assessment_objective && (
														<p className="mt-2 text-slate-800 text-sm">
															<span className="font-medium">Objective:</span>{" "}
															{objective.assessment_objective}
														</p>
													)}
													<p className="mt-2 text-slate-700 text-sm">
														<span className="font-medium">AI reasoning:</span>{" "}
														{objective.reasoning}
													</p>
												</div>
											))}
										</div>
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
