export const GLOSSARY = {
  scf: {
    term: "SCF",
    // 66 = MAPPED_FRAMEWORK_COUNT (lib/scf-parser.ts); hardcoded to keep the parser table out of client bundles
    def: "Secure Controls Framework — a meta-framework with ~1,500 controls cross-mapped to hundreds of laws and standards; Graphletter maps 66 of them today.",
  },
  erl: {
    term: "ERL",
    def: "Evidence Requirement List — the evidence expected for a control.",
  },
  atom: {
    term: "Evidence claim",
    def: "A single statement extracted from your document that supports or contradicts a control. Called an 'atom' in the technical sections below.",
  },
  mapping: {
    term: "Mapping",
    def: "A link between an SCF control and an external framework's control.",
  },
  coverage: {
    term: "Coverage",
    def: "The rolled-up support level (weak/moderate/strong) for a control given the atoms mapped to it.",
  },
  maturity: {
    term: "Maturity",
    def: "A 1–5 scale (Performed informally → Continuously improving) scoring how well the objective is implemented.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
