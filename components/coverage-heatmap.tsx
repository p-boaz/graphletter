"use client";

import {
	AlertTriangle,
	BarChart3,
	CheckCircle,
	RefreshCw,
	Target,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FrameworkCoverageHeatmap {
	framework_name: string;
	total_controls: number;
	controls_covered: number;
	coverage_percentage: number;
	high_confidence_controls: number;
	medium_confidence_controls: number;
	low_confidence_controls: number;
	last_updated: string;
}

export function CoverageHeatmap() {
	const [heatmapData, setHeatmapData] = useState<FrameworkCoverageHeatmap[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const loadHeatmapData = useCallback(async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/enhanced/search?action=heatmap");
			if (response.ok) {
				const result = await response.json();
				setHeatmapData(result.data || []);
			}
		} catch (error) {
			console.error("Error loading heatmap data:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	const refreshData = useCallback(async () => {
		setRefreshing(true);
		try {
			await fetch("/api/enhanced/search?action=refresh");
			await loadHeatmapData();
		} catch (error) {
			console.error("Error refreshing data:", error);
		} finally {
			setRefreshing(false);
		}
	}, [loadHeatmapData]);

	useEffect(() => {
		loadHeatmapData();
	}, [loadHeatmapData]);

	const getCoverageColor = (percentage: number) => {
		if (percentage >= 90) return "bg-green-500";
		if (percentage >= 70) return "bg-blue-500";
		if (percentage >= 50) return "bg-yellow-500";
		if (percentage >= 30) return "bg-orange-500";
		return "bg-red-500";
	};

	const getCoverageColorClass = (percentage: number) => {
		if (percentage >= 90) return "text-green-700 bg-green-50";
		if (percentage >= 70) return "text-blue-700 bg-blue-50";
		if (percentage >= 50) return "text-yellow-700 bg-yellow-50";
		if (percentage >= 30) return "text-orange-700 bg-orange-50";
		return "text-red-700 bg-red-50";
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="font-bold text-2xl text-slate-900">
							Framework Coverage Heatmap
						</h2>
						<p className="text-slate-600">Loading coverage analysis...</p>
					</div>
				</div>
				<div className="grid gap-6">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardContent className="p-6">
								<div className="mb-4 h-4 w-3/4 rounded bg-slate-200"></div>
								<div className="h-8 w-full rounded bg-slate-200"></div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	const totalFrameworks = heatmapData.length;
	const averageCoverage =
		heatmapData.length > 0
			? heatmapData.reduce((sum, item) => sum + item.coverage_percentage, 0) /
				heatmapData.length
			: 0;
	const totalControlsCovered = heatmapData.reduce(
		(sum, item) => sum + item.controls_covered,
		0,
	);
	const highConfidenceTotal = heatmapData.reduce(
		(sum, item) => sum + item.high_confidence_controls,
		0,
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-bold text-2xl text-slate-900">
						Framework Coverage Heatmap
					</h2>
					<p className="text-slate-600">
						Visual analysis of framework coverage and control distribution
					</p>
				</div>
				<Button
					onClick={refreshData}
					disabled={refreshing}
					variant="outline"
					className="flex items-center space-x-2"
				>
					<RefreshCw
						className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
					/>
					<span>{refreshing ? "Refreshing..." : "Refresh Data"}</span>
				</Button>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center space-x-2">
							<Target className="h-5 w-5 text-blue-600" />
							<span className="font-medium text-slate-600 text-sm">
								Frameworks
							</span>
						</div>
						<div className="mt-2">
							<span className="font-bold text-2xl">{totalFrameworks}</span>
							<p className="mt-1 text-slate-500 text-xs">
								Total frameworks analyzed
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center space-x-2">
							<TrendingUp className="h-5 w-5 text-green-600" />
							<span className="font-medium text-slate-600 text-sm">
								Avg Coverage
							</span>
						</div>
						<div className="mt-2">
							<span className="font-bold text-2xl">
								{averageCoverage.toFixed(1)}%
							</span>
							<Progress value={averageCoverage} className="mt-2" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center space-x-2">
							<BarChart3 className="h-5 w-5 text-purple-600" />
							<span className="font-medium text-slate-600 text-sm">
								Total Controls
							</span>
						</div>
						<div className="mt-2">
							<span className="font-bold text-2xl">{totalControlsCovered}</span>
							<p className="mt-1 text-slate-500 text-xs">Controls covered</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center space-x-2">
							<CheckCircle className="h-5 w-5 text-emerald-600" />
							<span className="font-medium text-slate-600 text-sm">
								High Confidence
							</span>
						</div>
						<div className="mt-2">
							<span className="font-bold text-2xl">{highConfidenceTotal}</span>
							<p className="mt-1 text-slate-500 text-xs">
								High-confidence controls
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Coverage Heatmap */}
			<Card>
				<CardHeader>
					<CardTitle>Framework Coverage Analysis</CardTitle>
					<CardDescription>
						Visual representation of control coverage across all frameworks
					</CardDescription>
				</CardHeader>
				<CardContent>
					{heatmapData.length > 0 ? (
						<div className="space-y-4">
							{heatmapData
								.sort((a, b) => b.coverage_percentage - a.coverage_percentage)
								.map((framework, index) => (
									<div
										key={index}
										className="rounded-lg border p-4 transition-colors hover:bg-slate-50"
									>
										<div className="mb-3 flex items-center justify-between">
											<div className="flex-1">
												<div className="mb-2 flex items-center justify-between">
													<h3 className="font-medium text-slate-900">
														{framework.framework_name}
													</h3>
													<div className="flex items-center space-x-2">
														<Badge
															className={getCoverageColorClass(
																framework.coverage_percentage,
															)}
														>
															{framework.coverage_percentage.toFixed(1)}%
															coverage
														</Badge>
														<Badge variant="outline">
															{framework.controls_covered}/
															{framework.total_controls} controls
														</Badge>
													</div>
												</div>

												<div className="mb-3">
													<div className="mb-1 flex items-center justify-between text-slate-600 text-sm">
														<span>Coverage Progress</span>
														<span>
															{framework.controls_covered} of{" "}
															{framework.total_controls}
														</span>
													</div>
													<div className="h-3 w-full rounded-full bg-slate-200">
														<div
															className={`h-3 rounded-full transition-all duration-500 ${getCoverageColor(
																framework.coverage_percentage,
															)}`}
															style={{
																width: `${framework.coverage_percentage}%`,
															}}
														/>
													</div>
												</div>

												<div className="grid grid-cols-3 gap-4 text-sm">
													<div className="rounded bg-green-50 p-2 text-center">
														<div className="font-medium text-green-800">
															{framework.high_confidence_controls}
														</div>
														<div className="text-green-600 text-xs">
															High Confidence
														</div>
													</div>
													<div className="rounded bg-yellow-50 p-2 text-center">
														<div className="font-medium text-yellow-800">
															{framework.medium_confidence_controls}
														</div>
														<div className="text-xs text-yellow-600">
															Medium Confidence
														</div>
													</div>
													<div className="rounded bg-red-50 p-2 text-center">
														<div className="font-medium text-red-800">
															{framework.low_confidence_controls}
														</div>
														<div className="text-red-600 text-xs">
															Low Confidence
														</div>
													</div>
												</div>

												<div className="mt-3 text-slate-500 text-xs">
													Last updated:{" "}
													{new Date(
														framework.last_updated,
													).toLocaleDateString()}
												</div>
											</div>
										</div>
									</div>
								))}
						</div>
					) : (
						<div className="py-8 text-center">
							<AlertTriangle className="mx-auto mb-4 h-12 w-12 text-slate-400" />
							<h3 className="mb-2 font-medium text-lg text-slate-900">
								No Coverage Data
							</h3>
							<p className="text-slate-600">
								No framework coverage data is available yet. Import framework
								data or create mappings to see coverage analysis.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Coverage Distribution */}
			<Card>
				<CardHeader>
					<CardTitle>Coverage Distribution</CardTitle>
					<CardDescription>
						Framework distribution by coverage levels
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						{[
							{ label: "Excellent (90%+)", color: "bg-green-500", min: 90 },
							{ label: "Good (70-89%)", color: "bg-blue-500", min: 70 },
							{ label: "Fair (50-69%)", color: "bg-yellow-500", min: 50 },
							{ label: "Poor (<50%)", color: "bg-red-500", min: 0 },
						].map((level, index) => {
							const count = heatmapData.filter((f) => {
								if (index === 0) return f.coverage_percentage >= 90;
								if (index === 1)
									return (
										f.coverage_percentage >= 70 && f.coverage_percentage < 90
									);
								if (index === 2)
									return (
										f.coverage_percentage >= 50 && f.coverage_percentage < 70
									);
								return f.coverage_percentage < 50;
							}).length;

							return (
								<div key={index} className="rounded-lg border p-4 text-center">
									<div
										className={`h-8 w-8 ${level.color} mx-auto mb-2 rounded-full`}
									/>
									<div className="font-medium text-slate-900">{count}</div>
									<div className="text-slate-600 text-xs">{level.label}</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
