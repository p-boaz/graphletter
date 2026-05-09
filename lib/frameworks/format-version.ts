/**
 * Format a framework version string for display.
 *
 * Some SCF frameworks use alphabetic prefixes ("rev5", "v4.0.1") while others
 * use plain numerics ("4.0.1", "2023"). The UI previously prefixed every value
 * with a literal "v", producing "vrev5" and "vv4.0.1". This helper adds "v"
 * only when the raw value starts with a digit.
 *
 * Returns `null` for missing/empty input so callers can omit the badge.
 */
export function formatFrameworkVersion(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z]/.test(trimmed)) return trimmed;
  return `v${trimmed}`;
}
