"use client";

import {
	AlertTriangle,
	CheckCircle,
	Clock,
	Eye,
	Search,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { EvidenceFreshnessDot } from "@/components/evidence-freshness-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";

interface EvidenceRecord {
	id: string;
	file_name: string;
	scf_control_id: string;
	evidence_type: string;
	evidence_status: string;
	submitted_at: string;
	evidence_group_id?: string;
	erl_global_id?: string;
	metadata?: {
		documentation_artifact?: string;
		smart_upload?: boolean;
	};
}

interface EvidenceGroup {
	groupId: string;
	representative: EvidenceRecord;
	records: EvidenceRecord[];
	allControls: string;
	controlCount: number;
	uploadCount: number;
}

export default function EvidencePage() {
	const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [controlFilter, setControlFilter] = useState("all");
	const [selectedEvidenceGroup, setSelectedEvidenceGroup] =
		useState<EvidenceGroup | null>(null);
	const [freshnessMap, setFreshnessMap] = useState<
		Map<
			string,
			{ status: "fresh" | "expiring" | "stale"; daysUntilExpiry: number }
		>
	>(new Map());

	const loadEvidenceData = useCallback(async () => {
		setLoading(true);
		try {
			const [evidenceResponse, freshnessResponse] = await Promise.all([
				fetch(`/api/evidence/history`, { cache: "no-store" }),
				fetch(`/api/compliance/freshness`, { cache: "no-store" }),
			]);
			if (evidenceResponse.ok) {
				const evidenceData = await evidenceResponse.json();
				setEvidenceRecords(evidenceData.evidence || []);
			}
			if (freshnessResponse.ok) {
				const freshnessData = await freshnessResponse.json();
				const items = freshnessData.freshness?.items || [];
				const map = new Map<
					string,
					{ status: "fresh" | "expiring" | "stale"; daysUntilExpiry: number }
				>();
				for (const item of items) {
					map.set(item.evidenceId, {
						status: item.status,
						daysUntilExpiry: item.daysUntilExpiry,
					});
				}
				setFreshnessMap(map);
			}
		} catch (error) {
			console.error("Error loading evidence data:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadEvidenceData();
	}, [loadEvidenceData]);

	const getStatusColor = (status: string) => {
		switch (status.toLowerCase()) {
			case "pass":
				return "bg-green-100 text-green-800 border-green-200";
			case "fail":
				return "bg-red-100 text-red-800 border-red-200";
			case "partial":
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			case "completed":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "under_review":
				return "bg-amber-100 text-amber-800 border-amber-200";
			case "assessed":
				return "bg-indigo-100 text-indigo-800 border-indigo-200";
			case "submitted":
				return "bg-gray-100 text-gray-800 border-gray-200";
			case "outdated":
				return "bg-slate-100 text-slate-700 border-slate-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status.toLowerCase()) {
			case "pass":
				return <CheckCircle className="h-4 w-4" />;
			case "fail":
				return <XCircle className="h-4 w-4" />;
			case "partial":
				return <AlertTriangle className="h-4 w-4" />;
			case "completed":
				return <CheckCircle className="h-4 w-4" />;
			case "under_review":
				return <AlertTriangle className="h-4 w-4" />;
			case "assessed":
				return <CheckCircle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	// First group by upload group id
	const evidenceGroupsMap = new Map<string, EvidenceRecord[]>();
	evidenceRecords.forEach((evidence) => {
		const groupId = evidence.evidence_group_id || evidence.id;
		if (!evidenceGroupsMap.has(groupId)) {
			evidenceGroupsMap.set(groupId, []);
		}
		evidenceGroupsMap.get(groupId)!.push(evidence);
	});

	const uploadGroups: EvidenceGroup[] = Array.from(
		evidenceGroupsMap.entries(),
	).map(([groupId, records]) => {
		const representative = [...records].sort(
			(a, b) =>
				new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
		)[0];
		const uniqueControls = [
			...new Set(records.map((r) => r.scf_control_id)),
		].sort();
		return {
			groupId,
			representative,
			records,
			allControls: uniqueControls.join(", "),
			controlCount: uniqueControls.length,
			uploadCount: 1,
		};
	});

	// Collapse repeated uploads of the same artifact/file into one latest row.
	const dedupedByArtifactFile = new Map<string, EvidenceGroup>();
	for (const group of uploadGroups) {
		const artifact =
			group.representative.metadata?.documentation_artifact || "";
		const dedupeKey = `${artifact}::${group.representative.file_name.toLowerCase()}`;
		const existing = dedupedByArtifactFile.get(dedupeKey);

		if (!existing) {
			dedupedByArtifactFile.set(dedupeKey, { ...group });
			continue;
		}

		existing.uploadCount += 1;
		const mergedControls = new Set<string>([
			...existing.allControls
				.split(",")
				.map((control) => control.trim())
				.filter(Boolean),
			...group.allControls
				.split(",")
				.map((control) => control.trim())
				.filter(Boolean),
		]);
		existing.allControls = [...mergedControls].sort().join(", ");
		existing.controlCount = mergedControls.size;

		const existingSubmittedAt = new Date(
			existing.representative.submitted_at,
		).getTime();
		const currentSubmittedAt = new Date(
			group.representative.submitted_at,
		).getTime();
		if (currentSubmittedAt > existingSubmittedAt) {
			existing.groupId = group.groupId;
			existing.representative = group.representative;
			existing.records = group.records;
		}
	}

	const filteredEvidenceGroups: EvidenceGroup[] = Array.from(
		dedupedByArtifactFile.values(),
	)
		.sort(
			(a, b) =>
				new Date(b.representative.submitted_at).getTime() -
				new Date(a.representative.submitted_at).getTime(),
		)
		.filter((group) => {
			const matchesSearch =
				group.representative.file_name
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				group.allControls.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesStatus =
				statusFilter === "all" ||
				group.representative.evidence_status === statusFilter;
			const matchesControl =
				controlFilter === "all" ||
				group.records.some((r) => r.scf_control_id === controlFilter);

			return matchesSearch && matchesStatus && matchesControl;
		});

	// Get unique controls for filter dropdown
	const uniqueControls = [
		...new Set(evidenceRecords.map((e) => e.scf_control_id)),
	].sort();

	return (
		<DashboardLayout
			title="Evidence Records"
			description="View and manage all uploaded evidence files"
			showUploadButton={true}
		>
			<Card className="ft-card">
				<CardContent>
					{/* Filters */}
					<div className="mb-6 flex flex-col gap-4 sm:flex-row">
						<div className="flex-1">
							<div className="relative">
								<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
								<Input
									placeholder="Search by filename or control ID..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-full sm:w-48">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Statuses</SelectItem>
								<SelectItem value="submitted">Submitted</SelectItem>
								<SelectItem value="under_review">Under Review</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
								<SelectItem value="outdated">Outdated</SelectItem>
							</SelectContent>
						</Select>
						<Select value={controlFilter} onValueChange={setControlFilter}>
							<SelectTrigger className="w-full sm:w-48">
								<SelectValue placeholder="Filter by control" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Controls</SelectItem>
								{uniqueControls.map((control) => (
									<SelectItem key={control} value={control}>
										{control}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Evidence Table */}
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>File Name</TableHead>
									<TableHead>Document Artifact</TableHead>
									<TableHead>Controls Mapped</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Uploaded</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell colSpan={7} className="py-8 text-center">
											Loading evidence records...
										</TableCell>
									</TableRow>
								) : filteredEvidenceGroups.length === 0 ? (
									<TableRow>
										<TableCell colSpan={7} className="py-8 text-center">
											No evidence groups found
										</TableCell>
									</TableRow>
								) : (
									filteredEvidenceGroups.map((group) => {
										const freshness = freshnessMap.get(group.representative.id);
										return (
											<TableRow key={group.groupId} data-testid="evidence-row">
												<TableCell className="font-medium">
													<span className="inline-flex items-center gap-2">
														{freshness && (
															<TooltipProvider delayDuration={0}>
																<EvidenceFreshnessDot
																	status={freshness.status}
																	daysUntilExpiry={freshness.daysUntilExpiry}
																/>
															</TooltipProvider>
														)}
														{group.representative.file_name}
													</span>
													{group.representative.metadata?.smart_upload && (
														<Badge variant="outline" className="ml-2 text-xs">
															Smart Upload
														</Badge>
													)}
													{group.uploadCount > 1 && (
														<Badge variant="secondary" className="ml-2 text-xs">
															{group.uploadCount} uploads
														</Badge>
													)}
												</TableCell>
												<TableCell>
													<div className="text-gray-600 text-sm">
														{group.representative.metadata
															?.documentation_artifact || "-"}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<div className="font-medium text-sm">
															{group.controlCount} control
															{group.controlCount !== 1 ? "s" : ""}
														</div>
														<div
															className="max-w-xs truncate text-gray-500 text-xs"
															title={group.allControls}
														>
															{group.allControls}
														</div>
													</div>
												</TableCell>
												<TableCell>
													{group.representative.evidence_type}
												</TableCell>
												<TableCell>
													<Badge
														className={getStatusColor(
															group.representative.evidence_status,
														)}
													>
														{getStatusIcon(
															group.representative.evidence_status,
														)}
														<span className="ml-1 capitalize">
															{group.representative.evidence_status.replace(
																"_",
																" ",
															)}
														</span>
													</Badge>
												</TableCell>
												<TableCell>
													{
														new Date(group.representative.submitted_at)
															.toISOString()
															.split("T")[0]
													}
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="sm"
														data-testid="evidence-view-action"
														aria-label={`View details for ${group.representative.file_name}`}
														onClick={() => setSelectedEvidenceGroup(group)}
													>
														<Eye className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<Dialog
				open={selectedEvidenceGroup !== null}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedEvidenceGroup(null);
					}
				}}
			>
				<DialogContent
					className="max-h-[85vh] max-w-2xl overflow-y-auto"
					data-testid="evidence-detail-dialog"
				>
					<DialogHeader>
						<DialogTitle>Evidence details</DialogTitle>
						<DialogDescription>
							Review the uploaded file context and mapped controls for this
							evidence group.
						</DialogDescription>
					</DialogHeader>

					{selectedEvidenceGroup && (
						<div className="space-y-4 text-sm">
							<div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2">
								<div>
									<p className="font-medium text-slate-900">File name</p>
									<p
										className="text-slate-700"
										data-testid="evidence-detail-file-name"
									>
										{selectedEvidenceGroup.representative.file_name}
									</p>
								</div>
								<div>
									<p className="font-medium text-slate-900">Artifact</p>
									<p className="text-slate-700">
										{selectedEvidenceGroup.representative.metadata
											?.documentation_artifact || "-"}
									</p>
								</div>
								<div>
									<p className="font-medium text-slate-900">Status</p>
									<Badge
										className={getStatusColor(
											selectedEvidenceGroup.representative.evidence_status,
										)}
									>
										{getStatusIcon(
											selectedEvidenceGroup.representative.evidence_status,
										)}
										<span className="ml-1 capitalize">
											{selectedEvidenceGroup.representative.evidence_status.replace(
												"_",
												" ",
											)}
										</span>
									</Badge>
								</div>
								<div>
									<p className="font-medium text-slate-900">Uploaded</p>
									<p className="text-slate-700">
										{
											new Date(
												selectedEvidenceGroup.representative.submitted_at,
											)
												.toISOString()
												.split("T")[0]
										}
									</p>
								</div>
								<div>
									<p className="font-medium text-slate-900">Uploads merged</p>
									<p className="text-slate-700">
										{selectedEvidenceGroup.uploadCount}
									</p>
								</div>
							</div>

							<div className="rounded-lg border p-4">
								<p className="font-medium text-slate-900">Mapped controls</p>
								<p
									className="mt-1 text-slate-700"
									data-testid="evidence-detail-controls"
								>
									{selectedEvidenceGroup.allControls}
								</p>
							</div>

							<div className="rounded-lg border p-4">
								<p className="font-medium text-slate-900">
									Evidence records in this group
								</p>
								<ul
									className="mt-2 space-y-2 text-slate-700"
									data-testid="evidence-detail-record-list"
								>
									{selectedEvidenceGroup.records.map((record) => (
										<li
											key={record.id}
											className="rounded border border-slate-100 bg-slate-50 p-2"
										>
											<p className="font-medium">{record.scf_control_id}</p>
											<p className="text-xs capitalize">
												{record.evidence_type}
											</p>
										</li>
									))}
								</ul>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
