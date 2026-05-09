"use client";

import { AlertCircle, Brain, CheckCircle, Target, Zap } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

interface ControlMatch {
	id: string;
	title: string;
	description: string;
	domain_id: string;
	confidence: number;
	reasoning: string;
	scf_control_mappings?: Array<{
		framework_control_id: string;
		scf_frameworks: {
			framework_name: string;
			framework_version?: string;
		};
	}>;
}

interface FrameworkCoverage {
	frameworkName: string;
	frameworkVersion?: string;
	coveredControls: number;
	controlIds: string[];
}

interface Recommendation {
	type: string;
	priority: "high" | "medium" | "low";
	title: string;
	description: string;
	actionItems: string[];
}

interface MappingResult {
	inputPolicy: {
		text: string;
		wordCount: number;
		analyzedAt: string;
	};
	analysis: {
		concepts: string[];
		matchedControls: ControlMatch[];
		gaps: string[];
		overallAssessment: string;
		totalMatches: number;
		avgConfidence: number;
	};
	frameworkCoverage: FrameworkCoverage[] | null;
	recommendations: Recommendation[];
}

export function CustomControlMapper() {
	const [policyText, setPolicyText] = useState("");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [results, setResults] = useState<MappingResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleAnalyze = async () => {
		if (!policyText.trim() || policyText.trim().length < 10) {
			setError("Please enter at least 10 characters of policy text");
			return;
		}

		setIsAnalyzing(true);
		setError(null);

		try {
			const response = await fetch("/api/ai/custom-control-mapping", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					policyText,
					includeFrameworkCoverage: true,
				}),
			});

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || "Analysis failed");
			}

			setResults(data.data);
		} catch (error) {
			console.error("Analysis error:", error);
			setError(
				error instanceof Error
					? error.message
					: "Failed to analyze policy text",
			);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const handleClear = () => {
		setPolicyText("");
		setResults(null);
		setError(null);
	};

	const getPriorityColor = (
		priority: string,
	): "destructive" | "secondary" | "outline" => {
		switch (priority) {
			case "high":
				return "destructive";
			case "medium":
				return "secondary";
			case "low":
				return "outline";
			default:
				return "outline";
		}
	};

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 80) return "text-green-600";
		if (confidence >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="space-y-1">
					<div className="flex items-center gap-2">
						<Brain className="h-5 w-5 text-blue-600" />
						<CardTitle className="text-xl">AI-Powered Control Mapper</CardTitle>
					</div>
					<CardDescription>
						Paste your custom policy or control text below, and our AI will map
						it to relevant SCF controls and show framework coverage.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="policy-text" className="font-medium text-sm">
							Policy/Control Text
						</label>
						<Textarea
							id="policy-text"
							placeholder="Paste your custom policy, procedure, or control description here. For example:

'All user accounts must be protected with multi-factor authentication. Passwords must be at least 12 characters long and include uppercase, lowercase, numbers, and special characters. Account lockouts must occur after 5 failed login attempts. Administrative accounts require additional approval processes and must be reviewed quarterly.'"
							value={policyText}
							onChange={(e) => setPolicyText(e.target.value)}
							className="min-h-[150px] resize-none"
							disabled={isAnalyzing}
						/>
						<div className="flex items-center justify-between text-muted-foreground text-sm">
							<span>{policyText.length} characters</span>
							<span>
								{policyText.split(/\s+/).filter((w) => w.length > 0).length}{" "}
								words
							</span>
						</div>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="flex gap-2">
						<Button
							onClick={handleAnalyze}
							disabled={isAnalyzing || !policyText.trim()}
							className="flex items-center gap-2"
						>
							{isAnalyzing ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Analyzing...
								</>
							) : (
								<>
									<Zap className="h-4 w-4" />
									Analyze with AI
								</>
							)}
						</Button>
						<Button
							variant="outline"
							onClick={handleClear}
							disabled={isAnalyzing}
						>
							Clear
						</Button>
					</div>
				</CardContent>
			</Card>

			{results && (
				<div className="space-y-6">
					{/* Analysis Overview */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								Analysis Results
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
								<div className="space-y-2">
									<div className="font-bold text-2xl text-blue-600">
										{results.analysis.totalMatches}
									</div>
									<div className="text-muted-foreground text-sm">
										Controls Matched
									</div>
								</div>
								<div className="space-y-2">
									<div
										className={`font-bold text-2xl ${getConfidenceColor(
											results.analysis.avgConfidence,
										)}`}
									>
										{results.analysis.avgConfidence}%
									</div>
									<div className="text-muted-foreground text-sm">
										Avg Confidence
									</div>
								</div>
								<div className="space-y-2">
									<div className="font-bold text-2xl text-green-600">
										{results.analysis.concepts.length}
									</div>
									<div className="text-muted-foreground text-sm">
										Concepts Found
									</div>
								</div>
								<div className="space-y-2">
									<div className="font-bold text-2xl text-purple-600">
										{results.frameworkCoverage?.length || 0}
									</div>
									<div className="text-muted-foreground text-sm">
										Frameworks
									</div>
								</div>
							</div>

							<div className="mt-4 rounded-lg bg-muted p-4">
								<div className="mb-2 font-medium text-sm">
									Overall Assessment
								</div>
								<div className="text-sm">
									{results.analysis.overallAssessment}
								</div>
							</div>
						</CardContent>
					</Card>

					<Tabs defaultValue="controls" className="space-y-4">
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="controls">Matched Controls</TabsTrigger>
							<TabsTrigger value="frameworks">Framework Coverage</TabsTrigger>
							<TabsTrigger value="concepts">Concepts & Gaps</TabsTrigger>
							<TabsTrigger value="recommendations">Recommendations</TabsTrigger>
						</TabsList>

						<TabsContent value="controls" className="space-y-4">
							{results.analysis.matchedControls.length === 0 ? (
								<Card>
									<CardContent className="pt-6">
										<div className="text-center text-muted-foreground">
											No matching controls found. Try refining your policy text.
										</div>
									</CardContent>
								</Card>
							) : (
								results.analysis.matchedControls.map((control) => (
									<Card key={control.id}>
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<CardTitle className="text-lg">
														{control.id}: {control.title}
													</CardTitle>
													<div className="flex items-center gap-2">
														<Badge variant="outline">
															Domain: {control.domain_id}
														</Badge>
														<Badge
															variant={
																control.confidence >= 80
																	? "default"
																	: control.confidence >= 60
																		? "secondary"
																		: "destructive"
															}
														>
															{control.confidence}% confidence
														</Badge>
													</div>
												</div>
											</div>
										</CardHeader>
										<CardContent className="space-y-3">
											<div>
												<div className="mb-1 font-medium text-sm">
													Description
												</div>
												<div className="text-muted-foreground text-sm">
													{control.description.substring(0, 300)}
													{control.description.length > 300 && "..."}
												</div>
											</div>

											<div>
												<div className="mb-1 font-medium text-sm">
													Why This Maps
												</div>
												<div className="text-muted-foreground text-sm">
													{control.reasoning}
												</div>
											</div>

											{control.scf_control_mappings &&
												control.scf_control_mappings.length > 0 && (
													<div>
														<div className="mb-2 font-medium text-sm">
															Framework Mappings
														</div>
														<div className="flex flex-wrap gap-1">
															{control.scf_control_mappings
																.slice(0, 8)
																.map((mapping, idx) => (
																	<Badge
																		key={idx}
																		variant="outline"
																		className="text-xs"
																	>
																		{mapping.scf_frameworks.framework_name}
																		{mapping.scf_frameworks.framework_version &&
																			` ${mapping.scf_frameworks.framework_version}`}
																	</Badge>
																))}
															{control.scf_control_mappings.length > 8 && (
																<Badge variant="secondary" className="text-xs">
																	+{control.scf_control_mappings.length - 8}{" "}
																	more
																</Badge>
															)}
														</div>
													</div>
												)}
										</CardContent>
									</Card>
								))
							)}
						</TabsContent>

						<TabsContent value="frameworks" className="space-y-4">
							{!results.frameworkCoverage ||
							results.frameworkCoverage.length === 0 ? (
								<Card>
									<CardContent className="pt-6">
										<div className="text-center text-muted-foreground">
											No framework coverage data available.
										</div>
									</CardContent>
								</Card>
							) : (
								<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
									{results.frameworkCoverage.map((framework, index) => (
										<Card key={index}>
											<CardHeader>
												<CardTitle className="text-lg">
													{framework.frameworkName}
												</CardTitle>
												{framework.frameworkVersion && (
													<CardDescription>
														Version: {framework.frameworkVersion}
													</CardDescription>
												)}
											</CardHeader>
											<CardContent>
												<div className="space-y-3">
													<div className="flex items-center justify-between">
														<span className="font-medium text-sm">
															Controls Covered
														</span>
														<span className="font-bold text-blue-600 text-lg">
															{framework.coveredControls}
														</span>
													</div>
													<div className="text-muted-foreground text-xs">
														Control IDs:{" "}
														{framework.controlIds.slice(0, 5).join(", ")}
														{framework.controlIds.length > 5 &&
															` +${framework.controlIds.length - 5} more`}
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</TabsContent>

						<TabsContent value="concepts" className="space-y-4">
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<CheckCircle className="h-5 w-5 text-green-600" />
											Identified Concepts
										</CardTitle>
									</CardHeader>
									<CardContent>
										{results.analysis.concepts.length === 0 ? (
											<div className="text-muted-foreground text-sm">
												No concepts identified
											</div>
										) : (
											<div className="flex flex-wrap gap-2">
												{results.analysis.concepts.map((concept, index) => (
													<Badge key={index} variant="secondary">
														{concept}
													</Badge>
												))}
											</div>
										)}
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<AlertCircle className="h-5 w-5 text-yellow-600" />
											Identified Gaps
										</CardTitle>
									</CardHeader>
									<CardContent>
										{results.analysis.gaps.length === 0 ? (
											<div className="text-muted-foreground text-sm">
												No gaps identified
											</div>
										) : (
											<ul className="space-y-2">
												{results.analysis.gaps.map((gap, index) => (
													<li
														key={index}
														className="flex items-start gap-2 text-muted-foreground text-sm"
													>
														<span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-600" />
														{gap}
													</li>
												))}
											</ul>
										)}
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent value="recommendations" className="space-y-4">
							{results.recommendations.map((rec, index) => (
								<Card key={index}>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-1">
												<CardTitle className="text-lg">{rec.title}</CardTitle>
												<CardDescription>{rec.description}</CardDescription>
											</div>
											<Badge variant={getPriorityColor(rec.priority)}>
												{rec.priority} priority
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="font-medium text-sm">Action Items:</div>
											<ul className="space-y-1">
												{rec.actionItems.map((item, itemIndex) => (
													<li
														key={itemIndex}
														className="flex items-start gap-2 text-muted-foreground text-sm"
													>
														<span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-600" />
														{item}
													</li>
												))}
											</ul>
										</div>
									</CardContent>
								</Card>
							))}
						</TabsContent>
					</Tabs>
				</div>
			)}
		</div>
	);
}
