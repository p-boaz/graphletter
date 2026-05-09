export type ResearchStatus = "active" | "planned" | "shipped";

export interface ResearchTopic {
  slug: string;
  title: string;
  status: ResearchStatus;
  summary: string;
  bullets: string[];
  links?: { label: string; href: string }[];
  lastUpdated?: string;
}

export const RESEARCH_TOPICS: ResearchTopic[] = [
  {
    slug: "control-graph-modeling",
    title: "Control Graph Modeling",
    status: "active",
    summary:
      "Modeling relationships between SCF controls, assessment objectives, and cross-framework mappings as a navigable graph structure.",
    bullets: [
      "SCF 2025.1.15 normalization task across 79+ frameworks.",
      "Hierarchical domain → control → objective → evidence relationships.",
      "Cross-framework traceability (cue controls / objective implies required evidence).",
      "Graph-based gap propagation — a gap in one control surfaces across all mapped frameworks.",
    ],
  },
  {
    slug: "evidence-confidence-scoring",
    title: "Evidence Confidence Scoring",
    status: "active",
    summary:
      "Developing reliable confidence metrics for LLM-based evidence assessment against compliance controls.",
    bullets: [
      "Per-objective scoring with Strong/Moderate/Weak/Insufficient ratings.",
      "Evaluation against SME 5-of-5 by-mapping consistency: Clause 4.7 (benchmark for assessing depth).",
      "Temperature tuning for task types 0.0–0.3 range.",
      "Exploring calibration between LLM confidence and auditor agreement.",
    ],
  },
  {
    slug: "cross-framework-mapping-accuracy",
    title: "Cross-Framework Mapping Accuracy",
    status: "planned",
    summary:
      "Measuring and improving the accuracy of automated control mappings between regulatory frameworks.",
    bullets: [
      "SCF provides curated mappings; evaluating completeness and correctness.",
      "Identifying mapping gaps where SCF coverage is thin.",
      "Comparing AI-generated mappings against SCF reference mappings.",
      "Framework version tracking and mapping drift detection.",
    ],
  },
  {
    slug: "continuous-monitoring",
    title: "Continuous Monitoring",
    status: "planned",
    summary: "Moving from point-in-time assessment to continuous compliance posture tracking.",
    bullets: [
      "Evidence expiry and re-assessment triggers.",
      "Detecting when framework updates invalidate prior assessments.",
      "Integration points for automated evidence collection.",
      "Compliance drift scoring over time.",
    ],
  },
];
