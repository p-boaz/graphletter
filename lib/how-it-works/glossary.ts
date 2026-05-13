export const GLOSSARY = {
  scf: {
    term: "SCF",
    def: "Secure Controls Framework — a meta-framework with ~1,500 controls that map to 79+ regulatory standards.",
  },
  erl: {
    term: "ERL",
    def: "Evidence Requirement List — the evidence expected for a control.",
  },
  atom: {
    term: "Evidence Atom",
    def: "A single extracted assertion from your document that supports or contradicts a control.",
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
