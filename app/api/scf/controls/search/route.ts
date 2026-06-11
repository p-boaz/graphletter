import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/controls/search");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const framework = searchParams.get("framework") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");

    let supabaseQuery = supabase.from("scf_controls").select(
      `
        id,
        title,
        description,
        domain_id,
        scf_control_mappings (
          id,
          framework_control_id,
          mapping_type,
          scf_frameworks (
            framework_name,
            framework_version
          )
        )
      `
    );

    // Add search filters
    if (query.trim()) {
      supabaseQuery = supabaseQuery.or(
        `id.ilike.%${query}%,title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    // Add framework filter if specified
    if (framework !== "all") {
      supabaseQuery = supabaseQuery.filter(
        "scf_control_mappings.scf_frameworks.framework_name",
        "eq",
        framework
      );
    }

    const { data: controls, error } = await supabaseQuery.limit(limit).order("id");

    if (error) {
      throw error;
    }

    return NextResponse.json(controls || []);
  } catch (error) {
    log.error("controls.search_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to search controls" }, { status: 500 });
  }
}
