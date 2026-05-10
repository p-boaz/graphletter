import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import EnhancedDatabaseService from "@/lib/services/enhanced-database-service";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

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
    console.error("💥 Enhanced search API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enhanced search failed",
        search_enhanced: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const hasAdminAccess = await isAdminUser(user);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "dashboard": {
        const userId = searchParams.get("user_id");
        if (userId && userId !== user.id && !hasAdminAccess) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        const dashboardData = await EnhancedDatabaseService.getComplianceDashboard(
          userId || user.id
        );

        return NextResponse.json({
          success: true,
          action: "dashboard",
          data: dashboardData,
        });
      }

      case "heatmap": {
        const heatmapData = await EnhancedDatabaseService.getFrameworkCoverageHeatmap();

        return NextResponse.json({
          success: true,
          action: "heatmap",
          data: heatmapData,
        });
      }

      case "refresh":
        if (!hasAdminAccess) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        await EnhancedDatabaseService.refreshMaterializedViews();

        return NextResponse.json({
          success: true,
          action: "refresh",
          message: "Materialized views refreshed successfully",
        });

      case "analytics": {
        const analyticsUserId = searchParams.get("user_id");
        if (!analyticsUserId) {
          return NextResponse.json(
            { success: false, error: "user_id required for analytics" },
            { status: 400 }
          );
        }
        if (analyticsUserId !== user.id && !hasAdminAccess) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const analytics = await EnhancedDatabaseService.getComplianceAnalytics(analyticsUserId);

        return NextResponse.json({
          success: true,
          action: "analytics",
          data: analytics,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Available actions: dashboard, heatmap, refresh, analytics",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("💥 Enhanced search GET API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enhanced search GET failed",
      },
      { status: 500 }
    );
  }
}
