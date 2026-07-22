import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { authUrl } from "@/lib/auth/auth-tabs";
import { pageTitle } from "@/lib/seo/page-title";
import { GITHUB_URL } from "@/lib/config/links";
import {
  CONTROL_COUNT,
  CROSSWALK_COUNT,
  FRAMEWORK_COUNT,
  SCF_EDITION,
  formatStat,
} from "@/lib/scf/catalog-stats";

export const metadata: Metadata = {
  title: pageTitle("Compliance analysis for regulatory frameworks"),
};

// Frameworks named outright in the hero paragraph; the rest render as "N more".
const NAMED_FRAMEWORK_COUNT = 3;

const HERO_STATS = [
  { value: String(FRAMEWORK_COUNT), label: "Frameworks covered" },
  { value: formatStat(CONTROL_COUNT), label: "Controls checked" },
  { value: formatStat(CROSSWALK_COUNT), label: "Cross-framework links" },
  { value: SCF_EDITION, label: "SCF edition" },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <section className="ft-container pt-16 pb-20 lg:pt-20 lg:pb-24">
        <div className="max-w-5xl">
          <p className="ft-eyebrow">
            Edition {SCF_EDITION}
            <span className="mx-2 text-ft-pink/50" aria-hidden>
              ·
            </span>
            Compliance Analysis
          </p>
          <div className="ft-rule mt-4 max-w-2xl" />
          <h1 className="ft-serif mt-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-ft-black sm:text-6xl lg:text-[5.25rem]">
            Prove your policies meet the frameworks that matter.
          </h1>
          <p className="ft-serif mt-8 max-w-2xl text-xl italic leading-relaxed text-slate-600 lg:text-2xl">
            Upload an evidence document. Graphletter reads it against the Secure Controls Framework
            — a master catalog of {formatStat(CONTROL_COUNT)} controls that crosswalks to SOC 2, ISO
            27001, NIST, and {FRAMEWORK_COUNT - NAMED_FRAMEWORK_COUNT} more — with AI reasoning
            quoted back to your source.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" data-testid="hero-primary-cta">
              <Link href="/try">Try with a sample doc</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                GitHub →<span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          </div>
        </div>

        {/* Ticker rail */}
        <div className="mt-16 ft-rule pt-6 lg:mt-20">
          <dl
            data-testid="hero-stats"
            className="grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-slate-200"
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
                <dt className="ft-eyebrow text-slate-500">{stat.label}</dt>
                <dd className="ft-serif ft-mono mt-2 text-2xl font-bold tracking-tight text-ft-black sm:text-3xl lg:text-4xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Example output — the specimen */}
      <section className="border-y border-slate-100 bg-slate-50/40 py-20 lg:py-24">
        <div className="ft-container">
          <p className="ft-eyebrow">§ 01 · Example Output</p>
          <h2 className="ft-serif mt-3 text-3xl font-bold tracking-tight text-ft-black lg:text-4xl">
            One assessment, on paper.
          </h2>
          <p className="ft-sans mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Upload a document: a policy, a training record, a vendor assessment. Graphletter maps it
            to every relevant SCF control and returns structured findings per objective.
          </p>

          {/* Specimen document card */}
          <article
            className="ft-paper relative mt-10 max-w-3xl overflow-hidden rounded-sm border border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(15,23,42,0.18)]"
            aria-label="Example assessment output for ACME Identity & Access Policy v3.2"
          >
            {/* Document header chrome */}
            <header className="border-b border-slate-200 px-8 pt-7 pb-5">
              <p className="ft-eyebrow text-slate-500">Assessment Report</p>
              <h3 className="ft-serif mt-2 text-xl font-bold uppercase tracking-wide text-ft-black">
                ACME Identity &amp; Access Policy v3.2
              </h3>
              <p className="ft-mono mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Analyzed in 47s
                <span className="mx-2 text-slate-300" aria-hidden>
                  ·
                </span>
                12 controls evaluated
                <span className="mx-2 text-slate-300" aria-hidden>
                  ·
                </span>
                SCF {SCF_EDITION}
              </p>
            </header>

            {/* Specimen body — the existing table, refined */}
            <div className="overflow-x-auto px-8 py-6">
              <table className="ft-sans w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Control
                    </td>
                    <td className="py-3 text-ft-black">
                      <span className="ft-mono mr-2 text-xs text-slate-400">SCF-IAC-15</span>
                      Account Management
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Result
                    </td>
                    <td className="py-3">
                      <span className="ft-mono rounded-sm border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-700">
                        Partial
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Risk
                    </td>
                    <td className="py-3">
                      <span className="ft-mono rounded-sm border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-700">
                        Medium
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Frameworks
                    </td>
                    <td className="py-3 text-ft-black">
                      <span className="inline-flex flex-wrap gap-1.5">
                        <span className="ft-mono rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                          NIST 800-53 AC-2
                        </span>
                        <span className="ft-mono rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                          ISO 27001 A.9.2.1
                        </span>
                        <span className="ft-mono rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                          SOC 2 CC6.1
                        </span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Deficiencies
                    </td>
                    <td className="py-3 text-slate-700 leading-relaxed">
                      <ul className="space-y-1.5">
                        <li className="before:mr-2 before:text-ft-pink before:content-['·']">
                          No process for disabling dormant accounts after 90 days
                        </li>
                        <li className="before:mr-2 before:text-ft-pink before:content-['·']">
                          Shared/service account inventory not referenced
                        </li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Recommendations
                    </td>
                    <td className="py-3 text-slate-700 leading-relaxed">
                      <ul className="space-y-1.5">
                        <li className="before:mr-2 before:text-ft-pink before:content-['·']">
                          Add dormant-account deprovisioning policy with 90-day threshold
                        </li>
                        <li className="before:mr-2 before:text-ft-pink before:content-['·']">
                          Maintain a service account register with quarterly review
                        </li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="ft-eyebrow w-36 py-3 pr-6 text-slate-500 align-top whitespace-nowrap">
                      Remediation
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="ft-mono rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
                          Effort: Low
                        </span>
                        <span className="text-slate-300" aria-hidden>
                          ·
                        </span>
                        <span className="text-xs text-slate-500">
                          Policy update, no tooling changes
                        </span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Honest footnote */}
            <footer className="border-t border-slate-100 bg-white/60 px-8 py-3">
              <p className="ft-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Excerpt: 1 of 12 controls shown
              </p>
            </footer>
          </article>
        </div>
      </section>

      {/* Built in the open */}
      <section className="py-20 lg:py-24">
        <div className="ft-container max-w-3xl">
          <p className="ft-eyebrow">§ 02 · Built in the Open</p>
          <h2 className="ft-serif mt-3 text-3xl font-bold tracking-tight text-ft-black lg:text-4xl">
            MIT-licensed. Inspectable. Forkable.
          </h2>
          <p className="ft-serif mt-6 text-lg leading-relaxed text-slate-700">
            Graphletter is developed in public. The code, the prompts, the SCF mappings, and the
            schema migrations all live in the repository.
          </p>

          <dl className="mt-10 grid gap-y-8 sm:grid-cols-3 sm:gap-x-8">
            <div className="border-l-2 border-ft-pink/40 pl-4">
              <dt className="ft-mono text-xs uppercase tracking-[0.18em] text-slate-400">01</dt>
              <dd className="mt-2">
                <p className="ft-serif text-lg font-bold text-ft-black">Self-hostable</p>
                <p className="ft-sans mt-2 text-sm leading-relaxed text-slate-600">
                  Run it on your own infrastructure if you&apos;d rather keep evidence inside your
                  perimeter.
                </p>
              </dd>
            </div>
            <div className="border-l-2 border-ft-pink/40 pl-4">
              <dt className="ft-mono text-xs uppercase tracking-[0.18em] text-slate-400">02</dt>
              <dd className="mt-2">
                <p className="ft-serif text-lg font-bold text-ft-black">Inspectable</p>
                <p className="ft-sans mt-2 text-sm leading-relaxed text-slate-600">
                  Read how the assessments are scored, how citations are parsed, how data flows.
                </p>
              </dd>
            </div>
            <div className="border-l-2 border-ft-pink/40 pl-4">
              <dt className="ft-mono text-xs uppercase tracking-[0.18em] text-slate-400">03</dt>
              <dd className="mt-2">
                <p className="ft-serif text-lg font-bold text-ft-black">Forkable</p>
                <p className="ft-sans mt-2 text-sm leading-relaxed text-slate-600">
                  Extend it with your own evidence types or framework mappings.
                </p>
              </dd>
            </div>
          </dl>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-sans mt-10 inline-flex items-center gap-2 text-ft-pink font-medium underline underline-offset-4 transition-colors hover:text-ft-black"
          >
            View the code on GitHub →<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        className="border-t border-slate-100 bg-ft-cream/60 py-20 lg:py-24"
        data-testid="landing-closing-cta"
      >
        <div className="ft-container max-w-3xl">
          <p className="ft-eyebrow">§ 03 · Try It</p>
          <h2 className="ft-serif mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-ft-black lg:text-5xl">
            Run an assessment of your own.
          </h2>
          <p className="ft-serif mt-6 max-w-2xl text-lg italic leading-relaxed text-slate-700">
            Pick one of three sample policies and watch Graphletter map it against SCF objectives in
            under a minute.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/try">Try it now</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={authUrl("signup")}>Create an account</Link>
            </Button>
            <p className="ft-mono ml-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              No signup required to try
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
