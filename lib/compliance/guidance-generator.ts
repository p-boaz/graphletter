import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createHash } from "crypto";
import { checkCircuitBreaker } from "@/lib/ai/circuit-breaker";
import { getModel } from "@/lib/ai-client";
import { COMPLIANCE_AI_CONFIG } from "@/lib/ai-config";
import { createLogger } from "@/lib/logger";

const log = createLogger("compliance/guidance-generator");

export interface GuidanceRequest {
	erlId: string;
	artifact: string;
	artifactDescription: string;
	controlIds: string[];
	controlTitles?: string[];
}

export interface GuidanceResult {
	guidance: string;
	exampleSections: string[];
	estimatedEffort: "low" | "medium" | "high";
	cached: boolean;
	templateFallback: boolean;
}

interface CacheRow {
	guidance_text: string;
	example_sections: unknown;
	estimated_effort: string;
}

function hashControlIds(controlIds: string[]): string {
	const sorted = [...controlIds].sort();
	return createHash("sha256").update(sorted.join(",")).digest("hex");
}

function estimateEffort(controlCount: number): "low" | "medium" | "high" {
	if (controlCount <= 2) return "low";
	if (controlCount <= 6) return "medium";
	return "high";
}

/**
 * Template-based fallback guidance when AI is unavailable.
 */
function generateTemplateFallback(req: GuidanceRequest): GuidanceResult {
	const controlList = req.controlIds
		.slice(0, 10)
		.map((id) => `- ${id}`)
		.join("\n");
	const moreNote =
		req.controlIds.length > 10
			? `\n- ... and ${req.controlIds.length - 10} more controls`
			: "";

	const guidance = [
		`## ${req.artifact}`,
		"",
		req.artifactDescription || "Prepare the required documentation artifact.",
		"",
		"### Controls Addressed",
		controlList + moreNote,
		"",
		"### Recommended Sections",
		"1. **Purpose & Scope** — Define what this document covers and its applicability",
		"2. **Roles & Responsibilities** — Identify accountable parties",
		"3. **Implementation Details** — Document current controls and procedures",
		"4. **Evidence of Execution** — Include logs, screenshots, or records showing the control in operation",
		"5. **Review Cadence** — Specify how often this artifact is reviewed and updated",
	].join("\n");

	return {
		guidance,
		exampleSections: [
			"Purpose & Scope",
			"Roles & Responsibilities",
			"Implementation Details",
			"Evidence of Execution",
			"Review Cadence",
		],
		estimatedEffort: estimateEffort(req.controlIds.length),
		cached: false,
		templateFallback: true,
	};
}

/**
 * Generate (or retrieve cached) remediation guidance for an ERL artifact.
 * Falls back to template guidance if AI is unavailable.
 */
export async function generateGuidance(
	supabase: SupabaseClient,
	req: GuidanceRequest,
): Promise<GuidanceResult> {
	const controlHash = hashControlIds(req.controlIds);

	// Check cache
	const { data: cached } = await supabase
		.from("erl_guidance_cache")
		.select("guidance_text, example_sections, estimated_effort")
		.eq("erl_id", req.erlId)
		.eq("control_ids_hash", controlHash)
		.gt("expires_at", new Date().toISOString())
		.maybeSingle();

	if (cached) {
		const row = cached as CacheRow;
		return {
			guidance: row.guidance_text,
			exampleSections: Array.isArray(row.example_sections)
				? (row.example_sections as string[])
				: [],
			estimatedEffort:
				(row.estimated_effort as "low" | "medium" | "high") || "medium",
			cached: true,
			templateFallback: false,
		};
	}

	// Check circuit breaker before calling AI
	const cbResult = await checkCircuitBreaker(
		COMPLIANCE_AI_CONFIG.recommendations.provider,
	);
	if (!cbResult.allowed) {
		log.warn("Circuit breaker tripped, using template fallback", {
			provider: COMPLIANCE_AI_CONFIG.recommendations.provider,
		});
		return generateTemplateFallback(req);
	}

	// Generate with AI
	try {
		const controlContext = req.controlIds
			.map((id, i) => {
				const title = req.controlTitles?.[i];
				return title ? `- ${id}: ${title}` : `- ${id}`;
			})
			.join("\n");

		const prompt = [
			`You are a compliance advisor. Generate specific, actionable guidance for preparing the following documentation artifact.`,
			``,
			`**Artifact:** ${req.artifact}`,
			`**Description:** ${req.artifactDescription || "N/A"}`,
			``,
			`**SCF Controls this artifact must address:**`,
			controlContext,
			``,
			`Provide:`,
			`1. A clear explanation of what this document should contain`,
			`2. Specific sections to include (as a JSON array of section names)`,
			`3. Practical tips for gathering the evidence`,
			``,
			`Format your response as JSON:`,
			`{`,
			`  "guidance": "markdown formatted guidance text",`,
			`  "sections": ["Section 1", "Section 2", ...],`,
			`  "effort": "low" | "medium" | "high"`,
			`}`,
		].join("\n");

		const model = getModel(
			COMPLIANCE_AI_CONFIG.recommendations.provider,
			COMPLIANCE_AI_CONFIG.recommendations.model,
		);

		const response = await generateText({
			model,
			prompt,
			maxOutputTokens: COMPLIANCE_AI_CONFIG.recommendations.maxTokens,
			temperature: COMPLIANCE_AI_CONFIG.recommendations.temperature,
		});

		const text = response.text;

		// Parse JSON from response (handle markdown code blocks)
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			log.warn("Malformed AI response, using template fallback");
			return generateTemplateFallback(req);
		}

		const parsed = JSON.parse(jsonMatch[0]) as {
			guidance?: string;
			sections?: string[];
			effort?: string;
		};

		const result: GuidanceResult = {
			guidance: parsed.guidance || generateTemplateFallback(req).guidance,
			exampleSections: Array.isArray(parsed.sections) ? parsed.sections : [],
			estimatedEffort:
				parsed.effort === "low" ||
				parsed.effort === "medium" ||
				parsed.effort === "high"
					? parsed.effort
					: estimateEffort(req.controlIds.length),
			cached: false,
			templateFallback: false,
		};

		// Cache the result (fire-and-forget)
		supabase
			.from("erl_guidance_cache")
			.upsert(
				{
					erl_id: req.erlId,
					control_ids_hash: controlHash,
					guidance_text: result.guidance,
					example_sections: result.exampleSections,
					estimated_effort: result.estimatedEffort,
					model_provider: COMPLIANCE_AI_CONFIG.recommendations.provider,
					model_name: COMPLIANCE_AI_CONFIG.recommendations.model,
					expires_at: new Date(
						Date.now() + 30 * 24 * 60 * 60 * 1000,
					).toISOString(),
				},
				{ onConflict: "erl_id,control_ids_hash" },
			)
			.then(
				() => log.debug("Guidance cached", { erlId: req.erlId }),
				(err: Error) =>
					log.warn("Failed to cache guidance", { error: err.message }),
			);

		return result;
	} catch (error) {
		log.error("AI guidance generation failed, using template fallback", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return generateTemplateFallback(req);
	}
}
