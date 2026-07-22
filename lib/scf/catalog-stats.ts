// Public-copy stats derived from the committed seed snapshot so marketing
// surfaces can never drift from the imported SCF catalog again (the 2026.2
// upgrade shipped while the homepage hero still announced 2026.1.1).
// data/seed/expected_row_counts.json is regenerated and committed on every SCF
// version bump (scripts/snapshot-row-counts.ts, run after `pnpm seed`);
// catalog-stats.test.ts pins it against the framework manifest and the
// generated framework columns.
import seedSnapshot from "../../data/seed/expected_row_counts.json";

export const SCF_EDITION: string = seedSnapshot.scfVersion;
export const FRAMEWORK_COUNT: number = seedSnapshot.tables.scf_frameworks;
export const CONTROL_COUNT: number = seedSnapshot.tables.scf_controls;
export const CROSSWALK_COUNT: number = seedSnapshot.tables.scf_control_mappings;

// en-US pinned: server renders must produce identical copy regardless of the
// host locale (Vercel runs UTC/C locale).
export function formatStat(value: number): string {
  return value.toLocaleString("en-US");
}
