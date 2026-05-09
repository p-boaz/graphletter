"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExistingEvidence } from "./types";

interface VersionDialogProps {
	existingEvidence: ExistingEvidence;
	documentationArtifact: string;
	versionAction: "replace" | "keep_both" | null;
	onVersionActionChange: (action: "replace" | "keep_both") => void;
	onCancel: () => void;
	onContinue: () => void;
}

export function VersionDialog({
	existingEvidence,
	documentationArtifact,
	versionAction,
	onVersionActionChange,
	onCancel,
	onContinue,
}: VersionDialogProps) {
	return (
		<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
			<div className="flex items-start gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white">
					<FileText className="h-4 w-4" />
				</div>
				<div className="flex-1">
					<h4 className="font-medium text-amber-900">
						Existing Evidence Found
					</h4>
					<p className="mt-1 text-amber-800 text-sm">
						You already have evidence for &quot;
						{documentationArtifact}
						&quot;
					</p>
					<div className="mt-2 rounded bg-amber-100 p-2 text-amber-700 text-xs">
						<div className="flex justify-between">
							<span>Current: {existingEvidence.file_name}</span>
							<span>Version {existingEvidence.version}</span>
						</div>
						<div className="mt-1 text-amber-600">
							Uploaded:{" "}
							{
								new Date(existingEvidence.submitted_at)
									.toISOString()
									.split("T")[0]
							}
						</div>
					</div>

					<div className="mt-3 space-y-2">
						<p className="font-medium text-amber-900 text-sm">
							What would you like to do?
						</p>
						<div className="space-y-2">
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="versionAction"
									value="replace"
									checked={versionAction === "replace"}
									onChange={(e) =>
										onVersionActionChange(e.target.value as "replace")
									}
									className="text-amber-600"
								/>
								<span className="text-amber-800 text-sm">
									Replace with new version (v
									{existingEvidence.version + 1})
								</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="radio"
									name="versionAction"
									value="keep_both"
									checked={versionAction === "keep_both"}
									onChange={(e) =>
										onVersionActionChange(e.target.value as "keep_both")
									}
									className="text-amber-600"
								/>
								<span className="text-amber-800 text-sm">
									Keep both versions (separate upload)
								</span>
							</label>
						</div>
					</div>

					<div className="mt-3 flex gap-2">
						<Button size="sm" variant="outline" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={onContinue}
							disabled={!versionAction}
							className="bg-amber-600 hover:bg-amber-700"
						>
							Continue
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
