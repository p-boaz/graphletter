import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";

export default function SecurityPage() {
  const practices = [
    {
      title: "Encryption",
      description:
        "All data encrypted in transit (TLS 1.3) and at rest (AES-256). Database connections use SSL.",
    },
    {
      title: "Data Isolation",
      description:
        "Your organization's data is isolated from every other tenant at the database layer (Postgres row-level security). Users can only access their own data.",
    },
    {
      title: "Documents Aren't Retained",
      description:
        "Uploaded documents are processed in short-lived compute and not kept beyond the assessment. AI providers receive only extracted text, never your raw files.",
    },
    {
      title: "Authentication",
      description:
        "Sign in with Google or GitHub. Every protected page and API call re-verifies your identity on the server.",
    },
    {
      title: "Vulnerability Disclosure",
      description:
        "Report security issues following SECURITY.md. We acknowledge reports within 48 hours.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="bg-gradient-to-br from-ft-cream to-white">
        <div className="ft-container py-20">
          <div className="max-w-3xl space-y-4">
            <h1 className="ft-headline text-4xl lg:text-5xl">Security</h1>
            <p className="ft-sans text-lg text-slate-600 leading-relaxed">
              How Graphletter handles data protection and access control.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="ft-container">
          <div className="max-w-3xl space-y-8">
            {practices.map((p) => (
              <div key={p.title} className="space-y-2 pb-8 border-b border-slate-100 last:border-0">
                <h2 className="ft-serif font-bold text-lg text-ft-black">{p.title}</h2>
                <p className="ft-sans text-slate-600 leading-relaxed">{p.description}</p>
                {p.title === "Vulnerability Disclosure" && (
                  <p className="ft-sans text-slate-600">
                    <a
                      href="mailto:security@graphletter.com?subject=Security%20Disclosure"
                      className="ft-sans text-ft-pink underline underline-offset-4 hover:text-ft-black transition-colors"
                    >
                      security@graphletter.com
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
