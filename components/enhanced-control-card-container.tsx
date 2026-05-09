"use client";

import { useEnhancedControl } from "@/lib/hooks/use-enhanced-control";
import { EnhancedControlCard } from "./enhanced-control-card";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

interface EnhancedControlCardContainerProps {
	controlId: string;
	controlTitle: string;
	domainId: string;
	hasEvidence: boolean;
	hasAssessment: boolean;
	assessmentResult?: string | null;
	lastUpdated?: string | null;
	gapType:
		| "no_evidence"
		| "no_assessment"
		| "failed_assessment"
		| "partial_compliance"
		| "conflicting_evidence"
		| "compliant";
	onUploadEvidence?: () => void;
}

export function EnhancedControlCardContainer(
	props: EnhancedControlCardContainerProps,
) {
	const { data, loading, error } = useEnhancedControl(props.controlId);

	if (loading) {
		return (
			<Card className="border-indigo-100 bg-white shadow-sm">
				<CardContent className="p-4">
					<div className="space-y-3">
						<div className="flex gap-2">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-3 w-3/4" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		// Fallback to basic control card if enhanced data fails to load
		return (
			<Card className="border-indigo-100 bg-white shadow-sm">
				<CardContent className="p-4">
					<div className="text-xs text-red-500 mb-2">
						Failed to load enhanced data: {error}
					</div>
					<EnhancedControlCard
						{...props}
						risks={[]}
						threats={[]}
						maturityLevels={null}
					/>
				</CardContent>
			</Card>
		);
	}

	if (!data) {
		// Fallback to basic display
		return (
			<EnhancedControlCard
				{...props}
				risks={[]}
				threats={[]}
				maturityLevels={null}
			/>
		);
	}

	return (
		<EnhancedControlCard
			{...props}
			risks={data.risks}
			threats={data.threats}
			maturityLevels={data.maturity_levels}
		/>
	);
}
