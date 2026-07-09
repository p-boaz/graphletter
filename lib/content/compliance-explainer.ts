export interface WorkflowStep {
  id: string;
  title: string;
  whatHappens: string;
  whyItMatters: string;
  whereToFind: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  plainDefinition: string;
  graphletterDefinition: string;
  whereToFind: string;
}

export interface ResultGuidance {
  status: "pass" | "partial" | "fail" | "not_applicable";
  meaning: string;
  nextAction: string;
}

export interface GraphPipelineStage {
  id: string;
  title: string;
  table: string;
  whatStored: string;
  whyItMatters: string;
}

export interface GraphDecisionRule {
  id: string;
  condition: string;
  status: "compliant" | "partial" | "missing" | "conflicting";
  gapType: string;
  explanation: string;
}

export interface GraphSignalLegendItem {
  id: string;
  label: string;
  value: string;
  meaning: string;
}

export interface AnalysisLayer {
  id: string;
  title: string;
  engine: string;
  output: string;
  whyItExists: string;
}

export const explainerIntro =
  "Graphletter turns uploaded evidence into structured compliance decisions by mapping content to SCF controls, testing against assessment objectives, and surfacing clear coverage and gaps.";

export const workflowSteps: WorkflowStep[] = [
  {
    id: "upload",
    title: "Upload an artifact",
    whatHappens:
      "You choose the documentation artifact and upload supporting evidence such as a policy, screenshot, or record.",
    whyItMatters: "Artifact choice determines which SCF controls are evaluated first.",
    whereToFind: "Upload Evidence dialog in Dashboard",
  },
  {
    id: "extract",
    title: "Extract evidence signals",
    whatHappens:
      "Graphletter reads your file and keeps track of where every statement came from, so findings can quote your document back to you.",
    whyItMatters:
      "Reliable reading of your document is the foundation for every assessment and coverage result.",
    whereToFind: "Assessment progress and evidence history",
  },
  {
    id: "map",
    title: "Map to SCF controls",
    whatHappens:
      "Graphletter breaks your document into individual claims and links each one to the controls it supports — so one policy can count toward many requirements.",
    whyItMatters:
      "Your evidence becomes reusable: one document can support many controls across many frameworks.",
    whereToFind: "Dashboard coverage and framework views",
  },
  {
    id: "objectives",
    title: "Run AI objective assessment",
    whatHappens:
      "AI evaluates each SCF assessment objective and returns pass, partial, fail, or not applicable with confidence and reasoning.",
    whyItMatters:
      "Objective-by-objective reasoning makes control interpretation auditable instead of subjective.",
    whereToFind: "Assessment Results and assessment review output",
  },
  {
    id: "aggregate",
    title: "Score each control",
    whatHappens:
      "Each control is scored by the strength of its supporting evidence and classified as compliant, partial, missing, or conflicting; any contradictory evidence flags it for review.",
    whyItMatters:
      "Consistent rules keep coverage and gap reporting traceable to the specific evidence behind each result.",
    whereToFind: "Analytics and control cards",
  },
  {
    id: "project",
    title: "Project coverage and gaps",
    whatHappens:
      "Results carry over automatically to every mapped framework — one set of evidence informs SOC 2, ISO 27001, NIST, and more.",
    whyItMatters:
      "You can prioritize remediation where it creates the largest cross-framework impact.",
    whereToFind: "Compliance Overview and Framework Explorer",
  },
];

export const graphTechniqueIntro =
  "Graphletter does not jump directly from a document to a final compliance conclusion. It first builds a traceable evidence graph, then applies consistent scoring rules to determine coverage and gaps.";

export const analysisLayers: AnalysisLayer[] = [
  {
    id: "objective-ai",
    title: "AI Objective Review",
    engine: "AI reasoning",
    output: "Objective-level pass, partial, fail, or not applicable with confidence",
    whyItExists:
      "Tests SCF assessment objectives using structured reasoning over extracted evidence.",
  },
  {
    id: "graph-coverage",
    title: "Graph Coverage Scoring",
    engine: "Rules-based graph computation",
    output:
      "Control-level compliant, partial, missing, or conflicting with traceable evidence links",
    whyItExists: "Computes explainable coverage and gap statuses from mapped evidence atoms.",
  },
];

export const graphPipelineStages: GraphPipelineStage[] = [
  {
    id: "documents",
    title: "Document Record",
    table: "documents",
    whatStored: "Source file metadata, content hash, and ingestion metadata per upload.",
    whyItMatters:
      "Creates a stable root node so every downstream decision can be traced to an upload.",
  },
  {
    id: "chunks",
    title: "Chunked Content",
    table: "document_chunks",
    whatStored: "Overlapping content slices with char offsets and token counts.",
    whyItMatters:
      "Preserves source location context so evidence claims are not detached from original text.",
  },
  {
    id: "atoms",
    title: "Evidence Atoms",
    table: "evidence_atoms",
    whatStored: "Atomic evidence claims, supporting text, confidence, and source locator.",
    whyItMatters:
      "Turns long files into reusable evidence units that can support multiple controls.",
  },
  {
    id: "map",
    title: "Control Mappings",
    table: "evidence_control_map",
    whatStored: "Edges from atom -> SCF control with mapping polarity and coverage strength.",
    whyItMatters: "Captures how strongly each atom supports or contradicts a control.",
  },
  {
    id: "gaps",
    title: "Gap Results",
    table: "control_gap_analysis",
    whatStored: "Computed status, gap type, summary, and supporting atom IDs per control.",
    whyItMatters: "Materializes report-ready, traceable gap outputs for dashboards and exports.",
  },
];

export const graphSignalLegend: GraphSignalLegendItem[] = [
  {
    id: "polarity-supports",
    label: "Mapping polarity",
    value: "supports",
    meaning: "The atom provides supporting evidence for a control.",
  },
  {
    id: "polarity-contradicts",
    label: "Mapping polarity",
    value: "contradicts",
    meaning:
      "The atom indicates contradictory evidence; any contradiction drives a conflicting status.",
  },
  {
    id: "rank-strong",
    label: "Coverage strength",
    value: "Strong, Moderate, Weak, None",
    meaning:
      "Stronger mapped evidence produces better coverage outcomes when there is no contradiction.",
  },
];

export const graphDecisionRules: GraphDecisionRule[] = [
  {
    id: "rule-conflicting",
    condition: "Any contradictory mapped evidence exists",
    status: "conflicting",
    gapType: "Conflicting evidence",
    explanation:
      "If any contradiction exists, the control is marked conflicting regardless of support.",
  },
  {
    id: "rule-compliant",
    condition: "No contradiction and support is moderate or strong",
    status: "compliant",
    gapType: "Covered by strong or moderate evidence",
    explanation:
      "Moderate or strong support with no contradiction is treated as compliant coverage.",
  },
  {
    id: "rule-partial",
    condition: "No contradiction and support is only weak",
    status: "partial",
    gapType: "Covered by weak evidence",
    explanation:
      "Weak support is visible as partial coverage and should be strengthened with better evidence.",
  },
  {
    id: "rule-missing",
    condition: "No contradiction and no meaningful support is mapped",
    status: "missing",
    gapType: "No evidence yet",
    explanation: "No meaningful supporting atom mapping exists for the control yet.",
  },
];

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "scf-controls",
    term: "SCF Control",
    plainDefinition:
      "A specific security or privacy requirement from the Secure Controls Framework.",
    graphletterDefinition:
      "The base unit Graphletter maps evidence to before showing framework-level coverage.",
    whereToFind: "Control cards, framework explorer, exports",
  },
  {
    id: "assessment-objectives",
    term: "SCF Assessment Objective",
    plainDefinition: "A testable statement used to verify whether a control is actually satisfied.",
    graphletterDefinition:
      "Graphletter evaluates each objective separately and then rolls those results into a control-level status.",
    whereToFind: "Assessment Results and assessment review dialogs",
  },
  {
    id: "assessment-procedure",
    term: "Assessment Procedure",
    plainDefinition: "The expected method for checking whether an objective is met.",
    graphletterDefinition:
      "Used as structured guidance for how evidence should be interpreted during objective evaluation.",
    whereToFind: "Assessment objective data in API and detailed records",
  },
  {
    id: "expected-results",
    term: "Expected Results",
    plainDefinition:
      "The condition or outcome that should be observable when a control is implemented correctly.",
    graphletterDefinition:
      "Compared against evidence claims to determine objective-level pass, partial, or fail outcomes.",
    whereToFind: "Assessment objective records and outputs",
  },
  {
    id: "artifacts-and-controls",
    term: "Document type",
    plainDefinition:
      "The kind of document you're uploading. Graphletter uses it to pick which controls to assess.",
    graphletterDefinition:
      "Selecting a document type helps Graphletter identify relevant controls to assess first.",
    whereToFind: "Upload Evidence > Documentation Artifact",
  },
  {
    id: "result-states",
    term: "Pass / Partial / Fail / Not Applicable",
    plainDefinition: "Standard assessment outcomes describing whether evidence meets an objective.",
    graphletterDefinition:
      "Objective-level outcomes that roll up into control-level status and dashboard metrics.",
    whereToFind: "Assessment Results, control cards, reports",
  },
  {
    id: "confidence-score",
    term: "Confidence Score",
    plainDefinition:
      "An estimate of how strongly the current evidence supports an assessment result.",
    graphletterDefinition: "Used to flag weaker conclusions even when a control appears to pass.",
    whereToFind: "Assessment output, analytics, report exports",
  },
  {
    id: "coverage-vs-gap",
    term: "Coverage vs Gap",
    plainDefinition:
      "Coverage means evidence supports required controls; gaps are missing, weak, or conflicting support.",
    graphletterDefinition:
      "Graphletter classifies gaps to prioritize what evidence to add or improve next.",
    whereToFind: "Dashboard gap summary and priority controls",
  },
  {
    id: "framework-mapping",
    term: "One assessment, many frameworks",
    plainDefinition: "SCF acts as a common layer that maps controls to many external frameworks.",
    graphletterDefinition:
      "One mapped evidence set can influence SOC 2, ISO 27001, NIST, and other framework views.",
    whereToFind: "Framework Explorer and framework-focused dashboard mode",
  },
];

export const resultGuidance: ResultGuidance[] = [
  {
    status: "pass",
    meaning: "Evidence clearly supports the objective or control requirement.",
    nextAction: "Keep evidence current and improve documentation quality if confidence is low.",
  },
  {
    status: "partial",
    meaning:
      "Evidence supports part of the requirement but important elements are missing or unclear.",
    nextAction: "Address the missing objective elements and upload updated evidence.",
  },
  {
    status: "fail",
    meaning: "Current evidence does not demonstrate the requirement is met.",
    nextAction:
      "Prioritize remediation, then upload stronger evidence mapped to the same controls.",
  },
  {
    status: "not_applicable",
    meaning: "The objective does not apply to the provided evidence or current context.",
    nextAction: "Validate applicability assumptions and attach context for audit traceability.",
  },
];

export interface MaturityLevel {
  level: number;
  label: string;
  summary: string;
}

export const maturityLevels: MaturityLevel[] = [
  {
    level: 0,
    label: "Not Performed",
    summary:
      "No evidence of a capability to implement the control. Processes are absent or entirely ad hoc.",
  },
  {
    level: 1,
    label: "Performed Informally",
    summary:
      "Efforts are ad hoc and inconsistent. Controls may exist but lack formal documentation, ownership, or repeatable processes.",
  },
  {
    level: 2,
    label: "Planned & Tracked",
    summary:
      "Efforts are requirements-driven and formally governed at a local or regional level, but not consistent across the organization.",
  },
  {
    level: 3,
    label: "Well Defined",
    summary:
      "Efforts are standardized across the organization and centrally managed to ensure consistency. Policies, procedures, and metrics are documented and enforced.",
  },
  {
    level: 4,
    label: "Quantitatively Controlled",
    summary:
      "Efforts are metrics-driven with sufficient management insight to predict performance and identify deviations proactively.",
  },
  {
    level: 5,
    label: "Continuously Improving",
    summary:
      "Processes are optimized through continuous feedback loops, adapting to evolving threats and organizational changes.",
  },
];

export const scfSourceLinks = [
  {
    label: "Secure Controls Framework",
    href: "https://securecontrolsframework.com/",
  },
  {
    label: "SCF Download and resource hub",
    href: "https://securecontrolsframework.com/scf-download/",
  },
  {
    label: "SCF release updates",
    href: "https://securecontrolsframework.com/news/secure-controls-framework-scf-releases-version-2025-2-2",
  },
];
