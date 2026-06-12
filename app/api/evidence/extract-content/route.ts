import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { errorProgressSession, updateProgress } from "@/lib/progress/progress-store";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("evidence/extract-content");

const EXTRACTION_TIMEOUT_MS = 90_000;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_CONTENT_CHARS = 200_000;
const EXTRACT_RATE_LIMIT = {
  namespace: "evidence_extract_content",
  user: { windowMs: 60_000, maxRequests: 20 },
  ip: { windowMs: 60_000, maxRequests: 60 },
  message: "Rate limit exceeded for content extraction. Please retry shortly.",
} as const;

interface PdfParseResult {
  numpages: number;
  numrender: number;
  info: unknown;
  text?: string;
}

interface PdfParseModule {
  default: (buffer: Buffer) => Promise<PdfParseResult>;
}

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

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
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
      const truncated = rawContent.length > MAX_CONTENT_CHARS;
      const fileContent = truncated ? rawContent.slice(0, MAX_CONTENT_CHARS) : rawContent;
      log.info("Content extracted", {
        characters: fileContent.length,
        rawCharacters: rawContent.length,
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

// Extract text content from uploaded files (same as smart-upload)
export async function extractFileContent(file: File): Promise<string> {
  log.info("Extracting file content", {
    fileName: file.name,
    fileType: file.type,
  });

  try {
    // Text files - direct reading
    if (file.type === "text/plain" || file.type === "text/csv") {
      log.debug("Processing text file");
      return await file.text();
    }

    // PDF files - use pdf-parse
    else if (file.type === "application/pdf") {
      log.debug("Processing PDF file");
      const result = await extractPdfContent(file);
      return result;
    }

    // Word documents - use mammoth
    else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      log.debug("Processing Word document");
      return await extractWordContent(file);
    }

    // Images - use OCR
    else if (file.type.includes("image/")) {
      log.debug("Processing image with OCR");
      return await extractImageContent(file);
    }

    // Excel files - limited text extraction
    else if (file.type.includes("sheet") || file.type.includes("excel")) {
      log.debug("Processing spreadsheet (limited extraction)");
      return await extractSpreadsheetContent(file);
    }

    // Other document types - try as text fallback
    else {
      log.info("Unknown file type, attempting text extraction", {
        fileType: file.type,
      });
      try {
        const content = await file.text();
        return content || "[Document appears to be empty or binary]";
      } catch {
        return "[Document content could not be extracted - unsupported format]";
      }
    }
  } catch (error) {
    log.error("evidence.extract_content.extraction_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return `[Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }
}

// Extract text from PDF files
async function extractPdfContent(file: File): Promise<string> {
  log.debug("Starting PDF extraction", {
    fileName: file.name,
    fileSize: file.size,
  });

  try {
    // Use pdf-parse for actual text extraction
    try {
      const pdfParse = (await import("pdf-parse")) as unknown as PdfParseModule;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const data = await pdfParse.default(buffer);

      const text = data.text ? data.text.trim() : "";
      log.info("PDF text extracted", {
        characters: text.length,
        pages: data.numpages,
      });

      if (!text) {
        log.warn("evidence.extract_content.pdf_no_text", {});
        return "[PDF document contains no extractable text - may be image-based or encrypted]";
      }

      return text;
    } catch (pdfParseError) {
      const parsedPdfParseError =
        pdfParseError instanceof Error ? pdfParseError : new Error(String(pdfParseError));
      log.warn("evidence.extract_content.pdf_parse_failed", {
        detail: parsedPdfParseError.message,
      });

      // Fallback to pdf-lib for basic validation
      log.info("Attempting pdf-lib fallback");
      try {
        const { PDFDocument } = await import("pdf-lib");

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        const pageCount = pdfDoc.getPageCount();
        const fileSize = Math.round(arrayBuffer.byteLength / 1024);
        log.info("PDF loaded with pdf-lib fallback", { pageCount, fileSize });

        return `[PDF document loaded (${pageCount} pages, ${fileSize}KB) but text extraction failed. The PDF may be image-based, encrypted, or have complex formatting. Consider converting to Word/text format or using OCR.]`;
      } catch (pdfLibError) {
        const parsedPdfLibError =
          pdfLibError instanceof Error ? pdfLibError : new Error(String(pdfLibError));
        log.warn("evidence.extract_content.pdf_lib_fallback_failed", {
          detail: parsedPdfLibError.message,
        });

        // Final fallback - just acknowledge the PDF
        const arrayBuffer = await file.arrayBuffer();
        const fileSize = Math.round(arrayBuffer.byteLength / 1024);
        return `[PDF document detected (${fileSize}KB) but processing failed. File may be corrupted, password-protected, or in an unsupported format.]`;
      }
    }
  } catch (error) {
    log.error("evidence.extract_content.pdf_all_methods_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[PDF processing failed - file may be corrupted or password-protected]";
  }
}

// Extract text from Word documents
async function extractWordContent(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await mammoth.extractRawText({ buffer: buffer });

    const text = result.value.trim();
    log.info("Word document extracted", { characters: text.length });

    if (result.messages.length > 0) {
      log.warn("evidence.extract_content.word_extraction_warnings", {
        count: result.messages.length,
      });
    }

    if (!text) {
      return "[Word document appears to contain no extractable text]";
    }

    return text;
  } catch (error) {
    log.error("evidence.extract_content.word_extraction_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Word document content could not be extracted]";
  }
}

// Extract text from images using OCR
async function extractImageContent(file: File): Promise<string> {
  try {
    const Tesseract = await import("tesseract.js");

    log.debug("Starting OCR processing");
    const {
      data: { text },
    } = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          log.debug("OCR progress", { progress: Math.round(m.progress * 100) });
        }
      },
    });

    const cleanText = text.trim().replace(/\n\s*\n/g, "\n");
    log.info("OCR extraction complete", { characters: cleanText.length });

    if (!cleanText) {
      return "[Image does not contain readable text or OCR failed]";
    }

    return cleanText;
  } catch (error) {
    log.error("evidence.extract_content.ocr_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Image OCR processing failed - image may not contain readable text]";
  }
}

// Limited extraction from spreadsheet files
async function extractSpreadsheetContent(file: File): Promise<string> {
  try {
    // For CSV files, we can read directly
    if (file.type === "text/csv") {
      return await file.text();
    }

    // For Excel files, we'd need a specialized library like xlsx
    // For now, return a meaningful message
    return "[Spreadsheet detected - content extraction limited. Please export as CSV or PDF for full text analysis]";
  } catch (error) {
    log.error("evidence.extract_content.spreadsheet_extraction_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Spreadsheet content could not be extracted]";
  }
}
