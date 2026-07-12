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
      // 81 = MAPPED_FRAMEWORK_COUNT (lib/scf-parser.ts); hardcoded to keep the parser table out of client bundles
      "SCF 2026.2 normalization across 81 mapped frameworks.",
      "Hierarchical domain → control → objective → evidence relationships.",
      "Cross-framework traceability — one evidence base, many framework views.",
      "Graph-based gap propagation: a gap on one control surfaces across every framework it maps to.",
    ],
  },
  {
    slug: "evidence-confidence-scoring",
    title: "Evidence Confidence Scoring",
    status: "active",
    summary:
      "Developing reliable confidence metrics for LLM-based evidence assessment against compliance controls.",
    bullets: [
      "Per-objective confidence as a 0.0–1.0 score, bucketed into low / medium / high for display.",
      "Low model temperatures (0.1–0.2) to keep assessments consistent across runs.",
      "Open question: how well does model-reported confidence track human-auditor agreement?",
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
