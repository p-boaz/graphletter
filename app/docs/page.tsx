import { ArrowRight, CheckCircle2, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { PipelineDiagram } from "@/components/how-it-works/pipeline-diagram";
import { Navigation } from "@/components/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { pageTitle } from "@/lib/seo/page-title";
import {
  analysisLayers,
  explainerIntro,
  glossaryTerms,
  graphDecisionRules,
  graphPipelineStages,
  graphSignalLegend,
  graphTechniqueIntro,
  maturityLevels,
  resultGuidance,
  scfSourceLinks,
  workflowSteps,
} from "@/lib/content/compliance-explainer";
import { supabase } from "@/lib/database/supabase";
import { GLOSSARY } from "@/lib/how-it-works/glossary";

export const metadata: Metadata = { title: pageTitle("Docs") };

const GLOSSARY_TERMS_IN_PAGE_GLOSSARY = new Set([
  "SCF Control",
  "Coverage vs Gap",
  "Framework Mapping (SCF Normalization)",
  "Evidence Request List (ERL) Artifact",
]);

type ScfStats = {
  controls: number;
  frameworks: number;
  mappings: number;
} | null;

function graphStatusBadgeClass(status: string): string {
  if (status === "compliant") return "border-green-200 bg-green-50 text-green-800";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "missing") return "border-red-200 bg-red-50 text-red-700";
  return "border-orange-200 bg-orange-50 text-orange-800";
}

async function getScfStats(): Promise<ScfStats> {
  try {
    const [controlsResult, frameworksResult, mappingsResult] = await Promise.all([
      supabase.from("scf_controls").select("id", { count: "exact", head: true }),
      supabase.from("scf_frameworks").select("id", { count: "exact", head: true }),
      supabase.from("scf_control_mappings").select("id", { count: "exact", head: true }),
    ]);

    return {
      controls: controlsResult.count || 0,
      frameworks: frameworksResult.count || 0,
      mappings: mappingsResult.count || 0,
    };
  } catch (error) {
    console.error("Unable to load SCF stats for docs page:", error);
    return null;
  }
}

export default async function DocsPage() {
  const stats = await getScfStats();

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white">
        <Navigation />

        <section className="bg-gradient-to-br from-ft-cream to-white">
          <div className="ft-container py-20">
            <div className="max-w-4xl space-y-5">
              <h1 className="ft-headline text-4xl text-ft-black lg:text-5xl">Docs</h1>

              <PipelineDiagram />

              <p className="ft-sans text-lg text-slate-700 leading-relaxed">{explainerIntro}</p>
              <div className="rounded-xl border border-ft-pink/30 bg-white p-4 shadow-sm">
                <p className="ft-sans text-sm text-slate-700 leading-relaxed">
                  Need the fast version? Upload evidence, Graphletter maps it to SCF controls,
                  evaluates objective-by-objective, and returns coverage and prioritized gaps.
                </p>
              </div>
              {stats && (
                <div className="grid max-w-2xl grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
                    <div className="ft-serif text-2xl font-bold text-ft-black">
                      {stats.controls.toLocaleString()}
                    </div>
                    <div className="ft-sans text-xs text-slate-600">SCF controls</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
                    <div className="ft-serif text-2xl font-bold text-ft-black">
                      {stats.frameworks.toLocaleString()}
                    </div>
                    <div className="ft-sans text-xs text-slate-600">Frameworks</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
                    <div className="ft-serif text-2xl font-bold text-ft-black">
                      {stats.mappings.toLocaleString()}
                    </div>
                    <div className="ft-sans text-xs text-slate-600">Control mappings</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-28 py-20">
          <div className="ft-container">
            <div className="mb-8 max-w-3xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">Workflow</h2>
              <p className="ft-sans mt-2 text-slate-600">
                From document upload to compliance insight in six concrete steps.
              </p>
            </div>
            <div className="space-y-5">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ft-cream text-sm font-semibold text-ft-black">
                      {index + 1}
                    </div>
                    <h3 className="ft-serif text-xl font-bold text-ft-black">{step.title}</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                        What Happens
                      </p>
                      <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                        {step.whatHappens}
                      </p>
                    </div>
                    <div>
                      <p className="ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Why It Matters
                      </p>
                      <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                        {step.whyItMatters}
                      </p>
                    </div>
                    <div>
                      <p className="ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Where You See It
                      </p>
                      <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                        {step.whereToFind}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="graph-technique" className="scroll-mt-28 bg-slate-50 py-20">
          <div className="ft-container space-y-8">
            <div className="max-w-4xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">
                How Graph Analysis Works
              </h2>
              <p className="ft-sans mt-2 text-slate-700 leading-relaxed">{graphTechniqueIntro}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {analysisLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {layer.engine}
                  </p>
                  <h3 className="ft-serif mt-1 text-xl font-bold text-ft-black">{layer.title}</h3>
                  <p className="ft-sans mt-2 text-sm text-slate-700 leading-relaxed">
                    {layer.whyItExists}
                  </p>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="ft-sans text-xs font-semibold uppercase text-slate-500">Output</p>
                    <p className="ft-sans mt-1 text-sm text-slate-700">{layer.output}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Evidence Relationship Flow
                </p>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 ft-sans text-[11px] font-semibold uppercase text-slate-600">
                  Consistent Rules-Based Scoring
                </span>
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                Uploaded Document -&gt; Evidence Chunks -&gt; Evidence Atoms -&gt; Control Links
                -&gt; Coverage &amp; Gaps
              </pre>

              <div className="mt-4 hidden items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex">
                {graphPipelineStages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <p className="ft-sans text-[11px] font-semibold uppercase text-slate-500">
                        {index + 1}
                      </p>
                      <p className="ft-sans text-xs font-semibold text-ft-black">{stage.title}</p>
                    </div>
                    {index < graphPipelineStages.length - 1 ? (
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 lg:hidden">
                {graphPipelineStages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="ft-sans text-xs font-semibold text-ft-black">
                        {index + 1}. {stage.title}
                      </p>
                    </div>
                    <p className="ft-sans mt-1 text-xs text-slate-600 leading-relaxed">
                      {stage.whyItMatters}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2">
                {graphPipelineStages.map((stage, index) => (
                  <div key={stage.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ft-cream text-xs font-bold text-ft-black">
                        {index + 1}
                      </span>
                      <p className="ft-serif text-base font-bold text-ft-black">{stage.title}</p>
                    </div>
                    <p className="ft-sans mt-2 text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-ft-black">Captures:</span>{" "}
                      {stage.whatStored}
                    </p>
                    <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-ft-black">Why it matters:</span>{" "}
                      {stage.whyItMatters}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="ft-serif text-xl font-bold text-ft-black">Graph Signals</h3>
                <div className="mt-3 space-y-3">
                  {graphSignalLegend.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="ft-sans text-xs font-semibold uppercase text-slate-500">
                        {item.label}
                      </p>
                      <p className="ft-sans mt-1 text-sm font-semibold text-ft-black">
                        {item.value}
                      </p>
                      <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                        {item.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="ft-serif text-xl font-bold text-ft-black">
                  Coverage Decision Rules
                </h3>
                <p className="ft-sans mt-1 text-sm text-slate-600">
                  Control coverage is classified using clear, consistent rules.
                </p>
                <div className="mt-3 hidden overflow-x-auto md:block">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-2 text-left ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Condition
                        </th>
                        <th className="px-2 py-2 text-left ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                        <th className="px-2 py-2 text-left ft-sans text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Gap type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {graphDecisionRules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-b border-slate-100 align-top last:border-0"
                        >
                          <td className="px-2 py-3">
                            <p className="ft-sans text-xs font-mono text-ft-black">
                              {rule.condition}
                            </p>
                            <p className="ft-sans mt-1 text-xs text-slate-600 leading-relaxed">
                              {rule.explanation}
                            </p>
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 ft-sans text-[11px] font-semibold uppercase ${graphStatusBadgeClass(
                                rule.status
                              )}`}
                            >
                              {rule.status}
                            </span>
                          </td>
                          <td className="px-2 py-3 ft-sans text-xs text-slate-700">
                            {rule.gapType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-3 md:hidden">
                  {graphDecisionRules.map((rule) => (
                    <div key={rule.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="ft-sans text-xs font-semibold uppercase text-slate-500">
                        Condition
                      </p>
                      <p className="ft-sans mt-1 text-sm font-mono text-ft-black">
                        {rule.condition}
                      </p>
                      <p className="ft-sans mt-2 text-sm text-slate-700">
                        <span className="font-semibold text-ft-black">Status:</span>{" "}
                        <span
                          className={`ml-1 inline-flex rounded-full border px-2 py-0.5 ft-sans text-[11px] font-semibold uppercase ${graphStatusBadgeClass(
                            rule.status
                          )}`}
                        >
                          {rule.status}
                        </span>{" "}
                        <span className="text-slate-500">({rule.gapType})</span>
                      </p>
                      <p className="ft-sans mt-1 text-sm text-slate-700 leading-relaxed">
                        {rule.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-ft-cream py-20">
          <div className="ft-container">
            <div className="mb-8 max-w-3xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">
                Objective Result States (AI Layer)
              </h2>
              <p className="ft-sans mt-2 text-slate-600">
                How objective-level AI outcomes translate into action. Graph coverage states
                (compliant, partial, missing, conflicting) are computed separately in the Graph
                Technique section above.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {resultGuidance.map((item) => (
                <div key={item.status} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.status.replace("_", " ")}
                  </div>
                  <p className="ft-sans text-sm text-slate-700 leading-relaxed">{item.meaning}</p>
                  <p className="ft-sans mt-2 text-sm font-medium text-ft-black">
                    Next: {item.nextAction}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="maturity" className="scroll-mt-28 py-20">
          <div className="ft-container">
            <div className="mb-8 max-w-3xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">Maturity Levels</h2>
              <p className="ft-sans mt-2 text-slate-600">
                SCF uses a Cybersecurity &amp; Privacy Capability Maturity Model (C|P-CMM) with six
                levels. Graphletter assesses your evidence against these levels for each control.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {maturityLevels.map((level) => (
                <div key={level.level} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                      {level.level}
                    </span>
                    <span className="ft-serif text-base font-bold text-ft-black">
                      {level.label}
                    </span>
                  </div>
                  <p className="ft-sans text-sm text-slate-700 leading-relaxed">{level.summary}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="ft-sans text-sm text-purple-900 leading-relaxed">
                After assessment, each control shows its assessed maturity level, an optional target
                level with gap analysis, and AI-generated recommendations for reaching the next
                level.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="ft-container">
            <div className="mb-8 max-w-3xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">Core Terms</h2>
              <p className="ft-sans mt-2 text-slate-600">
                Plain-language definitions with Graphletter context.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.values(GLOSSARY).map((entry) => (
                <div key={entry.term} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="ft-serif text-lg font-bold text-ft-black">{entry.term}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{entry.def}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 mb-3">
              <h3 className="ft-serif text-lg font-bold text-ft-black">Related assessment terms</h3>
              <p className="ft-sans mt-1 text-sm text-slate-600">
                Other vocabulary that shows up in Graphletter's assessment results.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {glossaryTerms
                .filter((term) => !GLOSSARY_TERMS_IN_PAGE_GLOSSARY.has(term.term))
                .map((term) => (
                  <article
                    key={term.id}
                    id={term.id}
                    className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="ft-serif text-xl font-bold text-ft-black">{term.term}</h3>
                    <p className="ft-sans mt-3 text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-ft-black">Definition:</span>{" "}
                      {term.plainDefinition}
                    </p>
                    <p className="ft-sans mt-2 text-sm text-slate-700 leading-relaxed">
                      <span className="font-semibold text-ft-black">In Graphletter:</span>{" "}
                      {term.graphletterDefinition}
                    </p>
                    <p className="ft-sans mt-2 text-xs text-slate-500">
                      Where you see it: {term.whereToFind}
                    </p>
                  </article>
                ))}
            </div>
          </div>
        </section>

        <section className="bg-ft-cream py-20">
          <div className="ft-container">
            <div className="mb-8 max-w-3xl">
              <h2 className="ft-serif text-3xl font-bold text-ft-black">Data Model</h2>
              <p className="ft-sans mt-2 text-slate-600">
                How Graphletter organizes compliance data under the hood.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
              <div className="space-y-3">
                <h3 className="ft-serif font-bold text-lg text-ft-black">SCF Catalog</h3>
                <ul className="ft-sans text-slate-600 space-y-1.5 text-sm">
                  <li>
                    <span className="font-mono text-slate-500">scf_controls</span> — 1,200+ controls
                    across 33 domains
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">scf_frameworks</span> — 79+
                    regulatory standards
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">scf_control_mappings</span> —
                    cross-framework mapping table
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">scf_assessment_objectives</span> —
                    testable criteria per control
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">scf_evidence_request_list</span> —
                    required artifact types
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="ft-serif font-bold text-lg text-ft-black">
                  Graph Runtime + Assessments
                </h3>
                <ul className="ft-sans text-slate-600 space-y-1.5 text-sm">
                  <li>
                    <span className="font-mono text-slate-500">documents</span> — graph document
                    root records linked to uploads
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">document_chunks</span> — chunked
                    content with source offsets
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">evidence_atoms</span> — atomic
                    evidence claims with provenance
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">evidence_control_map</span> —
                    atom-to-control mappings with strength/polarity
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">control_gap_analysis</span> —
                    materialized control gap statuses
                  </li>
                  <li>
                    <span className="font-mono text-slate-500">assessments</span> — AI objective and
                    control assessment outputs
                  </li>
                  <li>Multi-tenant isolation via Row-Level Security</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="ft-container">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="ft-serif text-2xl font-bold text-ft-black">Sources & Attribution</h2>
              <p className="ft-sans mt-2 text-sm text-slate-600">
                SCF concepts are grounded in official SCF materials and linked for reference.
              </p>
              <div className="mt-4 space-y-2">
                {scfSourceLinks.map((source) => (
                  <div key={source.href} className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-slate-500" />
                    <Link
                      href={source.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ft-sans text-sm text-slate-700 underline underline-offset-4 hover:text-ft-black"
                    >
                      {source.label}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="ft-container">
            <div className="rounded-2xl border border-ft-pink/30 bg-gradient-to-r from-ft-cream to-white p-6">
              <p className="ft-sans text-sm text-slate-700">
                Ready to apply this? Start in the{" "}
                <Link href="/dashboard" className="font-semibold underline">
                  Dashboard
                </Link>{" "}
                or explore control mappings in{" "}
                <Link href="/dashboard/frameworks" className="font-semibold underline">
                  Framework Explorer
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </TooltipProvider>
  );
}
