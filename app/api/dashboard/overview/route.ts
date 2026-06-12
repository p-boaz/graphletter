import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/dashboard/overview");

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface FrameworkComplianceViewRow {
  framework_id: string;
  framework_name: string | null;
  framework_version: string | null;
  user_mapped_controls: number | null;
  avg_confidence_score: number | null;
  total_framework_mappings: number | null;
  last_updated: string | null;
}

interface FrameworkTotalsRow {
  framework_id: string;
  total_controls: number | null;
}

interface UserControlRow {
  scf_control_id: string | null;
  confidence_score: number | null;
  mapping_status: string | null;
}

interface ControlMappingRow {
  control_id: string;
  framework_id: string;
  confidence_score: number | null;
}

interface FrameworkRow {
  id: string;
  framework_name: string | null;
  framework_version: string | null;
}

interface FrameworkComplianceItem {
  framework_id: string;
  framework_name: string | null;
  framework_version: string | null;
  total_controls: number;
  user_mapped_controls: number;
  compliance_percentage: number;
  confidence_score: number;
  status: "compliant" | "partial" | "non-compliant";
  last_updated?: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    log.info("Loading optimized dashboard overview", { userId: user.id });
    const startTime = Date.now();

    // Use optimized queries with materialized views for best performance
    const [complianceStatusResult, documentsResult, frameworkComplianceResult, userControlsResult] =
      await Promise.allSettled([
        // User compliance status
        supabase.from("user_compliance_status").select("*").eq("user_id", user.id).single(),

        // User documents (with optimized field selection)
        supabase
          .from("user_documents")
          .select(
            "id, filename, file_size, file_type, document_type, status, upload_date, created_at, analysis_status, analysis_summary"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        // Framework compliance with materialized view optimization
        fetchOptimizedFrameworkCompliance(supabase, user.id),

        // User controls with optimized query
        supabase
          .from("user_controls")
          .select("id, scf_control_id, confidence_score, mapping_status", {
            count: "exact",
          })
          .eq("user_id", user.id)
          .not("scf_control_id", "is", null),
      ]);

    // Process results
    const complianceStatus =
      complianceStatusResult.status === "fulfilled" ? complianceStatusResult.value.data : null;

    const documents =
      documentsResult.status === "fulfilled" ? documentsResult.value.data || [] : [];

    const frameworkCompliance =
      frameworkComplianceResult.status === "fulfilled"
        ? frameworkComplianceResult.value
        : {
            frameworks: [],
            summary: { totalFrameworksCovered: 0, averageComplianceScore: 0 },
          };

    const userControls =
      userControlsResult.status === "fulfilled" ? userControlsResult.value.data || [] : [];

    // Calculate additional analytics
    const analytics = {
      totalControls: userControls.length,
      averageConfidence:
        userControls.length > 0
          ? userControls.reduce((sum, control) => sum + (control.confidence_score || 0), 0) /
            userControls.length
          : 0,
      mappedControls: userControls.filter((control) => control.scf_control_id).length,
      confirmedMappings: userControls.filter((control) => control.mapping_status === "confirmed")
        .length,
    };

    const response = {
      user: {
        id: user.id,
        email: user.email,
      },
      complianceStatus: complianceStatus || {
        overallScore: 0,
        frameworks: [],
        lastUpdated: new Date().toISOString(),
        totalFrameworks: 0,
        compliantFrameworks: 0,
      },
      documents,
      frameworkCompliance,
      analytics,
      summary: {
        totalDocuments: documents.length,
        totalFrameworks: frameworkCompliance.summary.totalFrameworksCovered,
        averageComplianceScore: frameworkCompliance.summary.averageComplianceScore,
        totalControls: analytics.totalControls,
        mappedControls: analytics.mappedControls,
        lastUpdated: new Date().toISOString(),
      },
      performance: {
        queryTime: Date.now() - startTime,
        optimized: true,
      },
    };

    log.info("Optimized dashboard overview loaded", {
      queryTimeMs: Date.now() - startTime,
      frameworks: frameworkCompliance.frameworks?.length || 0,
      documents: documents.length,
      controls: analytics.totalControls,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("dashboard.overview.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

// Optimized framework compliance using materialized views with fallback
async function fetchOptimizedFrameworkCompliance(supabase: SupabaseServerClient, userId: string) {
  try {
    const startTime = Date.now();

    // Try materialized view first for maximum performance
    const { data: frameworkData, error: frameworkError } = await supabase
      .from("mv_user_framework_compliance")
      .select(
        `
        user_id,
        framework_id,
        framework_name,
        framework_version,
        user_mapped_controls,
        avg_confidence_score,
        total_framework_mappings,
        last_updated
      `
      )
      .eq("user_id", userId);

    if (frameworkError) {
      log.warn("dashboard.overview.mv_query_failed", {
        detail: frameworkError instanceof Error ? frameworkError.message : String(frameworkError),
      });
      return await fetchFrameworkComplianceFallback(supabase, userId);
    }

    if (!frameworkData || frameworkData.length === 0) {
      return {
        frameworks: [],
        summary: {
          totalFrameworksCovered: 0,
          averageComplianceScore: 0,
          totalUserControls: 0,
          totalMappedControls: 0,
        },
      };
    }
    const typedFrameworkData = frameworkData as FrameworkComplianceViewRow[];

    // Get framework totals using materialized view
    const frameworkIds = typedFrameworkData.map((f) => f.framework_id);
    const { data: frameworkTotals } = await supabase
      .from("mv_framework_control_totals")
      .select("framework_id, total_controls")
      .in("framework_id", frameworkIds);

    const typedFrameworkTotals = (frameworkTotals || []) as FrameworkTotalsRow[];
    const totalsMap = typedFrameworkTotals.reduce(
      (acc: Record<string, number>, item) => ({
        ...acc,
        [item.framework_id]: item.total_controls || 0,
      }),
      {} as Record<string, number>
    );

    // Calculate compliance percentages and status
    const frameworkCompliance = typedFrameworkData.map((fw) => {
      const totalControls = totalsMap[fw.framework_id] || fw.total_framework_mappings || 1;
      const userMappedControls = fw.user_mapped_controls || 0;
      const compliancePercentage = Math.round((userMappedControls / totalControls) * 100);

      let status: "compliant" | "partial" | "non-compliant";
      if (compliancePercentage >= 80) status = "compliant";
      else if (compliancePercentage >= 30) status = "partial";
      else status = "non-compliant";

      return {
        framework_id: fw.framework_id,
        framework_name: fw.framework_name,
        framework_version: fw.framework_version,
        total_controls: totalControls,
        user_mapped_controls: userMappedControls,
        compliance_percentage: compliancePercentage,
        confidence_score: Math.round((fw.avg_confidence_score || 0) * 100) / 100,
        status,
        last_updated: fw.last_updated,
      };
    });

    // Sort by compliance percentage
    frameworkCompliance.sort((a, b) => b.compliance_percentage - a.compliance_percentage);

    const summary = {
      totalFrameworksCovered: frameworkCompliance.length,
      averageComplianceScore:
        frameworkCompliance.length > 0
          ? Math.round(
              frameworkCompliance.reduce((sum: number, f) => sum + f.compliance_percentage, 0) /
                frameworkCompliance.length
            )
          : 0,
      totalUserControls: typedFrameworkData.reduce(
        (sum: number, f) => sum + (f.user_mapped_controls || 0),
        0
      ),
      totalMappedControls: typedFrameworkData.reduce(
        (sum: number, f) => sum + (f.user_mapped_controls || 0),
        0
      ),
    };

    log.info("Framework compliance calculated using materialized views", {
      queryTimeMs: Date.now() - startTime,
    });

    return {
      frameworks: frameworkCompliance,
      summary,
    };
  } catch (error) {
    log.error("dashboard.overview.framework_compliance.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return await fetchFrameworkComplianceFallback(supabase, userId);
  }
}

// Fallback to original implementation if materialized views fail
async function fetchFrameworkComplianceFallback(supabase: SupabaseServerClient, userId: string) {
  log.info("Using fallback framework compliance calculation");
  try {
    // Get user controls mapped to SCF controls
    const { data: userControls } = await supabase
      .from("user_controls")
      .select("id, scf_control_id, confidence_score, mapping_status")
      .eq("user_id", userId)
      .not("scf_control_id", "is", null);

    const typedUserControls = (userControls || []) as UserControlRow[];

    if (typedUserControls.length === 0) {
      return {
        frameworks: [],
        summary: {
          totalFrameworksCovered: 0,
          averageComplianceScore: 0,
          totalUserControls: 0,
          totalMappedControls: 0,
        },
      };
    }

    // Get SCF control mappings to frameworks
    const scfControlIds = [
      ...new Set(
        typedUserControls.map((uc) => uc.scf_control_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const { data: controlMappings } = await supabase
      .from("scf_control_mappings")
      .select("control_id, framework_id, framework_control_id, confidence_score")
      .in("control_id", scfControlIds);

    if (!controlMappings || controlMappings.length === 0) {
      return {
        frameworks: [],
        summary: {
          totalFrameworksCovered: 0,
          averageComplianceScore: 0,
          totalUserControls: typedUserControls.length,
          totalMappedControls: 0,
        },
      };
    }
    const typedControlMappings = (controlMappings || []) as ControlMappingRow[];

    // Get framework details
    const frameworkIds = [...new Set(typedControlMappings.map((cm) => cm.framework_id))];
    const { data: frameworks } = await supabase
      .from("scf_frameworks")
      .select("id, framework_name, framework_version")
      .in("id", frameworkIds);

    const typedFrameworks = (frameworks || []) as FrameworkRow[];
    const frameworkMap = typedFrameworks.reduce(
      (acc: Record<string, FrameworkRow>, fw) => ({
        ...acc,
        [fw.id]: fw,
      }),
      {} as Record<string, FrameworkRow>
    );

    // Get total control counts for each framework (in parallel)
    const frameworkTotals = await Promise.all(
      frameworkIds.map(async (frameworkId) => {
        const { count } = await supabase
          .from("scf_control_mappings")
          .select("*", { count: "exact", head: true })
          .eq("framework_id", frameworkId);
        return { frameworkId, total: count || 0 };
      })
    );

    const frameworkTotalsMap = frameworkTotals.reduce(
      (acc: Record<string, number>, { frameworkId, total }) => ({
        ...acc,
        [frameworkId]: total,
      }),
      {} as Record<string, number>
    );

    // Group mappings by framework and calculate compliance
    const frameworkGroups = typedControlMappings.reduce(
      (acc: Record<string, ControlMappingRow[]>, mapping) => {
        const fwId = mapping.framework_id;
        if (!acc[fwId]) acc[fwId] = [];
        acc[fwId].push(mapping);
        return acc;
      },
      {} as Record<string, ControlMappingRow[]>
    );

    const frameworkCompliance = Object.entries(frameworkGroups)
      .map(([frameworkId, mappings]) => {
        const framework = frameworkMap[frameworkId];
        if (!framework) return null;

        const totalControls = frameworkTotalsMap[frameworkId] || 0;
        const userMappedControls = mappings.length;
        const compliancePercentage =
          totalControls > 0 ? Math.round((userMappedControls / totalControls) * 100) : 0;

        const avgConfidence =
          mappings.reduce((sum, m) => sum + (m.confidence_score || 0.8), 0) / mappings.length;

        let status: "compliant" | "partial" | "non-compliant";
        if (compliancePercentage >= 80) status = "compliant";
        else if (compliancePercentage >= 30) status = "partial";
        else status = "non-compliant";

        return {
          framework_id: frameworkId,
          framework_name: framework.framework_name,
          framework_version: framework.framework_version,
          total_controls: totalControls,
          user_mapped_controls: userMappedControls,
          compliance_percentage: compliancePercentage,
          confidence_score: Math.round(avgConfidence * 100) / 100,
          status,
        };
      })
      .filter((item): item is FrameworkComplianceItem => item !== null);

    // Sort by compliance percentage
    frameworkCompliance.sort((a, b) => b.compliance_percentage - a.compliance_percentage);

    const summary = {
      totalFrameworksCovered: frameworkCompliance.length,
      averageComplianceScore:
        frameworkCompliance.length > 0
          ? Math.round(
              frameworkCompliance.reduce((sum: number, f) => sum + f.compliance_percentage, 0) /
                frameworkCompliance.length
            )
          : 0,
      totalUserControls: typedUserControls.length,
      totalMappedControls: scfControlIds.length,
    };

    return {
      frameworks: frameworkCompliance,
      summary,
    };
  } catch (error) {
    log.error("dashboard.overview.framework_compliance_fallback.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return {
      frameworks: [],
      summary: {
        totalFrameworksCovered: 0,
        averageComplianceScore: 0,
        totalUserControls: 0,
        totalMappedControls: 0,
      },
    };
  }
}
