import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";
import EnhancedDatabaseService from "@/lib/services/enhanced-database-service";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/enhanced/search");

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    log.info("Enhanced search API called");

    const body = await request.json();
    const {
      query,
      frameworks,
      domains,
      confidence_threshold,
      limit,
      search_type = "controls",
    } = body;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query is required",
        },
        { status: 400 }
      );
    }

    log.info("Performing search", { search_type, query });

    let results;

    switch (search_type) {
      case "controls":
        results = await EnhancedDatabaseService.searchControls({
          query,
          frameworks,
          domains,
          confidence_threshold,
          limit: limit || 20,
        });
        break;

      case "crosswalk":
        if (!frameworks || frameworks.length < 2) {
          return NextResponse.json(
            {
              success: false,
              error: "Framework crosswalk requires at least 2 frameworks",
            },
            { status: 400 }
          );
        }
        results = await EnhancedDatabaseService.getFrameworkCrosswalk(frameworks[0], frameworks[1]);
        break;

      case "benchmarks": {
        const { industry_sector, organization_size, framework_name } = body;
        results = await EnhancedDatabaseService.getComplianceBenchmarks(
          industry_sector,
          organization_size,
          framework_name
        );
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown search type: ${search_type}`,
          },
          { status: 400 }
        );
    }

    log.info("Enhanced search completed", { resultCount: results?.length || 0 });

    return NextResponse.json({
      success: true,
      search_type,
      query,
      filters: {
        frameworks,
        domains,
        confidence_threshold,
        limit,
      },
      results,
      metadata: {
        total_results: results?.length || 0,
        search_enhanced: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError("enhanced.search_post_failed", "Enhanced search failed", 500, error);
  }
}
