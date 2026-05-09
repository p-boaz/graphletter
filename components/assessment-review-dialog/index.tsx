"use client";

import { AlertCircle, ArrowLeft, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DetailedView } from "./detailed-view";
import { SummaryView } from "./summary-view";
import type { AssessmentReviewDialogProps } from "./types";
import { buildDistributionSegments, getOverallScore } from "./utils";

export type { AssessmentResult, AssessmentReviewResult } from "./types";

export function AssessmentReviewDialog({
	isOpen,
	onClose,
	result,
	onApprove,
	onReject,
	title = "Assessment Review Required",
	description = "Please review the AI assessment results before finalizing",
	controlIds,
}: AssessmentReviewDialogProps) {
	const [showDetailedView, setShowDetailedView] = useState(false);
	const [rejectionReason, setRejectionReason] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);

	if (!isOpen || !result || result.assessments.length === 0) {
		return null;
	}

	const distributionSegments = buildDistributionSegments(result);

	const handleExportJson = () => {
		const assessmentCounts = result.assessments.reduce(
			(counts, assessment) => {
				if (assessment.overall_result === "pass") counts.pass += 1;
				else if (assessment.overall_result === "fail") counts.fail += 1;
				else if (assessment.overall_result === "partial") counts.partial += 1;
				else counts.notApplicable += 1;
				return counts;
			},
			{ pass: 0, fail: 0, partial: 0, notApplicable: 0 },
		);

		const exportPayload = {
			exported_at: new Date().toISOString(),
			source: result.source,
			summary: {
				total_assessments: result.assessments.length,
				overall_score: getOverallScore(result),
				distribution: assessmentCounts,
			},
			assessments: result.assessments,
		};

		const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		const safeName = result.source.name
			.replace(/[^a-zA-Z0-9-_]+/g, "-")
			.toLowerCase();
		link.href = url;
		link.download = `assessment-results-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		toast.success("Assessment results exported as JSON");
	};

	const handleApprove = async () => {
		setIsProcessing(true);
		try {
			await onApprove();
			toast.success("Assessment approved and saved successfully!");
			onClose();
		} catch (error) {
			console.error("Error approving assessment:", error);
			toast.error("Failed to approve assessment");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleReject = async () => {
		setIsProcessing(true);
		try {
			await onReject(rejectionReason);
			toast.success(
				"Assessment rejected. You can run a new assessment if needed.",
			);
			setRejectionReason("");
			onClose();
		} catch (error) {
			console.error("Error rejecting assessment:", error);
			toast.error("Failed to reject assessment");
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className={`max-h-[90vh] overflow-y-auto ${showDetailedView ? "max-w-6xl" : "max-w-4xl"} transition-all duration-300`}
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{showDetailedView ? (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDetailedView(false)}
									className="flex items-center gap-2 -ml-2 mr-2"
								>
									<ArrowLeft className="h-4 w-4" />
								</Button>
								<span className="flex items-center gap-2">
									<Eye className="h-5 w-5 text-blue-600" />
									Assessment Details
								</span>
							</>
						) : (
							<>
								<AlertCircle className="h-5 w-5 text-yellow-600" />
								{title}
							</>
						)}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{showDetailedView ? (
						<DetailedView result={result} />
					) : (
						<SummaryView
							result={result}
							distributionSegments={distributionSegments}
							controlIds={controlIds}
							rejectionReason={rejectionReason}
							isProcessing={isProcessing}
							onRejectionReasonChange={setRejectionReason}
							onShowDetailed={() => setShowDetailedView(true)}
							onExportJson={handleExportJson}
							onApprove={() => void handleApprove()}
							onReject={() => void handleReject()}
							description={description}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
