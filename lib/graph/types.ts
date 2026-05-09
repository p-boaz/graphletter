export type DocumentIngestionStatus = "pending" | "processed" | "failed";

export type EvidenceAtomType =
	| "policy_statement"
	| "technical_control"
	| "procedure_step"
	| "monitoring_signal"
	| "attestation"
	| "other";

export type MappingMethod = "rule" | "llm" | "manual";

export type CoverageStrength = "strong" | "moderate" | "weak" | "none";

export type GapStatus =
	| "compliant"
	| "partial"
	| "missing"
	| "conflicting"
	| "stale";

export interface GraphDocument {
	id: string;
	user_id: string;
	source_evidence_id: string | null;
	file_name: string | null;
	file_type: string | null;
	file_size: number | null;
	storage_path: string | null;
	source_hash: string | null;
	ingestion_status: DocumentIngestionStatus;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface DocumentChunk {
	id: string;
	document_id: string;
	chunk_index: number;
	content: string;
	char_start: number | null;
	char_end: number | null;
	token_count: number | null;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface EvidenceAtom {
	id: string;
	document_id: string;
	chunk_id: string | null;
	user_id: string;
	atom_type: EvidenceAtomType;
	claim: string;
	supporting_text: string | null;
	confidence: number | null;
	source_locator: Record<string, unknown> | null;
	extractor_version: string;
	metadata: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface EvidenceControlMapping {
	id: string;
	atom_id: string;
	scf_control_id: string;
	mapping_method: MappingMethod;
	coverage_strength: CoverageStrength;
	mapping_polarity: "supports" | "contradicts";
	rationale: string | null;
	mapped_by: string | null;
	created_at: string;
}

export interface ControlGapAnalysis {
	id: string;
	user_id: string;
	framework_id: string | null;
	scf_control_id: string;
	status: GapStatus;
	gap_type: string | null;
	summary: string | null;
	analysis_version: string;
	supporting_atom_ids: string[];
	created_at: string;
}

export interface TextChunk {
	chunkIndex: number;
	content: string;
	charStart: number;
	charEnd: number;
	tokenCount: number;
}
