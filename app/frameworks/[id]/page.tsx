import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, LinkIcon, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFrameworkDescription } from "@/lib/content/framework-descriptions";
import { formatFrameworkVersion } from "@/lib/frameworks/format-version";
import {
  MAPPINGS_PAGE_SIZE,
  mappingSearchFilter,
  parseBoundedInt,
  sanitizeMappingQuery,
} from "@/lib/frameworks/mapping-query";
import { supabase } from "@/lib/database/supabase";

type FrameworkDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
};

type FrameworkRecord = {
  id: string;
  framework_name: string;
  framework_version: string | null;
  total_mappings: number | null;
  mapping_type: string | null;
  scf_version: string | null;
  visibility: string | null;
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

function pageHref(id: string, page: number, q: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const suffix = params.toString();
  return `/frameworks/${id}${suffix ? `?${suffix}` : ""}`;
}

export default async function FrameworkDetailPage({
  params,
  searchParams,
}: FrameworkDetailPageProps) {
  const { id } = await params;
  const { page: rawPage, q: rawQ } = await searchParams;
  const page = parseBoundedInt(rawPage, 1, 1, Number.MAX_SAFE_INTEGER);
  const q = sanitizeMappingQuery(rawQ);
  const offset = (page - 1) * MAPPINGS_PAGE_SIZE;

  // Same gate as /api/scf/frameworks/[id]: exposure_status gates licensing,
  // visibility gates curation — this page must never render a framework the
  // list or API would hide (state-coherence rule).
  const { data: frameworkData, error: frameworkError } = await supabase
    .from("scf_frameworks")
    .select(
      "id, framework_name, framework_version, total_mappings, mapping_type, scf_version, visibility"
    )
    .eq("id", id)
    .eq("exposure_status", "public")
    .in("visibility", ["supported", "preview"])
    .maybeSingle();

  if (frameworkError || !frameworkData) {
    notFound();
  }
  const framework = frameworkData as FrameworkRecord;

  let countQuery = supabase
    .from("scf_control_mappings")
    .select("id", { count: "exact", head: true })
    .eq("framework_id", id);
  if (q) {
    countQuery = countQuery.or(mappingSearchFilter(q));
  }
  const { count, error: countError } = await countQuery;
  if (countError) {
    // Fail visibly: rendering "No mappings" on a query error would present a
    // false total on a page whose whole point is honest ranges.
    throw new Error(`Failed to count framework mappings: ${countError.message}`);
  }
  const total = count ?? 0;

  let mappings: MappingRecord[] = [];
  if (offset < total) {
    let pageQuery = supabase
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
      .eq("framework_id", id);
    if (q) {
      pageQuery = pageQuery.or(mappingSearchFilter(q));
    }
    // Secondary order on id: control_id repeats within a framework; ties
    // without a deterministic tie-break can shuffle rows between requests.
    const { data, error: pageError } = await pageQuery
      .order("control_id")
      .order("id")
      .range(offset, offset + MAPPINGS_PAGE_SIZE - 1);
    if (pageError) {
      throw new Error(`Failed to load framework mappings: ${pageError.message}`);
    }
    mappings = (data ?? []) as MappingRecord[];
  }

  const totalPages = Math.max(1, Math.ceil(total / MAPPINGS_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : Math.min(offset + 1, total);
  const rangeEnd = Math.min(offset + mappings.length, total);
  const isPreview = framework.visibility === "preview";

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
              <Badge
                data-testid="framework-tier-badge"
                className={
                  isPreview ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                }
              >
                {isPreview ? "Preview" : "Supported"}
              </Badge>
              <Badge variant="outline">{framework.total_mappings ?? total} mapped controls</Badge>
              {framework.scf_version && (
                <Badge variant="outline">SCF {framework.scf_version}</Badge>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="ft-container">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="ft-serif font-bold text-2xl text-slate-900">
                Associated Control Mappings
              </h2>
              <p className="ft-sans mt-2 text-slate-600">
                Each mapping shows which SCF control satisfies this framework&apos;s requirement.
              </p>
            </div>

            <form method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search control IDs…"
                  data-testid="framework-mapping-search-input"
                  className="ft-sans w-64 rounded-full border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-ft-pink focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-full border border-ft-pink bg-ft-pink px-4 py-2 text-sm font-semibold text-white hover:bg-ft-black hover:border-ft-black transition-colors"
              >
                Search
              </button>
            </form>
          </div>

          <p className="ft-sans mb-6 text-sm text-slate-500" data-testid="framework-mappings-range">
            {total === 0
              ? q
                ? `No mappings match "${q}"`
                : "No mappings"
              : `Showing ${rangeStart}–${rangeEnd} of ${total}${q ? ` matching "${q}"` : ""}`}
          </p>

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
                {q
                  ? `No control mappings match "${q}". Try a different identifier, or clear the search.`
                  : total > 0
                    ? `This page is out of range — there are ${total} mappings across ${totalPages} pages.`
                    : "This framework has no control mappings yet."}
              </p>
            </div>
          )}

          {total > MAPPINGS_PAGE_SIZE && (
            <nav className="mt-8 flex items-center justify-between" aria-label="Mapping pages">
              {page > 1 ? (
                <Link
                  href={pageHref(framework.id, page - 1, q)}
                  data-testid="framework-mappings-prev"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}

              <span className="ft-sans text-sm text-slate-500">
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>

              {page < totalPages ? (
                <Link
                  href={pageHref(framework.id, page + 1, q)}
                  data-testid="framework-mappings-next"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </nav>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
