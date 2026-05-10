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
        <h1 className="ft-serif text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-4 text-slate-600">Last updated: 2026-05-09</p>
        <section className="prose prose-slate mt-8 max-w-3xl">
          <p>
            Graphletter processes documents you upload solely to produce the compliance assessment
            you request. Documents are stored in Supabase storage with bucket policies that scope
            access to the owning user&apos;s evidence path.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Account information: name, email, organization.</li>
            <li>Evidence documents you upload and the AI assessments generated from them.</li>
            <li>Operational telemetry needed to secure the service and investigate failures.</li>
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
