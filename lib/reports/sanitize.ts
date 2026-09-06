/**
 * PDF content sanitization utility.
 * Sanitizes user-sourced strings at the PDF render boundary.
 * Defense in depth — pdf-lib doesn't execute scripts, but sanitizing is cheap insurance.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const DEFAULT_MAX_LENGTH = 10_000;
const DEFAULT_FIELD_LIMITS: Record<string, number> = {
  title: 200,
  summary: 2_000,
  description: 5_000,
  controlId: 50,
  frameworkName: 100,
  domainName: 200,
};

/**
 * Sanitize a single string for safe PDF rendering.
 * Strips HTML tags, control characters, and limits length.
 */
export function sanitizeForPDF(value: string | null | undefined, maxLength?: number): string {
  if (!value) return "";

  let sanitized = value.replace(HTML_TAG_RE, "").replace(CONTROL_CHAR_RE, "").trim();

  const limit = maxLength ?? DEFAULT_MAX_LENGTH;
  if (sanitized.length > limit) {
    sanitized = sanitized.slice(0, limit - 3) + "...";
  }

  return sanitized;
}

/**
 * Sanitize a string using a named field limit.
 */
export function sanitizeField(fieldName: string, value: string | null | undefined): string {
  const limit = DEFAULT_FIELD_LIMITS[fieldName] ?? DEFAULT_MAX_LENGTH;
  return sanitizeForPDF(value, limit);
}

/**
 * Sanitize all string values in an object for PDF rendering.
 * Non-string values are passed through unchanged.
 */
export function sanitizeRecord<T extends Record<string, unknown>>(
  record: T,
  fieldLimits?: Record<string, number>
): T {
  const result = { ...record };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      const limit = fieldLimits?.[key] ?? DEFAULT_FIELD_LIMITS[key] ?? DEFAULT_MAX_LENGTH;
      (result as Record<string, unknown>)[key] = sanitizeForPDF(value, limit);
    }
  }
  return result;
}
