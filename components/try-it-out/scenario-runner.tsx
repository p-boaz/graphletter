"use client";

import {
	AlertCircle,
	CheckCircle2,
	FileDown,
	Loader2,
	PlayCircle,
	ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEP_DEFINITIONS = [
	{
		key: "uploadOnly",
		title: "1) Upload Evidence",
		description:
			"A policy file is uploaded and mapped to SCF controls using the selected documentation artifact.",
	},
	{
		key: "documents",
		title: "2) Extract + Build Graph",
		description:
			"Extracted document text is chunked into evidence atoms when extraction quality is sufficient.",
	},
	{
		key: "mapControls",
		title: "3) Map Graph to Controls",
		description:
			"Evidence atoms are mapped to one or more SCF controls (or flagged as limited if extraction is unavailable).",
	},
	{
		key: "coverageAndGaps",
		title: "4) Compute Coverage + Gaps",
		description: "Coverage and control gap statuses are calculated.",
	},
	{
		key: "reportExport",
		title: "5) Build Auditor Report",
		description:
			"An audit-ready report payload is generated with traceability.",
	},
] as const;

type StepKey = (typeof STEP_DEFINITIONS)[number]["key"];
type StepStatus = "idle" | "running" | "success" | "error";

interface StepState {
	status: StepStatus;
	data: unknown | null;
	error: string | null;
}

interface DashboardPreviewControl {
	id: string;
	title: string;
	status: string;
	gapType: string;
	summary: string;
}

interface DashboardPreview {
	totalControls: number;
	compliant: number;
	partial: number;
	missing: number;
	conflicting: number;
	coveragePercent: number;
	controls: DashboardPreviewControl[];
}

const DEMO_FIXTURE_PATHS: Record<StepKey, string> = {
	uploadOnly: "/try-it-out/upload-response.json",
	documents: "/try-it-out/document-extraction.json",
	mapControls: "/try-it-out/map-controls-response.json",
	coverageAndGaps: "/try-it-out/coverage-response.json",
	reportExport: "/try-it-out/report-response.json",
};

const ARTIFACT_OPTIONS = ["Security Awareness Training Policy"];

const MATCHED_CONTROLS_PREVIEW = [
	"SCF-IAO-04: Security Awareness Training",
	"SCF-IAO-05: Training Completion Monitoring",
];

const SAMPLE_POLICY_PREVIEW = `Security Awareness Training Policy
Version: 1.4
...
All workforce members must complete annual refresher training.
Managers receive escalation notices for overdue training.`;

const SAMPLE_POLICY_FULL_TEXT = `Security Awareness Training Policy
Version: 1.4
Owner: Security & Compliance
Effective Date: 2026-01-15
Review Cycle: Annual

1. Purpose
This policy establishes mandatory security awareness training requirements for all workforce members.

2. Scope
This policy applies to all employees, contractors, interns, and privileged third-party operators with access to company systems or data.

3. Control Objectives
- Ensure workforce members understand secure handling of sensitive information.
- Reduce phishing susceptibility through recurring education and simulation.
- Verify completion and attestation for all in-scope personnel.

4. Training Requirements
4.1 New-Hire Training
- Must be completed within 10 business days of account provisioning.
- Covers password hygiene, MFA, incident reporting, and data classification.

4.2 Annual Refresher
- All personnel must complete annual refresher training.
- Completion deadline is 30 calendar days after assignment.

4.3 Role-Based Modules
- Additional modules are required for engineering, support, and admin roles.
- Privileged users must complete secure admin operations training.

5. Monitoring and Enforcement
- Security Operations tracks completion status weekly.
- Managers receive escalation notices for overdue training.
- Access restrictions may apply when training is overdue by more than 30 days.

6. Evidence and Recordkeeping
- Training completion records are retained for at least 24 months.
- Evidence includes completion logs, attestation records, and campaign reports.

7. Exceptions
Any exception requires documented approval from Security and Compliance leadership.

8. Policy Violations
Failure to complete required training may result in corrective action.`;

function createInitialStepState(): Record<StepKey, StepState> {
	return Object.fromEntries(
		STEP_DEFINITIONS.map((step) => [
			step.key,
			{ status: "idle", data: null, error: null } satisfies StepState,
		]),
	) as Record<StepKey, StepState>;
}

function pause(durationMs: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
}

function asNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function statusTone(status: string): string {
	if (status === "compliant")
		return "bg-green-50 text-green-800 border-green-200";
	if (status === "partial")
		return "bg-yellow-50 text-yellow-800 border-yellow-200";
	if (status === "missing") return "bg-red-50 text-red-700 border-red-200";
	if (status === "conflicting")
		return "bg-orange-50 text-orange-800 border-orange-200";
	return "bg-slate-50 text-slate-700 border-slate-200";
}

function downloadTextBlob(content: string, fileName: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType });
	const objectUrl = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(objectUrl);
}

function buildCsvFromReport(reportPayload: unknown): string {
	const payload =
		typeof reportPayload === "object" && reportPayload !== null
			? (reportPayload as Record<string, unknown>)
			: {};
	const report =
		typeof payload.report === "object" && payload.report !== null
			? (payload.report as Record<string, unknown>)
			: null;

	const controls = Array.isArray(report?.controls) ? report.controls : [];
	const header = [
		"control_id",
		"status",
		"gap_type",
		"control_title",
		"supporting_atom_count",
	];

	const rows = controls.map((item) => {
		const control =
			typeof item === "object" && item !== null
				? (item as Record<string, unknown>)
				: {};
		return [
			String(control.scf_control_id ?? ""),
			String(control.status ?? ""),
			String(control.gap_type ?? ""),
			String(control.control_title ?? ""),
			String(control.supporting_atom_count ?? ""),
		]
			.map((value) => `"${value.replaceAll('"', '""')}"`)
			.join(",");
	});

	return [header.join(","), ...rows].join("\n");
}

async function parseApiPayload<T>(response: Response): Promise<T> {
	const payload = (await response.json().catch(() => ({}))) as {
		error?: string;
		message?: string;
	};

	if (!response.ok) {
		throw new Error(payload.error || payload.message || "Request failed");
	}

	return payload as T;
}

function buildDashboardPreview(
	reportPayload: unknown,
): DashboardPreview | null {
	const payload =
		typeof reportPayload === "object" && reportPayload !== null
			? (reportPayload as Record<string, unknown>)
			: null;
	const report =
		payload && typeof payload.report === "object" && payload.report !== null
			? (payload.report as Record<string, unknown>)
			: null;
	const summary =
		report && typeof report.summary === "object" && report.summary !== null
			? (report.summary as Record<string, unknown>)
			: null;

	if (!report || !summary) return null;

	const totalControls = asNumber(summary.total_controls);
	const compliant = asNumber(summary.compliant);
	const partial = asNumber(summary.partial);
	const missing = asNumber(summary.missing);
	const conflicting = asNumber(summary.conflicting);
	const coveragePercent =
		totalControls > 0
			? Math.round(((compliant + partial) / totalControls) * 100)
			: 0;

	const controlsRaw = Array.isArray(report.controls) ? report.controls : [];
	const controls = controlsRaw
		.map((control) => {
			const row =
				typeof control === "object" && control !== null
					? (control as Record<string, unknown>)
					: null;
			if (!row) return null;

			return {
				id: String(row.scf_control_id ?? ""),
				title: String(
					row.control_title ?? row.scf_control_id ?? "Unknown control",
				),
				status: String(row.status ?? "unknown"),
				gapType: String(row.gap_type ?? "unknown"),
				summary: String(row.summary ?? ""),
			} satisfies DashboardPreviewControl;
		})
		.filter((control): control is DashboardPreviewControl => Boolean(control))
		.slice(0, 8);

	return {
		totalControls,
		compliant,
		partial,
		missing,
		conflicting,
		coveragePercent,
		controls,
	};
}

export function ScenarioRunner() {
	const [artifactSelection, setArtifactSelection] = useState(
		ARTIFACT_OPTIONS[0] || "",
	);
	const [stepStates, setStepStates] = useState<Record<StepKey, StepState>>(
		createInitialStepState,
	);
	const [isRunning, setIsRunning] = useState(false);
	const [runMessage, setRunMessage] = useState<string | null>(null);
	const [runError, setRunError] = useState<string | null>(null);

	const resetSteps = useCallback(() => {
		setRunMessage(null);
		setRunError(null);
		setStepStates(createInitialStepState());
	}, []);

	const updateStep = useCallback((key: StepKey, next: Partial<StepState>) => {
		setStepStates((current) => ({
			...current,
			[key]: {
				...current[key],
				...next,
			},
		}));
	}, []);

	const runDemoScenario = useCallback(async () => {
		setIsRunning(true);
		resetSteps();

		try {
			const fixturePairs = await Promise.all(
				STEP_DEFINITIONS.map(async (step) => {
					const response = await fetch(DEMO_FIXTURE_PATHS[step.key], {
						cache: "no-store",
					});
					const payload = await parseApiPayload<unknown>(response);
					return [step.key, payload] as const;
				}),
			);

			const fixtureMap = Object.fromEntries(fixturePairs) as Record<
				StepKey,
				unknown
			>;

			const uploadPayload =
				typeof fixtureMap.uploadOnly === "object" &&
				fixtureMap.uploadOnly !== null
					? (fixtureMap.uploadOnly as Record<string, unknown>)
					: {};
			fixtureMap.uploadOnly = {
				...uploadPayload,
				documentation_artifact: artifactSelection,
			};

			for (const step of STEP_DEFINITIONS) {
				updateStep(step.key, { status: "running", data: null, error: null });
				await pause(180);
				updateStep(step.key, {
					status: "success",
					data: fixtureMap[step.key],
					error: null,
				});
			}

			setRunMessage(`Demo complete. Artifact matched: ${artifactSelection}.`);
		} catch (error) {
			setRunError(
				error instanceof Error
					? error.message
					: "Failed to replay demo scenario",
			);
		} finally {
			setIsRunning(false);
		}
	}, [artifactSelection, resetSteps, updateStep]);

	const handleReportDownload = useCallback(
		(format: "json" | "csv") => {
			const reportPayload = stepStates.reportExport.data;
			if (!reportPayload) {
				throw new Error("Run the demo first to generate report output.");
			}

			if (format === "json") {
				downloadTextBlob(
					JSON.stringify(reportPayload, null, 2),
					"demo-graph-compliance-report.json",
					"application/json;charset=utf-8",
				);
				return;
			}

			const csv = buildCsvFromReport(reportPayload);
			downloadTextBlob(
				csv,
				"demo-graph-compliance-report.csv",
				"text/csv;charset=utf-8",
			);
		},
		[stepStates.reportExport.data],
	);

	const hasReportData = stepStates.reportExport.status === "success";
	const dashboardPreview = useMemo(
		() => buildDashboardPreview(stepStates.reportExport.data),
		[stepStates.reportExport.data],
	);

	return (
		<div className="space-y-8">
			<Card className="border-ft-pink/30">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-ft-black">
						<ShieldCheck className="h-5 w-5 text-ft-pink" />
						Single Upload Demo
					</CardTitle>
					<CardDescription className="text-slate-700">
						This page replays one clear scenario using fixture data only.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
						<p className="font-medium text-ft-black text-sm">
							Sample file used
						</p>
						<pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
							{SAMPLE_POLICY_PREVIEW}
						</pre>
						<details className="mt-3">
							<summary className="cursor-pointer text-ft-pink text-xs underline underline-offset-4">
								Expand full sample policy
							</summary>
							<pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
								{SAMPLE_POLICY_FULL_TEXT}
							</pre>
						</details>
					</div>

					<div className="space-y-2">
						<Label htmlFor="demo-artifact">Documentation Artifact Match</Label>
						<Select
							value={artifactSelection}
							onValueChange={setArtifactSelection}
						>
							<SelectTrigger id="demo-artifact">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ARTIFACT_OPTIONS.map((artifact) => (
									<SelectItem key={artifact} value={artifact}>
										{artifact}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-slate-600 text-xs">
							Matched controls in this demo:
						</p>
						<div className="flex flex-wrap gap-2">
							{MATCHED_CONTROLS_PREVIEW.map((control) => (
								<Badge key={control} variant="outline" className="text-xs">
									{control}
								</Badge>
							))}
						</div>
					</div>

					<div className="flex flex-wrap gap-3">
						<Button onClick={() => void runDemoScenario()} disabled={isRunning}>
							{isRunning ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<PlayCircle className="mr-2 h-4 w-4" />
							)}
							Run Demo
						</Button>
						<Button variant="outline" onClick={resetSteps} disabled={isRunning}>
							Reset
						</Button>
					</div>
				</CardContent>
			</Card>

			{runMessage ? (
				<div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
					<CheckCircle2 className="mt-0.5 h-4 w-4" />
					<p>{runMessage}</p>
				</div>
			) : null}

			{runError ? (
				<div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
					<AlertCircle className="mt-0.5 h-4 w-4" />
					<p>{runError}</p>
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{STEP_DEFINITIONS.map((step) => {
					const state = stepStates[step.key];
					const tone =
						state.status === "success"
							? "bg-green-50 text-green-800 border-green-200"
							: state.status === "error"
								? "bg-red-50 text-red-700 border-red-200"
								: state.status === "running"
									? "bg-blue-50 text-blue-700 border-blue-200"
									: "bg-slate-50 text-slate-700 border-slate-200";

					return (
						<Card key={step.key} className="border-slate-200">
							<CardHeader className="space-y-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<CardTitle className="text-lg text-ft-black">
											{step.title}
										</CardTitle>
										<CardDescription className="mt-1 text-slate-600">
											{step.description}
										</CardDescription>
									</div>
									<Badge className={cn("border", tone)}>
										{state.status === "idle" ? "Not Run" : null}
										{state.status === "running" ? "Running" : null}
										{state.status === "success" ? "Complete" : null}
										{state.status === "error" ? "Failed" : null}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								{state.status === "running" ? (
									<div className="flex items-center gap-2 text-blue-700 text-sm">
										<Loader2 className="h-4 w-4 animate-spin" />
										Processing step...
									</div>
								) : null}

								{state.error ? (
									<p className="text-red-700 text-sm">{state.error}</p>
								) : null}

								{state.data ? (
									<details>
										<summary className="cursor-pointer text-slate-700 text-sm">
											View response payload
										</summary>
										<pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
											{JSON.stringify(state.data, null, 2)}
										</pre>
									</details>
								) : null}
							</CardContent>
						</Card>
					);
				})}
			</div>

			{hasReportData ? (
				<Card className="border-ft-pink/30">
					<CardHeader>
						<CardTitle className="text-ft-black">Dashboard Preview</CardTitle>
						<CardDescription>
							This is how the demo result appears in a user-friendly dashboard
							view.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{dashboardPreview ? (
							<>
								<div className="grid grid-cols-2 gap-3 md:grid-cols-5">
									<div className="rounded-md border border-slate-200 p-3 text-center">
										<p className="text-slate-500 text-xs">Coverage</p>
										<p className="font-semibold text-ft-black text-lg">
											{dashboardPreview.coveragePercent}%
										</p>
									</div>
									<div className="rounded-md border border-slate-200 p-3 text-center">
										<p className="text-slate-500 text-xs">Compliant</p>
										<p className="font-semibold text-green-700 text-lg">
											{dashboardPreview.compliant}
										</p>
									</div>
									<div className="rounded-md border border-slate-200 p-3 text-center">
										<p className="text-slate-500 text-xs">Partial</p>
										<p className="font-semibold text-yellow-700 text-lg">
											{dashboardPreview.partial}
										</p>
									</div>
									<div className="rounded-md border border-slate-200 p-3 text-center">
										<p className="text-slate-500 text-xs">Missing</p>
										<p className="font-semibold text-red-700 text-lg">
											{dashboardPreview.missing}
										</p>
									</div>
									<div className="rounded-md border border-slate-200 p-3 text-center">
										<p className="text-slate-500 text-xs">Conflicting</p>
										<p className="font-semibold text-orange-700 text-lg">
											{dashboardPreview.conflicting}
										</p>
									</div>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between text-slate-700 text-sm">
										<span>Controls covered (compliant + partial)</span>
										<span>
											{dashboardPreview.compliant + dashboardPreview.partial}/
											{dashboardPreview.totalControls}
										</span>
									</div>
									<div className="h-2 w-full rounded-full bg-slate-200">
										<div
											className="h-2 rounded-full bg-ft-pink transition-all"
											style={{ width: `${dashboardPreview.coveragePercent}%` }}
										/>
									</div>
								</div>

								<div className="space-y-3">
									<p className="font-medium text-ft-black text-sm">
										Control Status Snapshot
									</p>
									<div className="space-y-2">
										{dashboardPreview.controls.map((control) => (
											<div
												key={control.id}
												className="rounded-md border border-slate-200 p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<p className="font-medium text-ft-black text-sm">
														{control.id} - {control.title}
													</p>
													<Badge
														className={cn("border", statusTone(control.status))}
													>
														{control.status}
													</Badge>
												</div>
												<p className="mt-1 text-slate-600 text-xs">
													{control.summary || control.gapType}
												</p>
											</div>
										))}
									</div>
								</div>
							</>
						) : (
							<p className="text-slate-600 text-sm">
								Report data is available, but preview formatting is not.
							</p>
						)}

						<div className="border-slate-200 border-t pt-4">
							<p className="mb-2 text-slate-500 text-xs uppercase tracking-wide">
								Optional raw export
							</p>
							<div className="flex flex-wrap gap-3">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										try {
											handleReportDownload("json");
										} catch (error) {
											setRunError(
												error instanceof Error
													? error.message
													: "Failed to download JSON",
											);
										}
									}}
								>
									<FileDown className="mr-2 h-4 w-4" />
									JSON
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										try {
											handleReportDownload("csv");
										} catch (error) {
											setRunError(
												error instanceof Error
													? error.message
													: "Failed to download CSV",
											);
										}
									}}
								>
									<FileDown className="mr-2 h-4 w-4" />
									CSV
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
