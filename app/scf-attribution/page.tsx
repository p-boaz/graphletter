"use client";

import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SCFAttributionPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="container mx-auto max-w-3xl px-4 py-16">
        <div className="space-y-8">
          <div className="space-y-4 text-center">
            <h1 className="ft-serif font-bold text-4xl text-slate-900">SCF Licensing Notice</h1>
            <p className="ft-sans text-slate-600 text-xl max-w-2xl mx-auto">
              Required third-party attribution for Secure Controls Framework (SCF) materials used as
              reference content.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="ft-serif text-2xl">Third-Party Attribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="ft-sans text-slate-700 leading-relaxed space-y-3">
                <p>
                  Graphletter includes unmodified references to{" "}
                  <strong>Secure Controls Framework (SCF)</strong> material. SCF is a separate work
                  from a separate organization.
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>
                    <strong>Work:</strong> Secure Controls Framework (SCF)
                  </li>
                  <li>
                    <strong>Copyright:</strong> Secure Controls Framework Council
                  </li>
                  <li>
                    <strong>License:</strong> Creative Commons Attribution-NoDerivatives 4.0
                    International
                  </li>
                  <li>
                    <strong>Source:</strong>{" "}
                    <Link
                      href="https://securecontrolsframework.com"
                      className="text-blue-600 underline hover:text-blue-800"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      securecontrolsframework.com
                    </Link>
                  </li>
                  <li>
                    <strong>License Text:</strong>{" "}
                    <Link
                      href="https://creativecommons.org/licenses/by-nd/4.0/"
                      className="text-blue-600 underline hover:text-blue-800"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      CC BY-ND 4.0
                    </Link>
                  </li>
                </ul>
                <p>
                  Inclusion of SCF material does not imply endorsement, sponsorship, partnership, or
                  affiliation.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-slate-500 text-sm ft-sans">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
