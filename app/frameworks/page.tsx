"use client";

import { ArrowRight, BookOpen, Globe, Loader2, Search, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFrameworkDescription } from "@/lib/content/framework-descriptions";
import { frameworkFamily, type FrameworkFamily } from "@/lib/frameworks/family";
import { formatFrameworkVersion } from "@/lib/frameworks/format-version";

const FAMILIES: readonly FrameworkFamily[] = [
  "NIST",
  "ISO",
  "PCI",
  "HIPAA",
  "SOC",
  "SOX",
  "CSA",
  "EU",
  "Other",
];

function chipClass(active: boolean): string {
  return active
    ? "rounded-full border border-ft-pink bg-ft-pink px-3 py-1 text-xs font-semibold text-white"
    : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";
}

interface Framework {
  id: string;
  framework_name: string;
  framework_version?: string;
  total_mappings: number;
}

export default function FrameworksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<FrameworkFamily | "All">("All");

  useEffect(() => {
    async function fetchFrameworks() {
      try {
        setLoading(true);
        const response = await fetch("/api/scf/frameworks");
        if (!response.ok) {
          throw new Error("Failed to fetch frameworks");
        }
        const data = await response.json();
        setFrameworks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchFrameworks();
  }, []);

  const filteredFrameworks = frameworks.filter((framework) => {
    const matchesSearch = framework.framework_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFamily =
      family === "All" ? true : frameworkFamily(framework.framework_name) === family;
    return matchesSearch && matchesFamily;
  });

  const hasActiveSearch = searchTerm.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-8">
            <h1 className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl">
              Compliance Frameworks
            </h1>
            <p className="ft-sans text-slate-600 text-xl max-w-3xl mx-auto">
              Upload evidence once. Graphletter maps it to every framework below through the Secure
              Controls Framework, so a SOC 2 policy also counts toward ISO 27001, NIST, and more.
            </p>
            <div className="flex justify-center">
              <Badge variant="outline" className="ft-sans" data-testid="framework-results-count">
                <Globe className="mr-2 h-4 w-4" />
                {loading
                  ? "Loading..."
                  : hasActiveSearch
                    ? `${filteredFrameworks.length} of ${frameworks.length} Frameworks`
                    : `${frameworks.length} frameworks covered`}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="py-12 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search frameworks by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
                data-testid="framework-search-input"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Framework Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-600">Loading frameworks...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="ft-serif font-medium text-lg text-slate-900 mb-2">
                Error Loading Frameworks
              </h3>
              <p className="ft-sans text-slate-600 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="family-filter-All"
                  data-state={family === "All" ? "active" : "inactive"}
                  onClick={() => setFamily("All")}
                  className={chipClass(family === "All")}
                >
                  All
                </button>
                {FAMILIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    data-testid={`family-filter-${f}`}
                    data-state={family === f ? "active" : "inactive"}
                    onClick={() => setFamily(f)}
                    className={chipClass(family === f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFrameworks.map((framework) => {
                  const version = formatFrameworkVersion(framework.framework_version);
                  return (
                    <Link
                      key={framework.id}
                      href={`/frameworks/${framework.id}`}
                      aria-label={`View ${framework.framework_name}${
                        version ? ` ${version}` : ""
                      } details`}
                      className="group block"
                      data-testid="framework-card-link"
                    >
                      <Card className="h-full transition-all group-hover:-translate-y-1 group-hover:shadow-lg">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <CardTitle
                                className="ft-serif text-lg"
                                data-testid="framework-card-title"
                              >
                                {framework.framework_name}
                                {version && (
                                  <span className="ml-2 text-sm font-normal text-slate-500">
                                    {version}
                                  </span>
                                )}
                              </CardTitle>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          </div>
                          <CardDescription
                            className="ft-sans"
                            data-testid="framework-card-description"
                          >
                            {getFrameworkDescription(framework.framework_name)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">Control Mappings:</span>
                              <span className="ml-1 text-slate-600">
                                {framework.total_mappings}
                              </span>
                            </div>
                            <div className="inline-flex items-center text-ft-pink text-sm font-medium">
                              View framework details
                              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {filteredFrameworks.length === 0 && frameworks.length > 0 && (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="ft-serif font-medium text-lg text-slate-900 mt-4">
                    No frameworks found
                  </h3>
                  <p className="ft-sans text-slate-600 mt-2">Try adjusting your search terms.</p>
                </div>
              )}

              {!loading && frameworks.length === 0 && !error && (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="ft-serif font-medium text-lg text-slate-900 mt-4">
                    No frameworks available
                  </h3>
                  <p className="ft-sans text-slate-600 mt-2">
                    Framework data isn't available right now. Please try again later.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
