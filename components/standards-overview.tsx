"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Plus,
	Shield,
	TrendingUp,
	XCircle,
} from "lucide-react";
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

export function StandardsOverview() {
	type ComplianceStatus = {
		total: number;
		compliant: number;
		partial: number;
		nonCompliant: number;
		notAssessed: number;
	};

	const standards = [
		{
			id: "iso-iec-81001",
			name: "ISO-IEC 81001",
			version: "2021",
			description:
				"Health informatics — Health software — Part 1: General requirements for product safety",
			status: "active",
			compliance: {
				total: 42,
				compliant: 28,
				partial: 8,
				nonCompliant: 4,
				notAssessed: 2,
			},
			lastAssessed: "2024-01-15",
			trend: "+5.2%",
		},
		{
			id: "nist-sp-800-218",
			name: "NIST SP 800-218",
			version: "2022",
			description: "Secure Software Development Framework (SSDF) Version 1.1",
			status: "mapping",
			compliance: {
				total: 36,
				compliant: 17,
				partial: 12,
				nonCompliant: 4,
				notAssessed: 3,
			},
			lastAssessed: "2024-01-20",
			trend: "+2.8%",
		},
	];

	const getComplianceScore = (compliance: ComplianceStatus) => {
		return Math.round(
			((compliance.compliant + compliance.partial * 0.5) / compliance.total) *
				100,
		);
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "active":
				return (
					<Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-body font-medium text-emerald-700">
						<div className="mr-2 h-2 w-2 rounded-full bg-emerald-500"></div>
						Active
					</Badge>
				);
			case "mapping":
				return (
					<Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-body font-medium text-blue-700">
						<div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
						AI Mapping
					</Badge>
				);
			default:
				return <Badge variant="secondary">{status}</Badge>;
		}
	};

	return (
		<div className="space-y-8">
			{/* Elegant Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<h2 className="font-display font-semibold text-3xl text-slate-900">
						Standards Overview
					</h2>
					<p className="font-body font-light text-lg text-slate-600">
						Comprehensive compliance framework management and assessment
					</p>
				</div>
				<Button className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-3 font-body font-medium text-white shadow-elegant transition-all duration-200 hover:scale-105 hover:from-slate-800 hover:to-slate-600 hover:shadow-lg">
					<Plus className="mr-2 h-4 w-4" />
					Add Standard
				</Button>
			</div>

			{/* Standards Grid */}
			<div className="grid gap-8">
				{standards.map((standard, index) => (
					<Card
						key={standard.id}
						className="group relative animate-slide-up overflow-hidden border-0 bg-white/80 shadow-elegant backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-elegant-lg"
						style={{ animationDelay: `${index * 100}ms` }}
					>
						{/* Gradient Border Effect */}
						<div className="absolute inset-0 bg-gradient-to-r from-slate-200/50 via-transparent to-slate-200/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

						<CardHeader className="relative border-slate-100/60 border-b bg-gradient-to-r from-slate-50/50 to-white/50 p-8">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-4">
									<div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-3 shadow-lg">
										<Shield className="h-6 w-6 text-white" />
									</div>
									<div className="space-y-1">
										<CardTitle className="font-display font-semibold text-2xl text-slate-900">
											{standard.name}
										</CardTitle>
										<CardDescription className="max-w-2xl font-body font-light text-base text-slate-600">
											{standard.description}
										</CardDescription>
									</div>
								</div>
								<div className="flex items-center space-x-3">
									{getStatusBadge(standard.status)}
									<div className="flex items-center space-x-1 font-body font-medium text-emerald-600 text-sm">
										<TrendingUp className="h-4 w-4" />
										{standard.trend}
									</div>
								</div>
							</div>
						</CardHeader>

						<CardContent className="relative p-8">
							<div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
								{/* Compliance Progress */}
								<div className="space-y-6">
									<div className="relative rounded-2xl border border-slate-100/60 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
										<div className="mb-4 flex items-center justify-between">
											<span className="font-body font-medium text-slate-700 text-sm uppercase tracking-wider">
												Compliance Progress
											</span>
											<span className="font-display font-semibold text-2xl text-slate-900">
												{getComplianceScore(standard.compliance)}%
											</span>
										</div>
										<Progress
											value={getComplianceScore(standard.compliance)}
											className="mb-6 h-3 bg-slate-200"
										/>

										<div className="grid grid-cols-2 gap-4">
											<div className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-white p-3">
												<div className="rounded-lg bg-emerald-100 p-2">
													<CheckCircle2 className="h-4 w-4 text-emerald-600" />
												</div>
												<div>
													<div className="font-display font-semibold text-lg text-slate-900">
														{standard.compliance.compliant}
													</div>
													<div className="font-body text-slate-500 text-xs">
														Compliant
													</div>
												</div>
											</div>

											<div className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-white p-3">
												<div className="rounded-lg bg-amber-100 p-2">
													<AlertCircle className="h-4 w-4 text-amber-600" />
												</div>
												<div>
													<div className="font-display font-semibold text-lg text-slate-900">
														{standard.compliance.partial}
													</div>
													<div className="font-body text-slate-500 text-xs">
														Partial
													</div>
												</div>
											</div>

											<div className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-white p-3">
												<div className="rounded-lg bg-red-100 p-2">
													<XCircle className="h-4 w-4 text-red-500" />
												</div>
												<div>
													<div className="font-display font-semibold text-lg text-slate-900">
														{standard.compliance.nonCompliant}
													</div>
													<div className="font-body text-slate-500 text-xs">
														Non-compliant
													</div>
												</div>
											</div>

											<div className="flex items-center space-x-3 rounded-xl border border-slate-100 bg-white p-3">
												<div className="rounded-lg bg-slate-100 p-2">
													<Clock className="h-4 w-4 text-slate-500" />
												</div>
												<div>
													<div className="font-display font-semibold text-lg text-slate-900">
														{standard.compliance.notAssessed}
													</div>
													<div className="font-body text-slate-500 text-xs">
														Not assessed
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Standard Details */}
								<div className="space-y-6">
									<div className="space-y-4">
										<div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4">
											<span className="font-body font-medium text-slate-700">
												Version
											</span>
											<span className="font-body font-semibold text-slate-900">
												{standard.version}
											</span>
										</div>
										<div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4">
											<span className="font-body font-medium text-slate-700">
												Total Controls
											</span>
											<span className="font-body font-semibold text-slate-900">
												{standard.compliance.total}
											</span>
										</div>
										<div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4">
											<span className="font-body font-medium text-slate-700">
												Last Assessed
											</span>
											<span className="font-body font-semibold text-slate-900">
												{standard.lastAssessed}
											</span>
										</div>
									</div>

									<div className="flex space-x-3 pt-4">
										<Button
											variant="outline"
											className="flex-1 rounded-xl border-slate-200 font-body font-medium text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
										>
											View Details
										</Button>
										<Button
											variant="outline"
											className="flex-1 rounded-xl border-slate-200 font-body font-medium text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
										>
											Export Report
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
