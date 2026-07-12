import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/frameworks");

const FRAMEWORK_FIELDS =
  "id, framework_name, framework_version, total_mappings, catalog_key, kind, family, geography, visibility";

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope");

    // exposure_status is the licensing gate and is independent of visibility
    // (see plans/scf-catalog-roadmap.md): this public endpoint never serves a
    // non-public framework, whatever its curation tier.
    let query = supabase
      .from("scf_frameworks")
      .select(FRAMEWORK_FIELDS)
      .eq("exposure_status", "public")
      .order("total_mappings", { ascending: false });

    // Catalog scope additionally exposes (public) preview frameworks.
    query =
      scope === "catalog"
        ? query.in("visibility", ["supported", "preview"])
        : query.eq("visibility", "supported");

    const { data: frameworks, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(frameworks || []);
  } catch (error) {
    log.error("frameworks.fetch_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch frameworks" }, { status: 500 });
  }
}
