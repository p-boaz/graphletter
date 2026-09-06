import type { EvidenceAtomType, TextChunk } from "@/lib/graph/types";

export interface BootstrapAtomInput {
  documentId: string;
  chunkId: string;
  userId: string;
  chunk: TextChunk;
  extractorVersion?: string;
}

export interface BootstrapAtomInsert {
  document_id: string;
  chunk_id: string;
  user_id: string;
  atom_type: EvidenceAtomType;
  claim: string;
  supporting_text: string;
  confidence: number;
  source_locator: Record<string, unknown>;
  extractor_version: string;
  metadata: Record<string, unknown>;
}

export function buildBootstrapAtom(input: BootstrapAtomInput): BootstrapAtomInsert {
  const normalized = input.chunk.content.replace(/\s+/g, " ").trim();
  const claim = normalized ? normalized.slice(0, 300) : "[No extracted content]";

  return {
    document_id: input.documentId,
    chunk_id: input.chunkId,
    user_id: input.userId,
    atom_type: "other",
    claim,
    supporting_text: input.chunk.content,
    confidence: 0.2,
    source_locator: {
      chunk_index: input.chunk.chunkIndex,
      char_start: input.chunk.charStart,
      char_end: input.chunk.charEnd,
    },
    extractor_version: input.extractorVersion ?? "stage1-bootstrap-v1",
    metadata: {
      bootstrap: true,
      source: "legacy_evidence",
    },
  };
}
