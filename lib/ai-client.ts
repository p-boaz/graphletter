// AI Client for Compliance Platform
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, streamText } from "ai";
import { z } from "zod";

import {
  AI_MODELS,
  AI_PROVIDERS,
  type AIModel,
  type AIProvider,
  COMPLIANCE_AI_CONFIG,
  getFallbackProvider,
  getOpenAIProviderOptions,
  getProviderConfig,
  getTemperatureSettings,
} from "./ai-config";
import { createLogger } from "./logger";

const log = createLogger("lib/ai-client");

// Get model instance based on provider and model name with proper API key handling
export function getModel(provider: AIProvider, model: AIModel) {
  const config = getProviderConfig();
  const fallbackProvider = getFallbackProvider(provider);

  if (!fallbackProvider) {
    throw new Error("No AI providers available");
  }

  // Use appropriate model for the provider with API key
  let finalModel = model;
  if (fallbackProvider !== provider) {
    // If using fallback, adjust model accordingly
    if (fallbackProvider === AI_PROVIDERS.ANTHROPIC && model.startsWith("gpt")) {
      finalModel = AI_MODELS.CLAUDE_3_7_SONNET;
    } else if (fallbackProvider === AI_PROVIDERS.OPENAI && model.startsWith("claude")) {
      finalModel = AI_MODELS.GPT_5_4;
    }
  }

  // Create provider instance with API key
  if (fallbackProvider === AI_PROVIDERS.OPENAI) {
    if (!config.openai.available) {
      throw new Error("OpenAI API key not configured");
    }
    return openai(finalModel);
  } else if (fallbackProvider === AI_PROVIDERS.ANTHROPIC) {
    if (!config.anthropic.available) {
      throw new Error("Anthropic API key not configured");
    }
    return anthropic(finalModel);
  }

  throw new Error(`Provider ${fallbackProvider} not supported`);
}

// Test function for checking provider availability
export async function testProvider(
  provider: AIProvider
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const config = getProviderConfig();

    if (provider === AI_PROVIDERS.OPENAI && !config.openai.available) {
      return {
        success: false,
        message: "OpenAI API key not configured",
        error: "Missing API key",
      };
    }

    if (provider === AI_PROVIDERS.ANTHROPIC && !config.anthropic.available) {
      return {
        success: false,
        message: "Anthropic API key not configured",
        error: "Missing API key",
      };
    }

    const model = getModel(
      provider,
      provider === AI_PROVIDERS.OPENAI ? AI_MODELS.GPT_5_4 : AI_MODELS.CLAUDE_3_HAIKU
    );

    const { text } = await generateText({
      model,
      prompt: `Say "${provider} automation ready" in exactly those words.`,
      ...getOpenAIProviderOptions(provider, {
        reasoningEffort: "minimal",
        textVerbosity: "low",
      }),
      maxOutputTokens: 10,
    });

    return { success: true, message: text.trim() };
  } catch (error) {
    console.error(`Error testing ${provider}:`, error);
    return {
      success: false,
      message: `${provider} test failed`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Enhanced interfaces for sophisticated analysis
export interface ParsedControl {
  id: string;
  title: string;
  description: string;
  category: string;
  requirements: string[];
  implementationGuidance?: string;
  relatedControls?: string[];
  riskLevel?: "low" | "medium" | "high" | "critical";
  keywords?: string[];
  technicalDomains?: string[];
  businessFunctions?: string[];
}

export interface ParsedStandard {
  name: string;
  version?: string;
  description: string;
  scope: string;
  controls: ParsedControl[];
  categories: string[];
  totalControls: number;
  documentStructure: {
    sections: string[];
    hasAppendices: boolean;
    hasGlossary: boolean;
  };
}

export interface DocumentParsingResult {
  standard: ParsedStandard;
  extractionConfidence: number;
  processingNotes: string[];
  suggestedMappings?: Array<{
    controlId: string;
    suggestedStandards: string[];
    confidence: number;
  }>;
}

interface PolicyControlMatch {
  controlId: string;
  confidence: number;
  reasoning: string;
  implementation: string;
}

function isPolicyControlMatch(value: unknown): value is PolicyControlMatch {
  if (!value || typeof value !== "object") return false;
  const match = value as Partial<PolicyControlMatch>;
  return (
    typeof match.controlId === "string" &&
    typeof match.confidence === "number" &&
    typeof match.reasoning === "string" &&
    typeof match.implementation === "string"
  );
}

const documentParsingSchema = z.object({
  standard: z
    .object({
      name: z.string().optional(),
      version: z.string().nullable().optional(),
      description: z.string().optional(),
      scope: z.string().optional(),
      controls: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            category: z.string().optional(),
            requirements: z.array(z.string()).optional(),
            implementationGuidance: z.string().nullable().optional(),
            relatedControls: z.array(z.string()).optional(),
            riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
            keywords: z.array(z.string()).optional(),
            technicalDomains: z.array(z.string()).optional(),
            businessFunctions: z.array(z.string()).optional(),
          })
        )
        .optional(),
      categories: z.array(z.string()).optional(),
      totalControls: z.number().optional(),
      documentStructure: z
        .object({
          sections: z.array(z.string()).optional(),
          hasAppendices: z.boolean().optional(),
          hasGlossary: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  extractionConfidence: z.number().min(0).max(100).optional(),
  processingNotes: z.array(z.string()).optional(),
  suggestedMappings: z
    .array(
      z.object({
        controlId: z.string(),
        suggestedStandards: z.array(z.string()),
        confidence: z.number().min(0).max(100),
      })
    )
    .optional(),
});

const enhancedMappingSchema = z.object({
  mappingType: z.enum(["direct", "partial", "related", "complementary", "no-mapping"]).optional(),
  confidence: z.number().min(0).max(100).optional(),
  semanticSimilarity: z.number().min(0).max(100).optional(),
  functionalOverlap: z.number().min(0).max(100).optional(),
  implementationAlignment: z.number().min(0).max(100).optional(),
  riskCoverage: z.number().min(0).max(100).optional(),
  businessValue: z.number().min(0).max(100).optional(),
  industryRelevance: z.number().min(0).max(100).optional(),
  analysis: z.string().optional(),
  gaps: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  implementationComplexity: z.enum(["low", "medium", "high"]).optional(),
  estimatedEffort: z.string().optional(),
  industrySpecificNotes: z.array(z.string()).optional(),
});

const basicControlMappingSchema = z.object({
  mappingType: z.enum(["direct", "partial", "related", "no-mapping"]),
  confidence: z.number().min(0).max(100),
  analysis: z.string(),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const policyAnalysisSchema = z.object({
  concepts: z.array(z.string()).optional(),
  matchedControls: z
    .array(
      z.object({
        controlId: z.string(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string(),
        implementation: z.string(),
      })
    )
    .optional(),
  gaps: z.array(z.string()).optional(),
  overallAssessment: z.string().optional(),
});

// Industry-specific context for enhanced analysis
export interface IndustryContext {
  industry:
    | "healthcare"
    | "financial"
    | "technology"
    | "manufacturing"
    | "retail"
    | "government"
    | "energy"
    | "other";
  organizationSize: "startup" | "small" | "medium" | "large" | "enterprise";
  riskTolerance: "low" | "medium" | "high";
  regulatoryEnvironment: "strict" | "moderate" | "flexible";
  technicalMaturity: "basic" | "intermediate" | "advanced" | "expert";
  complianceHistory: "new" | "established" | "mature";
}

// Enhanced mapping result with confidence calibration
export interface EnhancedMappingResult {
  sourceControlId: string;
  targetControlId: string;
  mappingType: "direct" | "partial" | "related" | "complementary" | "no-mapping";
  confidence: number;
  calibratedConfidence: number;
  semanticSimilarity: number;
  functionalOverlap: number;
  implementationAlignment: number;
  riskCoverage: number;
  businessValue: number;
  industryRelevance: number;
  analysis: string;
  gaps: string[];
  recommendations: string[];
  implementationComplexity: "low" | "medium" | "high";
  estimatedEffort: string;
  industrySpecificNotes: string[];
}

// Cross-standard mapping result
export interface CrossStandardMapping {
  sourceStandard: string;
  targetStandards: string[];
  mappingMatrix: Array<{
    sourceControl: ParsedControl;
    mappings: Array<{
      targetStandard: string;
      targetControl: ParsedControl;
      mapping: EnhancedMappingResult;
    }>;
    bestMatch?: {
      targetStandard: string;
      targetControl: ParsedControl;
      confidence: number;
    };
    coverageGaps: string[];
  }>;
  overallCoverage: {
    [standard: string]: {
      percentage: number;
      directMappings: number;
      partialMappings: number;
      gaps: number;
    };
  };
  recommendations: {
    priority: "high" | "medium" | "low";
    category: string;
    description: string;
    effort: string;
    timeline: string;
  }[];
}

// Industry-specific prompt templates
const INDUSTRY_PROMPTS = {
  healthcare: {
    context:
      "Healthcare organizations must comply with HIPAA, FDA regulations, and patient safety requirements. Focus on patient data protection, medical device security, and clinical workflow integrity.",
    riskFactors: [
      "patient safety",
      "PHI protection",
      "FDA compliance",
      "clinical workflow disruption",
      "medical device security",
    ],
    keyTerms: [
      "PHI",
      "HIPAA",
      "FDA",
      "clinical",
      "patient safety",
      "medical device",
      "healthcare data",
    ],
  },
  financial: {
    context:
      "Financial institutions operate under strict regulatory oversight including SOX, PCI-DSS, and banking regulations. Emphasize fraud prevention, financial data protection, and operational resilience.",
    riskFactors: [
      "financial fraud",
      "data breach",
      "regulatory penalties",
      "operational disruption",
      "customer trust",
    ],
    keyTerms: [
      "PCI-DSS",
      "SOX",
      "financial data",
      "fraud",
      "banking",
      "payment processing",
      "customer data",
    ],
  },
  technology: {
    context:
      "Technology companies focus on intellectual property protection, software security, and scalable security architectures. Consider DevSecOps, cloud security, and rapid development cycles.",
    riskFactors: [
      "IP theft",
      "software vulnerabilities",
      "cloud security",
      "DevOps alignment",
      "scalability",
    ],
    keyTerms: [
      "DevSecOps",
      "cloud security",
      "software development",
      "IP protection",
      "scalability",
      "automation",
    ],
  },
  manufacturing: {
    context:
      "Manufacturing organizations must secure operational technology (OT), industrial control systems, and supply chain. Focus on production continuity and safety systems.",
    riskFactors: [
      "production disruption",
      "OT security",
      "supply chain attacks",
      "safety system compromise",
      "industrial espionage",
    ],
    keyTerms: [
      "OT security",
      "ICS",
      "SCADA",
      "supply chain",
      "production systems",
      "industrial safety",
    ],
  },
  retail: {
    context:
      "Retail organizations process customer payment data across digital and physical channels. Focus on PCI compliance, fraud prevention, and resilient omnichannel operations.",
    riskFactors: [
      "payment fraud",
      "cardholder data theft",
      "ecommerce attacks",
      "supply chain compromise",
      "customer trust erosion",
    ],
    keyTerms: [
      "PCI-DSS",
      "point-of-sale",
      "cardholder data",
      "fraud detection",
      "ecommerce security",
      "omnichannel",
    ],
  },
  energy: {
    context:
      "Energy providers operate critical infrastructure with strict safety and resilience expectations. Prioritize OT/ICS security, service continuity, and incident response readiness.",
    riskFactors: [
      "grid disruption",
      "critical infrastructure attacks",
      "OT compromise",
      "safety incidents",
      "regulatory non-compliance",
    ],
    keyTerms: [
      "critical infrastructure",
      "OT",
      "ICS",
      "NERC CIP",
      "grid reliability",
      "operational resilience",
    ],
  },
  government: {
    context:
      "Government agencies must comply with FISMA, FedRAMP, and other federal security requirements. Emphasize national security, citizen data protection, and continuity of operations.",
    riskFactors: [
      "national security",
      "citizen data",
      "service disruption",
      "foreign interference",
      "compliance violations",
    ],
    keyTerms: [
      "FISMA",
      "FedRAMP",
      "NIST",
      "national security",
      "citizen services",
      "government data",
    ],
  },
  other: {
    context:
      "General business environment with standard cybersecurity and compliance requirements. Focus on business continuity, data protection, and regulatory compliance.",
    riskFactors: [
      "data breach",
      "business disruption",
      "regulatory penalties",
      "reputation damage",
      "financial loss",
    ],
    keyTerms: [
      "cybersecurity",
      "data protection",
      "business continuity",
      "compliance",
      "risk management",
    ],
  },
};

// Confidence calibration based on multiple factors
function calibrateConfidence(
  baseConfidence: number,
  semanticSimilarity: number,
  functionalOverlap: number,
  industryRelevance: number,
  implementationAlignment: number
): number {
  // Weighted average with industry-specific adjustments
  const weights = {
    base: 0.3,
    semantic: 0.25,
    functional: 0.25,
    industry: 0.1,
    implementation: 0.1,
  };

  const weightedScore =
    baseConfidence * weights.base +
    semanticSimilarity * weights.semantic +
    functionalOverlap * weights.functional +
    industryRelevance * weights.industry +
    implementationAlignment * weights.implementation;

  // Apply confidence penalty for low scores in critical areas
  let penalty = 0;
  if (semanticSimilarity < 50) penalty += 10;
  if (functionalOverlap < 40) penalty += 15;
  if (industryRelevance < 30) penalty += 5;

  const calibratedScore = Math.max(0, Math.min(100, weightedScore - penalty));

  // Round to nearest 5 for cleaner presentation
  return Math.round(calibratedScore / 5) * 5;
}

// Compliance-specific AI functions
export class GraphletterAI {
  // Parse compliance documents and extract structured data
  static async parseComplianceDocument(
    documentText: string,
    documentType = "compliance-standard",
    standardName = "Unknown Standard"
  ): Promise<DocumentParsingResult> {
    const config = COMPLIANCE_AI_CONFIG.documentParsing;
    const model = getModel(config.provider, config.model);

    const prompt = `
You are an expert compliance analyst. Parse this compliance document and extract structured information.

DOCUMENT TYPE: ${documentType}
STANDARD NAME: ${standardName}

DOCUMENT TEXT:
${documentText.substring(0, 8000)} ${documentText.length > 8000 ? "...[truncated]" : ""}

CRITICAL: Respond with ONLY a valid JSON object. Do not include any markdown formatting, explanations, or code blocks.

Extract and structure the following information in this exact JSON format:

{
  "standard": {
    "name": "extracted standard name",
    "version": "version if found or null",
    "description": "brief description of the standard",
    "scope": "what this standard covers",
    "controls": [
      {
        "id": "control identifier",
        "title": "control title",
        "description": "detailed control description",
        "category": "control category/domain",
        "requirements": ["list of specific requirements"],
        "implementationGuidance": "how to implement this control or null",
        "relatedControls": ["list of related control IDs"],
        "riskLevel": "low",
        "keywords": ["key terms and concepts"],
        "technicalDomains": ["technical areas covered"],
        "businessFunctions": ["business functions affected"]
      }
    ],
    "categories": ["list of all control categories found"],
    "totalControls": 0,
    "documentStructure": {
      "sections": ["main sections found"],
      "hasAppendices": false,
      "hasGlossary": false
    }
  },
  "extractionConfidence": 75,
  "processingNotes": ["notes about parsing quality"],
  "suggestedMappings": [
    {
      "controlId": "control ID",
      "suggestedStandards": ["ISO-27001", "NIST"],
      "confidence": 80
    }
  ]
}

ENHANCED PARSING GUIDELINES:
1. Extract ALL identifiable controls with unique IDs
2. Categorize controls logically (Access Control, Risk Management, etc.)
3. Set riskLevel as: "low", "medium", "high", or "critical"
4. Include specific requirements as separate array items
5. Extract keywords for semantic analysis
6. Identify technical domains (network, application, data, etc.)
7. Map to business functions (HR, Finance, Operations, etc.)
8. Suggest mappings to: ISO-27001, NIST-CSF, SOC-2, PCI-DSS, HIPAA
9. Set extractionConfidence based on document clarity (0-100)
10. Note any parsing challenges in processingNotes

Respond with valid JSON only - no markdown, no explanations, no code blocks.
`;

    try {
      const { object } = await generateObject({
        model,
        schema: documentParsingSchema,
        prompt,
        ...getOpenAIProviderOptions(config.provider, {
          reasoningEffort: "low",
          textVerbosity: "low",
        }),
        ...getTemperatureSettings(config.provider, config.model, config.temperature),
        maxOutputTokens: config.maxTokens,
      });
      const result: DocumentParsingResult = {
        standard: object.standard
          ? {
              name: object.standard.name || standardName,
              version: object.standard.version || undefined,
              description:
                object.standard.description || "Parsing incomplete - manual review required",
              scope: object.standard.scope || "Unknown",
              controls:
                object.standard.controls?.map((control) => ({
                  id: control.id || "UNKNOWN",
                  title: control.title || "Untitled Control",
                  description: control.description || "No description available",
                  category: control.category || "General",
                  requirements: control.requirements || [],
                  implementationGuidance: control.implementationGuidance || undefined,
                  relatedControls: control.relatedControls || [],
                  riskLevel: control.riskLevel || "medium",
                  keywords: control.keywords || [],
                  technicalDomains: control.technicalDomains || [],
                  businessFunctions: control.businessFunctions || [],
                })) || [],
              categories: object.standard.categories || [],
              totalControls: object.standard.totalControls || 0,
              documentStructure: {
                sections: object.standard.documentStructure?.sections || [],
                hasAppendices: object.standard.documentStructure?.hasAppendices || false,
                hasGlossary: object.standard.documentStructure?.hasGlossary || false,
              },
            }
          : {
              name: standardName,
              description: "Parsing incomplete - manual review required",
              scope: "Unknown",
              controls: [],
              categories: [],
              totalControls: 0,
              documentStructure: {
                sections: [],
                hasAppendices: false,
                hasGlossary: false,
              },
            },
        extractionConfidence: object.extractionConfidence || 0,
        processingNotes: object.processingNotes || [],
        suggestedMappings: object.suggestedMappings,
      };

      // Validate and enhance the result
      if (!result.standard) {
        result.standard = {
          name: standardName,
          description: "Parsing incomplete - manual review required",
          scope: "Unknown",
          controls: [],
          categories: [],
          totalControls: 0,
          documentStructure: {
            sections: [],
            hasAppendices: false,
            hasGlossary: false,
          },
        };
      }

      if (!result.standard.controls) {
        result.standard.controls = [];
      }

      // Ensure all controls have required fields with enhanced metadata
      result.standard.controls = result.standard.controls.map((control) => ({
        id: control.id || "UNKNOWN",
        title: control.title || "Untitled Control",
        description: control.description || "No description available",
        category: control.category || "General",
        requirements: control.requirements || [],
        implementationGuidance: control.implementationGuidance,
        relatedControls: control.relatedControls || [],
        riskLevel: control.riskLevel || "medium",
        keywords: control.keywords || [],
        technicalDomains: control.technicalDomains || [],
        businessFunctions: control.businessFunctions || [],
      }));

      // Update total controls count
      result.standard.totalControls = result.standard.controls.length;

      // Ensure other required fields exist
      if (!result.extractionConfidence) {
        result.extractionConfidence = result.standard.controls.length > 0 ? 70 : 20;
      }

      if (!result.processingNotes) {
        result.processingNotes = ["Document processed successfully"];
      }

      return result;
    } catch (error) {
      console.error("Error in document parsing:", error);

      // Return a fallback result if parsing fails
      return {
        standard: {
          name: standardName,
          description: "Document parsing failed - manual review required",
          scope: "Unknown",
          controls: [],
          categories: [],
          totalControls: 0,
          documentStructure: {
            sections: [],
            hasAppendices: false,
            hasGlossary: false,
          },
        },
        extractionConfidence: 0,
        processingNotes: [
          "Document parsing failed",
          error instanceof Error ? error.message : "Unknown parsing error",
          "Manual review and data entry required",
        ],
      };
    }
  }

  // Enhanced control mapping with industry context and confidence calibration
  static async analyzeControlMappingEnhanced(
    sourceControl: ParsedControl,
    targetControl: ParsedControl,
    industryContext: IndustryContext
  ): Promise<EnhancedMappingResult> {
    const config = COMPLIANCE_AI_CONFIG.controlMapping;
    const model = getModel(config.provider, config.model);

    const industryPrompt = INDUSTRY_PROMPTS[industryContext.industry];

    const prompt = `
You are a cybersecurity compliance expert specializing in ${
      industryContext.industry
    } industry compliance.

INDUSTRY CONTEXT:
${industryPrompt.context}

ORGANIZATION PROFILE:
- Industry: ${industryContext.industry}
- Size: ${industryContext.organizationSize}
- Risk Tolerance: ${industryContext.riskTolerance}
- Regulatory Environment: ${industryContext.regulatoryEnvironment}
- Technical Maturity: ${industryContext.technicalMaturity}
- Compliance History: ${industryContext.complianceHistory}

KEY INDUSTRY RISK FACTORS: ${industryPrompt.riskFactors.join(", ")}
INDUSTRY TERMINOLOGY: ${industryPrompt.keyTerms.join(", ")}

SOURCE CONTROL:
ID: ${sourceControl.id}
Title: ${sourceControl.title}
Description: ${sourceControl.description}
Category: ${sourceControl.category}
Requirements: ${sourceControl.requirements.join("; ")}
Risk Level: ${sourceControl.riskLevel}
Keywords: ${sourceControl.keywords?.join(", ") || "N/A"}
Technical Domains: ${sourceControl.technicalDomains?.join(", ") || "N/A"}
Business Functions: ${sourceControl.businessFunctions?.join(", ") || "N/A"}

TARGET CONTROL:
ID: ${targetControl.id}
Title: ${targetControl.title}
Description: ${targetControl.description}
Category: ${targetControl.category}
Requirements: ${targetControl.requirements.join("; ")}
Risk Level: ${targetControl.riskLevel}
Keywords: ${targetControl.keywords?.join(", ") || "N/A"}
Technical Domains: ${targetControl.technicalDomains?.join(", ") || "N/A"}
Business Functions: ${targetControl.businessFunctions?.join(", ") || "N/A"}

Perform a comprehensive analysis and provide scores (0-100) for each dimension:

1. SEMANTIC SIMILARITY: How similar are the controls in meaning and intent?
2. FUNCTIONAL OVERLAP: How much do the controls overlap in what they accomplish?
3. IMPLEMENTATION ALIGNMENT: How similar are the implementation approaches?
4. RISK COVERAGE: How well does the target control address the source control's risks?
5. BUSINESS VALUE: How valuable is this mapping for the organization?
6. INDUSTRY RELEVANCE: How relevant is this mapping for the ${industryContext.industry} industry?

CRITICAL: Respond with ONLY valid JSON in this exact format:

{
  "mappingType": "direct|partial|related|complementary|no-mapping",
  "confidence": 85,
  "semanticSimilarity": 78,
  "functionalOverlap": 82,
  "implementationAlignment": 75,
  "riskCoverage": 88,
  "businessValue": 80,
  "industryRelevance": 92,
  "analysis": "Detailed explanation of the mapping relationship, focusing on industry-specific considerations",
  "gaps": ["List of specific gaps or missing requirements"],
  "recommendations": ["Specific recommendations for this organization"],
  "implementationComplexity": "low|medium|high",
  "estimatedEffort": "Effort estimate with timeline",
  "industrySpecificNotes": ["Industry-specific implementation considerations"]
}

MAPPING TYPE DEFINITIONS:
- direct: Controls are functionally equivalent (90%+ overlap)
- partial: Controls overlap significantly but have gaps (60-89% overlap)
- related: Controls address similar areas but different aspects (30-59% overlap)
- complementary: Controls work together but address different aspects (10-29% overlap)
- no-mapping: Controls are unrelated (<10% overlap)

Consider industry-specific factors, regulatory requirements, and organizational context in your analysis.
`;

    try {
      const { object: rawResult } = await generateObject({
        model,
        schema: enhancedMappingSchema,
        prompt,
        ...getOpenAIProviderOptions(config.provider, {
          reasoningEffort: "low",
          textVerbosity: "medium",
        }),
        ...getTemperatureSettings(config.provider, config.model, config.temperature),
        maxOutputTokens: config.maxTokens,
      });

      // Calculate calibrated confidence
      const calibratedConfidence = calibrateConfidence(
        rawResult.confidence || 50,
        rawResult.semanticSimilarity || 50,
        rawResult.functionalOverlap || 50,
        rawResult.industryRelevance || 50,
        rawResult.implementationAlignment || 50
      );

      const result: EnhancedMappingResult = {
        sourceControlId: sourceControl.id,
        targetControlId: targetControl.id,
        mappingType: rawResult.mappingType || "related",
        confidence: rawResult.confidence || 50,
        calibratedConfidence,
        semanticSimilarity: rawResult.semanticSimilarity || 50,
        functionalOverlap: rawResult.functionalOverlap || 50,
        implementationAlignment: rawResult.implementationAlignment || 50,
        riskCoverage: rawResult.riskCoverage || 50,
        businessValue: rawResult.businessValue || 50,
        industryRelevance: rawResult.industryRelevance || 50,
        analysis: rawResult.analysis || "Analysis not available",
        gaps: rawResult.gaps || [],
        recommendations: rawResult.recommendations || [],
        implementationComplexity: rawResult.implementationComplexity || "medium",
        estimatedEffort: rawResult.estimatedEffort || "Not estimated",
        industrySpecificNotes: rawResult.industrySpecificNotes || [],
      };

      return result;
    } catch (error) {
      console.error("Error in enhanced control mapping:", error);
      throw new Error("Failed to perform enhanced control mapping analysis");
    }
  }

  // Cross-standard mapping analysis
  static async analyzeCrossStandardMapping(
    sourceStandard: ParsedStandard,
    targetStandards: ParsedStandard[],
    industryContext: IndustryContext
  ): Promise<CrossStandardMapping> {
    log.info("Starting cross-standard mapping analysis", { sourceStandard: sourceStandard.name });

    const mappingMatrix: CrossStandardMapping["mappingMatrix"] = [];

    // Analyze each source control against all target standards
    for (const sourceControl of sourceStandard.controls) {
      const controlMappings: Array<{
        targetStandard: string;
        targetControl: ParsedControl;
        mapping: EnhancedMappingResult;
      }> = [];

      let bestMatch:
        | {
            targetStandard: string;
            targetControl: ParsedControl;
            confidence: number;
          }
        | undefined;

      // Find mappings in each target standard
      for (const targetStandard of targetStandards) {
        for (const targetControl of targetStandard.controls) {
          try {
            const mapping = await GraphletterAI.analyzeControlMappingEnhanced(
              sourceControl,
              targetControl,
              industryContext
            );

            // Only include meaningful mappings
            if (mapping.calibratedConfidence >= 30) {
              controlMappings.push({
                targetStandard: targetStandard.name,
                targetControl,
                mapping,
              });

              // Track best match
              if (!bestMatch || mapping.calibratedConfidence > bestMatch.confidence) {
                bestMatch = {
                  targetStandard: targetStandard.name,
                  targetControl,
                  confidence: mapping.calibratedConfidence,
                };
              }
            }
          } catch (error) {
            console.error(`Error mapping ${sourceControl.id} to ${targetControl.id}:`, error);
          }
        }
      }

      // Identify coverage gaps
      const coverageGaps: string[] = [];
      if (!bestMatch) {
        coverageGaps.push("No suitable mapping found in any target standard");
      } else if (bestMatch.confidence < 70) {
        coverageGaps.push("Low confidence mapping - manual review recommended");
      }

      mappingMatrix.push({
        sourceControl,
        mappings: controlMappings,
        bestMatch,
        coverageGaps,
      });
    }

    // Calculate overall coverage statistics
    const overallCoverage: CrossStandardMapping["overallCoverage"] = {};

    for (const targetStandard of targetStandards) {
      const standardName = targetStandard.name;
      let directMappings = 0;
      let partialMappings = 0;
      let gaps = 0;

      for (const controlMapping of mappingMatrix) {
        const mappingForStandard = controlMapping.mappings.find(
          (m) => m.targetStandard === standardName
        );

        if (!mappingForStandard) {
          gaps++;
        } else if (mappingForStandard.mapping.mappingType === "direct") {
          directMappings++;
        } else if (
          ["partial", "related", "complementary"].includes(mappingForStandard.mapping.mappingType)
        ) {
          partialMappings++;
        } else {
          gaps++;
        }
      }

      const totalControls = sourceStandard.controls.length;
      const percentage = Math.round(((directMappings + partialMappings) / totalControls) * 100);

      overallCoverage[standardName] = {
        percentage,
        directMappings,
        partialMappings,
        gaps,
      };
    }

    // Generate high-level recommendations
    const recommendations: CrossStandardMapping["recommendations"] = [];

    // High priority recommendations
    for (const [standardName, coverage] of Object.entries(overallCoverage)) {
      if (coverage.gaps > coverage.directMappings + coverage.partialMappings) {
        recommendations.push({
          priority: "high",
          category: "Coverage Gap",
          description: `${standardName} has significant coverage gaps (${coverage.gaps} unmapped controls). Consider supplementary controls or alternative standards.`,
          effort: "High",
          timeline: "3-6 months",
        });
      }
    }

    // Medium priority recommendations
    const industryPrompt = INDUSTRY_PROMPTS[industryContext.industry];
    recommendations.push({
      priority: "medium",
      category: "Industry Alignment",
      description: `For ${
        industryContext.industry
      } organizations, focus on ${industryPrompt.riskFactors
        .slice(0, 2)
        .join(" and ")} when implementing mapped controls.`,
      effort: "Medium",
      timeline: "1-3 months",
    });

    return {
      sourceStandard: sourceStandard.name,
      targetStandards: targetStandards.map((s) => s.name),
      mappingMatrix,
      overallCoverage,
      recommendations,
    };
  }

  // Legacy methods for backward compatibility
  static async analyzeControlMapping(
    sourceControl: {
      id: string;
      title: string;
      description: string;
      standard: string;
    },
    targetControl: {
      id: string;
      title: string;
      description: string;
      standard: string;
    }
  ) {
    const config = COMPLIANCE_AI_CONFIG.controlMapping;
    const model = getModel(config.provider, config.model);

    const prompt = `
You are a cybersecurity compliance expert. Analyze the mapping between these two controls from different standards:

SOURCE CONTROL (${sourceControl.standard}):
ID: ${sourceControl.id}
Title: ${sourceControl.title}
Description: ${sourceControl.description}

TARGET CONTROL (${targetControl.standard}):
ID: ${targetControl.id}
Title: ${targetControl.title}
Description: ${targetControl.description}

Provide a detailed analysis including:
1. Mapping type (direct, partial, related, or no-mapping)
2. Confidence score (0-100)
3. Detailed explanation of similarities and differences
4. Identified gaps or missing requirements
5. Recommendations for addressing gaps

Format your response as JSON with the following structure:
{
  "mappingType": "direct|partial|related|no-mapping",
  "confidence": number,
  "analysis": "detailed explanation",
  "gaps": ["list of identified gaps"],
  "recommendations": ["list of recommendations"]
}
`;

    try {
      const { object } = await generateObject({
        model,
        schema: basicControlMappingSchema,
        prompt,
        ...getOpenAIProviderOptions(config.provider, {
          reasoningEffort: "low",
          textVerbosity: "medium",
        }),
        ...getTemperatureSettings(config.provider, config.model, config.temperature),
        maxOutputTokens: config.maxTokens,
      });

      return object;
    } catch (error) {
      console.error("Error in control mapping analysis:", error);
      throw new Error("Failed to analyze control mapping");
    }
  }

  // Generate gap analysis for a standard
  static async generateGapAnalysis(
    sourceStandard: string,
    targetStandard: string,
    mappings: Array<{
      sourceControl: string;
      targetControl: string;
      mappingType: string;
      gaps: string[];
    }>
  ) {
    const config = COMPLIANCE_AI_CONFIG.gapAnalysis;
    const model = getModel(config.provider, config.model);

    const prompt = `Analyze compliance gaps between ${sourceStandard} and ${targetStandard}.

Mappings Analysis:
${mappings
  .map(
    (m) => `
- ${m.sourceControl} → ${m.targetControl} (${m.mappingType})
  Gaps: ${m.gaps.join(", ")}
`
  )
  .join("")}

Provide:
1. Executive Summary of overall compliance status
2. Critical gaps requiring immediate attention
3. Medium-priority gaps for planning
4. Low-priority gaps for future consideration
5. Implementation roadmap with timelines
6. Resource requirements estimate
7. Risk assessment for each gap category

Format as structured analysis with clear priorities and actionable recommendations.`;

    const { text } = await generateText({
      model,
      prompt,
      ...getOpenAIProviderOptions(config.provider, {
        reasoningEffort: "low",
        textVerbosity: "medium",
      }),
      maxOutputTokens: config.maxTokens,
      ...getTemperatureSettings(config.provider, config.model, config.temperature),
    });

    return text;
  }

  static async analyzeCustomPolicyMapping(
    policyText: string,
    scfControls: Array<{
      id: string;
      title: string;
      description: string;
      domain_id: string;
      scf_control_mappings?: Array<{
        framework_control_id: string;
        scf_frameworks: {
          framework_name: string;
          framework_version?: string;
        };
      }>;
    }>
  ) {
    const config = COMPLIANCE_AI_CONFIG.controlMapping;
    const model = getModel(config.provider, config.model);

    // Create a focused subset of controls for better analysis
    const controlsContext = scfControls
      .slice(0, 100)
      .map(
        (control) => `${control.id}: ${control.title} - ${control.description.substring(0, 200)}...`
      )
      .join("\n");

    const prompt = `Analyze this custom policy/control text and map it to relevant SCF (Secure Controls Framework) controls.

CUSTOM POLICY TEXT:
"""
${policyText}
"""

AVAILABLE SCF CONTROLS (sample):
${controlsContext}

Please analyze the policy text and:

1. Identify the main security/compliance concepts covered
2. Map to the most relevant SCF controls (provide control IDs)
3. Assess the mapping confidence (0-100%)
4. Identify any gaps or areas not covered by standard controls
5. Suggest implementation guidance

Respond in this exact JSON format:
{
  "concepts": ["concept1", "concept2", ...],
  "matchedControls": [
    {
      "controlId": "SCF_ID", 
      "confidence": 85,
      "reasoning": "explanation of why this maps",
      "implementation": "specific implementation guidance"
    }
  ],
  "gaps": ["gap1", "gap2", ...],
  "overallAssessment": "brief summary of the policy coverage"
}`;

    try {
      const { object: analysisResult } = await generateObject({
        model,
        schema: policyAnalysisSchema,
        prompt,
        maxOutputTokens: 1500,
        ...getOpenAIProviderOptions(config.provider, {
          reasoningEffort: "low",
          textVerbosity: "medium",
        }),
        ...getTemperatureSettings(config.provider, config.model, config.temperature),
      });

      const matchedControls = Array.isArray(analysisResult.matchedControls)
        ? analysisResult.matchedControls
        : [];

      // Enrich with actual SCF control data
      const enrichedControls = matchedControls
        .map((match) => {
          if (!isPolicyControlMatch(match)) {
            return null;
          }
          const scfControl = scfControls.find((c) => c.id === match.controlId);
          if (scfControl) {
            return {
              ...scfControl,
              confidence: match.confidence,
              reasoning: match.reasoning,
              implementation: match.implementation,
            };
          }
          return null;
        })
        .filter(
          (
            control
          ): control is (typeof scfControls)[number] & {
            confidence: number;
            reasoning: string;
            implementation: string;
          } => control !== null
        )
        .slice(0, 10); // Limit to top 10 matches

      return {
        concepts: analysisResult.concepts || [],
        matchedControls: enrichedControls,
        gaps: analysisResult.gaps || [],
        overallAssessment: analysisResult.overallAssessment || "Analysis completed",
        totalMatches: enrichedControls.length,
        avgConfidence:
          enrichedControls.length > 0
            ? Math.round(
                enrichedControls.reduce((sum, c) => sum + c.confidence, 0) / enrichedControls.length
              )
            : 0,
      };
    } catch (error) {
      console.error("Failed to generate policy mapping:", error);

      // Fallback: simple keyword-based matching
      const keywords = policyText.toLowerCase().split(/\s+/);
      const keywordMatches = scfControls
        .filter((control) =>
          keywords.some(
            (keyword) =>
              control.title.toLowerCase().includes(keyword) ||
              control.description.toLowerCase().includes(keyword)
          )
        )
        .slice(0, 5)
        .map((control) => ({
          ...control,
          confidence: 50,
          reasoning: "Keyword-based fallback matching",
          implementation: "Review and implement according to control requirements",
        }));

      return {
        concepts: keywords.slice(0, 5),
        matchedControls: keywordMatches,
        gaps: ["AI analysis failed - using fallback keyword matching"],
        overallAssessment: "Fallback analysis due to AI parsing error",
        totalMatches: keywordMatches.length,
        avgConfidence: 50,
      };
    }
  }
}

// Streaming version for real-time analysis
export async function streamComplianceAnalysis(
  prompt: string,
  provider: AIProvider = AI_PROVIDERS.OPENAI,
  model: AIModel = AI_MODELS.GPT_5_4
) {
  const modelInstance = getModel(provider, model);

  return streamText({
    model: modelInstance,
    prompt,
    ...getOpenAIProviderOptions(provider, {
      reasoningEffort: "low",
      textVerbosity: "medium",
    }),
    ...getTemperatureSettings(provider, model, 0.1),
    maxOutputTokens: 2000,
  });
}
