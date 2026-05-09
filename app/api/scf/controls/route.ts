import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/controls");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit");
    const offset = Number.parseInt(searchParams.get("offset") || "0");

    // Handle unlimited results with chunking to bypass PostgREST limits
    if (limit === "all") {
      log.info("Fetching ALL controls using chunked approach");

      const allControls: Array<Record<string, unknown>> = [];
      let currentOffset = 0;
      const chunkSize = 1000; // Use chunks of 1000 to stay under any limits
      let hasMoreData = true;

      while (hasMoreData) {
        log.debug("Fetching chunk", { from: currentOffset, to: currentOffset + chunkSize - 1 });

        const { data: chunk, error } = await supabase
          .from("scf_controls")
          .select(
            `
            id,
            title,
            description,
            domain_id,
            scf_domains!domain_id (
              name,
              description
            ),
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
          )
          .order("id")
          .range(currentOffset, currentOffset + chunkSize - 1);

        if (error) {
          console.error("Error in chunk:", error);
          throw error;
        }

        if (chunk && chunk.length > 0) {
          allControls.push(...chunk);
          log.debug("Added controls chunk", {
            chunkSize: chunk.length,
            totalSoFar: allControls.length,
          });

          // If we got less than the chunk size, we've reached the end
          if (chunk.length < chunkSize) {
            hasMoreData = false;
          } else {
            currentOffset += chunkSize;
          }
        } else {
          hasMoreData = false;
        }
      }

      log.info("Successfully fetched all controls", { totalControls: allControls.length });
      return NextResponse.json(allControls);
    }

    // Handle limited results (original logic)
    let query = supabase
      .from("scf_controls")
      .select(
        `
        id,
        title,
        description,
        domain_id,
        scf_domains!domain_id (
          name,
          description
        ),
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
      )
      .order("id");

    if (limit && limit !== "all") {
      const limitNum = Number.parseInt(limit);
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data: controls, error } = await query;

    if (error) {
      throw error;
    }

    log.info("API returned controls", { count: controls?.length || 0, limit });
    return NextResponse.json(controls || []);
  } catch (error) {
    console.error("Error fetching controls:", error);
    return NextResponse.json({ error: "Failed to fetch controls" }, { status: 500 });
  }
}
