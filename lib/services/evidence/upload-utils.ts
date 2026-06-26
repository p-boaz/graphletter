import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

const MAX_EVIDENCE_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_EVIDENCE_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
]);

const MIME_EXTENSION_MAP: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".txt", ".text", ".md", ".log"],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
};

const UNSAFE_FILE_TYPE_ERROR =
  "File contents do not match the selected file type. Please upload a valid PDF, Word, Excel, text, or image file.";

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return (
    hasBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    hasBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    hasBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

function hasOleSignature(bytes: Uint8Array): boolean {
  return hasBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  return !bytes.some((byte) => byte === 0x00);
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function extensionMatches(file: File): boolean {
  const allowedExtensions = MIME_EXTENSION_MAP[file.type] ?? [];
  return allowedExtensions.includes(fileExtension(file.name));
}

function signatureMatches(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case "application/pdf":
      return hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "application/msword":
    case "application/vnd.ms-excel":
      return hasOleSignature(bytes);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return hasZipSignature(bytes);
    case "text/plain":
    case "text/csv":
      return looksLikeText(bytes);
    case "image/png":
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return (
        hasBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        hasBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      );
    default:
      return false;
  }
}

export async function validateEvidenceUploadFile(file: File | null | undefined): Promise<{
  isValid: boolean;
  error?: string;
}> {
  if (!file) {
    return { isValid: false, error: "File is required" };
  }

  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return { isValid: false, error: "File size must be less than 50MB" };
  }

  if (!ALLOWED_EVIDENCE_FILE_TYPES.has(file.type)) {
    return {
      isValid: false,
      error: "Unsupported file type. Please upload PDF, Word, Excel, text, or image files.",
    };
  }

  if (!extensionMatches(file)) {
    return {
      isValid: false,
      error: UNSAFE_FILE_TYPE_ERROR,
    };
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!signatureMatches(file.type, header)) {
    return {
      isValid: false,
      error: UNSAFE_FILE_TYPE_ERROR,
    };
  }

  return { isValid: true };
}

export function createEvidenceServiceClient() {
  return createServiceClient(getSupabaseServerUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
