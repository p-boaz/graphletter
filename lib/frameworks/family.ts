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

const PATTERNS: [RegExp, FrameworkFamily][] = [
  [/^nist/i, "NIST"],
  [/^iso/i, "ISO"],
  [/^pci/i, "PCI"],
  [/hipaa/i, "HIPAA"],
  [/^soc\s?\d/i, "SOC"],
  [/sox/i, "SOX"],
  [/^csa/i, "CSA"],
  [/^eu|gdpr|dora/i, "EU"],
];

export function frameworkFamily(name: string): FrameworkFamily {
  for (const [re, family] of PATTERNS) {
    if (re.test(name)) return family;
  }
  return "Other";
}
