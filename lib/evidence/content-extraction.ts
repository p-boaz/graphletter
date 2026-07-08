import { createLogger } from "@/lib/logger";

const log = createLogger("lib/evidence/content-extraction");

export function normalizeCanonicalText(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export async function extractFileContent(file: File): Promise<string> {
  log.info("evidence_content.extracting", {
    fileName: file.name,
    fileType: file.type,
  });

  try {
    if (file.type === "text/plain" || file.type === "text/csv" || file.type === "text/markdown") {
      return normalizeCanonicalText(await file.text());
    }

    if (file.type === "application/pdf") {
      return normalizeCanonicalText(await extractPdfContent(file));
    }

    if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      return normalizeCanonicalText(await extractWordContent(file));
    }

    if (file.type.includes("image/")) {
      return normalizeCanonicalText(await extractImageContent(file));
    }

    if (file.type.includes("sheet") || file.type.includes("excel")) {
      return normalizeCanonicalText(await extractSpreadsheetContent(file));
    }

    log.info("evidence_content.unknown_type_text_fallback", {
      fileType: file.type,
    });
    try {
      const content = await file.text();
      return normalizeCanonicalText(content || "[Document appears to be empty or binary]");
    } catch {
      return "[Document content could not be extracted - unsupported format]";
    }
  } catch (error) {
    log.error("evidence_content.extraction_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return `[Content extraction failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
  }
}

async function extractPdfContent(file: File): Promise<string> {
  log.debug("evidence_content.pdf_started", {
    fileName: file.name,
    fileSize: file.size,
  });

  try {
    try {
      const pdfParse = (await import("pdf-parse")) as unknown as {
        default: (buffer: Buffer) => Promise<{ text?: string; numpages?: number }>;
      };
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse.default(buffer);
      const text = data.text ? data.text.trim() : "";
      log.info("evidence_content.pdf_extracted", {
        characters: text.length,
        pages: data.numpages,
      });
      if (!text) {
        log.warn("evidence_content.pdf_no_text", {});
        return "[PDF document contains no extractable text - may be image-based or encrypted]";
      }
      return text;
    } catch (pdfParseError) {
      const parsedPdfParseError =
        pdfParseError instanceof Error ? pdfParseError : new Error(String(pdfParseError));
      log.warn("evidence_content.pdf_parse_failed", {
        detail: parsedPdfParseError.message,
      });

      try {
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();
        const fileSize = Math.round(arrayBuffer.byteLength / 1024);
        log.info("evidence_content.pdf_lib_loaded", { pageCount, fileSize });
        return `[PDF document loaded (${pageCount} pages, ${fileSize}KB) but text extraction failed. The PDF may be image-based, encrypted, or have complex formatting. Consider converting to Word/text format or using OCR.]`;
      } catch (pdfLibError) {
        const parsedPdfLibError =
          pdfLibError instanceof Error ? pdfLibError : new Error(String(pdfLibError));
        log.warn("evidence_content.pdf_lib_failed", {
          detail: parsedPdfLibError.message,
        });
        const fileSize = Math.round((await file.arrayBuffer()).byteLength / 1024);
        return `[PDF document detected (${fileSize}KB) but processing failed. File may be corrupted, password-protected, or in an unsupported format.]`;
      }
    }
  } catch (error) {
    log.error("evidence_content.pdf_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[PDF processing failed - file may be corrupted or password-protected]";
  }
}

async function extractWordContent(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    log.info("evidence_content.word_extracted", { characters: text.length });
    if (result.messages.length > 0) {
      log.warn("evidence_content.word_warnings", { count: result.messages.length });
    }
    return text || "[Word document appears to contain no extractable text]";
  } catch (error) {
    log.error("evidence_content.word_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Word document content could not be extracted]";
  }
}

async function extractImageContent(file: File): Promise<string> {
  try {
    const Tesseract = await import("tesseract.js");
    log.debug("evidence_content.ocr_started");
    const {
      data: { text },
    } = await Tesseract.recognize(file, "eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          log.debug("evidence_content.ocr_progress", {
            progress: Math.round(message.progress * 100),
          });
        }
      },
    });
    const cleanText = text.trim().replace(/\n\s*\n/g, "\n");
    log.info("evidence_content.ocr_complete", { characters: cleanText.length });
    return cleanText || "[Image does not contain readable text or OCR failed]";
  } catch (error) {
    log.error("evidence_content.ocr_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Image OCR processing failed - image may not contain readable text]";
  }
}

async function extractSpreadsheetContent(file: File): Promise<string> {
  try {
    if (file.type === "text/csv") {
      return await file.text();
    }
    return "[Spreadsheet detected - content extraction limited. Please export as CSV or PDF for full text analysis]";
  } catch (error) {
    log.error("evidence_content.spreadsheet_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return "[Spreadsheet content could not be extracted]";
  }
}
