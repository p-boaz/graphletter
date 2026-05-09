"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateAssessmentDialogProps {
	onStartAssessment: (controlId: string, aoId?: string) => void;
}

export function CreateAssessmentDialog({
	onStartAssessment,
}: CreateAssessmentDialogProps) {
	const [open, setOpen] = useState(false);
	const [controlId, setControlId] = useState("");
	const [aoId, setAoId] = useState("");

	const handleSubmit = () => {
		if (!controlId.trim()) {
			toast.error("Control ID is required");
			return;
		}

		onStartAssessment(controlId.trim(), aoId.trim() || undefined);
		setOpen(false);
		setControlId("");
		setAoId("");
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					New Assessment
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>Start New Assessment</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="control-id">SCF Control ID *</Label>
						<Input
							id="control-id"
							placeholder="e.g., AAT-01"
							value={controlId}
							onChange={(e) => setControlId(e.target.value)}
						/>
					</div>

					<div>
						<Label htmlFor="ao-id">Assessment Objective ID (Optional)</Label>
						<Input
							id="ao-id"
							placeholder="e.g., AAT-01_A01"
							value={aoId}
							onChange={(e) => setAoId(e.target.value)}
						/>
						<p className="mt-1 text-slate-500 text-xs">
							Leave empty to assess the entire control
						</p>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSubmit}>Start Assessment</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
