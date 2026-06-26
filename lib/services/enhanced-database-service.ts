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
  ControlHierarchy,
  ControlSearchParams,
  ControlSearchResult,
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
