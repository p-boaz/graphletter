/**
 * ERL Mapping Engine
 *
 * Intelligently maps evidence classifications to the most appropriate ERL artifacts
 * based on what the evidence actually proves, not hardcoded assumptions.
 */

import type { ERLMappingResult, EvidenceClassification } from "./evidence-classifier";

export interface ERLArtifact {
  erl_id: string;
  documentation_artifact: string;
  artifact_description: string;
  scf_control_mappings: string[]; // @deprecated - use junction table queries instead
  area_of_focus: string;
}

// New interface using junction table data
export interface ERLArtifactWithMappings {
  id: string;
  erl_id: string;
  documentation_artifact: string;
  artifact_description: string;
  area_of_focus: string;
  scf_version: string;
  // Related controls via junction table
  control_mappings?: {
    scf_control_id: string;
    relationship_type: "required" | "optional" | "supplementary";
    priority: number;
  }[];
}

interface MappingEvidenceData {
  total_buckets?: number;
  buckets_with_encryption?: number;
  buckets_with_public_block?: number;
  buckets_with_versioning?: number;
  user_count?: number;
  mfa_enabled_users?: number;
  has_policy?: boolean;
  password_policy?: Record<string, unknown>;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Static-only class provides namespace organization
export class ERLMappingEngine {
  /**
   * Find the best-fit ERL mapping for classified evidence
   */
  static async findBestFitERL(
    classification: EvidenceClassification,
    evidenceData: unknown,
    availableERLs: ERLArtifact[]
  ): Promise<ERLMappingResult> {
    const mappingEvidence = (evidenceData || {}) as MappingEvidenceData;

    // Apply classification-specific mapping logic
    switch (classification.artifact_type) {
      case "Cloud storage default encryption configuration":
        return ERLMappingEngine.mapEncryptionConfigurationEvidence(
          classification,
          mappingEvidence,
          availableERLs
        );

      case "Cloud storage access control configuration":
        return ERLMappingEngine.mapAccessControlEvidence(
          classification,
          mappingEvidence,
          availableERLs
        );

      case "Cloud storage data protection configuration":
        return ERLMappingEngine.mapDataProtectionEvidence(
          classification,
          mappingEvidence,
          availableERLs
        );

      case "Multi-factor authentication configuration":
        return ERLMappingEngine.mapMFAEvidence(classification, mappingEvidence, availableERLs);

      case "Password policy configuration":
        return ERLMappingEngine.mapPasswordPolicyEvidence(
          classification,
          mappingEvidence,
          availableERLs
        );

      default:
        return ERLMappingEngine.mapGenericEvidence(classification, evidenceData, availableERLs);
    }
  }

  /**
   * Map S3 encryption configuration to E-CRY-01 (Cryptographic Protections)
   */
  private static mapEncryptionConfigurationEvidence(
    _classification: EvidenceClassification,
    evidenceData: MappingEvidenceData,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    const primaryERL = availableERLs.find((erl) => erl.erl_id === "E-CRY-01");
    if (!primaryERL) throw new Error("E-CRY-01 (Cryptographic Protections) not found in ERL list");

    // Calculate coverage ratio
    const totalResources = evidenceData.total_buckets || 0;
    const protectedResources = evidenceData.buckets_with_encryption || 0;
    const coverageRatio = totalResources > 0 ? protectedResources / totalResources : 0;

    // Assess control satisfaction based on coverage
    const controlAssessment = primaryERL.scf_control_mappings.map((controlId) => {
      if (controlId === "CRY-05") {
        // Encryption at rest
        return {
          control_id: controlId,
          status:
            coverageRatio === 1.0
              ? ("complete" as const)
              : coverageRatio > 0
                ? ("partial" as const)
                : ("insufficient" as const),
          basis: `${protectedResources}/${totalResources} resources encrypted (${Math.round(coverageRatio * 100)}% coverage)`,
          coverage_ratio: coverageRatio,
        };
      } else if (controlId.startsWith("CRY-09")) {
        // Key management
        return {
          control_id: controlId,
          status: "insufficient" as const,
          basis: "Key management policies and procedures not evidenced by configuration data",
        };
      } else {
        return {
          control_id: controlId,
          status: "partial" as const,
          basis: "Configuration evidence provides supporting but not complete evidence",
        };
      }
    });

    // Identify complementary ERLs needed
    const keyMgmtERL = availableERLs.find((erl) => erl.erl_id === "E-CRY-02");
    const baselineERL = availableERLs.find((erl) => erl.erl_id === "E-AST-13");
    const inventoryERL = availableERLs.find((erl) => erl.erl_id === "E-AST-06");

    const complementaryERLs = [];
    if (keyMgmtERL) {
      complementaryERLs.push({
        erl_id: "E-CRY-02",
        artifact_name: keyMgmtERL.documentation_artifact,
        reason: "Key management policies, rotation, and governance not evidenced",
        gap_type: "missing_evidence" as const,
      });
    }
    if (baselineERL) {
      complementaryERLs.push({
        erl_id: "E-AST-13",
        artifact_name: baselineERL.documentation_artifact,
        reason: "Baseline configurations and guardrails not evidenced",
        gap_type: "missing_evidence" as const,
      });
    }
    if (inventoryERL) {
      complementaryERLs.push({
        erl_id: "E-AST-06",
        artifact_name: inventoryERL.documentation_artifact,
        reason: "Complete asset inventory for scope verification",
        gap_type: "insufficient_scope" as const,
      });
    }

    // Identify gaps
    const gaps = [];
    if (coverageRatio < 1.0) {
      gaps.push({
        gap_type: "incomplete_coverage",
        description: `${totalResources - protectedResources} resources lack encryption`,
        suggested_artifacts: [
          "AWS Config Rules for encryption enforcement",
          "Infrastructure as Code templates",
        ],
        priority: "high" as const,
      });
    }

    gaps.push({
      gap_type: "key_management",
      description: "Key management governance and procedures not evidenced",
      suggested_artifacts: ["KMS key policies", "Key rotation procedures", "Key access logs"],
      priority: "medium" as const,
    });

    return {
      primary_erl: {
        erl_id: "E-CRY-01",
        artifact_name: primaryERL.documentation_artifact,
        reason: "Direct evidence of encryption at rest implementation",
        confidence: 0.95,
      },
      complementary_erls: complementaryERLs,
      control_assessment: controlAssessment,
      gaps_identified: gaps,
    };
  }

  /**
   * Map S3 public access block to E-IAM-01 (Access Permission Review)
   */
  private static mapAccessControlEvidence(
    _classification: EvidenceClassification,
    evidenceData: MappingEvidenceData,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    const primaryERL = availableERLs.find((erl) => erl.erl_id === "E-IAM-01");
    if (!primaryERL) throw new Error("E-IAM-01 (Access Permission Review) not found in ERL list");

    const totalResources = evidenceData.total_buckets || 0;
    const protectedResources = evidenceData.buckets_with_public_block || 0;
    const coverageRatio = totalResources > 0 ? protectedResources / totalResources : 0;

    const controlAssessment = primaryERL.scf_control_mappings.map((controlId) => ({
      control_id: controlId,
      status:
        coverageRatio === 1.0
          ? ("complete" as const)
          : coverageRatio > 0
            ? ("partial" as const)
            : ("insufficient" as const),
      basis: `${protectedResources}/${totalResources} resources with public access blocks (${Math.round(coverageRatio * 100)}% coverage)`,
      coverage_ratio: coverageRatio,
    }));

    return {
      primary_erl: {
        erl_id: "E-IAM-01",
        artifact_name: primaryERL.documentation_artifact,
        reason: "Evidence of access control mechanisms for cloud storage",
        confidence: 0.85,
      },
      complementary_erls: [],
      control_assessment: controlAssessment,
      gaps_identified:
        coverageRatio < 1.0
          ? [
              {
                gap_type: "incomplete_coverage",
                description: `${totalResources - protectedResources} resources lack public access blocks`,
                suggested_artifacts: ["Bucket policies", "IAM policies", "Access monitoring logs"],
                priority: "high" as const,
              },
            ]
          : [],
    };
  }

  /**
   * Map S3 versioning to backup/data protection ERLs
   */
  private static mapDataProtectionEvidence(
    _classification: EvidenceClassification,
    evidenceData: MappingEvidenceData,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    // Look for backup-related ERL (search for "Backup" in artifact names)
    const backupERL = availableERLs.find(
      (erl) =>
        erl.documentation_artifact.toLowerCase().includes("backup") ||
        erl.erl_id.startsWith("E-BCM-")
    );

    const primaryERL = backupERL || availableERLs.find((erl) => erl.erl_id === "E-AST-11");
    if (!primaryERL) throw new Error("No suitable data protection ERL found");

    const totalResources = evidenceData.total_buckets || 0;
    const protectedResources = evidenceData.buckets_with_versioning || 0;
    const coverageRatio = totalResources > 0 ? protectedResources / totalResources : 0;

    return {
      primary_erl: {
        erl_id: primaryERL.erl_id,
        artifact_name: primaryERL.documentation_artifact,
        reason: "Evidence of data versioning for protection and recovery",
        confidence: 0.8,
      },
      complementary_erls: [],
      control_assessment: [
        {
          control_id: "BCD-11",
          status: coverageRatio === 1.0 ? ("complete" as const) : ("partial" as const),
          basis: `Versioning enabled on ${protectedResources}/${totalResources} buckets`,
          coverage_ratio: coverageRatio,
        },
      ],
      gaps_identified: [],
    };
  }

  /**
   * Map IAM MFA to E-IAM-05 (IAM Function)
   */
  private static mapMFAEvidence(
    _classification: EvidenceClassification,
    evidenceData: MappingEvidenceData,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    const primaryERL = availableERLs.find((erl) => erl.erl_id === "E-IAM-05");
    if (!primaryERL) throw new Error("E-IAM-05 (IAM Function) not found in ERL list");

    const totalUsers = evidenceData.user_count || 0;
    const mfaUsers = evidenceData.mfa_enabled_users || 0;
    const coverageRatio = totalUsers > 0 ? mfaUsers / totalUsers : 0;

    const controlAssessment = primaryERL.scf_control_mappings.map((controlId) => ({
      control_id: controlId,
      status:
        coverageRatio === 1.0
          ? ("complete" as const)
          : coverageRatio > 0
            ? ("partial" as const)
            : ("insufficient" as const),
      basis: `MFA enabled for ${mfaUsers}/${totalUsers} users (${Math.round(coverageRatio * 100)}% coverage)`,
      coverage_ratio: coverageRatio,
    }));

    return {
      primary_erl: {
        erl_id: "E-IAM-05",
        artifact_name: primaryERL.documentation_artifact,
        reason: "Evidence of multi-factor authentication implementation",
        confidence: 0.9,
      },
      complementary_erls: [],
      control_assessment: controlAssessment,
      gaps_identified:
        coverageRatio < 1.0
          ? [
              {
                gap_type: "incomplete_coverage",
                description: `${totalUsers - mfaUsers} users lack MFA configuration`,
                suggested_artifacts: ["MFA enforcement policies", "User training records"],
                priority: "high" as const,
              },
            ]
          : [],
    };
  }

  /**
   * Map password policy to E-IAM-06 (AAA Solution)
   */
  private static mapPasswordPolicyEvidence(
    _classification: EvidenceClassification,
    evidenceData: MappingEvidenceData,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    const primaryERL = availableERLs.find((erl) => erl.erl_id === "E-IAM-06");
    if (!primaryERL) throw new Error("E-IAM-06 (AAA Solution) not found in ERL list");

    const hasPolicy = evidenceData.has_policy || false;
    const policy = evidenceData.password_policy || {};

    // Assess policy strength
    const policyStrength = ERLMappingEngine.assessPasswordPolicyStrength(policy);

    const controlAssessment = primaryERL.scf_control_mappings.map((controlId) => ({
      control_id: controlId,
      status:
        hasPolicy && policyStrength.score > 0.7
          ? ("complete" as const)
          : hasPolicy
            ? ("partial" as const)
            : ("insufficient" as const),
      basis: hasPolicy
        ? `Password policy configured with ${policyStrength.score * 100}% compliance`
        : "No password policy configured",
    }));

    return {
      primary_erl: {
        erl_id: "E-IAM-06",
        artifact_name: primaryERL.documentation_artifact,
        reason: "Evidence of authentication policy configuration",
        confidence: 0.85,
      },
      complementary_erls: [],
      control_assessment: controlAssessment,
      gaps_identified: policyStrength.gaps.map((gap) => ({
        gap_type: "policy_weakness",
        description: gap,
        suggested_artifacts: ["Enhanced password policy", "User training materials"],
        priority: "medium" as const,
      })),
    };
  }

  /**
   * Generic evidence mapping for unknown types
   */
  private static mapGenericEvidence(
    _classification: EvidenceClassification,
    _evidenceData: unknown,
    availableERLs: ERLArtifact[]
  ): ERLMappingResult {
    // Try to find a reasonable ERL based on data source
    const genericERL = availableERLs[0]; // Fallback to first available

    return {
      primary_erl: {
        erl_id: genericERL.erl_id,
        artifact_name: genericERL.documentation_artifact,
        reason: "Generic mapping - manual review required",
        confidence: 0.2,
      },
      complementary_erls: [],
      control_assessment: [],
      gaps_identified: [
        {
          gap_type: "unknown_evidence_type",
          description: "Evidence type not recognized - manual classification needed",
          suggested_artifacts: [],
          priority: "high" as const,
        },
      ],
    };
  }

  /**
   * Assess password policy strength
   */
  private static assessPasswordPolicyStrength(policy: Record<string, unknown>): {
    score: number;
    gaps: string[];
  } {
    let score = 0;
    const gaps = [];
    const checks = [
      { field: "MinimumPasswordLength", threshold: 8, weight: 0.2 },
      { field: "RequireSymbols", threshold: true, weight: 0.2 },
      { field: "RequireNumbers", threshold: true, weight: 0.2 },
      { field: "RequireUppercaseCharacters", threshold: true, weight: 0.2 },
      { field: "RequireLowercaseCharacters", threshold: true, weight: 0.2 },
    ];

    for (const check of checks) {
      const policyValue = policy[check.field];
      if (typeof check.threshold === "number") {
        if (typeof policyValue === "number" && policyValue >= check.threshold) {
          score += check.weight;
        } else {
          gaps.push(`${check.field} should be >= ${check.threshold}`);
        }
      } else if (policyValue === check.threshold) {
        score += check.weight;
      } else {
        gaps.push(`${check.field} should be ${check.threshold}`);
      }
    }

    return { score, gaps };
  }
}
