"use client";

import {
	AlertCircle,
	Bot,
	CheckCircle2,
	CircleHelp,
	Database,
	Gauge,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AssessmentReviewResult } from "./types";
import {
	getAssessmentConfidence,
	getAssessmentResultDisplay,
	getObjectiveResultGuidance,
	getOverallScore,
} from "./utils";

interface DetailedViewProps {
	result: AssessmentReviewResult;
}

export function DetailedView({ result }: DetailedViewProps) {
	return (
		<>
			<div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
				<p className="text-blue-800 text-sm">
					Review the AI&apos;s reasoning and evidence for each control
					assessment. Weighted overall score:{" "}
					<span className="font-bold">{getOverallScore(result)}%</span>
				</p>
			</div>
			<div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
				<div className="flex items-center gap-1">
					<CircleHelp className="h-4 w-4" />
					<span className="font-medium">Need a quick refresher?</span>
				</div>
				<p className="mt-1">
					Use the{" "}
					<Link
						href="/how-it-works#assessment-objectives"
						className="underline underline-offset-4"
					>
						assessment objective explainer
					</Link>{" "}
					and{" "}
					<Link
						href="/how-it-works#result-states"
						className="underline underline-offset-4"
					>
						result-state guide
					</Link>
					.
				</p>
			</div>
			<div className="space-y-6">
				{result.assessments.map((assessment) => {
					const confidence = getAssessmentConfidence(assessment);
					const isLowConfidence = confidence < 60;

					return (
						<Card key={assessment.id} className="border-2">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-3">
										{assessment.overall_result === "pass" ? (
											<CheckCircle2 className="h-6 w-6 text-green-600" />
										) : (
											<AlertCircle className="h-6 w-6 text-red-600" />
										)}
										<div>
											<CardTitle className="text-lg">
												{assessment.scf_control_id}
											</CardTitle>
											<CardDescription>
												{assessment.control_title}
											</CardDescription>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant={confidence > 80 ? "default" : "secondary"}>
											{confidence}% Confidence
										</Badge>
										{isLowConfidence && (
											<Badge variant="destructive">Low confidence</Badge>
										)}
										<Badge
											variant={
												assessment.overall_result === "pass"
													? "default"
													: "destructive"
											}
										>
											{getAssessmentResultDisplay(assessment)}
										</Badge>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<div className="bg-blue-50 rounded-md p-3 border border-blue-200">
										<div className="flex items-center gap-2 mb-2">
											<Bot className="h-4 w-4 text-blue-600" />
											<h4 className="font-semibold text-sm text-blue-900">
												AI Assessment Summary
											</h4>
										</div>
										<p className="text-sm text-blue-800">
											{assessment.summary}
										</p>
									</div>
								</div>
								{assessment.maturity_assessment && (
									<div>
										<h4 className="font-semibold text-sm mb-2 text-purple-900">
											Maturity Assessment
										</h4>
										<div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900 space-y-3">
											<div className="bg-white/70 rounded-md p-2 border border-purple-300">
												<div className="flex items-center gap-2 mb-2">
													<Bot className="h-4 w-4 text-blue-600" />
													<span className="font-semibold text-blue-900 text-xs">
														AI Assessment
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="flex items-center gap-2 font-semibold">
														<Gauge className="h-4 w-4" /> Level{" "}
														{assessment.maturity_assessment.assessed_level}
													</span>
													<Badge variant="outline" className="text-xs">
														{Math.round(
															assessment.maturity_assessment.confidence * 100,
														)}
														% confidence
													</Badge>
												</div>
												{typeof assessment.maturity_assessment.target_level ===
													"number" && (
													<div className="text-xs mt-1">
														Target Level:{" "}
														{assessment.maturity_assessment.target_level}
														{typeof assessment.maturity_assessment
															.target_met === "boolean" && (
															<Badge
																variant={
																	assessment.maturity_assessment.target_met
																		? "default"
																		: "destructive"
																}
																className="ml-2 text-[10px]"
															>
																{assessment.maturity_assessment.target_met
																	? "On Target"
																	: "Needs Improvement"}
															</Badge>
														)}
														{typeof assessment.maturity_assessment
															.target_gap === "number" && (
															<span className="ml-2">
																Gap{" "}
																{assessment.maturity_assessment.target_gap >= 0
																	? "+"
																	: ""}
																{assessment.maturity_assessment.target_gap}
															</span>
														)}
													</div>
												)}
												<div className="mt-2">
													<span className="font-semibold text-xs text-blue-900">
														AI Rationale:
													</span>
													<p className="leading-relaxed text-xs text-blue-800 mt-1">
														{assessment.maturity_assessment.rationale}
													</p>
												</div>
												{assessment.maturity_assessment.recommended_actions &&
													assessment.maturity_assessment.recommended_actions
														.length > 0 && (
														<div className="text-xs mt-2">
															<span className="font-semibold text-blue-900">
																AI Recommendations:
															</span>
															<ul className="mt-1 list-disc list-inside space-y-1 text-blue-800">
																{assessment.maturity_assessment.recommended_actions.map(
																	(action, idx) => (
																		<li key={idx}>{action}</li>
																	),
																)}
															</ul>
														</div>
													)}
											</div>

											{assessment.maturity_assessment
												.referenced_level_description && (
												<div className="bg-green-50 rounded-md p-2 border border-green-300">
													<div className="flex items-center gap-2 mb-2">
														<Database className="h-4 w-4 text-green-600" />
														<span className="font-semibold text-green-900 text-xs">
															SCF Framework Reference
														</span>
													</div>
													<p className="text-xs leading-relaxed text-green-800">
														{
															assessment.maturity_assessment
																.referenced_level_description
														}
													</p>
												</div>
											)}
										</div>
									</div>
								)}
								{assessment.objective_results &&
									assessment.objective_results.length > 0 && (
										<div>
											<h4 className="font-semibold text-sm mb-2">
												Detailed Objectives:
											</h4>
											<div className="space-y-2">
												{assessment.objective_results.map((objective, idx) => (
													<div
														key={
															objective.scf_ao_id ||
															`objective-${assessment.id}-${idx}`
														}
														className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2"
													>
														<div className="flex items-center justify-between mb-2">
															<span className="text-xs font-medium text-slate-900 font-mono">
																{objective.scf_ao_id || `Objective ${idx + 1}`}
															</span>
															<Badge
																variant={
																	objective.result === "pass"
																		? "default"
																		: "destructive"
																}
																className="text-xs"
															>
																{objective.result.toUpperCase()}
															</Badge>
														</div>
														<p className="text-xs text-slate-600">
															{getObjectiveResultGuidance(objective.result)}{" "}
															<Link
																href="/how-it-works#result-states"
																className="underline underline-offset-4"
															>
																See what this status means
															</Link>
															.
														</p>
														{objective.assessment_objective && (
															<div className="bg-green-50 rounded-md p-2 border border-green-200">
																<div className="flex items-center gap-2 mb-1">
																	<Database className="h-3 w-3 text-green-600" />
																	<span className="font-semibold text-green-900 text-xs">
																		SCF Objective
																	</span>
																</div>
																<p className="text-xs text-green-800">
																	{objective.assessment_objective}
																</p>
															</div>
														)}
														<div className="bg-blue-50 rounded-md p-2 border border-blue-200">
															<div className="flex items-center gap-2 mb-1">
																<Bot className="h-3 w-3 text-blue-600" />
																<span className="font-semibold text-blue-900 text-xs">
																	AI Assessment
																</span>
															</div>
															<p className="text-xs text-blue-800">
																{objective.reasoning}
															</p>
														</div>
													</div>
												))}
											</div>
										</div>
									)}
							</CardContent>
						</Card>
					);
				})}
			</div>
		</>
	);
}
