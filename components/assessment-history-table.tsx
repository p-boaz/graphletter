"use client";

import {
	AlertTriangle,
	Brain,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Clock,
	FileText,
	Gauge,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	MaturityAssessment,
	MaturityLevels,
} from "@/lib/client/smart-evidence-workflow";

interface AssessmentRecord {
	id: string;
	scf_control_id: string;
	assessment_result: string;
	assessment_status: string;
	assessment_notes: string;
	completed_at: string;
	metadata?: {
		confidence?: number;
		ai_generated?: boolean;
		objective_results?: Array<{
			result: string;
			confidence: number;
			reasoning: string;
		}>;
		maturity_assessment?: MaturityAssessment | null;
		maturity_benchmark_snapshot?: MaturityLevels | null;
	};
	scf_controls?: {
		title: string;
		description: string;
	};
	linked_evidence?: Array<{
		id: string;
		file_name: string;
		evidence_type: string;
	}>;
}

interface AssessmentHistoryTableProps {
	assessments: AssessmentRecord[];
	loading?: boolean;
}

export function AssessmentHistoryTable({
	assessments,
	loading = false,
}: AssessmentHistoryTableProps) {
	const [expandedRows, setExpandedRows] = useState<Set<string>>(
		() => new Set(),
	);

	const toggleRow = (assessmentId: string) => {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(assessmentId)) {
				next.delete(assessmentId);
			} else {
				next.add(assessmentId);
			}
			return next;
		});
	};

	const getResultColor = (result: string) => {
		switch (result?.toLowerCase()) {
			case "pass":
				return "bg-green-100 text-green-800 border-green-200";
			case "fail":
				return "bg-red-100 text-red-800 border-red-200";
			case "partial":
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			case "not_applicable":
				return "bg-gray-100 text-gray-800 border-gray-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const getResultIcon = (result: string) => {
		switch (result?.toLowerCase()) {
			case "pass":
				return <CheckCircle className="h-4 w-4" />;
			case "fail":
				return <XCircle className="h-4 w-4" />;
			case "partial":
				return <AlertTriangle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	if (loading) {
		return (
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Control</TableHead>
							<TableHead>Result</TableHead>
							<TableHead>Confidence</TableHead>
							<TableHead>Evidence</TableHead>
							<TableHead>Completed</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell colSpan={6} className="py-8 text-center">
								Loading assessment history...
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>
		);
	}

	if (assessments.length === 0) {
		return (
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Control</TableHead>
							<TableHead>Result</TableHead>
							<TableHead>Confidence</TableHead>
							<TableHead>Evidence</TableHead>
							<TableHead>Completed</TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell colSpan={6} className="py-8 text-center">
								No assessment results found
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{assessments.map((assessment) => {
				const isExpanded = expandedRows.has(assessment.id);
				const hasObjectives =
					assessment.metadata?.objective_results &&
					assessment.metadata.objective_results.length > 0;
				const maturityAssessment =
					assessment.metadata?.maturity_assessment || null;

				return (
					<Card key={assessment.id} className="overflow-hidden">
						<Collapsible>
							<CollapsibleTrigger asChild>
								<div className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
									<div className="flex items-center justify-between">
										<div className="flex flex-1 items-center space-x-4">
											{/* Control Info */}
											<div className="min-w-0 flex-1">
												<div className="mb-1 flex items-center gap-2">
													<h4 className="font-medium text-sm">
														{assessment.scf_control_id}
													</h4>
													{assessment.metadata?.ai_generated && (
														<Badge variant="outline" className="text-xs">
															<Brain className="mr-1 h-3 w-3" />
															AI
														</Badge>
													)}
												</div>
												{assessment.scf_controls?.title && (
													<p className="truncate text-gray-600 text-xs">
														{assessment.scf_controls.title}
													</p>
												)}
											</div>

											{/* Result */}
											<div className="flex items-center gap-2">
												<Badge
													className={getResultColor(
														assessment.assessment_result,
													)}
												>
													{getResultIcon(assessment.assessment_result)}
													<span className="ml-1 capitalize">
														{assessment.assessment_result?.replace("_", " ")}
													</span>
												</Badge>
												{assessment.metadata?.confidence && (
													<Badge variant="outline">
														{Math.round(assessment.metadata.confidence * 100)}%
													</Badge>
												)}
												{maturityAssessment && (
													<Badge
														variant="outline"
														className="flex items-center gap-1 text-xs"
													>
														<Gauge className="h-3 w-3" />L
														{maturityAssessment.assessed_level}
													</Badge>
												)}
											</div>

											{/* Evidence Count */}
											<div className="flex items-center text-gray-500 text-xs">
												<FileText className="mr-1 h-3 w-3" />
												{assessment.linked_evidence?.length || 0} files
											</div>

											{/* Date */}
											<div className="min-w-0 text-gray-500 text-xs">
												{assessment.completed_at
													? new Date(
															assessment.completed_at,
														).toLocaleDateString()
													: "Pending"}
											</div>
										</div>

										{/* Expand/Collapse */}
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={() => toggleRow(assessment.id)}
										>
											{isExpanded ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							</CollapsibleTrigger>

							<CollapsibleContent>
								<div className="border-t bg-gray-50/50 px-4 pb-4">
									<div className="space-y-4 pt-4">
										{/* Assessment Notes */}
										{assessment.assessment_notes && (
											<div>
												<h5 className="mb-1 font-medium text-gray-900 text-xs">
													Assessment Summary
												</h5>
												<p className="text-gray-700 text-sm">
													{assessment.assessment_notes}
												</p>
											</div>
										)}

										{/* Objective Results */}
										{hasObjectives && (
											<div>
												<h5 className="mb-2 font-medium text-gray-900 text-xs">
													Individual Objectives (
													{assessment.metadata?.objective_results?.length || 0})
												</h5>
												<div className="space-y-2">
													{assessment.metadata?.objective_results?.map(
														(objective, idx) => (
															<div
																key={idx}
																className="rounded border-l-2 bg-white p-2 text-xs"
																style={{
																	borderLeftColor:
																		objective.result === "pass"
																			? "#16a34a"
																			: objective.result === "partial"
																				? "#ca8a04"
																				: objective.result === "fail"
																					? "#dc2626"
																					: "#6b7280",
																}}
															>
																<div className="mb-1 flex items-center justify-between">
																	<Badge
																		className={
																			getResultColor(objective.result) +
																			" px-1.5 py-0.5 text-[10px] text-xs"
																		}
																	>
																		{getResultIcon(objective.result)}
																		<span className="ml-1 capitalize">
																			{objective.result.replace("_", " ")}
																		</span>
																	</Badge>
																	<span className="font-medium text-[10px] text-gray-600">
																		{Math.round(objective.confidence * 100)}%
																	</span>
																</div>
																<p className="text-gray-700 leading-tight">
																	{objective.reasoning}
																</p>
															</div>
														),
													)}
												</div>
											</div>
										)}

										{maturityAssessment && (
											<div>
												<h5 className="mb-2 font-medium text-purple-900 text-xs">
													Maturity Assessment
												</h5>
												<div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900 space-y-2">
													<div className="flex items-center justify-between">
														<span className="flex items-center gap-2 font-semibold">
															<Gauge className="h-4 w-4" /> Level{" "}
															{maturityAssessment.assessed_level}
														</span>
														<Badge variant="outline" className="text-[10px]">
															{Math.round(
																(maturityAssessment.confidence || 0) * 100,
															)}
															% confidence
														</Badge>
													</div>
													{typeof maturityAssessment.target_level ===
														"number" && (
														<div>
															Target Level: {maturityAssessment.target_level}
															{typeof maturityAssessment.target_met ===
																"boolean" && (
																<Badge
																	variant={
																		maturityAssessment.target_met
																			? "default"
																			: "destructive"
																	}
																	className="ml-2 text-[10px]"
																>
																	{maturityAssessment.target_met
																		? "On Target"
																		: "Needs Improvement"}
																</Badge>
															)}
															{typeof maturityAssessment.target_gap ===
																"number" && (
																<span className="ml-2">
																	Gap{" "}
																	{maturityAssessment.target_gap >= 0
																		? "+"
																		: ""}
																	{maturityAssessment.target_gap}
																</span>
															)}
														</div>
													)}
													<p className="leading-relaxed">
														{maturityAssessment.rationale}
													</p>
													{maturityAssessment.recommended_actions &&
														maturityAssessment.recommended_actions.length >
															0 && (
															<div>
																<span className="font-semibold">
																	Recommendations:
																</span>
																<ul className="mt-1 list-disc list-inside space-y-1">
																	{maturityAssessment.recommended_actions.map(
																		(action, idx) => (
																			<li key={idx}>{action}</li>
																		),
																	)}
																</ul>
															</div>
														)}
												</div>
											</div>
										)}

										{/* Linked Evidence */}
										{assessment.linked_evidence &&
											assessment.linked_evidence.length > 0 && (
												<div>
													<h5 className="mb-1 font-medium text-gray-900 text-xs">
														Linked Evidence
													</h5>
													<div className="space-y-1">
														{assessment.linked_evidence.map((evidence) => (
															<div
																key={evidence.id}
																className="flex items-center text-gray-600 text-xs"
															>
																<FileText className="mr-2 h-3 w-3" />
																<span className="flex-1">
																	{evidence.file_name}
																</span>
																<Badge variant="outline" className="text-xs">
																	{evidence.evidence_type}
																</Badge>
															</div>
														))}
													</div>
												</div>
											)}
									</div>
								</div>
							</CollapsibleContent>
						</Collapsible>
					</Card>
				);
			})}
		</div>
	);
}
