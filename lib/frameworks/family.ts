export type FrameworkFamily =
  | "NIST"
  | "ISO"
  | "PCI"
  | "HIPAA"
  | "SOC"
  | "SOX"
  | "CSA"
  | "EU"
  | "Other";

// Publisher (manifest `family` field, served by /api/scf/frameworks) → UI
// bucket. Publishers that span several buckets (e.g. "Federal" covers HIPAA,
// SOX, FedRAMP, CJIS) fall through to the name patterns below.
const PUBLISHER_BUCKETS: Record<string, FrameworkFamily> = {
  NIST: "NIST",
  ISO: "ISO",
  "PCI SSC": "PCI",
  CSA: "CSA",
  EU: "EU",
  AICPA: "SOC",
};

// Name fallback for buckets that are law/report-specific rather than
// publisher-specific, and for frameworks served without a family value.
const NAME_PATTERNS: [RegExp, FrameworkFamily][] = [
  [/hipaa/i, "HIPAA"],
  [/^soc\s?\d/i, "SOC"],
  [/sox/i, "SOX"],
  [/^nist/i, "NIST"],
  [/^iso/i, "ISO"],
  [/^pci/i, "PCI"],
  [/^csa/i, "CSA"],
  [/^eu|gdpr|dora/i, "EU"],
];

export function frameworkFamily(name: string, publisher?: string | null): FrameworkFamily {
  for (const [re, family] of NAME_PATTERNS.slice(0, 3)) {
    if (re.test(name)) return family;
  }
  if (publisher && PUBLISHER_BUCKETS[publisher]) {
    return PUBLISHER_BUCKETS[publisher];
  }
  for (const [re, family] of NAME_PATTERNS) {
    if (re.test(name)) return family;
  }
  return "Other";
}
