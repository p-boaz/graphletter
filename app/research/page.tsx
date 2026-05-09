import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RESEARCH_TOPICS, type ResearchStatus } from "@/lib/research/research-topics";
import { pageTitle } from "@/lib/seo/page-title";

export const metadata: Metadata = { title: pageTitle("Research") };

function statusBadgeClass(status: ResearchStatus): string {
  switch (status) {
    case "active":
      return "border-green-300 bg-green-100 text-green-800";
    case "planned":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "shipped":
      return "border-blue-300 bg-blue-100 text-blue-800";
  }
}

function statusLabel(status: ResearchStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Header */}
      <section className="bg-gradient-to-br from-ft-cream to-white">
        <div className="ft-container py-20">
          <div className="max-w-3xl space-y-4">
            <h1 className="ft-headline text-4xl lg:text-5xl">Research</h1>
            <p className="ft-sans text-lg text-slate-600 leading-relaxed">
              Open questions and active work in automated compliance analysis. These research
              directions inform the system&apos;s development and represent areas where the approach
              is still evolving.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="ft-container space-y-6">
          {RESEARCH_TOPICS.map((t) => (
            <article
              key={t.slug}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              data-testid={`research-topic-${t.slug}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="ft-serif text-xl font-bold text-ft-black">{t.title}</h2>
                <Badge
                  variant="outline"
                  className={statusBadgeClass(t.status)}
                  data-testid="research-status-badge"
                >
                  {statusLabel(t.status)}
                </Badge>
              </div>
              <p className="mt-2 text-slate-700 leading-relaxed">{t.summary}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {t.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {t.links?.length ? (
                <ul className="mt-3 flex flex-wrap gap-3 text-sm">
                  {t.links.map((l) => (
                    <li key={l.href}>
                      <Link className="underline" href={l.href}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          <section
            className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
            data-testid="research-contact-cta"
          >
            <h2 className="ft-serif text-lg font-bold text-ft-black">Want to discuss?</h2>
            <p className="mt-2 text-sm text-slate-600">
              We&apos;re always happy to compare notes on compliance automation.
            </p>
            <Button asChild className="mt-3">
              <a href="mailto:hello@graphletter.com?subject=Research%20chat">Get in touch</a>
            </Button>
          </section>
        </div>
      </section>

      <Footer />
    </div>
  );
}
