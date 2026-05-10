export interface UserAssessment {
  id: string;
  scf_control_id: string;
  scf_ao_id?: string;
  assessment_type: string;
  assessment_status: string;
  assessment_result?: string;
  confidence_level?: string;
  implementation_status: string;
  assessment_summary?: string;
  assessment_notes?: string;
  deficiencies_identified?: string[];
  recommendations?: string[];
  risk_rating?: string;
  business_impact?: string;
  remediation_timeline?: string;
  testing_procedures?: string[];
  sample_size?: number;
  population_size?: number;
  assessment_frequency: string;
  next_assessment_due?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  scf_control?: {
    id: string;
    title: string;
    description: string;
  };
  assessment_objective?: {
    scf_ao_id: string;
    assessment_objective: string;
    assessment_procedure?: string;
    expected_results?: string;
  };
  assigned_to_profile?: {
    id: string;
    email: string;
  };
  evidence?: {
    id: string;
    file_name: string;
    evidence_type: string;
    evidence_status: string;
    file_size?: number | null;
    collection_method?: string | null;
    data_source?: string | null;
    confidence_score?: number | null;
    created_at?: string;
  } | null;
}
