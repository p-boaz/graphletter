import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { generateObject } from "ai";
import type { getModel } from "@/lib/ai-client";
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
} from "@/lib/ai-config";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/ai/custom-control-mapping");

interface FrameworkInfo {
  framework_name: string;
  framework_version?: string | null;
}

interface ControlMapping {
  framework_control_id: string;
  scf_frameworks: FrameworkInfo | null;
}

interface ScfControl {
  id: string;
  title: string;
  description: string;
  domain_id?: string | null;
  scf_control_mappings?: ControlMapping[];
  confidence?: number;
  reasoning?: string;
}

interface EnrichedControl extends ScfControl {
  confidence: number;
  reasoning: string;
}

interface AnalysisMatchedControl {
  controlId: string;
  confidence: number;
  reasoning?: string;
}

interface AnalysisResult {
  concepts?: string[];
  matchedControls?: AnalysisMatchedControl[];
  gaps?: string[];
  overallAssessment?: string;
}

type MappingMethod = "ai_model" | "keyword_fallback";
type MappingSource = "configured_ai_provider" | "local_keyword_matcher";

interface MappingMetadata {
  method: MappingMethod;
  source: MappingSource;
  provider?: string;
  model?: string;
}

type AuthResult = { user: { id: string } } | { response: NextResponse };

interface UserRateLimitInput {
  scope: string;
  userId: string;
  limit: number;
  windowMs: number;
}

interface ControlQuery {
  limit(count: number): PromiseLike<{
    data: ScfControl[] | null;
    error: { message: string } | null;
  }>;
}

interface ControlStore {
  from(table: "scf_controls"): {
    select(columns: string): ControlQuery;
  };
}

type GenerateObjectFn = typeof generateObject;
type GetModelFn = typeof getModel;

export interface CustomControlMappingDependencies {
  requireAuthenticatedUser: () => Promise<AuthResult>;
  enforceUserRateLimit: (options: UserRateLimitInput) => NextResponse | null;
  validateAIEnvironment: () => boolean;
  controlStore: ControlStore;
  generateObject: GenerateObjectFn;
  getModel: GetModelFn;
}

const customPolicyMappingSchema = z.object({
  concepts: z.array(z.string()).optional(),
  matchedControls: z
    .array(
      z.object({
        controlId: z.string(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string().optional(),
      })
    )
    .optional(),
  gaps: z.array(z.string()).optional(),
  overallAssessment: z.string().optional(),
});

function enrichMatchedControls(
  analysisResult: AnalysisResult,
  scfControls: ScfControl[]
): EnrichedControl[] {
  return (analysisResult.matchedControls || [])
    .map((match) => {
      const scfControl = scfControls.find((control) => control.id === match.controlId);
      if (scfControl) {
        return {
          ...scfControl,
          confidence: match.confidence || 50,
          reasoning: match.reasoning || "No reasoning provided",
        };
      }
      return null;
    })
    .filter((control): control is EnrichedControl => Boolean(control))
    .slice(0, 10);
}

async function analyzeFrameworkCoverage(matchedControls: ScfControl[]) {
  const frameworkStats: {
    [key: string]: {
      controlCount: number;
      controls: string[];
      frameworkVersion?: string;
    };
  } = {};

  matchedControls.forEach((control) => {
    control.scf_control_mappings?.forEach((mapping) => {
      const framework = mapping.scf_frameworks;
      if (!framework) return;
      const frameworkKey = `${framework.framework_name}${
        framework.framework_version ? ` ${framework.framework_version}` : ""
      }`;

      if (!frameworkStats[frameworkKey]) {
        frameworkStats[frameworkKey] = {
          controlCount: 0,
          controls: [],
          frameworkVersion: framework.framework_version ?? undefined,
        };
      }

      if (!frameworkStats[frameworkKey].controls.includes(control.id)) {
        frameworkStats[frameworkKey].controlCount++;
        frameworkStats[frameworkKey].controls.push(control.id);
      }
    });
  });

  return Object.entries(frameworkStats)
    .map(([name, stats]) => ({
      frameworkName: name,
      frameworkVersion: stats.frameworkVersion ?? undefined,
      coveredControls: stats.controlCount,
      controlIds: stats.controls,
    }))
    .sort((a, b) => b.coveredControls - a.coveredControls)
    .slice(0, 15);
}

function generateRecommendations(matchCount: number) {
  const recommendations = [];

  if (matchCount === 0) {
    recommendations.push({
      type: "no_matches",
      priority: "high",
      title: "No Direct Control Matches Found",
      description: "Consider refining your policy text or check if it covers a specialized area.",
      actionItems: [
        "Review policy text for standard security terminology",
        "Consider broader policy statements",
        "Check if this represents a novel control area",
      ],
    });
  } else if (matchCount < 3) {
    recommendations.push({
      type: "limited_coverage",
      priority: "medium",
      title: "Limited Control Coverage",
      description: "Your policy maps to only a few controls. Consider expanding scope.",
      actionItems: [
        "Review related control families",
        "Consider additional policy statements",
        "Evaluate gaps in current coverage",
      ],
    });
  } else {
    recommendations.push({
      type: "good_coverage",
      priority: "low",
      title: "Good Control Alignment",
      description: `Your policy aligns well with ${matchCount} SCF controls.`,
      actionItems: [
        "Review implementation details for each control",
        "Develop evidence collection procedures",
        "Plan regular compliance assessments",
      ],
    });
  }

  return recommendations;
}

function buildResponseData({
  policyText,
  analysisResult,
  enrichedControls,
  frameworkCoverage,
  metadata,
}: {
  policyText: string;
  analysisResult: AnalysisResult;
  enrichedControls: EnrichedControl[];
  frameworkCoverage: Awaited<ReturnType<typeof analyzeFrameworkCoverage>> | null;
  metadata: MappingMetadata;
}) {
  return {
    inputPolicy: {
      text: policyText,
      wordCount: policyText.split(/\s+/).length,
      analyzedAt: new Date().toISOString(),
    },
    analysis: {
      method: metadata.method,
      source: metadata.source,
      concepts: analysisResult.concepts || [],
      matchedControls: enrichedControls,
      gaps: analysisResult.gaps || [],
      overallAssessment: analysisResult.overallAssessment || "Analysis completed",
      totalMatches: enrichedControls.length,
      avgConfidence:
        enrichedControls.length > 0
          ? Math.round(
              enrichedControls.reduce((sum: number, control) => sum + control.confidence, 0) /
                enrichedControls.length
            )
          : 0,
    },
    mappingMetadata: metadata,
    frameworkCoverage,
    recommendations: generateRecommendations(enrichedControls.length),
  };
}

export function createCustomControlMappingHandler(dependencies: CustomControlMappingDependencies) {
  return async function customControlMappingPost(request: NextRequest) {
    try {
      const authResult = await dependencies.requireAuthenticatedUser();
      if ("response" in authResult) {
        return authResult.response;
      }

      const rateLimited = dependencies.enforceUserRateLimit({
        scope: "ai",
        userId: authResult.user.id,
        limit: 20,
        windowMs: 60_000,
      });
      if (rateLimited) {
        return rateLimited;
      }

      log.info("Custom control mapping API called");

      if (!dependencies.validateAIEnvironment()) {
        return NextResponse.json(
          {
            success: false,
            error: "AI services not properly configured. Please check your API keys.",
          },
          { status: 500 }
        );
      }

      const body = await request.json();
      const { policyText, includeFrameworkCoverage = true } = body;

      if (!policyText || typeof policyText !== "string" || policyText.trim().length < 10) {
        return NextResponse.json(
          {
            success: false,
            error: "Policy text is required and must be at least 10 characters long",
          },
          { status: 400 }
        );
      }

      log.info("Analyzing custom policy text", {
        length: policyText.length,
      });

      const { data: scfControls, error: controlsError } = await dependencies.controlStore
        .from("scf_controls")
        .select(
          `
        id,
        title,
        description,
        domain_id,
        scf_control_mappings (
          framework_control_id,
          scf_frameworks (
            framework_name,
            framework_version
          )
        )
      `
        )
        .limit(200);

      if (controlsError) {
        log.error("ai.custom_control_mapping.controls_fetch_failed", {
          detail: controlsError.message,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch SCF controls from database",
          },
          { status: 500 }
        );
      }
      const controls = scfControls || [];

      const controlsContext = controls
        .slice(0, 50)
        .map(
          (control) =>
            `${control.id}: ${control.title} - ${control.description.substring(0, 150)}...`
        )
        .join("\n");

      const model = dependencies.getModel(
        COMPLIANCE_AI_CONFIG.controlMapping.provider,
        COMPLIANCE_AI_CONFIG.controlMapping.model
      );

      const prompt = `Analyze this custom policy/control text and map it to relevant SCF (Secure Controls Framework) controls.

CUSTOM POLICY TEXT:
"""
${policyText}
"""

SAMPLE SCF CONTROLS:
${controlsContext}

Please analyze the policy text and respond with ONLY valid JSON in this exact format (no markdown, no code blocks, just pure JSON):
{
  "concepts": ["concept1", "concept2"],
  "matchedControls": [
    {
      "controlId": "SCF_ID", 
      "confidence": 85,
      "reasoning": "explanation of why this maps"
    }
  ],
  "gaps": ["gap1", "gap2"],
  "overallAssessment": "brief summary"
}`;

      try {
        const { object } = (await dependencies.generateObject({
          model,
          schema: customPolicyMappingSchema,
          prompt,
          maxOutputTokens: 1500,
          ...getOpenAIProviderOptions(COMPLIANCE_AI_CONFIG.controlMapping.provider, {
            reasoningEffort: "low",
            textVerbosity: "medium",
          }),
          ...getTemperatureSettings(
            COMPLIANCE_AI_CONFIG.controlMapping.provider,
            COMPLIANCE_AI_CONFIG.controlMapping.model,
            COMPLIANCE_AI_CONFIG.controlMapping.temperature
          ),
        })) as { object: AnalysisResult };

        const analysisResult: AnalysisResult = object;
        const enrichedControls = enrichMatchedControls(analysisResult, controls);

        let frameworkCoverage = null;
        if (includeFrameworkCoverage && enrichedControls.length > 0) {
          frameworkCoverage = await analyzeFrameworkCoverage(enrichedControls);
        }

        const metadata: MappingMetadata = {
          method: "ai_model",
          source: "configured_ai_provider",
          provider: COMPLIANCE_AI_CONFIG.controlMapping.provider,
          model: COMPLIANCE_AI_CONFIG.controlMapping.model,
        };
        log.info("ai.custom_control_mapping.completed", {
          method: metadata.method,
          source: metadata.source,
          matchedControls: enrichedControls.length,
        });

        return NextResponse.json({
          success: true,
          data: buildResponseData({
            policyText,
            analysisResult,
            enrichedControls,
            frameworkCoverage,
            metadata,
          }),
        });
      } catch (error) {
        log.warn("ai.custom_control_mapping.ai_failed_using_fallback", {
          detail: error instanceof Error ? error.message : String(error),
          method: "keyword_fallback",
          source: "local_keyword_matcher",
        });

        const keywords = policyText
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 3);
        const keywordMatches = controls
          .filter((control) =>
            keywords.some(
              (keyword) =>
                control.title.toLowerCase().includes(keyword) ||
                control.description.toLowerCase().includes(keyword)
            )
          )
          .slice(0, 5);

        const analysisResult: AnalysisResult = {
          concepts: keywords.slice(0, 5),
          matchedControls: keywordMatches.map((control) => ({
            controlId: control.id,
            confidence: 50,
            reasoning: "Keyword-based fallback matching",
          })),
          gaps: ["AI analysis failed - using fallback matching"],
          overallAssessment: "Fallback analysis used due to parsing error",
        };

        const enrichedControls = enrichMatchedControls(analysisResult, controls);

        let frameworkCoverage = null;
        if (includeFrameworkCoverage && enrichedControls.length > 0) {
          frameworkCoverage = await analyzeFrameworkCoverage(enrichedControls);
        }

        const metadata: MappingMetadata = {
          method: "keyword_fallback",
          source: "local_keyword_matcher",
        };

        return NextResponse.json({
          success: true,
          data: buildResponseData({
            policyText,
            analysisResult,
            enrichedControls,
            frameworkCoverage,
            metadata,
          }),
        });
      }
    } catch (error) {
      return apiError(
        "ai.custom_control_mapping_failed",
        "Failed to analyze custom policy mapping",
        500,
        error
      );
    }
  };
}
