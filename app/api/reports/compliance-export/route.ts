import { type NextRequest, NextResponse } from "next/server";
import { computeControlGaps } from "@/lib/graph/gap-analysis";
import { coverageStrengthRank } from "@/lib/graph/service";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ExportFormat = "json" | "csv";

interface FrameworkFilter {
	id: string | null;
	name: string | null;
}

interface ControlMappingRow {
	control_id: string;
}

interface ControlRow {
	id: string;
}

interface AtomDetail {
	atom_id: string;
	atom_type: string | null;
	claim: string | null;
	supporting_text: string | null;
	confidence: number | null;
	source_locator: Record<string, unknown> | null;
	document_id: string | null;
	chunk_id: string | null;
	document_file_name: string | null;
	source_evidence_id: string | null;
	evidence_type: string;
	mapping_polarity: "supports" | "contradicts";
	coverage_rank: number;
}

const UNKNOWN_EVIDENCE_TYPE = "unknown";

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

function countBy<T>(values: T[]): Record<string, number> {
	const output: Record<string, number> = {};
	for (const value of values) {
		const key = String(value ?? "unknown");
		output[key] = (output[key] || 0) + 1;
	}
	return output;
}

function csvCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	const text =
		typeof value === "string" ? value : JSON.stringify(value, null, 0) || "";
	return `"${text.replaceAll('"', '""')}"`;
}

async function resolveFrameworkFilter(
	supabase: SupabaseClient,
	frameworkId?: string | null,
	frameworkName?: string | null,
): Promise<FrameworkFilter> {
	if (frameworkId) {
		const { data, error } = await supabase
			.from("scf_frameworks")
			.select("id, framework_name")
			.eq("id", frameworkId)
			.maybeSingle();

		if (error) throw new Error(error.message);
		return {
			id: (data?.id as string | undefined) ?? frameworkId,
			name: (data?.framework_name as string | undefined) ?? null,
		};
	}

	if (frameworkName) {
		const { data, error } = await supabase
			.from("scf_frameworks")
			.select("id, framework_name")
			.eq("framework_name", frameworkName)
			.maybeSingle();

		if (error) throw new Error(error.message);
		return {
			id: (data?.id as string | undefined) ?? null,
			name: (data?.framework_name as string | undefined) ?? frameworkName,
		};
	}

	return { id: null, name: null };
}

async function resolveControlIds(
	supabase: SupabaseClient,
	frameworkId?: string | null,
	frameworkName?: string | null,
): Promise<string[]> {
	if (frameworkId) {
		const { data, error } = await supabase
			.from("scf_control_mappings")
			.select("control_id")
			.eq("framework_id", frameworkId);
		if (error) throw new Error(error.message);
		return [
			...new Set(
				((data || []) as ControlMappingRow[]).map((r) => r.control_id),
			),
		];
	}

	if (frameworkName) {
		const { data, error } = await supabase
			.from("scf_control_mappings")
			.select("control_id, scf_frameworks!inner(framework_name)")
			.eq("scf_frameworks.framework_name", frameworkName);
		if (error) throw new Error(error.message);
		return [
			...new Set(
				((data || []) as ControlMappingRow[]).map((r) => r.control_id),
			),
		];
	}

	const { data, error } = await supabase.from("scf_controls").select("id");
	if (error) throw new Error(error.message);
	return ((data || []) as ControlRow[]).map((row) => row.id);
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const format = (searchParams.get("format") || "json") as ExportFormat;
		const includeDetails = searchParams.get("details") === "true";
		const frameworkId = searchParams.get("frameworkId");
		const frameworkName = searchParams.get("frameworkName");
		const framework = await resolveFrameworkFilter(
			supabase,
			frameworkId,
			frameworkName,
		);
		const controlIds = await resolveControlIds(
			supabase,
			framework.id,
			framework.name,
		);

		if (controlIds.length === 0) {
			return NextResponse.json({
				success: true,
				report: {
					generated_at: new Date().toISOString(),
					framework_filter: framework,
					summary: {
						total_controls: 0,
						compliant: 0,
						partial: 0,
						missing: 0,
						conflicting: 0,
						traceable_statuses: 0,
					},
					evidence_type_breakdown: {},
					atom_type_breakdown: {},
					controls: [],
				},
			});
		}

		const { data: mappings, error: mappingsError } = await supabase
			.from("evidence_control_map")
			.select(
				"scf_control_id, coverage_strength, atom_id, mapping_polarity, evidence_atoms!inner(id, user_id, atom_type, claim, supporting_text, confidence, source_locator, document_id, chunk_id, documents!inner(id, file_name, source_evidence_id))",
			)
			.eq("evidence_atoms.user_id", user.id)
			.in("scf_control_id", controlIds);

		if (mappingsError) {
			return NextResponse.json(
				{ error: mappingsError.message },
				{ status: 500 },
			);
		}

		const computedGaps = computeControlGaps(
			controlIds,
			(mappings || []) as Array<{
				scf_control_id: string;
				coverage_strength?: string | null;
				atom_id?: string | null;
				mapping_polarity?: string | null;
			}>,
		);

		const atomDetailsByControl = new Map<string, AtomDetail[]>();
		const sourceEvidenceIds = new Set<string>();

		for (const mapping of mappings || []) {
			const controlId = mapping.scf_control_id as string;
			const atom = normalizeSingle(mapping.evidence_atoms);
			const document = normalizeSingle(atom?.documents);
			const sourceEvidenceId =
				(document?.source_evidence_id as string | null | undefined) ?? null;

			if (sourceEvidenceId) {
				sourceEvidenceIds.add(sourceEvidenceId);
			}

			if (!atomDetailsByControl.has(controlId)) {
				atomDetailsByControl.set(controlId, []);
			}

			atomDetailsByControl.get(controlId)?.push({
				atom_id: (atom?.id as string | undefined) || "",
				atom_type: (atom?.atom_type as string | undefined) || null,
				claim: (atom?.claim as string | undefined) || null,
				supporting_text: (atom?.supporting_text as string | undefined) || null,
				confidence:
					typeof atom?.confidence === "number"
						? (atom.confidence as number)
						: null,
				source_locator:
					(atom?.source_locator as
						| Record<string, unknown>
						| null
						| undefined) ?? null,
				document_id: (atom?.document_id as string | undefined) || null,
				chunk_id: (atom?.chunk_id as string | undefined) || null,
				document_file_name: (document?.file_name as string | undefined) || null,
				source_evidence_id: sourceEvidenceId,
				evidence_type: UNKNOWN_EVIDENCE_TYPE,
				mapping_polarity:
					mapping.mapping_polarity === "contradicts"
						? "contradicts"
						: "supports",
				coverage_rank: coverageStrengthRank(
					(mapping.coverage_strength as string) || "none",
				),
			});
		}

		const { data: sourceEvidenceRows, error: sourceEvidenceError } =
			sourceEvidenceIds.size > 0
				? await supabase
						.from("evidence")
						.select("id, evidence_type")
						.in("id", [...sourceEvidenceIds])
						.eq("user_id", user.id)
				: { data: [], error: null };

		if (sourceEvidenceError) {
			return NextResponse.json(
				{ error: sourceEvidenceError.message },
				{ status: 500 },
			);
		}

		const evidenceTypeById = new Map(
			(sourceEvidenceRows || []).map(
				(row: { id: string; evidence_type: string }) => [
					row.id,
					row.evidence_type || UNKNOWN_EVIDENCE_TYPE,
				],
			),
		);

		for (const [controlId, atomDetails] of atomDetailsByControl.entries()) {
			atomDetailsByControl.set(
				controlId,
				atomDetails.map((atom) => ({
					...atom,
					evidence_type:
						(atom.source_evidence_id
							? evidenceTypeById.get(atom.source_evidence_id)
							: null) || UNKNOWN_EVIDENCE_TYPE,
				})),
			);
		}

		const { data: controls, error: controlsError } = await supabase
			.from("scf_controls")
			.select("id, title, domain_id, scf_domains!domain_id(name)")
			.in("id", controlIds);

		if (controlsError) {
			return NextResponse.json(
				{ error: controlsError.message },
				{ status: 500 },
			);
		}

		const controlsById = new Map(
			(
				(controls || []) as Array<{
					id: string;
					title: string;
					domain_id: string;
					scf_domains?: { name?: string } | Array<{ name?: string }> | null;
				}>
			).map((control) => [control.id, control]),
		);

		const controlReports = computedGaps.map((gap) => {
			const controlMetadata = controlsById.get(gap.scfControlId);
			const rawAtoms = atomDetailsByControl.get(gap.scfControlId) || [];
			const atomsById = new Map(rawAtoms.map((atom) => [atom.atom_id, atom]));
			const relatedAtoms = gap.supportingAtomIds
				.map((atomId) => atomsById.get(atomId))
				.filter((atom): atom is AtomDetail => Boolean(atom));
			const evidenceTypeBreakdown = countBy(
				relatedAtoms.map((atom) => atom.evidence_type),
			);
			const atomTypeBreakdown = countBy(
				relatedAtoms.map((atom) => atom.atom_type || "other"),
			);
			const domain = normalizeSingle(controlMetadata?.scf_domains);

			return {
				scf_control_id: gap.scfControlId,
				control_title: controlMetadata?.title || null,
				domain_id: controlMetadata?.domain_id || null,
				domain_name: domain?.name || null,
				status: gap.status,
				gap_type: gap.gapType,
				summary: gap.summary,
				strongest_support_rank: gap.strongestSupportRank,
				strongest_contradiction_rank: gap.strongestContradictionRank,
				traceable: gap.status === "missing" ? true : relatedAtoms.length > 0,
				evidence_type_breakdown: evidenceTypeBreakdown,
				atom_type_breakdown: atomTypeBreakdown,
				supporting_atoms: includeDetails ? relatedAtoms : undefined,
				supporting_atom_count: relatedAtoms.length,
			};
		});

		const globalEvidenceTypeBreakdown: Record<string, number> = {};
		const globalAtomTypeBreakdown: Record<string, number> = {};
		for (const controlReport of controlReports) {
			for (const [type, count] of Object.entries(
				controlReport.evidence_type_breakdown,
			)) {
				globalEvidenceTypeBreakdown[type] =
					(globalEvidenceTypeBreakdown[type] || 0) + count;
			}
			for (const [type, count] of Object.entries(
				controlReport.atom_type_breakdown,
			)) {
				globalAtomTypeBreakdown[type] =
					(globalAtomTypeBreakdown[type] || 0) + count;
			}
		}

		const summary = {
			total_controls: controlReports.length,
			compliant: controlReports.filter((r) => r.status === "compliant").length,
			partial: controlReports.filter((r) => r.status === "partial").length,
			missing: controlReports.filter((r) => r.status === "missing").length,
			conflicting: controlReports.filter((r) => r.status === "conflicting")
				.length,
			traceable_statuses: controlReports.filter(
				(r) => r.status === "missing" || r.traceable,
			).length,
		};

		const report = {
			generated_at: new Date().toISOString(),
			framework_filter: framework,
			summary,
			evidence_type_breakdown: globalEvidenceTypeBreakdown,
			atom_type_breakdown: globalAtomTypeBreakdown,
			controls: controlReports,
		};

		if (format === "csv") {
			const datePart = new Date().toISOString().split("T")[0];
			const header = [
				"control_id",
				"control_title",
				"domain_id",
				"domain_name",
				"status",
				"gap_type",
				"atom_id",
				"atom_type",
				"mapping_polarity",
				"coverage_rank",
				"confidence",
				"evidence_type",
				"file_name",
				"source_locator",
			];
			const rows = [header.join(",")];

			for (const control of controlReports) {
				const atoms = includeDetails
					? (control.supporting_atoms as AtomDetail[] | undefined) || []
					: [];

				if (atoms.length === 0) {
					rows.push(
						[
							csvCell(control.scf_control_id),
							csvCell(control.control_title),
							csvCell(control.domain_id),
							csvCell(control.domain_name),
							csvCell(control.status),
							csvCell(control.gap_type),
							csvCell(""),
							csvCell(""),
							csvCell(""),
							csvCell(""),
							csvCell(""),
							csvCell(""),
							csvCell(""),
							csvCell(""),
						].join(","),
					);
					continue;
				}

				for (const atom of atoms) {
					rows.push(
						[
							csvCell(control.scf_control_id),
							csvCell(control.control_title),
							csvCell(control.domain_id),
							csvCell(control.domain_name),
							csvCell(control.status),
							csvCell(control.gap_type),
							csvCell(atom.atom_id),
							csvCell(atom.atom_type),
							csvCell(atom.mapping_polarity),
							csvCell(atom.coverage_rank),
							csvCell(atom.confidence),
							csvCell(atom.evidence_type),
							csvCell(atom.document_file_name),
							csvCell(atom.source_locator),
						].join(","),
					);
				}
			}

			return new NextResponse(rows.join("\n"), {
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="graph-compliance-report-${datePart}.csv"`,
				},
			});
		}

		return NextResponse.json({
			success: true,
			report,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to export report",
			},
			{ status: 500 },
		);
	}
}
