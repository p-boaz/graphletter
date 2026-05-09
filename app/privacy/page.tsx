import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { pageTitle } from "@/lib/seo/page-title";

export const metadata: Metadata = { title: pageTitle("Privacy Policy") };

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navigation />
      <main className="ft-container flex-1 py-16">
        <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 text-sm">
          Draft — subject to revision. For questions contact hello@graphletter.com.
        </div>
        <h1 className="ft-serif text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-4 text-slate-600">Last updated: 2026-04-14</p>
        <section className="prose prose-slate mt-8 max-w-3xl">
          <p>
            Graphletter processes documents you upload solely to produce the compliance assessment
            you request. Documents are stored in your tenant&apos;s Supabase storage bucket with
            row-level security so only you and users you invite can access them.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Account information: name, email, organization.</li>
            <li>Evidence documents you upload and the AI assessments generated from them.</li>
            <li>
              Product analytics (page visits, feature use) via PostHog, anonymised where possible.
            </li>
          </ul>
          <h2>What we don&apos;t do</h2>
          <ul>
            <li>We do not train models on your documents.</li>
            <li>We do not sell your data.</li>
          </ul>
          <p>
            Questions? Email <a href="mailto:hello@graphletter.com">hello@graphletter.com</a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
