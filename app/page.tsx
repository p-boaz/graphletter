import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { authUrl } from "@/lib/auth/auth-tabs";
import { pageTitle } from "@/lib/seo/page-title";

const GITHUB_URL = "https://github.com/p-boaz/graphletter";

export const metadata: Metadata = {
  title: pageTitle("Compliance analysis for regulatory frameworks"),
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <section className="ft-container py-20">
        <p className="ft-mono text-xs uppercase tracking-[0.2em] text-ft-pink">Graphletter</p>
        <h1 className="ft-serif mt-4 text-5xl font-bold tracking-tight text-ft-black lg:text-6xl">
          Prove your policies meet the frameworks that matter.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-700 leading-relaxed">
          Upload an evidence document. Graphletter reads it against 1,200+ SCF controls and maps the
          outcome to 79 frameworks — with AI reasoning quoted back to your source.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" data-testid="hero-primary-cta">
            <Link href="/try">Try with a sample doc</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub →<span className="sr-only"> (opens in new tab)</span>
            </a>
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          79 frameworks · 1,200+ controls · 25,000+ cross-framework mappings
        </p>
      </section>

      {/* Example output */}
      <section className="py-20">
        <div className="ft-container">
          <h2 className="ft-serif font-bold text-2xl text-ft-black mb-4">Example output</h2>
          <p className="ft-sans text-slate-600 mb-8 max-w-2xl">
            Upload a document — a policy, a training record, a vendor assessment. Graphletter maps
            it to every relevant SCF control and returns structured findings per objective.
          </p>
          <div className="ft-card rounded-2xl border-2 border-ft-cream p-8 max-w-3xl overflow-x-auto">
            <table className="ft-sans text-sm w-full">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Control
                  </td>
                  <td className="py-3 text-ft-black">
                    <span className="font-mono text-xs text-slate-400 mr-2">SCF-IAC-15</span>
                    Account Management
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Result
                  </td>
                  <td className="py-3">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 font-medium">
                      Partial
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Risk
                  </td>
                  <td className="py-3">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 font-medium">
                      Medium
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Frameworks
                  </td>
                  <td className="py-3 text-ft-black">
                    <span className="inline-flex flex-wrap gap-1.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        NIST 800-53 AC-2
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        ISO 27001 A.9.2.1
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">SOC 2 CC6.1</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Deficiencies
                  </td>
                  <td className="py-3 text-slate-600 leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li>No process for disabling dormant accounts after 90 days</li>
                      <li>Shared/service account inventory not referenced</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Recommendations
                  </td>
                  <td className="py-3 text-slate-600 leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Add dormant-account deprovisioning policy with 90-day threshold</li>
                      <li>Maintain a service account register with quarterly review</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Remediation
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center space-x-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                        Effort: Low
                      </span>
                      <span className="text-slate-400 text-xs">·</span>
                      <span className="text-slate-500 text-xs">
                        Policy update, no tooling changes
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Built in the open */}
      <section className="bg-ft-cream py-16">
        <div className="ft-container max-w-3xl">
          <h2 className="ft-serif font-bold text-2xl text-ft-black mb-4">Built in the open</h2>
          <p className="ft-sans text-slate-700 leading-relaxed mb-6">
            Graphletter is MIT-licensed and developed in public. The code, the prompts, the SCF
            mappings, and the schema migrations all live in the repository.
          </p>
          <ul className="space-y-3 mb-6">
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Self-hostable</strong> — run it on your own
              infrastructure if you'd rather keep evidence inside your perimeter.
            </li>
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Inspectable</strong> — read how the assessments are
              scored, how citations are parsed, how data flows.
            </li>
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Forkable</strong> — extend it with your own evidence
              types or framework mappings.
            </li>
          </ul>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-sans text-ft-pink font-medium underline underline-offset-4 hover:text-ft-black transition-colors"
          >
            View the code on GitHub →<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        className="border-ft-pink/30 border-t bg-gradient-to-br from-ft-cream to-white py-16"
        data-testid="landing-closing-cta"
      >
        <div className="ft-container text-center">
          <h2 className="ft-serif text-3xl font-bold text-ft-black">
            Ready to see a real assessment?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-slate-700 leading-relaxed">
            Pick one of three sample policies and watch Graphletter map it against SCF objectives in
            under a minute. No signup required.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/try">Try it now</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={authUrl("signup")}>Create a free account</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
