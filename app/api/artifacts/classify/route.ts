import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { classifyArtifactFromFilename } from "@/lib/artifact-classifier/classify";
import { createRequestLogger, getOrCreateRequestId } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const bodySchema = z.object({
  filename: z.string().min(1).max(512),
  mimeType: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const log = createRequestLogger(requestId);

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    parsed = bodySchema.parse(raw);
  } catch (error) {
    log.warn("classify_bad_request", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await classifyArtifactFromFilename(parsed.filename, {
      mimeType: parsed.mimeType,
    });
    log.info("classify_success", {
      filename: parsed.filename,
      artifact: result.artifact,
      confidence: result.confidence,
    });
    return NextResponse.json(result);
  } catch (error) {
    log.error("classify_failed", {
      filename: parsed.filename,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Classifier unavailable" }, { status: 503 });
  }
}
