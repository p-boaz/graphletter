import { supabaseAdmin } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/services/compliance-calculator");

export interface ComplianceCalculation {
  frameworkName: string;
  frameworkVersion: string;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  nonCompliantControls: number;
  notAssessedControls: number;
  complianceScore: number;
}

export class ComplianceCalculator {
  static async calculateUserCompliance(userId: string): Promise<ComplianceCalculation[]> {
    try {
      // Get user's uploaded documents and extracted controls
      const { data: userDocuments, error: docsError } = await supabaseAdmin
        .from("user_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("processing_status", "completed");

      if (docsError) {
        log.error("compliance_calculator.user_documents_fetch_failed", {
          detail: docsError instanceof Error ? docsError.message : String(docsError),
        });
        return [];
      }

      if (!userDocuments || userDocuments.length === 0) {
        return [];
      }

      // Get all SCF frameworks for comparison
      const { data: frameworks, error: frameworksError } = await supabaseAdmin
        .from("scf_frameworks")
        .select("*");

      if (frameworksError) {
        log.error("compliance_calculator.frameworks_fetch_failed", {
          detail:
            frameworksError instanceof Error ? frameworksError.message : String(frameworksError),
        });
        return [];
      }

      const complianceResults: ComplianceCalculation[] = [];

      // Calculate compliance for major frameworks
      const majorFrameworks = ["ISO-27001", "NIST-CSF", "SOC-2", "PCI-DSS", "HIPAA"];

      for (const frameworkName of majorFrameworks) {
        const framework = frameworks?.find((f) =>
          f.framework_name.toLowerCase().includes(frameworkName.toLowerCase())
        );

        if (!framework) continue;

        // Get framework controls
        const { data: frameworkControls, error: controlsError } = await supabaseAdmin
          .from("scf_control_mappings")
          .select(
            `
            framework_control_id,
            scf_controls (
              id,
              title,
              description
            )
          `
          )
          .eq("framework_id", framework.id);

        if (controlsError || !frameworkControls) continue;

        // Analyze user's controls against framework
        let compliantControls = 0;
        const partialControls = 0;
        let nonCompliantControls = 0;

        const totalControls = frameworkControls.length;
        const userControlIds = new Set<string>();

        // Extract all user control IDs from documents
        userDocuments.forEach((doc) => {
          if (doc.extracted_controls && Array.isArray(doc.extracted_controls)) {
            doc.extracted_controls.forEach((control: unknown) => {
              if (
                control &&
                typeof control === "object" &&
                "id" in control &&
                typeof (control as { id: unknown }).id === "string"
              ) {
                userControlIds.add((control as { id: string }).id.toLowerCase());
              }
            });
          }
        });

        // Simple matching logic - can be enhanced with AI
        frameworkControls.forEach((frameworkControl) => {
          const hasMatch = Array.from(userControlIds).some(
            (userControlId) =>
              userControlId.includes(frameworkControl.framework_control_id.toLowerCase()) ||
              frameworkControl.framework_control_id.toLowerCase().includes(userControlId)
          );

          if (hasMatch) {
            compliantControls++;
          } else {
            nonCompliantControls++;
          }
        });

        const notAssessedControls =
          totalControls - compliantControls - partialControls - nonCompliantControls;
        const complianceScore =
          totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;

        complianceResults.push({
          frameworkName,
          frameworkVersion: framework.framework_version || "Latest",
          totalControls,
          compliantControls,
          partialControls,
          nonCompliantControls,
          notAssessedControls,
          complianceScore,
        });

        // Save to database
        await supabaseAdmin.from("user_compliance_status").upsert(
          {
            user_id: userId,
            framework_name: frameworkName,
            framework_version: framework.framework_version || "Latest",
            total_controls: totalControls,
            compliant_controls: compliantControls,
            partial_controls: partialControls,
            non_compliant_controls: nonCompliantControls,
            not_assessed_controls: notAssessedControls,
            compliance_score: complianceScore,
            last_assessment_date: new Date().toISOString(),
          },
          {
            onConflict: "user_id,framework_name,framework_version",
          }
        );
      }

      return complianceResults;
    } catch (error) {
      log.error("compliance_calculator.calculation_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  static async updateUserCompliance(userId: string) {
    log.info("Updating compliance for user", { userId });
    const results = await ComplianceCalculator.calculateUserCompliance(userId);
    log.info("Calculated compliance", { frameworkCount: results.length });
    return results;
  }
}
