import { buildBootstrapAtom } from "@/lib/graph/atom-bootstrap";
import { chunkText } from "@/lib/graph/chunking";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EvidenceContentSource {
  extracted_content?: string | null;
  processed_content?: string | null;
  evidence_data?: unknown;
}

export interface ChunkBootstrapResult {
  chunkCount: number;
  createdAtomCount: number;
  mappedCount: number;
  atomIds: string[];
}

export function resolveEvidenceContent(source: EvidenceContentSource): string {
  if (source.extracted_content?.trim()) return source.extracted_content;
  if (source.processed_content?.trim()) return source.processed_content;
  if (source.evidence_data != null) return JSON.stringify(source.evidence_data);
  return "";
}

export async function chunkAndBootstrapDocument(options: {
  supabase: SupabaseClient;
  documentId: string;
  userId: string;
  content: string;
  scfControlId?: string | null;
  extractorVersion?: string;
}): Promise<ChunkBootstrapResult> {
  const extractorVersion = options.extractorVersion ?? "stage1-bootstrap-v1";
  const chunks = chunkText(options.content, { chunkSize: 1200, overlap: 200 });

  let createdAtomCount = 0;
  let mappedCount = 0;
  const atomIds: string[] = [];

  for (const chunk of chunks) {
    const { data: chunkRows, error: chunkError } = await options.supabase
      .from("document_chunks")
      .upsert(
        {
          document_id: options.documentId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          token_count: chunk.tokenCount,
          metadata: {
            source: "api",
            extractor_version: extractorVersion,
          },
        },
        { onConflict: "document_id,chunk_index" }
      )
      .select("id")
      .single();

    if (chunkError || !chunkRows?.id) {
      throw new Error(
        `Failed to upsert chunk ${chunk.chunkIndex}: ${chunkError?.message ?? "missing chunk id"}`
      );
    }

    const chunkId = chunkRows.id as string;

    const { data: existingAtom } = await options.supabase
      .from("evidence_atoms")
      .select("id")
      .eq("chunk_id", chunkId)
      .eq("extractor_version", extractorVersion)
      .maybeSingle();

    let atomId = existingAtom?.id as string | undefined;

    if (!atomId) {
      const atomPayload = buildBootstrapAtom({
        documentId: options.documentId,
        chunkId,
        userId: options.userId,
        chunk,
        extractorVersion,
      });

      const { data: atomRow, error: atomError } = await options.supabase
        .from("evidence_atoms")
        .insert(atomPayload)
        .select("id")
        .single();

      if (atomError || !atomRow?.id) {
        throw new Error(
          `Failed to create bootstrap atom for chunk ${chunk.chunkIndex}: ${atomError?.message ?? "missing atom id"}`
        );
      }

      atomId = atomRow.id as string;
      createdAtomCount += 1;
    }

    if (atomId) {
      atomIds.push(atomId);
    }

    if (atomId && options.scfControlId) {
      const { error: mapError } = await options.supabase.from("evidence_control_map").upsert(
        {
          atom_id: atomId,
          scf_control_id: options.scfControlId,
          mapping_method: "rule",
          coverage_strength: "weak",
          mapping_polarity: "supports",
          rationale: "seeded from source evidence control",
        },
        { onConflict: "atom_id,scf_control_id" }
      );

      if (mapError) {
        throw new Error(`Failed to map atom to control: ${mapError.message}`);
      }

      mappedCount += 1;
    }
  }

  return {
    chunkCount: chunks.length,
    createdAtomCount,
    mappedCount,
    atomIds,
  };
}

export function coverageStrengthRank(strength: string): number {
  switch (strength) {
    case "strong":
      return 4;
    case "moderate":
      return 3;
    case "weak":
      return 2;
    case "none":
      return 1;
    default:
      return 0;
  }
}

export function rankToCoverageStatus(rank: number): "compliant" | "partial" | "missing" {
  if (rank >= 3) return "compliant";
  if (rank >= 2) return "partial";
  return "missing";
}
