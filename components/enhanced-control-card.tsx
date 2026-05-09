"use client";

import {
	AlertTriangle,
	ChevronDown,
	ChevronUp,
	Shield,
	Target,
	Upload,
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
import { cn } from "@/lib/utils";

interface Risk {
	id: string;
	title: string;
	description: string;
	risk_grouping: string;
	nist_csf_function: string;
}

interface Threat {
	id: string;
	title: string;
	description: string;
	threat_grouping: string;
}

interface MaturityLevels {
	scf_control_id: string;
	level_0_description: string | null;
	level_1_description: string | null;
	level_2_description: string | null;
	level_3_description: string | null;
	level_4_description: string | null;
	level_5_description: string | null;
}

interface EnhancedControlCardProps {
	controlId: string;
	controlTitle: string;
	domainId: string;
	hasEvidence: boolean;
	hasAssessment: boolean;
	assessmentResult?: string | null;
	lastUpdated?: string | null;
	gapType:
		| "no_evidence"
		| "no_assessment"
		| "failed_assessment"
		| "partial_compliance"
		| "conflicting_evidence"
		| "compliant";
	risks: Risk[];
	threats: Threat[];
	maturityLevels?: MaturityLevels | null;
	onUploadEvidence?: () => void;
}

export function EnhancedControlCard({
	controlId,
	controlTitle,
	domainId,
	hasEvidence,
	hasAssessment,
	assessmentResult,
	lastUpdated,
	gapType,
	risks,
	threats,
	maturityLevels,
	onUploadEvidence,
}: EnhancedControlCardProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const getGapTypeInfo = (type: typeof gapType) => {
		switch (type) {
			case "no_evidence":
				return {
					label: "No Evidence",
					color: "bg-red-100 text-red-800",
					priority: "High",
				};
			case "no_assessment":
				return {
					label: "Assessment Needed",
					color: "bg-blue-100 text-blue-800",
					priority: "Medium",
				};
			case "failed_assessment":
				return {
					label: "Failed",
					color: "bg-red-100 text-red-800",
					priority: "High",
				};
			case "partial_compliance":
				return {
					label: "Partial",
					color: "bg-yellow-100 text-yellow-800",
					priority: "Medium",
				};
			case "conflicting_evidence":
				return {
					label: "Conflicting",
					color: "bg-orange-100 text-orange-800",
					priority: "High",
				};
			case "compliant":
				return {
					label: "Compliant",
					color: "bg-green-100 text-green-800",
					priority: "Low",
				};
			default:
				return {
					label: "Unknown",
					color: "bg-gray-100 text-gray-800",
					priority: "Unknown",
				};
		}
	};

	const gapInfo = getGapTypeInfo(gapType);
	const formattedLastUpdated = lastUpdated
		? new Date(lastUpdated).toLocaleDateString()
		: null;

	// Get risk category counts
	const riskGroups = risks.reduce((acc: Record<string, number>, risk) => {
		acc[risk.risk_grouping] = (acc[risk.risk_grouping] || 0) + 1;
		return acc;
	}, {});

	// Get threat category counts
	const threatGroups = threats.reduce((acc: Record<string, number>, threat) => {
		acc[threat.threat_grouping] = (acc[threat.threat_grouping] || 0) + 1;
		return acc;
	}, {});

	return (
		<Card className="border-indigo-100 bg-white shadow-sm transition-shadow hover:shadow-md">
			<div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex-1 space-y-3">
					{/* Header with badges */}
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge className={cn("text-xs", gapInfo.color)}>
								{gapInfo.label}
							</Badge>
							<Badge variant="outline" className="font-mono text-xs">
								{controlId}
							</Badge>
							<Badge variant="outline" className="text-xs">
								{domainId}
							</Badge>
							<Badge variant="outline" className="text-xs">
								Priority: {gapInfo.priority}
							</Badge>
						</div>
						<div>
							<h4 className="text-sm font-semibold text-slate-900">
								{controlTitle}
							</h4>
							<p className="text-xs text-slate-500">
								{hasEvidence ? "Evidence present" : "Evidence missing"}
								{!hasAssessment
									? " · Assessment needed"
									: assessmentResult
										? ` · Result: ${assessmentResult}`
										: ""}
								{formattedLastUpdated
									? ` · Updated ${formattedLastUpdated}`
									: ""}
							</p>
						</div>
					</div>

					{/* Risk and Threat Summary */}
					<div className="flex flex-wrap gap-2">
						{risks.length > 0 && (
							<div className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs">
								<AlertTriangle className="h-3 w-3 text-red-600" />
								<span className="text-red-700">
									{risks.length} risk{risks.length === 1 ? "" : "s"}
								</span>
								{Object.keys(riskGroups).length > 1 && (
									<span className="text-red-600">
										({Object.keys(riskGroups).length} categories)
									</span>
								)}
							</div>
						)}
						{threats.length > 0 && (
							<div className="flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs">
								<Shield className="h-3 w-3 text-orange-600" />
								<span className="text-orange-700">
									{threats.length} threat{threats.length === 1 ? "" : "s"}
								</span>
								{Object.keys(threatGroups).length > 1 && (
									<span className="text-orange-600">
										({Object.keys(threatGroups).length} categories)
									</span>
								)}
							</div>
						)}
						{maturityLevels && (
							<div className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs">
								<Target className="h-3 w-3 text-indigo-600" />
								<span className="text-indigo-700">
									C|P-CMM levels available
								</span>
							</div>
						)}
					</div>

					{/* Expandable details */}
					{(risks.length > 0 || threats.length > 0 || maturityLevels) && (
						<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 text-xs text-indigo-600 hover:text-indigo-700"
								>
									{isExpanded ? (
										<>
											<ChevronUp className="mr-1 h-3 w-3" />
											Hide details
										</>
									) : (
										<>
											<ChevronDown className="mr-1 h-3 w-3" />
											Show risks, threats & maturity levels
										</>
									)}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-3 space-y-3">
								{/* Risks Section */}
								{risks.length > 0 && (
									<div className="space-y-2">
										<h5 className="text-xs font-medium text-red-800">
											Risks Mitigated ({risks.length})
										</h5>
										<div className="space-y-1">
											{risks.slice(0, 3).map((risk) => (
												<div
													key={risk.id}
													className="rounded border border-red-100 bg-red-50 p-2"
												>
													<div className="flex items-center gap-2">
														<Badge
															variant="outline"
															className="font-mono text-xs"
														>
															{risk.id}
														</Badge>
														<Badge variant="outline" className="text-xs">
															{risk.risk_grouping}
														</Badge>
														{risk.nist_csf_function && (
															<Badge variant="outline" className="text-xs">
																{risk.nist_csf_function}
															</Badge>
														)}
													</div>
													<p className="mt-1 text-xs font-medium text-red-900">
														{risk.title}
													</p>
													<p className="text-xs text-red-700 line-clamp-2">
														{risk.description}
													</p>
												</div>
											))}
											{risks.length > 3 && (
												<p className="text-xs text-red-600">
													+{risks.length - 3} more risk
													{risks.length - 3 === 1 ? "" : "s"}
												</p>
											)}
										</div>
									</div>
								)}

								{/* Threats Section */}
								{threats.length > 0 && (
									<div className="space-y-2">
										<h5 className="text-xs font-medium text-orange-800">
											Threats Addressed ({threats.length})
										</h5>
										<div className="space-y-1">
											{threats.slice(0, 3).map((threat) => (
												<div
													key={threat.id}
													className="rounded border border-orange-100 bg-orange-50 p-2"
												>
													<div className="flex items-center gap-2">
														<Badge
															variant="outline"
															className="font-mono text-xs"
														>
															{threat.id}
														</Badge>
														<Badge variant="outline" className="text-xs">
															{threat.threat_grouping}
														</Badge>
													</div>
													<p className="mt-1 text-xs font-medium text-orange-900">
														{threat.title}
													</p>
													<p className="text-xs text-orange-700 line-clamp-2">
														{threat.description}
													</p>
												</div>
											))}
											{threats.length > 3 && (
												<p className="text-xs text-orange-600">
													+{threats.length - 3} more threat
													{threats.length - 3 === 1 ? "" : "s"}
												</p>
											)}
										</div>
									</div>
								)}

								{/* Maturity Levels Section */}
								{maturityLevels && (
									<div className="space-y-2">
										<h5 className="text-xs font-medium text-indigo-800">
											C|P-CMM Maturity Levels
										</h5>
										<div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
											{[0, 1, 2, 3, 4, 5].map((level) => {
												const description = maturityLevels[
													`level_${level}_description` as keyof MaturityLevels
												] as string;
												if (!description) return null;

												return (
													<div
														key={level}
														className="rounded border border-indigo-100 bg-indigo-50 p-2"
													>
														<div className="mb-1 flex items-center gap-2">
															<Badge variant="outline" className="text-xs">
																Level {level}
															</Badge>
														</div>
														<p className="text-xs text-indigo-700 line-clamp-2">
															{description}
														</p>
													</div>
												);
											})}
										</div>
									</div>
								)}
							</CollapsibleContent>
						</Collapsible>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					{!hasEvidence && (
						<Badge variant="outline" className="border-red-200 text-red-700">
							Evidence gap
						</Badge>
					)}
					{!hasAssessment && (
						<Badge variant="outline" className="border-blue-200 text-blue-700">
							Assessment gap
						</Badge>
					)}
					<Button size="sm" onClick={onUploadEvidence}>
						<Upload className="mr-2 h-3 w-3" />
						Upload Evidence
					</Button>
				</div>
			</div>
		</Card>
	);
}
