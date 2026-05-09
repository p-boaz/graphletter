"use client";

import { Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface LeverageBadgeProps {
	controlIds: string[];
}

interface FrameworkImpact {
	total_frameworks_impacted: number;
	frameworks: Array<{
		framework_name: string;
		controls_advanced: number;
	}>;
}

export function LeverageBadge({ controlIds }: LeverageBadgeProps) {
	const [impact, setImpact] = useState<FrameworkImpact | null>(null);

	useEffect(() => {
		if (controlIds.length === 0) return;

		const fetchImpact = async () => {
			try {
				const res = await fetch("/api/controls/framework-impact", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ controlIds }),
				});
				if (res.ok) {
					setImpact((await res.json()) as FrameworkImpact);
				}
			} catch {
				// Non-critical
			}
		};

		fetchImpact();
	}, [controlIds]);

	if (!impact || impact.total_frameworks_impacted === 0) return null;

	return (
		<Badge
			variant="secondary"
			className="gap-1 bg-purple-50 text-purple-700 text-xs"
		>
			<Layers className="h-3 w-3" />
			{impact.total_frameworks_impacted} framework
			{impact.total_frameworks_impacted !== 1 ? "s" : ""}
		</Badge>
	);
}
