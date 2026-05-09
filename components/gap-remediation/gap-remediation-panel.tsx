"use client";

import { AlertTriangle, FileUp, Loader2, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GapGuidanceCard } from "./gap-guidance-card";
import { GapSummaryClipboard } from "./gap-summary-clipboard";
import { LeverageBadge } from "./leverage-badge";

interface Remediation {
	erlId: string;
	artifact: string;
	artifactDescription: string;
	areaOfFocus: string;
	controlsCovered: string[];
	controlsOverlap: number;
	priority: number;
}

interface RemediationResponse {
	remediations: Remediation[];
	totalGaps: number;
	gapBreakdown: {
		missing: number;
		partial: number;
		conflicting: number;
	};
}

interface GapRemediationPanelProps {
	frameworkId?: string;
	frameworkName?: string;
	controlIds?: string[];
	onStartUpload?: (artifactName: string, controlIds: string[]) => void;
}

export function GapRemediationPanel({
	frameworkId,
	frameworkName,
	controlIds,
	onStartUpload,
}: GapRemediationPanelProps) {
	const [data, setData] = useState<RemediationResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchRemediations = async () => {
			setLoading(true);
			setError(null);

			try {
				const res = await fetch("/api/compliance/gap-remediation", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ frameworkId, frameworkName, controlIds }),
				});

				if (!res.ok) {
					const err = (await res.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(err.error || "Failed to load remediations");
				}

				setData((await res.json()) as RemediationResponse);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setLoading(false);
			}
		};

		fetchRemediations();
	}, [frameworkId, frameworkName, controlIds]);

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center gap-2 py-8">
					<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
					<span className="text-slate-500 text-sm">
						Analyzing gap remediations...
					</span>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
					<p className="text-slate-600 text-sm">{error}</p>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.remediations.length === 0) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<Target className="mx-auto mb-2 h-8 w-8 text-green-500" />
					<p className="font-medium text-slate-900">No gaps to remediate</p>
					<p className="mt-1 text-slate-500 text-sm">
						All controls have sufficient evidence coverage.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5 text-amber-500" />
							Gap Remediation
							{frameworkName && (
								<Badge variant="outline" className="font-normal">
									{frameworkName}
								</Badge>
							)}
						</CardTitle>
						<CardDescription className="mt-1">
							{data.totalGaps} control{data.totalGaps !== 1 ? "s" : ""} need
							evidence — {data.remediations.length} artifact
							{data.remediations.length !== 1 ? "s" : ""} recommended
						</CardDescription>
					</div>
					<GapSummaryClipboard
						frameworkName={frameworkName}
						totalGaps={data.totalGaps}
						gapBreakdown={data.gapBreakdown}
						remediations={data.remediations}
					/>
				</div>

				{/* Gap breakdown badges */}
				<div className="mt-2 flex gap-2">
					{data.gapBreakdown.missing > 0 && (
						<Badge variant="secondary" className="bg-red-50 text-red-700">
							{data.gapBreakdown.missing} missing
						</Badge>
					)}
					{data.gapBreakdown.partial > 0 && (
						<Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
							{data.gapBreakdown.partial} partial
						</Badge>
					)}
					{data.gapBreakdown.conflicting > 0 && (
						<Badge variant="secondary" className="bg-orange-50 text-orange-700">
							{data.gapBreakdown.conflicting} conflicting
						</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent>
				<div className="space-y-4">
					{data.remediations.map((rem) => (
						<div
							key={rem.erlId}
							className="rounded-lg border p-4 transition-colors hover:bg-slate-50"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-slate-900 text-sm">
											{rem.artifact}
										</p>
										<Badge
											variant="outline"
											className="shrink-0 font-mono text-[10px]"
										>
											{rem.erlId}
										</Badge>
									</div>
									<p className="mt-0.5 text-slate-500 text-xs">
										{rem.areaOfFocus}
									</p>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<Badge
											variant="secondary"
											className="bg-blue-50 text-blue-700 text-xs"
										>
											{rem.controlsOverlap} gap control
											{rem.controlsOverlap !== 1 ? "s" : ""}
										</Badge>
										<LeverageBadge controlIds={rem.controlsCovered} />
									</div>
								</div>

								{onStartUpload && (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											onStartUpload(rem.artifact, rem.controlsCovered)
										}
										className="shrink-0 gap-1.5"
									>
										<FileUp className="h-3.5 w-3.5" />
										Upload
									</Button>
								)}
							</div>

							{rem.artifactDescription && (
								<p className="mt-2 text-slate-600 text-xs leading-relaxed">
									{rem.artifactDescription}
								</p>
							)}

							<div className="mt-2">
								<GapGuidanceCard
									erlId={rem.erlId}
									artifact={rem.artifact}
									artifactDescription={rem.artifactDescription}
									controlIds={rem.controlsCovered}
								/>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
