export interface Standard {
  id: string;
  name: string;
  version: string;
  description: string;
  controls: Control[];
}

export interface Control {
  id: string;
  standardId: string;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: "compliant" | "partial" | "non-compliant" | "not-assessed";
  evidence?: string;
  lastAssessed?: Date;
}

export interface ControlMapping {
  id: string;
  sourceControlId: string;
  targetControlId: string;
  mappingType: "direct" | "partial" | "related" | "no-mapping";
  confidence: number;
  aiAnalysis: string;
  gaps?: string[];
}

export interface ComplianceStatus {
  standardId: string;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  nonCompliantControls: number;
  notAssessedControls: number;
  overallScore: number;
}

// New interfaces for enhanced database structure
export interface FrameworkCrosswalk {
  id: string;
  source_framework: string;
  source_control_id: string;
  target_framework: string;
  target_control_id: string;
  mapping_type: "equivalent" | "subset" | "superset" | "related";
  confidence_score: number;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceBenchmark {
  id: string;
  industry_sector: string;
  organization_size: "small" | "medium" | "large" | "enterprise";
  framework_name: string;
  average_score: number;
  percentile_25: number;
  percentile_50: number;
  percentile_75: number;
  percentile_90: number;
  sample_size: number;
  benchmark_date: string;
  created_at: string;
  updated_at: string;
}

export interface ControlHierarchy {
  id: string;
  parent_control_id: string;
  child_control_id: string;
  relationship_type: "family" | "prerequisite" | "enhancement" | "related";
  framework_context?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  table_name: string;
  record_id: string;
  action_type: "insert" | "update" | "delete" | "approve" | "reject" | "import";
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  change_reason?: string;
  compliance_impact?: "low" | "medium" | "high" | "critical";
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Removed interfaces for dropped tables:
// - MLModelVersion (ml_model_versions table removed)
// - ControlSimilarity (control_similarity_matrix table removed)
// - UserFeedback (user_feedback_loops table removed)

// Enhanced search interface
export interface ControlSearchParams {
  query: string;
  frameworks?: string[];
  domains?: string[];
  confidence_threshold?: number;
  limit?: number;
}

// SCF-specific control interface
export interface SCFControl {
  id: string;
  title: string;
  description: string;
  domain_id: string;
  principle?: string;
  control_questions?: string[];
  guidance_micro?: string;
  guidance_small?: string;
  guidance_medium?: string;
  guidance_large?: string;
  guidance_enterprise?: string;
  applies_to_people?: boolean;
  applies_to_process?: boolean;
  applies_to_technology?: boolean;
  applies_to_governance?: boolean;
  risk_ids?: string[];
  threat_ids?: string[];
  assessment_objectives?: string[];
  evidence_requests?: string[]; // @deprecated - use scf_control_evidence_mappings table instead
  scf_version: string;
  created_at: string;
  updated_at: string;
  scf_domains?: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface ControlSearchResult {
  control: SCFControl;
  similarity_score: number;
  matching_fields: string[];
  related_controls?: string[];
}

// New interfaces for the junction table relationships
export interface SCFControlEvidenceMapping {
  id: string;
  scf_control_id: string;
  evidence_request_id: string;
  relationship_type: "required" | "optional" | "supplementary";
  priority: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SCFEvidenceRequest {
  id: string;
  erl_id: string;
  area_of_focus: string;
  documentation_artifact: string;
  artifact_description: string;
  scf_control_mappings?: string[]; // @deprecated - use scf_control_evidence_mappings table instead
  scf_version: string;
  import_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ControlEvidenceRelationship {
  control: SCFControl;
  evidence_request: SCFEvidenceRequest;
  mapping: SCFControlEvidenceMapping;
}
