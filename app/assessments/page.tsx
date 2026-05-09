"use client";

import {
	ArrowRight,
	BarChart3,
	Calendar,
	CheckCircle,
	Clock,
	FileText,
	Filter,
	Search,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export default function AssessmentsPage() {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	const assessments = [
		{
			id: "ast-001",
			title: "SOC 2 Type II Readiness Assessment",
			framework: "SOC 2",
			status: "completed",
			score: 87,
			createdAt: "2024-01-15",
			completedAt: "2024-01-22",
			evidenceCount: 45,
			findings: {
				critical: 2,
				high: 5,
				medium: 12,
				low: 8,
			},
		},
		{
			id: "ast-002",
			title: "ISO 27001 Gap Analysis",
			framework: "ISO 27001",
			status: "in-progress",
			score: 72,
			createdAt: "2024-01-20",
			completedAt: null,
			evidenceCount: 38,
			findings: {
				critical: 1,
				high: 8,
				medium: 15,
				low: 6,
			},
		},
		{
			id: "ast-003",
			title: "GDPR Compliance Review",
			framework: "GDPR",
			status: "completed",
			score: 94,
			createdAt: "2024-01-10",
			completedAt: "2024-01-18",
			evidenceCount: 32,
			findings: {
				critical: 0,
				high: 2,
				medium: 7,
				low: 4,
			},
		},
		{
			id: "ast-004",
			title: "HIPAA Security Rule Assessment",
			framework: "HIPAA",
			status: "pending",
			score: null,
			createdAt: "2024-01-25",
			completedAt: null,
			evidenceCount: 0,
			findings: {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
			},
		},
		{
			id: "ast-005",
			title: "PCI DSS v4.0 Assessment",
			framework: "PCI DSS",
			status: "in-progress",
			score: 68,
			createdAt: "2024-01-18",
			completedAt: null,
			evidenceCount: 28,
			findings: {
				critical: 3,
				high: 12,
				medium: 18,
				low: 10,
			},
		},
	];

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-100 text-green-800";
			case "in-progress":
				return "bg-blue-100 text-blue-800";
			case "pending":
				return "bg-yellow-100 text-yellow-800";
			case "failed":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getScoreColor = (score: number | null) => {
		if (!score) return "text-gray-500";
		if (score >= 90) return "text-green-600";
		if (score >= 75) return "text-blue-600";
		if (score >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	const filteredAssessments = assessments.filter((assessment) => {
		const matchesSearch =
			assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			assessment.framework.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || assessment.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const stats = {
		total: assessments.length,
		completed: assessments.filter((a) => a.status === "completed").length,
		inProgress: assessments.filter((a) => a.status === "in-progress").length,
		avgScore: Math.round(
			assessments
				.filter((a) => a.score)
				.reduce((sum, a) => sum + (a.score || 0), 0) /
				assessments.filter((a) => a.score).length,
		),
	};

	return (
		<div className="min-h-screen bg-white">
			<Navigation />

			{/* Hero Section */}
			<section className="bg-gradient-to-br from-slate-50 to-white py-20">
				<div className="container mx-auto px-4">
					<div className="text-center space-y-8">
						<h1 className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl">
							Compliance Assessments
						</h1>
						<p className="ft-sans text-slate-600 text-xl max-w-3xl mx-auto">
							AI-powered compliance assessments that provide detailed gap
							analysis, evidence evaluation, and actionable recommendations for
							regulatory readiness.
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
											Total Assessments
										</p>
										<p className="ft-serif font-bold text-2xl text-slate-900">
											{stats.total}
										</p>
									</div>
									<BarChart3 className="h-8 w-8 text-slate-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">Completed</p>
										<p className="ft-serif font-bold text-2xl text-green-600">
											{stats.completed}
										</p>
									</div>
									<CheckCircle className="h-8 w-8 text-green-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">
											In Progress
										</p>
										<p className="ft-serif font-bold text-2xl text-blue-600">
											{stats.inProgress}
										</p>
									</div>
									<Clock className="h-8 w-8 text-blue-400" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="ft-sans text-slate-600 text-sm">
											Average Score
										</p>
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

			{/* Search and Filter */}
			<section className="py-8">
				<div className="container mx-auto px-4">
					<div className="flex flex-col md:flex-row gap-4 items-center justify-between">
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
							<Input
								placeholder="Search assessments..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>

						<div className="flex gap-4">
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-40">
									<Filter className="mr-2 h-4 w-4" />
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
									<SelectItem value="in-progress">In Progress</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
								</SelectContent>
							</Select>

							<Button asChild>
								<Link href="/assessments/new">
									New Assessment
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Assessments List */}
			<section className="pb-20">
				<div className="container mx-auto px-4">
					<div className="space-y-6">
						{filteredAssessments.map((assessment) => (
							<Card
								key={assessment.id}
								className="hover:shadow-lg transition-shadow"
							>
								<CardHeader>
									<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
										<div className="space-y-2">
											<div className="flex items-center gap-3">
												<CardTitle className="ft-serif text-xl">
													{assessment.title}
												</CardTitle>
												<Badge variant="outline">{assessment.framework}</Badge>
											</div>
											<div className="flex items-center gap-4 text-sm text-slate-600">
												<div className="flex items-center gap-1">
													<Calendar className="h-4 w-4" />
													Created:{" "}
													{new Date(assessment.createdAt).toLocaleDateString()}
												</div>
												{assessment.completedAt && (
													<div className="flex items-center gap-1">
														<CheckCircle className="h-4 w-4" />
														Completed:{" "}
														{new Date(
															assessment.completedAt,
														).toLocaleDateString()}
													</div>
												)}
											</div>
										</div>

										<div className="flex items-center gap-4">
											<Badge
												className={getStatusColor(assessment.status)}
												variant="secondary"
											>
												{assessment.status.charAt(0).toUpperCase() +
													assessment.status.slice(1)}
											</Badge>
											{assessment.score && (
												<div className="text-center">
													<div
														className={`ft-serif font-bold text-2xl ${getScoreColor(assessment.score)}`}
													>
														{assessment.score}%
													</div>
													<div className="ft-sans text-xs text-slate-500">
														Score
													</div>
												</div>
											)}
										</div>
									</div>
								</CardHeader>

								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
										<div className="space-y-2">
											<p className="ft-sans font-medium text-sm text-slate-700">
												Evidence Collected
											</p>
											<div className="flex items-center gap-2">
												<FileText className="h-4 w-4 text-slate-400" />
												<span className="ft-sans text-slate-600">
													{assessment.evidenceCount} items
												</span>
											</div>
										</div>

										<div className="space-y-2">
											<p className="ft-sans font-medium text-sm text-slate-700">
												Findings
											</p>
											<div className="flex gap-2">
												{assessment.findings.critical > 0 && (
													<Badge variant="destructive" className="text-xs">
														{assessment.findings.critical} Critical
													</Badge>
												)}
												{assessment.findings.high > 0 && (
													<Badge
														variant="secondary"
														className="text-xs bg-orange-100 text-orange-800"
													>
														{assessment.findings.high} High
													</Badge>
												)}
												{assessment.findings.medium > 0 && (
													<Badge
														variant="secondary"
														className="text-xs bg-yellow-100 text-yellow-800"
													>
														{assessment.findings.medium} Medium
													</Badge>
												)}
												{assessment.findings.low > 0 && (
													<Badge variant="secondary" className="text-xs">
														{assessment.findings.low} Low
													</Badge>
												)}
											</div>
										</div>

										<div className="space-y-2">
											<p className="ft-sans font-medium text-sm text-slate-700">
												Actions
											</p>
											<div className="flex gap-2">
												<Button size="sm" variant="outline" asChild>
													<Link href={`/assessments/${assessment.id}`}>
														View Details
													</Link>
												</Button>
												{assessment.status === "completed" && (
													<Button size="sm" variant="outline" asChild>
														<Link href={`/assessments/${assessment.id}/report`}>
															Download Report
														</Link>
													</Button>
												)}
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{filteredAssessments.length === 0 && (
						<div className="text-center py-12">
							<BarChart3 className="mx-auto h-12 w-12 text-slate-400" />
							<h3 className="ft-serif font-medium text-lg text-slate-900 mt-4">
								No assessments found
							</h3>
							<p className="ft-sans text-slate-600 mt-2">
								Try adjusting your search terms or create a new assessment.
							</p>
							<Button className="mt-4" asChild>
								<Link href="/assessments/new">
									Create New Assessment
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					)}
				</div>
			</section>

			{/* Quick Actions */}
			<section className="bg-slate-50 py-20">
				<div className="container mx-auto px-4">
					<div className="max-w-4xl mx-auto text-center space-y-8">
						<h2 className="ft-serif font-bold text-3xl text-slate-900">
							Assessment Tools
						</h2>
						<p className="ft-sans text-slate-600 text-lg">
							Powerful tools to streamline your compliance assessment process
						</p>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
							<Card>
								<CardContent className="pt-6 text-center">
									<div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
										<BarChart3 className="h-6 w-6 text-blue-600" />
									</div>
									<h3 className="ft-serif font-semibold text-lg mb-2">
										Gap Analysis
									</h3>
									<p className="ft-sans text-slate-600 text-sm mb-4">
										Comprehensive gap analysis across frameworks
									</p>
									<Button size="sm" variant="outline" asChild>
										<Link href="/assessments/gap-analysis">Start Analysis</Link>
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="pt-6 text-center">
									<div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
										<FileText className="h-6 w-6 text-green-600" />
									</div>
									<h3 className="ft-serif font-semibold text-lg mb-2">
										Evidence Review
									</h3>
									<p className="ft-sans text-slate-600 text-sm mb-4">
										AI-powered evidence assessment and validation
									</p>
									<Button size="sm" variant="outline" asChild>
										<Link href="/evidence">Review Evidence</Link>
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="pt-6 text-center">
									<div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
										<TrendingUp className="h-6 w-6 text-purple-600" />
									</div>
									<h3 className="ft-serif font-semibold text-lg mb-2">
										Progress Tracking
									</h3>
									<p className="ft-sans text-slate-600 text-sm mb-4">
										Real-time compliance progress monitoring
									</p>
									<Button size="sm" variant="outline" asChild>
										<Link href="/dashboard">View Dashboard</Link>
									</Button>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}
