export interface DemoSample {
  id: string;
  label: string;
  /**
   * @deprecated Kept equal to `label` for one release cycle of
   * backwards compat. Downstream callers should migrate to `label`.
   */
  artifactName: string;
  erlId: string;
  scfControlId: string;
  sampleFileName: string;
  evidenceType: string;
  /** Plain-English description of what this document is */
  documentDescription: string;
  /** What the compliance requirement checks for */
  controlSummary: string;
}

/**
 * Demo samples: each maps to an artifact with exactly 1 SCF control,
 * keeping AI workload minimal for anonymous users.
 */
export const DEMO_SAMPLES: DemoSample[] = [
  {
    id: "gov-charter",
    label: "Cybersecurity Program Charter",
    artifactName: "Cybersecurity Program Charter",
    erlId: "E-GOV-01",
    scfControlId: "GOV-01",
    sampleFileName: "sample-cybersecurity-charter.txt",
    evidenceType: "policy",
    documentDescription:
      "A governance document that defines an organization's cybersecurity program — its structure, roles, and objectives.",
    controlSummary:
      "Does the organization have a formal cybersecurity program with defined governance, roles, and responsibilities?",
  },
  {
    id: "crypto-key-mgmt",
    label: "Cryptographic Key Management",
    artifactName: "Cryptographic Key Management",
    erlId: "E-CRY-02",
    scfControlId: "CRY-09",
    sampleFileName: "sample-crypto-key-management.txt",
    evidenceType: "procedure",
    documentDescription:
      "A technical procedure describing how cryptographic keys are generated, stored, rotated, and destroyed.",
    controlSummary:
      "Does the organization manage cryptographic keys through their full lifecycle — generation, storage, rotation, and destruction?",
  },
  {
    id: "privacy-notice",
    label: "Data Privacy Notice",
    artifactName: "Data Privacy Notice",
    erlId: "E-PRI-08",
    scfControlId: "PRI-02",
    sampleFileName: "sample-data-privacy-notice.txt",
    evidenceType: "policy",
    documentDescription:
      "A privacy notice that tells individuals what personal data is collected, how it's used, and what rights they have.",
    controlSummary:
      "Does the organization provide clear notice about its data collection, use, and sharing practices?",
  },
];

export function getDemoSampleById(id: string): DemoSample | undefined {
  return DEMO_SAMPLES.find((s) => s.id === id);
}
