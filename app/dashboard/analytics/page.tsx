"use client";

import { AlertTriangle, Download, FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { exportGraphComplianceReport } from "@/lib/client/graph-report-export";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const oneWeekAgoThreshold = Date.now() - ONE_WEEK_MS;

interface EvidenceRecord {
	id: string;
	file_name: string;
	scf_control_id: string;
	evidence_type: string;
	evidence_status: string;
	submitted_at: string;
	evidence_group_id?: string;
	erl_global_id?: string;
	metadata?: {
		documentation_artifact?: string;
		smart_upload?: boolean;
	};
}

interface AssessmentRecord {
	id: string;
	evidence_id?: string;
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
		maturity_assessment?: {
			assessed_level: number;
			confidence: number;
			rationale: string;
			target_level?: number | null;
			target_met?: boolean | null;
			target_gap?: number | null;
			referenced_level_description?: string | null;
			recommended_actions?: string[];
		} | null;
		maturity_benchmark_snapshot?: {
			level_0_description?: string | null;
			level_1_description?: string | null;
			level_2_description?: string | null;
			level_3_description?: string | null;
			level_4_description?: string | null;
			level_5_description?: string | null;
		} | null;
		is_summary?: boolean;
		basic_assessment?: boolean;
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

interface GraphCoverageControl {
	scf_control_id: string;
	status: "compliant" | "partial" | "missing" | "conflicting";
	strongest_coverage_rank: number;
}

interface GraphCoverageSummary {
	total_controls: number;
	covered_controls: number;
	partial_controls: number;
	missing_controls: number;
	conflicting_controls?: number;
	coverage_percentage: number;
}

interface ScfDomainInfo {
	name?: string | null;
	description?: string | null;
}

interface ScfControlCatalogItem {
	id: string;
	domain_id: string;
	scf_domains?: ScfDomainInfo | ScfDomainInfo[] | null;
}

interface DomainCoverageRow {
	domain_id: string;
	domain_name: string;
	domain_description: string;
	total_controls: number;
	compliant_controls: number;
	partial_controls: number;
	missing_controls: number;
	conflicting_controls: number;
	coverage_percentage: number;
}

function normalizeDomainInfo(
	value: ScfControlCatalogItem["scf_domains"],
): ScfDomainInfo | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default function AnalyticsPage() {
	const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
	const [assessmentRecords, setAssessmentRecords] = useState<
		AssessmentRecord[]
	>([]);
	const [coverageSummary, setCoverageSummary] =
		useState<GraphCoverageSummary | null>(null);
	const [graphControls, setGraphControls] = useState<GraphCoverageControl[]>(
		[],
	);
	const [controlCatalog, setControlCatalog] = useState<ScfControlCatalogItem[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [
				evidenceResponse,
				assessmentResponse,
				coverageResponse,
				controlsResponse,
			] = await Promise.all([
				fetch(`/api/evidence/history`, { cache: "no-store" }),
				fetch(`/api/assessments/history`, { cache: "no-store" }),
				fetch("/api/controls/build-coverage", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ includeControls: true }),
				}),
				fetch("/api/scf/controls?limit=all", { cache: "no-store" }),
			]);

			if (evidenceResponse.ok) {
				const evidenceData = await evidenceResponse.json();
				setEvidenceRecords(evidenceData.evidence || []);
			}

			if (assessmentResponse.ok) {
				const assessmentData = await assessmentResponse.json();
				setAssessmentRecords(assessmentData.assessments || []);
			}

			if (coverageResponse.ok) {
				const coverageData = (await coverageResponse.json()) as {
					success?: boolean;
					coverage?: GraphCoverageSummary;
					controls?: GraphCoverageControl[];
				};
				if (coverageData.success) {
					setCoverageSummary(coverageData.coverage || null);
					setGraphControls(
						Array.isArray(coverageData.controls) ? coverageData.controls : [],
					);
				}
			}

			if (controlsResponse.ok) {
				const controlsData = await controlsResponse.json();
				setControlCatalog(Array.isArray(controlsData) ? controlsData : []);
			}
		} catch (loadError) {
			console.error("Error loading analytics data:", loadError);
			setError("Unable to load analytics data right now.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const handleExportReport = async (format: "json" | "csv" = "csv") => {
		try {
			await exportGraphComplianceReport(format);
			toast.success("Graph compliance report downloaded successfully");
		} catch (exportError) {
			console.error("Export failed:", exportError);
			toast.error("Failed to export graph compliance report");
		}
	};

	const totalEvidenceFiles = [
		...new Set(evidenceRecords.map((e) => e.evidence_group_id || e.id)),
	].length;
	const totalEvidenceRecords = evidenceRecords.length;
	const recentUploadGroups = [
		...new Set(
			evidenceRecords
				.filter((e) => {
					const uploadDate = new Date(e.submitted_at);
					return uploadDate.getTime() > oneWeekAgoThreshold;
				})
				.map((e) => e.evidence_group_id || e.id),
		),
	].length;
	const smartUploadGroups = [
		...new Set(
			evidenceRecords
				.filter((e) => e.metadata?.smart_upload)
				.map((e) => e.evidence_group_id || e.id),
		),
	].length;

	const completedAssessments = assessmentRecords.filter(
		(record) => record.assessment_status === "completed",
	);
	const completedAssessmentsCount = completedAssessments.length;
	const uniqueControlsAssessed = [
		...new Set(completedAssessments.map((record) => record.scf_control_id)),
	].length;

	const maturityRecords = assessmentRecords.filter(
		(record) =>
			record.metadata?.maturity_assessment &&
			(record.metadata?.is_summary || record.metadata?.basic_assessment),
	);

	const maturityAssessments = maturityRecords.map((record) => ({
		controlId: record.scf_control_id,
		...((record.metadata?.maturity_assessment as NonNullable<
			AssessmentRecord["metadata"]
		>["maturity_assessment"]) || {
			assessed_level: 0,
			confidence: 0,
			rationale: "",
		}),
	}));

	const totalMaturityAssessments = maturityAssessments.length;
	const avgMaturityLevel =
		totalMaturityAssessments > 0
			? maturityAssessments.reduce(
					(sum, item) => sum + (item.assessed_level || 0),
					0,
				) / totalMaturityAssessments
			: 0;

	const avgMaturityConfidence =
		totalMaturityAssessments > 0
			? maturityAssessments.reduce(
					(sum, item) => sum + (item.confidence || 0),
					0,
				) / totalMaturityAssessments
			: 0;

	const onTargetCount = maturityAssessments.filter(
		(item) => item.target_met === true,
	).length;
	const needsImprovementCount = maturityAssessments.filter(
		(item) => item.target_met === false,
	).length;

	const maturityLevelDistribution = [0, 1, 2, 3, 4, 5].map((level) => ({
		level,
		count: maturityAssessments.filter((item) => item.assessed_level === level)
			.length,
	}));

	const maxMaturityCount = Math.max(
		1,
		...maturityLevelDistribution.map((entry) => entry.count),
	);

	const graphCoveredControls =
		coverageSummary?.covered_controls ??
		graphControls.filter((control) => control.status === "compliant").length;
	const graphPartialControls =
		coverageSummary?.partial_controls ??
		graphControls.filter((control) => control.status === "partial").length;
	const graphMissingControls =
		coverageSummary?.missing_controls ??
		graphControls.filter((control) => control.status === "missing").length;
	const graphConflictingControls =
		coverageSummary?.conflicting_controls ??
		graphControls.filter((control) => control.status === "conflicting").length;
	const graphTotalControls =
		coverageSummary?.total_controls ?? graphControls.length;
	const graphControlsWithEvidence = graphCoveredControls + graphPartialControls;
	const graphCoverageRate =
		coverageSummary?.coverage_percentage ??
		(graphTotalControls > 0
			? Math.round((graphControlsWithEvidence / graphTotalControls) * 100)
			: 0);

	const domainCoverageRows = useMemo(() => {
		const metadataByControlId = new Map(
			controlCatalog.map((control) => [control.id, control]),
		);
		const domainStats = new Map<string, DomainCoverageRow>();

		for (const control of graphControls) {
			const metadata = metadataByControlId.get(control.scf_control_id);
			const domainId = metadata?.domain_id || "Unknown";
			const domainInfo = normalizeDomainInfo(metadata?.scf_domains);
			const domainName = domainInfo?.name?.trim() || domainId;
			const domainDescription =
				domainInfo?.description?.trim() || `${domainName} control domain`;

			if (!domainStats.has(domainId)) {
				domainStats.set(domainId, {
					domain_id: domainId,
					domain_name: domainName,
					domain_description: domainDescription,
					total_controls: 0,
					compliant_controls: 0,
					partial_controls: 0,
					missing_controls: 0,
					conflicting_controls: 0,
					coverage_percentage: 0,
				});
			}

			const stats = domainStats.get(domainId);
			if (!stats) {
				continue;
			}

			stats.total_controls += 1;
			if (control.status === "compliant") stats.compliant_controls += 1;
			if (control.status === "partial") stats.partial_controls += 1;
			if (control.status === "missing") stats.missing_controls += 1;
			if (control.status === "conflicting") stats.conflicting_controls += 1;
		}

		return Array.from(domainStats.values())
			.map((row) => ({
				...row,
				coverage_percentage:
					row.total_controls > 0
						? Math.round(
								((row.compliant_controls + row.partial_controls) /
									row.total_controls) *
									100,
							)
						: 0,
			}))
			.sort((a, b) => {
				const coverageDiff = a.coverage_percentage - b.coverage_percentage;
				if (coverageDiff !== 0) return coverageDiff;
				return a.domain_name.localeCompare(b.domain_name);
			});
	}, [controlCatalog, graphControls]);

	if (loading) {
		return (
			<DashboardLayout
				title="Analytics"
				description="Drill-down analysis for domain performance, maturity trends, operational activity, and exports."
				showUploadButton={true}
			>
				<Card>
					<CardContent className="p-6">
						<div className="text-center">
							<div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2"></div>
							<p className="mt-2 text-gray-600 text-sm">Loading analytics...</p>
						</div>
					</CardContent>
				</Card>
			</DashboardLayout>
		);
	}

	if (error) {
		return (
			<DashboardLayout
				title="Analytics"
				description="Drill-down analysis for domain performance, maturity trends, operational activity, and exports."
				showUploadButton={true}
			>
				<Card>
					<CardContent className="p-6">
						<div className="text-center">
							<AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
							<p className="text-red-600">{error}</p>
							<Button onClick={loadData} variant="outline" className="mt-2">
								Retry
							</Button>
						</div>
					</CardContent>
				</Card>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout
			title="Analytics"
			description="Drill-down analysis for domain performance, maturity trends, operational activity, and exports."
			showUploadButton={true}
		>
			<div className="space-y-6">
				<Card data-testid="analytics-purpose-card" className="border-slate-200">
					<CardHeader>
						<CardTitle className="ft-serif font-bold text-2xl text-ft-black">
							Purpose of this page
						</CardTitle>
						<CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
							Use Analytics for deep drill-down metrics. For at-a-glance status,
							use Overview. For control-by-control objective evidence, use
							Assessment Results.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						<Button asChild variant="outline" className="border-slate-300">
							<Link href="/dashboard">Open Overview</Link>
						</Button>
						<Button asChild variant="outline" className="border-slate-300">
							<Link href="/dashboard/assessments">Open Assessment Results</Link>
						</Button>
					</CardContent>
				</Card>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card className="ft-card" data-testid="analytics-maturity-card">
						<CardHeader>
							<CardTitle className="ft-serif font-bold text-2xl text-ft-black">
								Control Maturity Insights
							</CardTitle>
							<CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
								AI-estimated maturity levels and target posture progress.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{totalMaturityAssessments === 0 ? (
								<div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/60 p-6 text-center text-purple-700 text-sm">
									Run an AI assessment to populate maturity benchmarks and
									target tracking.
								</div>
							) : (
								<>
									<div className="grid grid-cols-2 gap-4">
										<div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center">
											<div className="font-bold text-2xl text-purple-700">
												{totalMaturityAssessments}
											</div>
											<div className="text-purple-600 text-sm">
												Maturity-Scored Controls
											</div>
										</div>
										<div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center">
											<div className="font-bold text-2xl text-purple-700">
												{Math.round(avgMaturityLevel * 10) / 10}
											</div>
											<div className="text-purple-600 text-sm">
												Average Level
											</div>
										</div>
										<div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
											<div className="font-bold text-2xl text-green-700">
												{onTargetCount}
											</div>
											<div className="text-green-600 text-sm">On Target</div>
										</div>
										<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
											<div className="font-bold text-2xl text-amber-700">
												{needsImprovementCount}
											</div>
											<div className="text-amber-600 text-sm">
												Needs Improvement
											</div>
										</div>
									</div>

									<div>
										<h4 className="mb-2 font-semibold text-purple-900 text-sm">
											Level Distribution
										</h4>
										<div className="space-y-2">
											{maturityLevelDistribution.map((entry) => (
												<div key={entry.level} className="space-y-1">
													<div className="flex items-center justify-between text-purple-700 text-xs">
														<span>Level {entry.level}</span>
														<span>{entry.count}</span>
													</div>
													<div className="h-2 rounded-full bg-purple-100">
														<div
															className="h-full rounded-full bg-purple-500"
															style={{
																width: `${(entry.count / maxMaturityCount) * 100}%`,
															}}
														></div>
													</div>
												</div>
											))}
										</div>
									</div>

									<div className="rounded bg-slate-50 p-3 text-slate-600 text-xs">
										Average maturity confidence:{" "}
										{Math.round(avgMaturityConfidence * 100)}%
									</div>
								</>
							)}
						</CardContent>
					</Card>

					<Card className="ft-card" data-testid="analytics-activity-card">
						<CardHeader>
							<CardTitle className="ft-serif font-bold text-2xl text-ft-black">
								Operational Activity
							</CardTitle>
							<CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
								Evidence and assessment throughput with graph-aligned coverage
								metrics.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
									<div className="font-bold text-2xl text-blue-700">
										{recentUploadGroups}
									</div>
									<div className="text-blue-600 text-sm">Recent Uploads</div>
									<div className="mt-1 text-blue-500 text-xs">Last 7 days</div>
								</div>
								<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
									<div className="font-bold text-2xl text-gray-700">
										{totalEvidenceFiles}
									</div>
									<div className="text-gray-600 text-sm">Evidence Files</div>
									<div className="mt-1 text-gray-500 text-xs">
										{totalEvidenceRecords} control mappings
									</div>
								</div>
								<div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
									<div className="font-bold text-2xl text-indigo-700">
										{smartUploadGroups}
									</div>
									<div className="text-indigo-600 text-sm">
										AI-Processed Files
									</div>
									<div className="mt-1 text-indigo-500 text-xs">
										Smart uploads
									</div>
								</div>
								<div
									className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center"
									data-testid="analytics-controls-with-evidence-card"
								>
									<div className="font-bold text-2xl text-emerald-700">
										{graphControlsWithEvidence}
									</div>
									<div className="text-emerald-600 text-sm">
										Fully or Partially Covered
									</div>
									<div className="mt-1 text-emerald-500 text-xs">
										Controls with any evidence
									</div>
								</div>
								<div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
									<div className="font-bold text-2xl text-orange-700">
										{Math.max(
											graphTotalControls - graphControlsWithEvidence,
											0,
										)}
									</div>
									<div className="text-orange-600 text-sm">No Evidence</div>
									<div className="mt-1 text-orange-500 text-xs">
										Controls without any evidence
									</div>
								</div>
								<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
									<div className="font-bold text-2xl text-slate-700">
										{completedAssessmentsCount}
									</div>
									<div className="text-slate-600 text-sm">
										Completed Objectives
									</div>
									<div className="mt-1 text-slate-500 text-xs">
										Across {uniqueControlsAssessed} controls
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<Card className="ft-card" data-testid="analytics-domain-coverage-card">
					<CardHeader>
						<CardTitle className="ft-serif font-bold text-2xl text-ft-black">
							SCF Domain Coverage
						</CardTitle>
						<CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
							Per-domain breakdown using the same coverage model as the Overview
							dashboard.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{domainCoverageRows.length === 0 ? (
							<div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600 text-sm">
								No domain coverage data available yet. Upload and map evidence
								to see domain-level coverage.
							</div>
						) : (
							<div
								className="overflow-x-auto"
								data-testid="analytics-domain-coverage-table"
							>
								<table className="min-w-full border-collapse text-sm">
									<thead>
										<tr className="border-slate-200 border-b text-left text-slate-600">
											<th className="px-3 py-2 font-medium">Domain</th>
											<th className="px-3 py-2 font-medium">Description</th>
											<th className="px-3 py-2 text-right font-medium">
												Fully Covered
											</th>
											<th className="px-3 py-2 text-right font-medium">
												Partially Covered
											</th>
											<th className="px-3 py-2 text-right font-medium">
												No Evidence
											</th>
											<th className="px-3 py-2 text-right font-medium">
												Conflicting
											</th>
											<th className="px-3 py-2 text-right font-medium">
												Coverage
											</th>
										</tr>
									</thead>
									<tbody>
										{domainCoverageRows.map((domain) => (
											<tr
												key={domain.domain_id}
												className="border-slate-100 border-b align-top"
											>
												<td className="px-3 py-3">
													<div className="font-semibold text-slate-900">
														{domain.domain_name}
													</div>
													<div className="font-mono text-slate-500 text-xs">
														{domain.domain_id}
													</div>
												</td>
												<td className="max-w-xl px-3 py-3 text-slate-600 text-xs leading-relaxed">
													{domain.domain_description}
												</td>
												<td className="px-3 py-3 text-right text-green-700">
													{domain.compliant_controls}
												</td>
												<td className="px-3 py-3 text-right text-yellow-700">
													{domain.partial_controls}
												</td>
												<td className="px-3 py-3 text-right text-red-700">
													{domain.missing_controls}
												</td>
												<td className="px-3 py-3 text-right text-orange-700">
													{domain.conflicting_controls}
												</td>
												<td className="px-3 py-3 text-right">
													<div className="flex items-center justify-end gap-2">
														<div className="w-24">
															<Progress
																value={domain.coverage_percentage}
																className="h-2"
															/>
														</div>
														<span className="w-10 text-right font-medium text-slate-700 text-xs">
															{domain.coverage_percentage}%
														</span>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="ft-card" data-testid="analytics-export-card">
					<CardHeader>
						<CardTitle className="ft-serif font-bold text-2xl text-ft-black">
							Export & Reporting
						</CardTitle>
						<CardDescription className="ft-sans text-base text-slate-600 leading-relaxed">
							Generate audit-ready extracts from current graph and assessment
							data.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<Button
								className="ft-button-secondary w-full justify-start"
								onClick={() => handleExportReport("csv")}
							>
								<FileText className="mr-2 h-4 w-4" />
								Export Compliance Report (CSV)
							</Button>
							<Button
								className="ft-button-secondary w-full justify-start"
								onClick={() => handleExportReport("json")}
							>
								<Download className="mr-2 h-4 w-4" />
								Export Detailed Report (JSON)
							</Button>
						</div>
						<div className="rounded bg-gray-50 p-3 text-gray-500 text-xs">
							<p>
								<strong>Coverage snapshot:</strong> {graphControlsWithEvidence}/
								{graphTotalControls} controls fully or partially covered,{" "}
								{graphCoverageRate}% coverage.
							</p>
							<p>
								<strong>Current gaps:</strong> {graphMissingControls} with no
								evidence, {graphConflictingControls} conflicting.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}
