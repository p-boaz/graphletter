import { ArrowLeft, BookOpen, LinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFrameworkDescription } from "@/lib/content/framework-descriptions";
import { formatFrameworkVersion } from "@/lib/frameworks/format-version";
import { supabase } from "@/lib/database/supabase";

type FrameworkDetailPageProps = {
  params: Promise<{ id: string }>;
};

type FrameworkRecord = {
  id: string;
  framework_name: string;
  framework_version: string | null;
  total_mappings: number | null;
  mapping_type: string | null;
  scf_version: string | null;
};

type MappingRecord = {
  id: string;
  control_id: string;
  framework_control_id: string | null;
  mapping_type: string | null;
  confidence_score: number | null;
  scf_controls:
    | {
        id: string;
        title: string;
        description: string | null;
        domain_id: string | null;
      }
    | {
        id: string;
        title: string;
        description: string | null;
        domain_id: string | null;
      }[]
    | null;
};

export default async function FrameworkDetailPage({ params }: FrameworkDetailPageProps) {
  const { id } = await params;

  const [frameworkResult, mappingsResult] = await Promise.all([
    supabase
      .from("scf_frameworks")
      .select("id, framework_name, framework_version, total_mappings, mapping_type, scf_version")
      .eq("id", id)
      .single(),
    supabase
      .from("scf_control_mappings")
      .select(
        `
					id,
					control_id,
					framework_control_id,
					mapping_type,
					confidence_score,
					scf_controls (
						id,
						title,
						description,
						domain_id
					)
				`
      )
      .eq("framework_id", id)
      .order("control_id")
      .limit(20),
  ]);

  if (frameworkResult.error || !frameworkResult.data) {
    notFound();
  }

  const framework = frameworkResult.data as FrameworkRecord;
  const mappings = (mappingsResult.data ?? []) as MappingRecord[];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="bg-gradient-to-br from-slate-50 to-white py-16">
        <div className="ft-container space-y-6">
          <Link
            href="/frameworks"
            className="inline-flex items-center text-ft-pink text-sm font-medium hover:text-ft-black transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to frameworks
          </Link>

          <div className="max-w-4xl space-y-4">
            <h1
              className="ft-serif font-bold text-4xl text-slate-900 lg:text-5xl"
              data-testid="framework-detail-heading"
            >
              {framework.framework_name}
              {formatFrameworkVersion(framework.framework_version) && (
                <span className="text-slate-500 text-xl font-normal ml-3">
                  {formatFrameworkVersion(framework.framework_version)}
                </span>
              )}
            </h1>
            <p className="ft-sans text-slate-600 text-lg leading-relaxed">
              {getFrameworkDescription(framework.framework_name)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-green-100 text-green-800">Active</Badge>
              <Badge variant="outline">
                {framework.total_mappings ?? mappings.length} mapped controls
              </Badge>
              {framework.scf_version && (
                <Badge variant="outline">SCF {framework.scf_version}</Badge>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="ft-container">
          <div className="mb-6 max-w-3xl">
            <h2 className="ft-serif font-bold text-2xl text-slate-900">
              Associated Control Mappings
            </h2>
            <p className="ft-sans mt-2 text-slate-600">
              Each mapping shows which SCF control satisfies this framework&apos;s requirement.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2" data-testid="framework-detail-mappings">
            {mappings.map((mapping) => {
              const control = Array.isArray(mapping.scf_controls)
                ? mapping.scf_controls[0]
                : mapping.scf_controls;

              return (
                <Card key={mapping.id} className="h-full border-slate-200">
                  <CardHeader className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <LinkIcon className="h-3.5 w-3.5" />
                      <span>{mapping.framework_control_id || mapping.control_id}</span>
                    </div>
                    <CardTitle className="ft-serif text-lg text-slate-900">
                      {control?.title || "Control details unavailable"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="ft-sans text-sm text-slate-600 leading-relaxed">
                      {control?.description || "No control description available for this mapping."}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {mappings.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="ft-serif mt-3 text-xl font-semibold text-slate-900">
                No mappings found
              </h3>
              <p className="ft-sans mt-2 text-slate-600">
                This framework has no control mappings yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
