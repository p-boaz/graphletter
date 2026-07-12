/** Shared contract for framework-mapping pagination/search
 * (app/frameworks/[id]/page.tsx and app/api/scf/frameworks/[id]/route.ts). */

export const MAPPINGS_PAGE_SIZE = 24;

export function parseBoundedInt(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Control identifiers are word chars, dots, dashes; strip anything that could
 * splice into the PostgREST or() filter syntax.
 */
export function sanitizeMappingQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^\w.\s-]/g, "").trim();
}

/** PostgREST or() filter for a sanitized control-identifier search. */
export function mappingSearchFilter(q: string): string {
  return `framework_control_id.ilike.%${q}%,control_id.ilike.%${q}%`;
}
