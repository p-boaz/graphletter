import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import {
  mappingSearchFilter,
  parseBoundedInt,
  sanitizeMappingQuery,
} from "@/lib/frameworks/mapping-query";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/frameworks");

// Responses are intentionally bounded (stage-5 acceptance criterion: no
// framework detail response ever loads the complete mapping set). This is a
// deliberate semantic change from the pre-pagination behavior; the route has
// no internal consumers (verified 2026-07-11) — external callers page via
// limit/offset and read `total`.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: frameworkId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const limit = parseBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
    const q = sanitizeMappingQuery(searchParams.get("q"));

    // Get framework details. Only publicly-exposable tiers are served:
    // exposure_status gates licensing, visibility gates curation — a
    // framework outside both is a 404, not a hint that it exists.
    const { data: framework, error: frameworkError } = await supabase
      .from("scf_frameworks")
      .select("*")
      .eq("id", frameworkId)
      .eq("exposure_status", "public")
      .in("visibility", ["supported", "preview"])
      .maybeSingle();

    if (frameworkError) {
      throw frameworkError;
    }
    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 });
    }

    // Count first, then fetch one page — an offset past the end returns an
    // empty page with the honest total instead of a PostgREST 416.
    let countQuery = supabase
      .from("scf_control_mappings")
      .select("id", { count: "exact", head: true })
      .eq("framework_id", frameworkId);
    if (q) {
      countQuery = countQuery.or(mappingSearchFilter(q));
    }
    const { count, error: countError } = await countQuery;
    if (countError) {
      throw countError;
    }
    const total = count ?? 0;

    let mappings: unknown[] = [];
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
            domain_id,
            scf_version
          )
        `
        )
        .eq("framework_id", frameworkId);
      if (q) {
        pageQuery = pageQuery.or(mappingSearchFilter(q));
      }
      // Secondary order on id: control_id repeats within a framework, and
      // ties without a deterministic tie-break can shuffle rows between
      // requests — duplicating or dropping mappings across pages.
      const { data, error: mappingsError } = await pageQuery
        .order("control_id")
        .order("id")
        .range(offset, offset + limit - 1);

      if (mappingsError) {
        throw mappingsError;
      }
      mappings = data || [];
    }

    return NextResponse.json({
      framework,
      mappings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    log.error("frameworks.fetch_details_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch framework details" }, { status: 500 });
  }
}
