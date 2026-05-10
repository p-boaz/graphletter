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
      title: "Row-Level Security",
      description:
        "Multi-tenant data isolation enforced at the database layer via Supabase RLS policies. Users can only access their own data.",
    },
    {
      title: "Ephemeral Processing",
      description:
        "Uploaded documents are processed in serverless functions and not retained beyond the assessment lifecycle. AI providers receive only extracted text, not raw files.",
    },
    {
      title: "Authentication",
      description:
        "Supabase OAuth (Google, GitHub) with session management. Server-side auth guards verify the user on every protected route handler and server component.",
    },
    {
      title: "Vulnerability Disclosure",
      description:
        "Report security issues to security@graphletter.com following SECURITY.md. We acknowledge reports within 48 hours.",
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
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
