"use client";

import { BookOpen, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GapGuidanceCardProps {
	erlId: string;
	artifact: string;
	artifactDescription: string;
	controlIds: string[];
}

interface GuidanceData {
	guidance: string;
	exampleSections: string[];
	estimatedEffort: "low" | "medium" | "high";
	templateFallback: boolean;
}

const EFFORT_STYLES = {
	low: "bg-green-50 text-green-700",
	medium: "bg-yellow-50 text-yellow-700",
	high: "bg-red-50 text-red-700",
} as const;

export function GapGuidanceCard({
	erlId,
	artifact,
	artifactDescription,
	controlIds,
}: GapGuidanceCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [loading, setLoading] = useState(false);
	const [guidance, setGuidance] = useState<GuidanceData | null>(null);
	const [error, setError] = useState(false);

	const handleToggle = async () => {
		if (expanded) {
			setExpanded(false);
			return;
		}

		setExpanded(true);

		if (guidance) return; // Already loaded

		setLoading(true);
		setError(false);

		try {
			const res = await fetch("/api/compliance/gap-guidance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					erlId,
					artifact,
					artifactDescription,
					controlIds,
				}),
			});

			if (res.ok) {
				setGuidance((await res.json()) as GuidanceData);
			} else {
				setError(true);
			}
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleToggle}
				className="gap-1.5 text-slate-600 hover:text-slate-900"
			>
				<BookOpen className="h-3.5 w-3.5" />
				<span>{expanded ? "Hide" : "View"} Guidance</span>
				{expanded ? (
					<ChevronUp className="h-3.5 w-3.5" />
				) : (
					<ChevronDown className="h-3.5 w-3.5" />
				)}
			</Button>

			{expanded && (
				<div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm">
					{loading && (
						<div className="flex items-center gap-2 text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							Generating guidance...
						</div>
					)}

					{error && (
						<p className="text-red-600">
							Failed to load guidance. Please try again.
						</p>
					)}

					{guidance && (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className={EFFORT_STYLES[guidance.estimatedEffort]}
								>
									{guidance.estimatedEffort} effort
								</Badge>
								{guidance.templateFallback && (
									<Badge variant="outline" className="text-xs">
										Template
									</Badge>
								)}
							</div>

							<div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap">
								{guidance.guidance}
							</div>

							{guidance.exampleSections.length > 0 && (
								<div>
									<p className="mb-1.5 font-medium text-slate-700 text-xs">
										Recommended Sections
									</p>
									<div className="flex flex-wrap gap-1">
										{guidance.exampleSections.map((section) => (
											<Badge
												key={section}
												variant="outline"
												className="text-xs"
											>
												{section}
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
