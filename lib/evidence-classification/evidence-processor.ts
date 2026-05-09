/**
 * Evidence Processor
 *
 * Main orchestrator that replaces the current processEvidenceViaERL function
 * with intelligent evidence analysis and mapping.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import { type ERLArtifact, ERLMappingEngine } from "./erl-mapping-engine";
import type { ERLMappingResult, EvidenceClassification } from "./evidence-classifier";
import { EvidenceClassifier } from "./evidence-classifier";

const log = createLogger("lib/evidence-classification/evidence-processor");

export interface ProcessedEvidenceResult {
  artifact_classification: {
    assigned_erl_id: string;
    erl_name: string;
    reason: string;
    confidence: number;
  };
  evidence_observation: unknown;
  control_assessment_from_this_artifact: Array<{
    control: string;
    status: string;
    basis: string;
    coverage_ratio?: number;
  }>;
  suggested_additional_artifacts: Array<{
    erl_id: string;
    name: string;
    reason: string;
  }>;
  gaps_identified: Array<{
    gap_type: string;
    description: string;
    suggested_artifacts: string[];
    priority: string;
  }>;
}

type ControlAssessment = ERLMappingResult["control_assessment"][number];
type EvidenceRecordRef = { id?: string };

interface ERLArtifactRow {
  erl_id: string;
  documentation_artifact: string;
  artifact_description?: string | null;
  area_of_focus?: string | null;
  scf_control_evidence_mappings?: Array<{ scf_control_id: string }>;
}

/**
 * Main Evidence Processing Pipeline
 *
 * This replaces the hardcoded processEvidenceViaERL approach with
 * systematic evidence analysis.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Static-only class provides namespace organization
export class EvidenceProcessor {
  /**
   * Process any evidence through intelligent classification and mapping
   */
  static async processEvidence(
    userId: string,
    connectionId: string,
    evidenceData: unknown,
    dataSource: string,
    checkType: string,
    processedContent: string,
    supabase: SupabaseClient,
    evidenceRecords: EvidenceRecordRef[],
    assessments: unknown[],
    sessionId?: string
  ): Promise<ProcessedEvidenceResult> {
    try {
      log.info("Processing evidence via intelligent classification", { dataSource });

      // Step 1: Classify the evidence based on schema/content
      const classification = EvidenceProcessor.classifyEvidence(
        evidenceData,
        dataSource,
        checkType
      );
      log.info("Classification identified", { artifactType: classification.artifact_type });

      // Step 2: Get available ERL artifacts from database
      const availableERLs = await EvidenceProcessor.getAvailableERLs(supabase);

      // Step 3: Find best-fit ERL mapping
      const mapping = await ERLMappingEngine.findBestFitERL(
        classification,
        evidenceData,
        availableERLs
      );
      log.info("Primary ERL mapping found", {
        erlId: mapping.primary_erl.erl_id,
        confidence: mapping.primary_erl.confidence * 100,
      });

      // Step 4: Store evidence using the intelligently selected ERL
      await EvidenceProcessor.storeEvidenceRecord(
        userId,
        connectionId,
        mapping.primary_erl.erl_id,
        dataSource,
        evidenceData,
        processedContent,
        checkType,
        supabase,
        evidenceRecords,
        sessionId
      );

      // Step 5: Create assessments based on control analysis
      await EvidenceProcessor.createIntelligentAssessments(
        userId,
        connectionId,
        mapping,
        evidenceData,
        checkType,
        supabase,
        assessments,
        evidenceRecords,
        sessionId
      );

      // Step 6: Return machine-readable analysis
      return EvidenceProcessor.generateMachineReadableOutput(mapping, evidenceData);
    } catch (error) {
      console.error(`❌ [EVIDENCE-PROCESSOR] Failed to process ${dataSource} evidence:`, error);
      throw error;
    }
  }

  /**
   * Classify evidence based on data source and content
   */
  private static classifyEvidence(
    evidenceData: unknown,
    dataSource: string,
    checkType: string
  ): EvidenceClassification {
    // Route to appropriate classifier based on data source
    if (dataSource.startsWith("aws-")) {
      return EvidenceClassifier.classifyAWSEvidence(evidenceData, checkType);
    } else if (dataSource.startsWith("azure-")) {
      return EvidenceClassifier.classifyAzureEvidence(evidenceData, checkType);
    } else if (dataSource.startsWith("gcp-")) {
      return EvidenceClassifier.classifyGCPEvidence(evidenceData, checkType);
    } else {
      // Generic classification for unknown sources
      return {
        artifact_type: "Unknown evidence type",
        data_source: dataSource,
        evidence_category: "configuration",
        scope: "account_wide",
        temporal_nature: "point_in_time",
        limitations: ["Unknown data source - manual classification needed"],
        capabilities: [],
      };
    }
  }

  /**
   * Get available ERL artifacts from database with control mappings from junction table
   */
  private static async getAvailableERLs(supabase: SupabaseClient): Promise<ERLArtifact[]> {
    const { data: erlArtifacts, error } = await supabase
      .from("scf_evidence_request_list")
      .select(
        `
        erl_id, 
        documentation_artifact, 
        artifact_description, 
        area_of_focus,
        scf_control_evidence_mappings!inner(
          scf_control_id
        )
      `
      )
      .order("erl_id");

    if (error) {
      throw new Error(`Failed to fetch ERL artifacts: ${error.message}`);
    }

    // Transform the data to match the expected ERLArtifact interface
    return ((erlArtifacts || []) as ERLArtifactRow[]).map((artifact) => ({
      erl_id: artifact.erl_id,
      documentation_artifact: artifact.documentation_artifact,
      artifact_description: artifact.artifact_description || "",
      area_of_focus: artifact.area_of_focus || "",
      scf_control_mappings:
        artifact.scf_control_evidence_mappings?.map((m) => m.scf_control_id) || [],
    }));
  }

  /**
   * Store evidence record using intelligent ERL selection
   */
  private static async storeEvidenceRecord(
    userId: string,
    connectionId: string,
    erlId: string,
    dataSource: string,
    evidenceData: unknown,
    processedContent: string,
    checkType: string,
    supabase: SupabaseClient,
    evidenceRecords: EvidenceRecordRef[],
    sessionId?: string
  ): Promise<void> {
    // Get the ERL artifact details
    const { data: erlArtifact, error: erlError } = await supabase
      .from("scf_evidence_request_list")
      .select("id, erl_id, documentation_artifact, artifact_description")
      .eq("erl_id", erlId)
      .single();

    if (erlError || !erlArtifact) {
      throw new Error(`ERL artifact ${erlId} not found: ${erlError?.message}`);
    }

    // Resolve at least one mapped control for this ERL artifact
    const { data: controlMappings, error: controlMappingsError } = await supabase
      .from("scf_control_evidence_mappings")
      .select("scf_control_id")
      .eq("evidence_request_id", erlArtifact.id)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(1);

    if (controlMappingsError) {
      throw new Error(`Failed to fetch ERL control mappings: ${controlMappingsError.message}`);
    }

    const primaryControlId = controlMappings?.[0]?.scf_control_id ?? null;

    // Create evidence record with enhanced metadata
    const evidenceRecord = {
      user_id: userId,
      integration_connection_id: connectionId,
      scf_control_id: primaryControlId,
      evidence_type: "configuration",
      collection_method: "integrated",
      erl_id: erlArtifact.id,
      erl_global_id: erlArtifact.erl_id,
      data_source: dataSource,
      evidence_data: evidenceData,
      processed_content: processedContent,
      collection_timestamp: new Date().toISOString(),
      evidence_status: "completed",
      confidence_score: 0.95, // High confidence for intelligent analysis
      metadata: {
        check_type: checkType,
        classification_method: "intelligent_analysis",
        processing_session_id: sessionId,
        erl_mapping: {
          erl_id: erlId,
          artifact_name: erlArtifact.documentation_artifact,
          artifact_description: erlArtifact.artifact_description,
        },
        file_info: {
          file_name: `${dataSource}_${new Date().toISOString().split("T")[0]}.json`,
          file_path: `automated/${connectionId}/${dataSource}`,
          file_size: JSON.stringify(evidenceData).length,
        },
      },
    };

    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence")
      .insert(evidenceRecord)
      .select()
      .single();

    if (evidenceError) {
      throw new Error(`Failed to store evidence: ${evidenceError.message}`);
    }

    evidenceRecords.push(evidence);
    log.info("Evidence record created", { evidenceId: evidence.id, erlId });
  }

  /**
   * Create intelligent assessments based on control analysis
   */
  private static async createIntelligentAssessments(
    userId: string,
    connectionId: string,
    mapping: ERLMappingResult,
    evidenceData: unknown,
    checkType: string,
    supabase: SupabaseClient,
    assessments: unknown[],
    evidenceRecords: EvidenceRecordRef[],
    sessionId?: string
  ): Promise<void> {
    for (const controlAssessment of mapping.control_assessment) {
      try {
        // Get assessment objectives for this control
        const { data: objectives, error: aoError } = await supabase
          .from("scf_assessment_objectives")
          .select("id, scf_ao_id, assessment_objective")
          .eq("scf_control_id", controlAssessment.control_id)
          .limit(1);

        if (aoError || !objectives?.length) {
          console.warn(
            `⚠️ No assessment objectives found for control ${controlAssessment.control_id}`
          );
          continue;
        }

        // Get the latest evidence record ID
        const latestEvidence = evidenceRecords[evidenceRecords.length - 1];
        if (!latestEvidence?.id) {
          console.warn(`⚠️ No evidence record found for control ${controlAssessment.control_id}`);
          continue;
        }

        // Create intelligent assessment
        const assessment = {
          user_id: userId,
          evidence_id: latestEvidence.id,
          scf_control_id: controlAssessment.control_id,
          scf_ao_id: objectives[0].scf_ao_id,
          assessment_type: "automated",
          assessment_method: "automated",
          assessment_status: "completed",
          assessment_result: EvidenceProcessor.mapStatusToResult(controlAssessment.status),
          confidence_level: EvidenceProcessor.mapConfidenceToLevel(mapping.primary_erl.confidence),
          ai_reasoning: EvidenceProcessor.generateAssessmentNotes(controlAssessment, evidenceData),
          assessment_notes: EvidenceProcessor.generateAssessmentNotes(
            controlAssessment,
            evidenceData
          ),
          integration_source_id: connectionId,
          integration_source_type: "automated_collection",
          integration_timestamp: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          metadata: {
            evidence_source: "automated_collection",
            check_type: checkType,
            coverage_ratio: controlAssessment.coverage_ratio,
            assessment_basis: controlAssessment.basis,
            classification_confidence: mapping.primary_erl.confidence,
            processing_session_id: sessionId,
          },
        };

        const { data: createdAssessment, error: assessmentError } = await supabase
          .from("assessments")
          .insert(assessment)
          .select()
          .single();

        if (assessmentError) {
          console.error(
            `❌ Failed to create assessment for ${controlAssessment.control_id}:`,
            assessmentError
          );
          continue;
        }

        assessments.push(createdAssessment);
        log.info("Assessment created", {
          controlId: controlAssessment.control_id,
          status: controlAssessment.status,
        });
      } catch (error) {
        console.error(`❌ Error creating assessment for ${controlAssessment.control_id}:`, error);
      }
    }
  }

  /**
   * Generate machine-readable output in the format shown in user's example
   */
  private static generateMachineReadableOutput(
    mapping: ERLMappingResult,
    evidenceData: unknown
  ): ProcessedEvidenceResult {
    return {
      artifact_classification: {
        assigned_erl_id: mapping.primary_erl.erl_id,
        erl_name: mapping.primary_erl.artifact_name,
        reason: mapping.primary_erl.reason,
        confidence: mapping.primary_erl.confidence,
      },
      evidence_observation: evidenceData,
      control_assessment_from_this_artifact: mapping.control_assessment.map((ca) => ({
        control: ca.control_id,
        status: ca.status,
        basis: ca.basis,
        coverage_ratio: ca.coverage_ratio,
      })),
      suggested_additional_artifacts: mapping.complementary_erls.map((erl) => ({
        erl_id: erl.erl_id,
        name: erl.artifact_name,
        reason: erl.reason,
      })),
      gaps_identified: mapping.gaps_identified,
    };
  }

  /**
   * Map control assessment status to automated assessment result
   */
  private static mapStatusToResult(status: string): string {
    switch (status) {
      case "complete":
        return "pass";
      case "partial":
        return "partial";
      case "insufficient":
        return "fail";
      case "not_evidenced":
        return "fail";
      default:
        return "not_applicable";
    }
  }

  /**
   * Map a numeric confidence score to assessments.confidence_level enum.
   */
  private static mapConfidenceToLevel(confidence: number): "low" | "medium" | "high" {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  }

  /**
   * Generate detailed assessment notes
   */
  private static generateAssessmentNotes(
    controlAssessment: ControlAssessment,
    evidenceData: unknown
  ): string {
    let notes = `Assessment Basis: ${controlAssessment.basis}\n\n`;

    if (controlAssessment.coverage_ratio !== undefined) {
      notes += `Coverage Analysis: ${Math.round(controlAssessment.coverage_ratio * 100)}% of resources comply\n\n`;
    }

    notes += `Evidence Summary: ${JSON.stringify(evidenceData, null, 2)}`;

    return notes;
  }
}
