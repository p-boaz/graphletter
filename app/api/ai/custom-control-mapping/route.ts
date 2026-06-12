import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getModel } from "@/lib/ai-client";
import {
  COMPLIANCE_AI_CONFIG,
  getOpenAIProviderOptions,
  getTemperatureSettings,
  validateAIEnvironment,
} from "@/lib/ai-config";
import { apiError } from "@/lib/api/error-response";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";
import { enforceUserRateLimit, requireAuthenticatedUser } from "@/utils/api-guards";

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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser();
    if ("response" in authResult) {
      return authResult.response;
    }

    const rateLimited = enforceUserRateLimit({
      scope: "ai",
      userId: authResult.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    log.info("Custom control mapping API called");

    // Validate AI environment
    if (!validateAIEnvironment()) {
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

    // Validate input
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

    // Get sample SCF controls for analysis
    const { data: scfControls, error: controlsError } = await supabase
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
      .limit(200); // Reasonable limit for analysis

    if (controlsError) {
      log.error("ai.custom_control_mapping.controls_fetch_failed", {
        detail: controlsError instanceof Error ? controlsError.message : String(controlsError),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch SCF controls from database",
        },
        { status: 500 }
      );
    }

    // Create simplified control context for AI
    const controlsContext = (scfControls || [])
      .slice(0, 50)
      .map(
        (control) => `${control.id}: ${control.title} - ${control.description.substring(0, 150)}...`
      )
      .join("\n");

    // AI analysis with simpler approach
    const model = getModel(
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
      const { object } = await generateObject({
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
      });

      const analysisResult: AnalysisResult = object;

      // Enrich with full SCF control data
      const enrichedControls = (analysisResult.matchedControls || [])
        .map((match) => {
          const scfControl = (scfControls || []).find((c) => c.id === match.controlId) as
            | ScfControl
            | undefined;
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

      // Framework coverage analysis
      let frameworkCoverage = null;
      if (includeFrameworkCoverage && enrichedControls.length > 0) {
        frameworkCoverage = await analyzeFrameworkCoverage(enrichedControls);
      }

      return NextResponse.json({
        success: true,
        data: {
          inputPolicy: {
            text: policyText,
            wordCount: policyText.split(/\s+/).length,
            analyzedAt: new Date().toISOString(),
          },
          analysis: {
            concepts: analysisResult.concepts || [],
            matchedControls: enrichedControls,
            gaps: analysisResult.gaps || [],
            overallAssessment: analysisResult.overallAssessment || "Analysis completed",
            totalMatches: enrichedControls.length,
            avgConfidence:
              enrichedControls.length > 0
                ? Math.round(
                    enrichedControls.reduce((sum: number, c) => sum + c.confidence, 0) /
                      enrichedControls.length
                  )
                : 0,
          },
          frameworkCoverage,
          recommendations: generateRecommendations(enrichedControls.length),
        },
      });
    } catch (error) {
      log.warn("ai.custom_control_mapping.ai_failed_using_fallback", {
        detail: error instanceof Error ? error.message : String(error),
      });

      // Fallback analysis
      const keywords = policyText
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3);
      const keywordMatches = (scfControls || [])
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

      const enrichedControls = (analysisResult.matchedControls || [])
        .map((match) => {
          const scfControl = (scfControls || []).find((c) => c.id === match.controlId) as
            | ScfControl
            | undefined;
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

      let frameworkCoverage = null;
      if (includeFrameworkCoverage && enrichedControls.length > 0) {
        frameworkCoverage = await analyzeFrameworkCoverage(enrichedControls);
      }

      return NextResponse.json({
        success: true,
        data: {
          inputPolicy: {
            text: policyText,
            wordCount: policyText.split(/\s+/).length,
            analyzedAt: new Date().toISOString(),
          },
          analysis: {
            concepts: analysisResult.concepts || [],
            matchedControls: enrichedControls,
            gaps: analysisResult.gaps || [],
            overallAssessment: analysisResult.overallAssessment || "Analysis completed",
            totalMatches: enrichedControls.length,
            avgConfidence:
              enrichedControls.length > 0
                ? Math.round(
                    enrichedControls.reduce((sum: number, c) => sum + c.confidence, 0) /
                      enrichedControls.length
                  )
                : 0,
          },
          frameworkCoverage,
          recommendations: generateRecommendations(enrichedControls.length),
        },
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
}

// Helper function to analyze framework coverage
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

// Helper function to generate recommendations
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
