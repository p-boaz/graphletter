import type { CoverageStrength, MappingMethod, TextChunk } from "@/lib/graph/types";
import { createClient } from "@/lib/supabase/server";

export interface CreateDocumentInput {
  userId: string;
  sourceEvidenceId?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  sourceHash?: string | null;
  ingestionStatus?: "pending" | "processed" | "failed";
  metadata?: Record<string, unknown>;
}

export interface CreateChunkInput {
  documentId: string;
  chunk: TextChunk;
  metadata?: Record<string, unknown>;
}

export interface CreateAtomInput {
  documentId: string;
  chunkId?: string | null;
  userId: string;
  atomType: string;
  claim: string;
  supportingText?: string | null;
  confidence?: number | null;
  sourceLocator?: Record<string, unknown> | null;
  extractorVersion: string;
  metadata?: Record<string, unknown>;
}

export interface CreateControlMapInput {
  atomId: string;
  scfControlId: string;
  mappingMethod: MappingMethod;
  coverageStrength: CoverageStrength;
  mappingPolarity?: "supports" | "contradicts";
  rationale?: string | null;
  mappedBy?: string | null;
}

export async function createGraphDocument(input: CreateDocumentInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: input.userId,
      source_evidence_id: input.sourceEvidenceId ?? null,
      file_name: input.fileName ?? null,
      file_type: input.fileType ?? null,
      file_size: input.fileSize ?? null,
      storage_path: input.storagePath ?? null,
      source_hash: input.sourceHash ?? null,
      ingestion_status: input.ingestionStatus ?? "pending",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create graph document: ${error.message}`);
  }

  return data as { id: string };
}

export async function upsertDocumentChunk(input: CreateChunkInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_chunks")
    .upsert(
      {
        document_id: input.documentId,
        chunk_index: input.chunk.chunkIndex,
        content: input.chunk.content,
        char_start: input.chunk.charStart,
        char_end: input.chunk.charEnd,
        token_count: input.chunk.tokenCount,
        metadata: input.metadata ?? {},
      },
      { onConflict: "document_id,chunk_index" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert document chunk: ${error.message}`);
  }

  return data as { id: string };
}

export async function insertEvidenceAtom(input: CreateAtomInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_atoms")
    .insert({
      document_id: input.documentId,
      chunk_id: input.chunkId ?? null,
      user_id: input.userId,
      atom_type: input.atomType,
      claim: input.claim,
      supporting_text: input.supportingText ?? null,
      confidence: input.confidence ?? null,
      source_locator: input.sourceLocator ?? null,
      extractor_version: input.extractorVersion,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert evidence atom: ${error.message}`);
  }

  return data as { id: string };
}

export async function upsertEvidenceControlMap(input: CreateControlMapInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_control_map")
    .upsert(
      {
        atom_id: input.atomId,
        scf_control_id: input.scfControlId,
        mapping_method: input.mappingMethod,
        coverage_strength: input.coverageStrength,
        mapping_polarity: input.mappingPolarity ?? "supports",
        rationale: input.rationale ?? null,
        mapped_by: input.mappedBy ?? null,
      },
      { onConflict: "atom_id,scf_control_id" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert evidence/control mapping: ${error.message}`);
  }

  return data as { id: string };
}
