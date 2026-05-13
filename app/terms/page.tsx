import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { GITHUB_URL } from "@/lib/config/links";
import { pageTitle } from "@/lib/seo/page-title";

export const metadata: Metadata = { title: pageTitle("Terms of Service") };

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navigation />
      <main className="ft-container flex-1 py-16">
        <h1 className="ft-serif text-4xl font-bold">Terms of Service</h1>
        <p className="mt-4 text-slate-600">Last updated: 2026-05-09</p>
        <section className="prose prose-slate mt-8 max-w-3xl">
          <p>
            These terms govern your use of Graphletter (&quot;Graphletter&quot;, &quot;we&quot;,
            &quot;our&quot;). By creating an account or uploading content, you accept them.
          </p>
          <h2>Acceptable use</h2>
          <p>
            You agree not to upload content you don&apos;t have the right to share, to
            reverse-engineer the service, or to attempt to interfere with its operation.
          </p>
          <h2>Your content</h2>
          <p>
            You retain ownership of anything you upload. You grant us a limited license to process
            that content to produce the assessments you request, and to retain it on your behalf for
            as long as you have an account.
          </p>
          <h2>Service availability</h2>
          <p>
            We aim for high availability but don&apos;t guarantee uninterrupted service. We may
            update or discontinue features with reasonable notice.
          </p>
          <h2>Contact</h2>
          <p>
            Questions? Open an issue on{" "}
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            .
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
