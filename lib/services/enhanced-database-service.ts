import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai-client";
import {
  AI_MODELS,
  AI_PROVIDERS,
  getAvailableProviders,
  getOpenAIProviderOptions,
} from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("lib/services/enhanced-database-service");
import type {
  ComplianceBenchmark,
  ComplianceDashboardData,
  ControlHierarchy,
  ControlSearchParams,
  ControlSearchResult,
  FrameworkCoverageHeatmap,
  FrameworkCrosswalk,
  SCFControl,
} from "@/lib/types";

type SearchableControl = Omit<
  SCFControl,
  "guidance_micro" | "guidance_small" | "guidance_medium" | "scf_domains"
> & {
  guidance_micro?: string | null;
  guidance_small?: string | null;
  guidance_medium?: string | null;
  scf_domains?: { name?: string | null } | null;
};

interface UserControlDashboardRow {
  user_id: string;
  scf_control_id: string;
  confidence_score: number | null;
  mapping_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ControlMappingFrameworkRow {
  control_id: string;
  framework_id: string;
}

interface FrameworkBasicRow {
  id: string;
  framework_name: string | null;
}

interface GroupedDashboardItem {
  user_id: string;
  framework_name: string;
  controls_mapped: number;
  high_confidence_controls: number;
  total_confidence: number;
  last_updated: string;
}

interface GroupedHeatmapItem {
  framework_name: string;
  user_ids: Set<string>;
  scf_control_ids: Set<string>;
  confidences: number[];
  last_updated: string;
}

export class EnhancedDatabaseService {
  // Full-Text Search for Controls
  static async searchControls(params: ControlSearchParams): Promise<ControlSearchResult[]> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from("scf_controls")
        .select(
          `
          *,
          scf_domains!domain_id (
            id,
            name,
            description
          )
        `
        )
        .textSearch("search_vector", params.query)
        .limit(params.limit || 20);

      if (params.confidence_threshold) {
        // For now, we'll use a placeholder since we don't have confidence in the base control
        // This would be enhanced with similarity scoring
      }

      if (params.domains?.length) {
        query = query.in("domain_id", params.domains);
      }

      const { data: controls, error } = await query;

      if (error) {
        log.error("enhanced_database.controls_search_failed", {
          detail: error instanceof Error ? error.message : String(error),
        });
        return [];
      }

      if (!controls || controls.length === 0) {
        return [];
      }

      const controlList = controls as SearchableControl[];
      const fallbackRanked = controlList
        .map((control) => {
          const combinedText = `${control.title || ""} ${control.description || ""} ${control.scf_domains?.name || ""}`;
          const similarity = computeTextSimilarity(params.query, combinedText);
          return {
            control: control as SCFControl,
            similarity_score: Number(similarity.toFixed(3)),
            matching_fields: ["title", "description"],
            related_controls: [] as string[],
          } satisfies ControlSearchResult;
        })
        .sort((a, b) => b.similarity_score - a.similarity_score);

      const availableProviders = getAvailableProviders();
      if (availableProviders.length === 0) {
        return fallbackRanked.slice(0, params.limit || 20);
      }

      try {
        const providerForSearch = availableProviders.includes(AI_PROVIDERS.OPENAI)
          ? AI_PROVIDERS.OPENAI
          : availableProviders[0];
        const modelForProvider =
          providerForSearch === AI_PROVIDERS.OPENAI
            ? AI_MODELS.GPT_5_4
            : AI_MODELS.CLAUDE_3_7_SONNET;
        const model = getModel(providerForSearch, modelForProvider);
        const schema = z.object({
          matches: z
            .array(
              z.object({
                control_id: z.string(),
                similarity: z.number().min(0).max(1),
                rationale: z.string().optional(),
                related_controls: z.array(z.string()).optional(),
              })
            )
            .max(params.limit || 20),
        });

        const candidateSummaries = controlList.slice(0, 25).map((control) => {
          const title = (control.title || "").slice(0, 160);
          const description = (control.description || "").slice(0, 500);
          const guidanceText =
            control.guidance_micro || control.guidance_small || control.guidance_medium || "";

          return {
            id: control.id,
            title,
            description,
            domain: control.scf_domains?.name ?? "",
            guidance: guidanceText.slice(0, 500),
          };
        });

        const { object } = await generateObject({
          model,
          schema,
          ...getOpenAIProviderOptions(providerForSearch, {
            reasoningEffort: "minimal",
            textVerbosity: "low",
          }),
          prompt: `You are an AI assistant helping compliance analysts locate the most relevant Secure Controls Framework (SCF) controls for a search query. Review the query and candidate controls and return the strongest matches ranked from most to least relevant.

Return no more than ${params.limit || 20} results. For each match provide:
- control_id: the SCF control id
- similarity: a value between 0 and 1 reflecting semantic similarity
- rationale: a concise explanation of why the control matches (optional)
- related_controls: other control IDs from the candidate list that are closely related (optional)

Query: ${params.query}
Candidate controls: ${JSON.stringify(candidateSummaries)}`,
        });

        const controlMap = new Map(controlList.map((control) => [control.id, control]));
        const aiResults: ControlSearchResult[] = [];

        for (const match of object.matches) {
          const control = controlMap.get(match.control_id);
          if (!control) continue;

          const related = (match.related_controls || []).filter((id) => controlMap.has(id));
          const reasoning = match.rationale?.trim();

          aiResults.push({
            control: control as SCFControl,
            similarity_score: Number(Math.min(1, Math.max(0, match.similarity)).toFixed(3)),
            matching_fields: reasoning ? [`semantic: ${reasoning}`] : ["semantic"],
            related_controls: related,
          });
        }

        if (aiResults.length === 0) {
          return fallbackRanked.slice(0, params.limit || 20);
        }

        const seen = new Set(aiResults.map((result) => result.control.id));
        for (const fallback of fallbackRanked) {
          if (aiResults.length >= (params.limit || 20)) {
            break;
          }
          if (!seen.has(fallback.control.id)) {
            aiResults.push(fallback);
            seen.add(fallback.control.id);
          }
        }

        return aiResults.slice(0, params.limit || 20);
      } catch (aiError) {
        log.error("enhanced_database.ai_search_failed", {
          detail: aiError instanceof Error ? aiError.message : String(aiError),
        });
        return fallbackRanked.slice(0, params.limit || 20);
      }
    } catch (error) {
      log.error("enhanced_database.search_controls_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Framework Crosswalk Operations
  // Note: Uses the framework_crosswalk materialized view created by migration 20250926000000_create_framework_crosswalk_view.sql
  // To refresh the view after importing new framework mappings, call: SELECT refresh_framework_crosswalk();
  static async getFrameworkCrosswalk(
    sourceFramework: string,
    targetFramework: string
  ): Promise<FrameworkCrosswalk[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("framework_crosswalk")
        .select("*")
        .eq("source_framework", sourceFramework)
        .eq("target_framework", targetFramework)
        .order("confidence_score", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.error("enhanced_database.framework_crosswalk_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  static async addFrameworkMapping(
    mapping: Omit<FrameworkCrosswalk, "id" | "created_at" | "updated_at">
  ): Promise<FrameworkCrosswalk | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("framework_crosswalk")
        .insert(mapping)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      log.error("enhanced_database.framework_mapping_add_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // Compliance Benchmarks
  static async getComplianceBenchmarks(
    industrySector?: string,
    organizationSize?: string,
    frameworkName?: string
  ): Promise<ComplianceBenchmark[]> {
    try {
      const supabase = await createClient();
      let query = supabase.from("compliance_benchmarks").select("*");

      if (industrySector) {
        query = query.eq("industry_sector", industrySector);
      }
      if (organizationSize) {
        query = query.eq("organization_size", organizationSize);
      }
      if (frameworkName) {
        query = query.eq("framework_name", frameworkName);
      }

      const { data, error } = await query.order("benchmark_date", {
        ascending: false,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.error("enhanced_database.compliance_benchmarks_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Control Hierarchies
  static async getControlHierarchies(controlId: string): Promise<{
    parents: ControlHierarchy[];
    children: ControlHierarchy[];
  }> {
    try {
      const supabase = await createClient();

      const [parentResult, childrenResult] = await Promise.all([
        supabase.from("control_hierarchies").select("*").eq("child_control_id", controlId),
        supabase.from("control_hierarchies").select("*").eq("parent_control_id", controlId),
      ]);

      return {
        parents: parentResult.data || [],
        children: childrenResult.data || [],
      };
    } catch (error) {
      log.error("enhanced_database.control_hierarchies_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return { parents: [], children: [] };
    }
  }

  // Dashboard Analytics (formerly materialized views)
  static async getComplianceDashboard(userId?: string): Promise<ComplianceDashboardData[]> {
    try {
      const supabase = await createClient();

      // Get user controls that are mapped to SCF controls
      let userControlsQuery = supabase
        .from("user_controls")
        .select(
          `
          user_id,
          scf_control_id,
          confidence_score,
          mapping_status,
          created_at
        `
        )
        .not("scf_control_id", "is", null);

      if (userId) {
        userControlsQuery = userControlsQuery.eq("user_id", userId);
      }

      const { data: userControls, error } = await userControlsQuery;
      if (error) throw error;

      if (!userControls || userControls.length === 0) {
        return [];
      }

      // Get SCF control mappings to frameworks
      const typedUserControls = (userControls || []) as UserControlDashboardRow[];
      const scfControlIds = [...new Set(typedUserControls.map((uc) => uc.scf_control_id))];
      const { data: controlMappings } = await supabase
        .from("scf_control_mappings")
        .select("control_id, framework_id")
        .in("control_id", scfControlIds);

      if (!controlMappings || controlMappings.length === 0) {
        return [];
      }

      // Get framework details
      const typedControlMappings = (controlMappings || []) as ControlMappingFrameworkRow[];
      const frameworkIds = [...new Set(typedControlMappings.map((cm) => cm.framework_id))];
      const { data: frameworks } = await supabase
        .from("scf_frameworks")
        .select("id, framework_name")
        .in("id", frameworkIds);

      const typedFrameworks = (frameworks || []) as FrameworkBasicRow[];
      const frameworkMap = typedFrameworks.reduce(
        (acc: Record<string, string>, fw) => ({
          ...acc,
          [fw.id]: fw.framework_name || "",
        }),
        {}
      );

      const controlToFrameworkMap = typedControlMappings.reduce(
        (acc: Record<string, string[]>, cm) => {
          if (!acc[cm.control_id]) acc[cm.control_id] = [];
          acc[cm.control_id].push(frameworkMap[cm.framework_id]);
          return acc;
        },
        {}
      );

      // Aggregate the data to match the materialized view structure
      const grouped = typedUserControls.reduce((acc: Record<string, GroupedDashboardItem>, row) => {
        const frameworks = controlToFrameworkMap[row.scf_control_id] || [];

        frameworks.forEach((frameworkName: string) => {
          if (!frameworkName) return;

          const key = `${row.user_id}_${frameworkName}`;
          const createdAt = row.created_at || new Date(0).toISOString();

          if (!acc[key]) {
            acc[key] = {
              user_id: row.user_id,
              framework_name: frameworkName,
              controls_mapped: 0,
              high_confidence_controls: 0,
              total_confidence: 0,
              last_updated: createdAt,
            };
          }

          acc[key].controls_mapped++;
          acc[key].total_confidence += row.confidence_score || 0;

          if ((row.confidence_score || 0) >= 0.8) {
            acc[key].high_confidence_controls++;
          }

          if (createdAt > acc[key].last_updated) {
            acc[key].last_updated = createdAt;
          }
        });

        return acc;
      }, {});

      const groupedItems = Object.values(grouped).map((item) => ({
        ...item,
        avg_confidence:
          item.controls_mapped > 0
            ? (item.total_confidence / item.controls_mapped).toFixed(2)
            : "0.00",
      }));
      if (groupedItems.length === 0) {
        return [];
      }

      const frameworkCoverage = groupedItems.reduce((acc: Record<string, number>, item) => {
        acc[item.framework_name] = item.controls_mapped;
        return acc;
      }, {});
      const frameworkConfidence = groupedItems.reduce((acc: Record<string, number>, item) => {
        acc[item.framework_name] = Number.parseFloat(item.avg_confidence);
        return acc;
      }, {});
      const totalMapped = groupedItems.reduce((sum, item) => sum + item.controls_mapped, 0);
      const totalConfidence = groupedItems.reduce((sum, item) => sum + item.total_confidence, 0);
      const lastUpdated = groupedItems.reduce(
        (max, item) => (item.last_updated > max ? item.last_updated : max),
        groupedItems[0].last_updated
      );

      return [
        {
          user_id: groupedItems[0].user_id,
          total_controls_mapped: totalMapped,
          avg_confidence: totalMapped > 0 ? totalConfidence / totalMapped : 0,
          framework_coverage: frameworkCoverage,
          framework_confidence: frameworkConfidence,
          last_updated: lastUpdated,
          documents_analyzed: 0,
        },
      ];
    } catch (error) {
      log.error("enhanced_database.compliance_dashboard_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  static async getFrameworkCoverageHeatmap(): Promise<FrameworkCoverageHeatmap[]> {
    try {
      const supabase = await createClient();

      // Query user_controls for heatmap data
      const { data: userControls, error } = await supabase
        .from("user_controls")
        .select(
          `
          user_id,
          scf_control_id,
          confidence_score,
          updated_at,
          mapping_status
        `
        )
        .not("scf_control_id", "is", null)
        .in("mapping_status", ["confirmed", "suggested"]);

      if (error) throw error;

      if (!userControls || userControls.length === 0) {
        return [];
      }

      // Get SCF control mappings to frameworks
      const typedUserControls = (userControls || []) as UserControlDashboardRow[];
      const scfControlIds = [...new Set(typedUserControls.map((uc) => uc.scf_control_id))];
      const { data: controlMappings } = await supabase
        .from("scf_control_mappings")
        .select("control_id, framework_id")
        .in("control_id", scfControlIds);

      if (!controlMappings || controlMappings.length === 0) {
        return [];
      }

      // Get framework details
      const typedControlMappings = (controlMappings || []) as ControlMappingFrameworkRow[];
      const frameworkIds = [...new Set(typedControlMappings.map((cm) => cm.framework_id))];
      const { data: frameworks } = await supabase
        .from("scf_frameworks")
        .select("id, framework_name")
        .in("id", frameworkIds);

      const typedFrameworks = (frameworks || []) as FrameworkBasicRow[];
      const frameworkMap = typedFrameworks.reduce(
        (acc: Record<string, string>, fw) => ({
          ...acc,
          [fw.id]: fw.framework_name || "",
        }),
        {}
      );

      const controlToFrameworkMap = typedControlMappings.reduce(
        (acc: Record<string, string[]>, cm) => {
          if (!acc[cm.control_id]) acc[cm.control_id] = [];
          acc[cm.control_id].push(frameworkMap[cm.framework_id]);
          return acc;
        },
        {}
      );

      // Aggregate data by framework
      const grouped = typedUserControls.reduce((acc: Record<string, GroupedHeatmapItem>, row) => {
        const frameworks = controlToFrameworkMap[row.scf_control_id] || [];

        frameworks.forEach((frameworkName: string) => {
          if (!frameworkName) return;
          const updatedAt = row.updated_at || new Date(0).toISOString();

          if (!acc[frameworkName]) {
            acc[frameworkName] = {
              framework_name: frameworkName,
              user_ids: new Set(),
              scf_control_ids: new Set(),
              confidences: [],
              last_updated: updatedAt,
            };
          }

          acc[frameworkName].user_ids.add(row.user_id);
          acc[frameworkName].scf_control_ids.add(row.scf_control_id);
          acc[frameworkName].confidences.push(row.confidence_score || 0);

          if (updatedAt > acc[frameworkName].last_updated) {
            acc[frameworkName].last_updated = updatedAt;
          }
        });

        return acc;
      }, {});

      // Calculate metrics and return array
      const result = Object.values(grouped)
        .map((item) => ({
          framework_name: item.framework_name,
          user_count: item.user_ids.size,
          avg_confidence:
            item.confidences.length > 0
              ? Math.round(
                  (item.confidences.reduce((a: number, b: number) => a + b, 0) /
                    item.confidences.length) *
                    100
                ) / 100
              : 0,
          controls_covered: item.scf_control_ids.size,
          control_list: Array.from(item.scf_control_ids).sort() as string[],
          last_updated: item.last_updated,
        }))
        .sort((a, b) => b.controls_covered - a.controls_covered);

      return result;
    } catch (error) {
      log.error("enhanced_database.framework_coverage_heatmap_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Refresh Materialized Views
  static async refreshMaterializedViews(): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.rpc("refresh_compliance_views");

      if (error) throw error;
      log.info("Materialized views refreshed successfully");
    } catch (error) {
      log.error("enhanced_database.materialized_views_refresh_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Advanced Analytics Queries
  static async getComplianceAnalytics(userId: string): Promise<{
    totalControls: number;
    avgConfidence: number;
    frameworkBreakdown: Record<string, number>;
    recentActivity: unknown[];
    topGaps: unknown[];
    improvementTrends: unknown[];
  }> {
    try {
      const supabase = await createClient();

      const [dashboardData, gapsData] = await Promise.all([
        EnhancedDatabaseService.getComplianceDashboard(userId),
        supabase
          .from("user_compliance_gaps")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "open")
          .order("priority_level", { ascending: false })
          .limit(5),
      ]);

      const dashboard = dashboardData[0];

      return {
        totalControls: dashboard?.total_controls_mapped || 0,
        avgConfidence: dashboard?.avg_confidence || 0,
        frameworkBreakdown: dashboard?.framework_coverage || {},
        recentActivity: [], // Audit logs removed
        topGaps: gapsData.data || [],
        improvementTrends: [], // Would be calculated from historical data
      };
    } catch (error) {
      log.error("enhanced_database.compliance_analytics_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return {
        totalControls: 0,
        avgConfidence: 0,
        frameworkBreakdown: {},
        recentActivity: [],
        topGaps: [],
        improvementTrends: [],
      };
    }
  }
}

const WORD_REGEX = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(WORD_REGEX) ?? []).map((token) =>
    token.normalize("NFC")
  );
}

function computeCoverageScore(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const targetSet = new Set(targetTokens);
  const matched = queryTokens.filter((token) => targetSet.has(token));

  return matched.length / queryTokens.length;
}

function computeDiceCoefficient(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const queryCounts = new Map<string, number>();
  const targetCounts = new Map<string, number>();

  for (const token of queryTokens) {
    queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);
  }

  for (const token of targetTokens) {
    targetCounts.set(token, (targetCounts.get(token) ?? 0) + 1);
  }

  let intersection = 0;
  for (const [token, count] of queryCounts.entries()) {
    const minCount = Math.min(count, targetCounts.get(token) ?? 0);
    intersection += minCount;
  }

  return (2 * intersection) / (queryTokens.length + targetTokens.length);
}

export function computeTextSimilarity(query: string, text: string): number {
  if (!query || !text) {
    return 0;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const directMatch = normalizedText.includes(normalizedQuery) ? 1 : 0;

  const queryTokens = tokenize(normalizedQuery);
  const targetTokens = tokenize(normalizedText);

  if (queryTokens.length === 0 || targetTokens.length === 0) {
    return directMatch;
  }

  const coverage = computeCoverageScore(queryTokens, targetTokens);
  const dice = computeDiceCoefficient(queryTokens, targetTokens);

  const score = Math.max(directMatch, 0.6 * dice + 0.4 * coverage);
  return Math.min(1, Math.max(0, Number(score.toFixed(4))));
}

export default EnhancedDatabaseService;
