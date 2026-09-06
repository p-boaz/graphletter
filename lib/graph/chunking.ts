import type { TextChunk } from "@/lib/graph/types";

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 200;

function estimateTokenCount(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function chunkText(content: string, options: ChunkingOptions = {}): TextChunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be >= 0 and < chunkSize");
  }

  if (!content) {
    return [
      {
        chunkIndex: 0,
        content: "",
        charStart: 1,
        charEnd: 0,
        tokenCount: 0,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  const step = chunkSize - overlap;
  let chunkIndex = 0;

  for (let start = 0; start < content.length; start += step) {
    const endExclusive = Math.min(start + chunkSize, content.length);
    const chunkContent = content.slice(start, endExclusive);

    chunks.push({
      chunkIndex,
      content: chunkContent,
      charStart: start + 1,
      charEnd: endExclusive,
      tokenCount: estimateTokenCount(chunkContent),
    });

    chunkIndex += 1;

    if (endExclusive >= content.length) {
      break;
    }
  }

  return chunks;
}
