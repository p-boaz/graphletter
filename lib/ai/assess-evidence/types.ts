import type { SupabaseClient } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

export interface AssessmentObjective {
	id: string;
	scf_ao_id: string;
	assessment_objective: string;
	assessment_procedure?: string;
	expected_results?: string;
}

export interface MaturityLevels {
	level_0_description?: string | null;
	level_1_description?: string | null;
	level_2_description?: string | null;
	level_3_description?: string | null;
	level_4_description?: string | null;
	level_5_description?: string | null;
}

export interface MaturityAssessmentResult {
	assessed_level: number;
	confidence: number;
	rationale: string;
	target_level: number | null;
	target_met: boolean | null;
	target_gap: number | null;
	referenced_level_description?: string | null;
	recommended_actions?: string[];
}

export interface ObjectiveAssessmentResult {
	objective_id: string;
	result: "pass" | "fail" | "partial" | "not_applicable";
	confidence: number;
	reasoning: string;
}

export type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type ServiceSupabaseClient = SupabaseClient;
export type ImagePayload = { base64: string; mimeType: string } | null;

export type AssessmentLogContext = {
	requestId: string;
	sessionId: string | null;
	evidenceId: string;
	scfControlId: string;
	evidenceContentHash: string;
};
