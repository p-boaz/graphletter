"use client";

import {
	BarChart3,
	Download,
	FileText,
	Filter,
	Search,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { exportGraphComplianceReport } from "@/lib/client/graph-report-export";

interface GraphCoverageControl {
	scf_control_id: string;
	status: "compliant" | "partial" | "missing" | "conflicting";
	strongest_coverage_rank: number;
}

interface ReportItem {
	id: string;
	title: string;
	type: string;
	framework: string;
	status: "published" | "draft" | "in-review" | "archived";
	result: GraphCoverageControl["status"];
	generatedAt: string;
	score: number;
	description: string;
}

export default function ReportsPage() {
	const [searchTerm, setSearchTerm] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [frameworkFilter, setFrameworkFilter] = useState("all");
	const [reports, setReports] = useState<ReportItem[]>([]);
	const [isLoadingReports, setIsLoadingReports] = useState(true);
	const [reportsError, setReportsError] = useState<string | null>(null);
	const [isExporting, setIsExporting] = useState(false);

	const mapCoverageStatusToScore = (status: GraphCoverageControl["status"]) => {
		if (status === "compliant") return 100;
		if (status === "partial") return 70;
		if (status === "conflicting") return 40;
		return 0;
	};

	const exportComplianceReport = async (format: "csv" | "json") => {
		setIsExporting(true);
		try {
			await exportGraphComplianceReport(format);
		} catch (error) {
			setReportsError(
				error instanceof Error ? error.message : "Failed to export report",
			);
		} finally {
			setIsExporting(false);
		}
	};

	useEffect(() => {
		const loadReports = async () => {
			setIsLoadingReports(true);
			setReportsError(null);

			try {
				await fetch("/api/analysis/run-gap-analysis", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				});

				const response = await fetch("/api/controls/build-coverage", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ includeControls: true }),
				});
				const data = await response.json();

				if (!response.ok || !data.success) {
					throw new Error(data.error || "Failed to load graph reports");
				}

				const mappedReports: ReportItem[] = (
					(data.controls || []) as GraphCoverageControl[]
				).map((control) => ({
					id: control.scf_control_id,
					title: `Coverage ${control.scf_control_id}`,
					type: "graph_coverage",
					framework: "SCF",
					status:
						control.status === "missing"
							? "draft"
							: control.status === "conflicting"
								? "in-review"
								: "published",
					result: control.status,
					generatedAt: new Date().toISOString(),
					score: mapCoverageStatusToScore(control.status),
					description: `Graph-native coverage rank ${control.strongest_coverage_rank}.`,
				}));

				setReports(mappedReports);
			} catch (error) {
				setReportsError(
					error instanceof Error ? error.message : "Failed to load reports",
				);
				setReports([]);
			} finally {
				setIsLoadingReports(false);
			}
		};

		loadReports();
	}, []);

	const availableFrameworks = Array.from(
		new Set(reports.map((report) => report.framework)),
	).sort();
	const availableTypes = Array.from(
		new Set(reports.map((report) => report.type)),
	).sort();

	const getStatusColor = (status: string) => {
		switch (status) {
			case "published":
				return "bg-green-100 text-green-800";
			case "draft":
				return "bg-yellow-100 text-yellow-800";
			case "in-review":
				return "bg-blue-100 text-blue-800";
			case "archived":
				return "bg-gray-100 text-gray-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getTypeColor = (type: string) =>
		type === "graph_coverage"
			? "bg-green-100 text-green-800"
			: "bg-gray-100 text-gray-800";

	const getScoreColor = (score: number) => {
		if (score >= 90) return "text-green-600";
		if (score >= 75) return "text-blue-600";
		if (score >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	const filteredReports = reports.filter((report) => {
		const matchesSearch =
			report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			report.framework.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesType = typeFilter === "all" || report.type === typeFilter;
		const matchesFramework =
			frameworkFilter === "all" || report.framework === frameworkFilter;
		return matchesSearch && matchesType && matchesFramework;
	});

	const stats = {
		total: reports.length,
		published: reports.filter((r) => r.status === "published").length,
		draft: reports.filter((r) => r.status === "draft").length,
		avgScore: reports.length
			? Math.round(
					reports.reduce((sum, r) => sum + r.score, 0) / reports.length,
				)
			: 0,
	};

	return (
		<div className="min-h-screen bg-white">
			<Navigation />

			{/* Hero Section */}
			<section className="bg-gradient-to-br from-slate-50 to-white py-20">
				<div className="container mx-auto px-4">
					<div className="text-center space-y-8">
						<h1 className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl">
							Compliance Reports
						</h1>
						<p className="ft-sans text-slate-600 text-xl max-w-3xl mx-auto">
							Review completed assessments, track compliance outcomes, and
							export report data for auditors and internal stakeholders.
						</p>
					</div>
				</div>
			</section>

			{/* Stats Overview */}
			<section className="py-12 bg-slate-50">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">
											Total Reports
										</p>
										<p className="ft-serif font-bold text-2xl text-slate-900">
											{stats.total}
										</p>
									</div>
									<FileText className="h-8 w-8 text-slate-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">Published</p>
										<p className="ft-serif font-bold text-2xl text-green-600">
											{stats.published}
										</p>
									</div>
									<BarChart3 className="h-8 w-8 text-green-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">Drafts</p>
										<p className="ft-serif font-bold text-2xl text-yellow-600">
											{stats.draft}
										</p>
									</div>
									<FileText className="h-8 w-8 text-yellow-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">Avg Score</p>
										<p className="ft-serif font-bold text-2xl text-slate-900">
											{stats.avgScore}%
										</p>
									</div>
									<TrendingUp className="h-8 w-8 text-slate-400" />
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			<section className="py-16">
				<div className="container mx-auto px-4">
					<div className="space-y-8">
						<div className="flex flex-wrap items-center justify-end gap-3">
							<Button
								size="sm"
								variant="outline"
								onClick={() => exportComplianceReport("json")}
								disabled={isExporting}
							>
								<Download className="mr-2 h-3 w-3" />
								Export JSON
							</Button>
							<Button
								size="sm"
								onClick={() => exportComplianceReport("csv")}
								disabled={isExporting}
							>
								<Download className="mr-2 h-3 w-3" />
								Export CSV
							</Button>
						</div>

						<div className="flex flex-col md:flex-row gap-4 items-center justify-between">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
								<Input
									placeholder="Search reports..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
								/>
							</div>

							<div className="flex gap-4">
								<Select value={typeFilter} onValueChange={setTypeFilter}>
									<SelectTrigger className="w-40">
										<Filter className="mr-2 h-4 w-4" />
										<SelectValue placeholder="Type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										{availableTypes.map((type) => (
											<SelectItem key={type} value={type}>
												{type.charAt(0).toUpperCase() + type.slice(1)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Select
									value={frameworkFilter}
									onValueChange={setFrameworkFilter}
								>
									<SelectTrigger className="w-40">
										<SelectValue placeholder="Framework" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Frameworks</SelectItem>
										{availableFrameworks.map((framework) => (
											<SelectItem key={framework} value={framework}>
												{framework}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{reportsError && (
							<Card className="border-red-200 bg-red-50">
								<CardContent className="pt-6">
									<p className="text-red-700 text-sm">{reportsError}</p>
								</CardContent>
							</Card>
						)}

						{isLoadingReports && (
							<Card>
								<CardContent className="pt-6">
									<p className="text-slate-600 text-sm">Loading reports...</p>
								</CardContent>
							</Card>
						)}

						<div className="space-y-4">
							{filteredReports.map((report) => (
								<Card
									key={report.id}
									className="hover:shadow-lg transition-shadow"
								>
									<CardContent className="pt-6">
										<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
											<div className="flex-1 space-y-3">
												<div className="flex items-start justify-between">
													<div className="space-y-2">
														<div className="flex items-center gap-3">
															<h3 className="ft-serif font-semibold text-lg">
																{report.title}
															</h3>
															<Badge
																className={getTypeColor(report.type)}
																variant="secondary"
															>
																{report.type.charAt(0).toUpperCase() +
																	report.type.slice(1)}
															</Badge>
														</div>
														<p className="ft-sans text-slate-600 text-sm">
															{report.description}
														</p>
													</div>
													<Badge
														className={getStatusColor(report.status)}
														variant="secondary"
													>
														{report.status.charAt(0).toUpperCase() +
															report.status.slice(1)}
													</Badge>
												</div>

												<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
													<div>
														<span className="font-medium text-slate-700">
															Framework:
														</span>
														<span className="ml-1 text-slate-600">
															{report.framework}
														</span>
													</div>
													<div>
														<span className="font-medium text-slate-700">
															Result:
														</span>
														<span className="ml-1 text-slate-600">
															{report.result || "Unknown"}
														</span>
													</div>
													<div>
														<span className="font-medium text-slate-700">
															Generated:
														</span>
														<span className="ml-1 text-slate-600">
															{new Date(
																report.generatedAt,
															).toLocaleDateString()}
														</span>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-4">
												<div className="text-center">
													<div
														className={`ft-serif font-bold text-xl ${getScoreColor(report.score)}`}
													>
														{report.score}%
													</div>
													<div className="ft-sans text-xs text-slate-500">
														Score
													</div>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>

						{filteredReports.length === 0 && (
							<div className="text-center py-12">
								<FileText className="mx-auto h-12 w-12 text-slate-400" />
								<h3 className="ft-serif font-medium text-lg text-slate-900 mt-4">
									No reports found
								</h3>
								<p className="ft-sans text-slate-600 mt-2">
									Run assessments or adjust the active filters.
								</p>
							</div>
						)}
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}
