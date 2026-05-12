import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { TryItOutContent } from "@/components/try-it-out-content";
import { pageTitle } from "@/lib/seo/page-title";

export const metadata: Metadata = { title: pageTitle("Try") };

export default function TryPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="bg-gradient-to-br from-ft-cream to-white py-14">
        <div className="ft-container">
          <div className="max-w-4xl space-y-4">
            <h1
              className="ft-headline text-4xl text-ft-black lg:text-5xl"
              data-testid="try-it-out-heading"
            >
              Try it with a sample doc
            </h1>
            <p
              className="ft-sans text-lg text-slate-700 leading-relaxed"
              data-testid="try-it-out-summary"
            >
              Pick a sample policy and watch Graphletter evaluate it against SCF controls. Uses the
              same Smart Evidence Upload flow the product runs on.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10" data-testid="try-it-out-live-upload-section">
        <div className="ft-container space-y-6">
          <TryItOutContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
