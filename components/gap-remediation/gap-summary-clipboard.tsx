"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface GapSummaryClipboardProps {
	frameworkName?: string;
	totalGaps: number;
	gapBreakdown: {
		missing: number;
		partial: number;
		conflicting: number;
	};
	remediations: Array<{
		artifact: string;
		controlsOverlap: number;
		areaOfFocus: string;
	}>;
}

export function GapSummaryClipboard({
	frameworkName,
	totalGaps,
	gapBreakdown,
	remediations,
}: GapSummaryClipboardProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const lines = [
			`## Gap Analysis Summary${frameworkName ? ` — ${frameworkName}` : ""}`,
			"",
			`**${totalGaps} controls** require attention:`,
			`- Missing: ${gapBreakdown.missing}`,
			`- Partial: ${gapBreakdown.partial}`,
			`- Conflicting: ${gapBreakdown.conflicting}`,
			"",
		];

		if (remediations.length > 0) {
			lines.push("### Top Remediation Actions");
			lines.push("");
			for (const r of remediations.slice(0, 5)) {
				lines.push(
					`- **${r.artifact}** (${r.areaOfFocus}) — covers ${r.controlsOverlap} gap control${r.controlsOverlap !== 1 ? "s" : ""}`,
				);
			}
			if (remediations.length > 5) {
				lines.push(`- ... and ${remediations.length - 5} more artifacts`);
			}
		}

		await navigator.clipboard.writeText(lines.join("\n"));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleCopy}
			className="gap-1.5"
		>
			{copied ? (
				<>
					<Check className="h-3.5 w-3.5 text-green-600" />
					<span className="text-green-600">Copied</span>
				</>
			) : (
				<>
					<Copy className="h-3.5 w-3.5" />
					<span>Copy Summary</span>
				</>
			)}
		</Button>
	);
}
