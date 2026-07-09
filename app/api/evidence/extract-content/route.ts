import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { extractFileContent, normalizeCanonicalText } from "@/lib/evidence/content-extraction";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { errorProgressSession, updateProgress } from "@/lib/progress/progress-store";
import { validateEvidenceUploadFile } from "@/lib/services/evidence/upload-utils";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("evidence/extract-content");

const EXTRACTION_TIMEOUT_MS = 90_000;
const MAX_CONTENT_CHARS = 200_000;
const EXTRACT_RATE_LIMIT = {
  namespace: "evidence_extract_content",
  user: { windowMs: 60_000, maxRequests: 20 },
  ip: { windowMs: 60_000, maxRequests: 60 },
  message: "Rate limit exceeded for content extraction. Please retry shortly.",
} as const;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export async function POST(request: NextRequest) {
  log.info("Content extraction started");

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      log.warn("evidence.extract_content.unauthorized", {});
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = checkRouteRateLimit(EXTRACT_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) return rateLimitResponse;

    const sessionId = request.headers.get("x-progress-session");
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const fileValidationResult = await validateEvidenceUploadFile(file);
    if (!fileValidationResult.isValid) {
      return NextResponse.json(
        { error: fileValidationResult.error || "Invalid evidence upload file" },
        { status: 400 }
      );
    }

    log.info("Extracting content", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    if (sessionId) {
      await updateProgress(
        supabase,
        sessionId,
        "extracting-content",
        15,
        "Extracting document content",
        {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }
      );
    }

    try {
      const rawContent = await withTimeout(
        extractFileContent(file),
        EXTRACTION_TIMEOUT_MS,
        "Content extraction timed out"
      );
      const canonicalContent = normalizeCanonicalText(rawContent);
      const truncated = canonicalContent.length > MAX_CONTENT_CHARS;
      const fileContent = truncated
        ? canonicalContent.slice(0, MAX_CONTENT_CHARS)
        : canonicalContent;
      log.info("Content extracted", {
        characters: fileContent.length,
        rawCharacters: canonicalContent.length,
        truncated,
      });

      // For images, also return base64 data for direct AI analysis
      let imageData = null;
      if (file.type.includes("image/")) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        imageData = {
          base64: base64,
          mimeType: file.type,
        };
      }

      if (sessionId) {
        await updateProgress(
          supabase,
          sessionId,
          "content-extracted",
          25,
          "Document content extracted",
          {
            fileName: file.name,
            characters: fileContent.length,
            hasImageData: Boolean(imageData),
          }
        );
      }

      return NextResponse.json({
        success: true,
        content: fileContent,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        imageData: imageData,
        truncated,
      });
    } catch (error) {
      if (sessionId) {
        await errorProgressSession(
          supabase,
          sessionId,
          error instanceof Error ? error.message : "Content extraction failed"
        );
      }
      return apiError("evidence.extract_content_failed", "Content extraction failed", 500, error);
    }
  } catch (error) {
    const sessionId = request.headers.get("x-progress-session");
    if (sessionId) {
      const supabase2 = await createClient().catch(() => null);
      if (supabase2) {
        await errorProgressSession(
          supabase2,
          sessionId,
          error instanceof Error ? error.message : "Content extraction request failed"
        );
      }
    }
    return apiError("evidence.extract_content_request_failed", "Request failed", 500, error);
  }
}
