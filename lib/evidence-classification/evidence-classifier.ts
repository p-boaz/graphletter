/**
 * Evidence Classification Engine
 *
 * A systematic, reusable framework for classifying evidence artifacts
 * based on their schema/content and mapping them to appropriate ERLs.
 *
 * This replaces hardcoded artifact mappings with intelligent analysis.
 */

export interface EvidenceClassification {
	artifact_type: string;
	data_source: string;
	evidence_category:
		| "configuration"
		| "policy"
		| "implementation"
		| "monitoring"
		| "assessment";
	scope: "per_resource" | "account_wide" | "organization_wide";
	temporal_nature: "point_in_time" | "continuous" | "historical";
	limitations: string[];
	capabilities: string[];
}

export interface ERLMappingResult {
	primary_erl: {
		erl_id: string;
		artifact_name: string;
		reason: string;
		confidence: number;
	};
	complementary_erls: Array<{
		erl_id: string;
		artifact_name: string;
		reason: string;
		gap_type: "missing_evidence" | "insufficient_scope" | "temporal_limitation";
	}>;
	control_assessment: Array<{
		control_id: string;
		status: "complete" | "partial" | "insufficient" | "not_evidenced";
		basis: string;
		coverage_ratio?: number;
	}>;
	gaps_identified: Array<{
		gap_type: string;
		description: string;
		suggested_artifacts: string[];
		priority: "high" | "medium" | "low";
	}>;
}

/**
 * Classification Rules Engine
 *
 * Uses schema-based analysis to determine what type of evidence we have
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Static-only class provides namespace organization
export class EvidenceClassifier {
	/**
	 * Classify AWS evidence based on schema and content analysis
	 */
	static classifyAWSEvidence(
		evidenceData: unknown,
		checkType: string,
	): EvidenceClassification {
		// S3 Encryption Configuration
		if (
			checkType === "s3_encryption" &&
			evidenceData &&
			typeof evidenceData === "object" &&
			"encryption_details" in evidenceData
		) {
			return {
				artifact_type: "Cloud storage default encryption configuration",
				data_source: "aws-s3-encryption-config",
				evidence_category: "configuration",
				scope: "per_resource",
				temporal_nature: "point_in_time",
				limitations: [
					"Configuration state only, not enforcement policy",
					"No key management governance evidence",
					"No baseline/guardrail evidence",
				],
				capabilities: [
					"Proves encryption at rest per bucket",
					"Shows encryption algorithm (KMS, AES256)",
					"Provides coverage ratio across resources",
				],
			};
		}

		// S3 Public Access Block Configuration
		if (
			checkType === "s3_public_access" &&
			evidenceData &&
			typeof evidenceData === "object" &&
			"public_access_details" in evidenceData
		) {
			return {
				artifact_type: "Cloud storage access control configuration",
				data_source: "aws-s3-public-access-config",
				evidence_category: "configuration",
				scope: "per_resource",
				temporal_nature: "point_in_time",
				limitations: [
					"Access block settings only, not comprehensive access policies",
					"No monitoring or alerting evidence",
					"Point-in-time config, not continuous enforcement",
				],
				capabilities: [
					"Proves public access prevention per bucket",
					"Shows specific block settings (ACLs, policies)",
					"Provides coverage ratio across resources",
				],
			};
		}

		// S3 Versioning Configuration
		if (
			checkType === "s3_versioning" &&
			evidenceData &&
			typeof evidenceData === "object" &&
			"versioning_details" in evidenceData
		) {
			return {
				artifact_type: "Cloud storage data protection configuration",
				data_source: "aws-s3-versioning-config",
				evidence_category: "configuration",
				scope: "per_resource",
				temporal_nature: "point_in_time",
				limitations: [
					"Versioning config only, not backup procedures",
					"No retention policy evidence",
					"No recovery testing evidence",
				],
				capabilities: [
					"Proves version management per bucket",
					"Shows data protection capability",
					"Supports data recovery controls",
				],
			};
		}

		// IAM MFA Configuration
		if (
			checkType === "mfa_enforcement" &&
			evidenceData &&
			typeof evidenceData === "object" &&
			"mfa_devices" in evidenceData
		) {
			return {
				artifact_type: "Multi-factor authentication configuration",
				data_source: "aws-iam-mfa-config",
				evidence_category: "configuration",
				scope: "account_wide",
				temporal_nature: "point_in_time",
				limitations: [
					"MFA device registration only, not enforcement policy",
					"No conditional access policy evidence",
					"Point-in-time state, not continuous monitoring",
				],
				capabilities: [
					"Proves MFA capability per user",
					"Shows MFA coverage ratio",
					"Supports authentication controls",
				],
			};
		}

		// IAM Password Policy
		if (
			checkType === "password_policy" &&
			evidenceData &&
			typeof evidenceData === "object" &&
			"password_policy" in evidenceData
		) {
			return {
				artifact_type: "Password policy configuration",
				data_source: "aws-iam-password-policy",
				evidence_category: "policy",
				scope: "account_wide",
				temporal_nature: "point_in_time",
				limitations: [
					"Policy definition only, not enforcement monitoring",
					"No user training or awareness evidence",
					"Limited to AWS IAM users only",
				],
				capabilities: [
					"Proves password complexity requirements",
					"Shows policy enforcement mechanism",
					"Supports authentication controls",
				],
			};
		}

		// Fallback for unknown types
		return {
			artifact_type: "Unknown evidence type",
			data_source: checkType,
			evidence_category: "configuration",
			scope: "account_wide",
			temporal_nature: "point_in_time",
			limitations: ["Unknown evidence type - manual classification needed"],
			capabilities: [],
		};
	}

	/**
	 * Extend this for other cloud providers
	 */
	static classifyAzureEvidence(
		_evidenceData: unknown,
		_checkType: string,
	): EvidenceClassification {
		void _evidenceData;
		void _checkType;
		// TODO(#34): Implement Azure classification rules.
		throw new Error("Azure classification not yet implemented");
	}

	static classifyGCPEvidence(
		_evidenceData: unknown,
		_checkType: string,
	): EvidenceClassification {
		void _evidenceData;
		void _checkType;
		// TODO(#34): Implement GCP classification rules.
		throw new Error("GCP classification not yet implemented");
	}
}
