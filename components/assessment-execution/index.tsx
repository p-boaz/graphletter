"use client";

import {
	Calendar,
	CheckSquare,
	ClipboardList,
	Clock,
	Eye,
	Filter,
	Link,
	Play,
	Search,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { UserAssessment } from "@/lib/types/assessment";
import { AssessmentDetailView } from "./assessment-detail-view";
import { AssessmentExecutionSkeleton } from "./assessment-skeleton";
import { CreateAssessmentDialog } from "./create-assessment-dialog";
import {
	type AssessmentExecutionProps,
	type AssessmentStats,
	getResultColor,
	getRiskIcon,
	getStatusColor,
	getStatusIcon,
} from "./utils";

// Re-export for backwards compatibility
export type { UserAssessment } from "@/lib/types/assessment";

export function AssessmentExecution({ controlId }: AssessmentExecutionProps) {
	const [assessments, setAssessments] = useState<UserAssessment[]>([]);
	const [stats, setStats] = useState<AssessmentStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [resultFilter, setResultFilter] = useState<string>("all");
	const [selectedAssessment, setSelectedAssessment] =
		useState<UserAssessment | null>(null);

	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const itemsPerPage = 20;

	const loadAssessments = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const params = new URLSearchParams({
				limit: itemsPerPage.toString(),
				offset: ((currentPage - 1) * itemsPerPage).toString(),
			});

			if (controlId) params.append("control_id", controlId);
			if (statusFilter !== "all") params.append("status", statusFilter);
			if (searchTerm) params.append("search", searchTerm);

			const response = await fetch(`/api/assessments?${params}`);

			if (!response.ok) {
				throw new Error("Failed to load assessments");
			}

			const data = await response.json();
			setAssessments(data.assessments || []);
			setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));
		} catch (err) {
			console.error("Error loading assessments:", err);
			setError(
				err instanceof Error ? err.message : "Failed to load assessments",
			);
		} finally {
			setLoading(false);
		}
	}, [controlId, currentPage, searchTerm, statusFilter]);

	const loadStats = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (controlId) params.append("control_id", controlId);

			const response = await fetch(`/api/assessments/stats?${params}`);

			if (response.ok) {
				const data = await response.json();
				setStats(data.stats);
			}
		} catch (err) {
			console.error("Error loading assessment stats:", err);
		}
	}, [controlId]);

	useEffect(() => {
		void loadAssessments();
		void loadStats();
	}, [loadAssessments, loadStats]);

	const handleStartAssessment = async (controlId: string, aoId?: string) => {
		try {
			const response = await fetch("/api/assessments", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					scf_control_id: controlId,
					scf_ao_id: aoId,
					assessment_type: aoId ? "objective" : "control",
					assessment_summary: `Assessment for ${aoId || controlId}`,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to start assessment");
			}

			await loadAssessments();
			await loadStats();
			toast.success("Assessment started successfully");
		} catch (error) {
			console.error("Error starting assessment:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to start assessment",
			);
		}
	};

	const handleUpdateAssessment = async (
		assessmentId: string,
		updates: Partial<UserAssessment>,
	) => {
		try {
			const response = await fetch(`/api/assessments?id=${assessmentId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updates),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to update assessment");
			}

			await loadAssessments();
			await loadStats();
			toast.success("Assessment updated successfully");
		} catch (error) {
			console.error("Error updating assessment:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to update assessment",
			);
		}
	};

	const filteredAssessments = assessments.filter((item) => {
		const matchesSearch =
			!searchTerm ||
			item.scf_control?.title
				?.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			item.scf_control_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.scf_ao_id?.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesStatus =
			statusFilter === "all" || item.assessment_status === statusFilter;
		const matchesResult =
			resultFilter === "all" || item.assessment_result === resultFilter;

		return matchesSearch && matchesStatus && matchesResult;
	});

	if (loading && assessments.length === 0) {
		return <AssessmentExecutionSkeleton />;
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl text-slate-900">
						Assessment Execution
					</h2>
					<p className="text-slate-600">
						Execute and manage control assessments using SCF assessment
						objectives
						{controlId && " for this control"}
					</p>
				</div>
				<CreateAssessmentDialog onStartAssessment={handleStartAssessment} />
			</div>

			{/* Stats Cards */}
			{stats && (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
					<Card>
						<CardContent className="p-4 text-center">
							<div className="mb-1 font-bold text-2xl text-blue-700">
								{stats.total_assessments}
							</div>
							<div className="text-blue-600 text-sm">Total Assessments</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4 text-center">
							<div className="mb-1 font-bold text-2xl text-green-700">
								{stats.compliance_rate}%
							</div>
							<div className="text-green-600 text-sm">Compliance Rate</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4 text-center">
							<div className="mb-1 font-bold text-2xl text-yellow-700">
								{stats.pending_assessments}
							</div>
							<div className="text-sm text-yellow-600">Pending</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4 text-center">
							<div className="mb-1 font-bold text-2xl text-red-700">
								{stats.overdue_assessments}
							</div>
							<div className="text-red-600 text-sm">Overdue</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4 text-center">
							<div className="mb-1 font-bold text-2xl text-purple-700">
								{stats.implementation_rate}%
							</div>
							<div className="text-purple-600 text-sm">Implementation</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Filters and Search */}
			<Card>
				<CardContent className="p-4">
					<div className="flex flex-col gap-4 sm:flex-row">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
								<Input
									placeholder="Search assessments by control, objective ID..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<div className="flex gap-2">
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-40">
									<Filter className="mr-2 h-4 w-4" />
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="not_started">Not Started</SelectItem>
									<SelectItem value="in_progress">In Progress</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
									<SelectItem value="under_review">Under Review</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="requires_remediation">
										Needs Remediation
									</SelectItem>
								</SelectContent>
							</Select>

							<Select value={resultFilter} onValueChange={setResultFilter}>
								<SelectTrigger className="w-40">
									<Target className="mr-2 h-4 w-4" />
									<SelectValue placeholder="Result" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Results</SelectItem>
									<SelectItem value="met">Met</SelectItem>
									<SelectItem value="partially_met">Partially Met</SelectItem>
									<SelectItem value="not_met">Not Met</SelectItem>
									<SelectItem value="not_tested">Not Tested</SelectItem>
									<SelectItem value="not_applicable">Not Applicable</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Assessment List */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ClipboardList className="h-5 w-5" />
						Active Assessments
						<Badge variant="secondary">{filteredAssessments.length}</Badge>
					</CardTitle>
					<CardDescription>
						Manage assessment execution and track progress
					</CardDescription>
				</CardHeader>
				<CardContent>
					{filteredAssessments.length === 0 ? (
						<div className="py-8 text-center text-slate-500">
							<ClipboardList className="mx-auto mb-4 h-12 w-12 text-slate-300" />
							<p className="font-medium text-lg">No Assessments Found</p>
							<p className="text-sm">
								{searchTerm || statusFilter !== "all" || resultFilter !== "all"
									? "No assessments match your current filters."
									: "Start your first assessment to begin compliance testing."}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{filteredAssessments.map((assessment) => (
								<Card key={assessment.id} className="border border-slate-200">
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="mb-2 flex items-center gap-2">
													<Badge
														variant="outline"
														className="font-mono text-xs"
													>
														{assessment.scf_control_id}
													</Badge>
													{assessment.scf_ao_id && (
														<Badge
															variant="secondary"
															className="font-mono text-xs"
														>
															{assessment.scf_ao_id}
														</Badge>
													)}

													<Badge
														className={`text-xs ${getStatusColor(assessment.assessment_status)}`}
													>
														{getStatusIcon(assessment.assessment_status)}
														<span className="ml-1">
															{assessment.assessment_status.replace("_", " ")}
														</span>
													</Badge>

													{assessment.assessment_result && (
														<Badge
															className={`text-xs ${getResultColor(assessment.assessment_result)}`}
														>
															{assessment.assessment_result.replace("_", " ")}
														</Badge>
													)}

													{assessment.risk_rating && (
														<div className="flex items-center gap-1">
															{getRiskIcon(assessment.risk_rating)}
															<span className="text-slate-600 text-xs capitalize">
																{assessment.risk_rating}
															</span>
														</div>
													)}
												</div>

												<h4 className="mb-2 font-semibold text-slate-900">
													{assessment.scf_control?.title ||
														assessment.scf_control_id}
												</h4>

												{assessment.assessment_objective && (
													<p className="mb-3 line-clamp-2 text-slate-600 text-sm">
														{
															assessment.assessment_objective
																.assessment_objective
														}
													</p>
												)}

												<div className="mb-3 grid grid-cols-2 gap-4 text-slate-600 text-sm md:grid-cols-4">
													<div className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														<span>
															Created:{" "}
															{new Date(
																assessment.created_at,
															).toLocaleDateString()}
														</span>
													</div>

													{assessment.started_at && (
														<div className="flex items-center gap-1">
															<Play className="h-3 w-3" />
															<span>
																Started:{" "}
																{new Date(
																	assessment.started_at,
																).toLocaleDateString()}
															</span>
														</div>
													)}

													{assessment.completed_at && (
														<div className="flex items-center gap-1">
															<CheckSquare className="h-3 w-3" />
															<span>
																Completed:{" "}
																{new Date(
																	assessment.completed_at,
																).toLocaleDateString()}
															</span>
														</div>
													)}

													{assessment.next_assessment_due && (
														<div className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															<span>
																Next:{" "}
																{new Date(
																	assessment.next_assessment_due,
																).toLocaleDateString()}
															</span>
														</div>
													)}
												</div>

												{assessment.evidence_assessment_links &&
													assessment.evidence_assessment_links.length > 0 && (
														<div className="mb-3 flex items-center gap-1 text-slate-600 text-sm">
															<Link className="h-3 w-3" />
															<span>
																{assessment.evidence_assessment_links.length}{" "}
																evidence file(s) linked
															</span>
														</div>
													)}

												{assessment.assessment_summary && (
													<div className="mb-3 text-slate-600 text-sm">
														<strong>Summary:</strong>{" "}
														{assessment.assessment_summary}
													</div>
												)}
											</div>

											<div className="ml-4 flex items-center gap-2">
												<Dialog>
													<DialogTrigger asChild>
														<Button
															variant="outline"
															size="sm"
															onClick={() => setSelectedAssessment(assessment)}
														>
															<Eye className="mr-1 h-4 w-4" />
															View
														</Button>
													</DialogTrigger>
													<DialogContent
														className="max-h-[80vh] max-w-4xl overflow-y-auto"
														aria-describedby={undefined}
													>
														<DialogHeader>
															<DialogTitle>Assessment Details</DialogTitle>
														</DialogHeader>
														{selectedAssessment && (
															<AssessmentDetailView
																assessment={selectedAssessment}
																onUpdate={handleUpdateAssessment}
															/>
														)}
													</DialogContent>
												</Dialog>

												{assessment.assessment_status === "not_started" && (
													<Button
														size="sm"
														onClick={() =>
															handleUpdateAssessment(assessment.id, {
																assessment_status: "in_progress",
																started_at: new Date().toISOString(),
															})
														}
														className="bg-blue-600 hover:bg-blue-700"
													>
														<Play className="mr-1 h-4 w-4" />
														Start
													</Button>
												)}

												{assessment.assessment_status === "in_progress" && (
													<Button
														size="sm"
														onClick={() =>
															handleUpdateAssessment(assessment.id, {
																assessment_status: "completed",
																completed_at: new Date().toISOString(),
															})
														}
														className="bg-green-600 hover:bg-green-700"
													>
														<CheckSquare className="mr-1 h-4 w-4" />
														Complete
													</Button>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage === 1}
					>
						Previous
					</Button>

					<span className="text-slate-600 text-sm">
						Page {currentPage} of {totalPages}
					</span>

					<Button
						variant="outline"
						size="sm"
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						disabled={currentPage === totalPages}
					>
						Next
					</Button>
				</div>
			)}
		</div>
	);
}
