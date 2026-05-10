-- Public baseline schema for Graphletter.
-- This baseline intentionally starts from the unified `evidence` model and
-- omits the legacy `user_evidence`, `automated_evidence`, and transitional
-- migration history that only existed to merge older internal schemas.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- SCF reference tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scf_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  scf_version text NOT NULL,
  import_status text NOT NULL DEFAULT 'processing',
  total_controls integer NOT NULL DEFAULT 0,
  total_domains integer NOT NULL DEFAULT 0,
  total_frameworks integer NOT NULL DEFAULT 0,
  total_mappings integer NOT NULL DEFAULT 0,
  errors text[],
  warnings text[],
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.scf_domains (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  principles text[] DEFAULT '{}'::text[],
  control_count integer NOT NULL DEFAULT 0,
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  principle_intent text
);

CREATE TABLE IF NOT EXISTS public.scf_controls (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  domain_id text REFERENCES public.scf_domains(id) ON DELETE SET NULL,
  principle text,
  control_questions text[],
  guidance_micro text,
  guidance_small text,
  guidance_medium text,
  guidance_large text,
  guidance_enterprise text,
  applies_to_people boolean NOT NULL DEFAULT false,
  applies_to_process boolean NOT NULL DEFAULT false,
  applies_to_technology boolean NOT NULL DEFAULT false,
  applies_to_governance boolean NOT NULL DEFAULT false,
  risk_ids text[],
  threat_ids text[],
  assessment_objectives text[],
  evidence_requests text[],
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector
);

CREATE TABLE IF NOT EXISTS public.scf_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_name text NOT NULL,
  framework_version text,
  source_url text,
  mapping_type text NOT NULL DEFAULT 'direct',
  total_mappings integer NOT NULL DEFAULT 0,
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id text REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  framework_id uuid REFERENCES public.scf_frameworks(id) ON DELETE CASCADE,
  framework_control_id text NOT NULL,
  mapping_type text NOT NULL DEFAULT 'direct',
  confidence_score numeric(3,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (control_id, framework_id, framework_control_id)
);

CREATE TABLE IF NOT EXISTS public.scf_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  domain_code text NOT NULL,
  domain_name text NOT NULL,
  principle_name text NOT NULL,
  principle_intent text NOT NULL,
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_authoritative_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography text NOT NULL,
  mapping_column_header text NOT NULL,
  source_organization text NOT NULL,
  authoritative_source text NOT NULL,
  strm_url text,
  source_url text,
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mapping_column_header, geography, import_id)
);

CREATE TABLE IF NOT EXISTS public.scf_assessment_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  scf_ao_id text NOT NULL UNIQUE,
  assessment_objective text NOT NULL,
  origin text,
  notes_errata text,
  scf_baseline_aos boolean NOT NULL DEFAULT false,
  dhs_ztcf_aos boolean NOT NULL DEFAULT false,
  nist_800_53_r5_aos boolean NOT NULL DEFAULT false,
  nist_800_171_r2_aos boolean NOT NULL DEFAULT false,
  nist_800_171_r3_aos boolean NOT NULL DEFAULT false,
  nist_800_172_aos boolean NOT NULL DEFAULT false,
  asset_type text,
  assessment_procedure text,
  expected_results text,
  assessment_status text,
  inherited boolean NOT NULL DEFAULT false,
  assessment_frequency text,
  last_date_assessed date,
  assessment_performed_by text,
  scf_version text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scf_assessment_objectives_assessment_status_check
    CHECK (
      assessment_status IS NULL
      OR assessment_status = ANY (ARRAY['met', 'not_met', 'not_tested', 'not_applicable'])
    )
);

CREATE TABLE IF NOT EXISTS public.scf_evidence_request_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erl_id text NOT NULL,
  area_of_focus text NOT NULL DEFAULT 'general',
  documentation_artifact text NOT NULL,
  artifact_description text NOT NULL,
  scf_control_mappings text[] NOT NULL DEFAULT '{}'::text[],
  scf_version text NOT NULL DEFAULT 'unknown',
  import_id uuid REFERENCES public.scf_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (erl_id, import_id)
);

CREATE TABLE IF NOT EXISTS public.scf_control_evidence_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  evidence_request_id uuid NOT NULL REFERENCES public.scf_evidence_request_list(id) ON DELETE CASCADE,
  relationship_type text,
  priority integer,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_maturity_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text NOT NULL UNIQUE REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  level_0_description text,
  level_1_description text,
  level_2_description text,
  level_3_description text,
  level_4_description text,
  level_5_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_risks (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  risk_grouping text,
  nist_csf_function text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_threats (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  threat_grouping text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_control_risk_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  risk_id text NOT NULL REFERENCES public.scf_risks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scf_control_id, risk_id)
);

CREATE TABLE IF NOT EXISTS public.scf_control_threat_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  threat_id text NOT NULL REFERENCES public.scf_threats(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scf_control_id, threat_id)
);

CREATE TABLE IF NOT EXISTS public.control_hierarchies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  child_control_id text NOT NULL REFERENCES public.scf_controls(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('family', 'prerequisite', 'enhancement', 'related')),
  framework_context text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_control_id, child_control_id, relationship_type, framework_context)
);

CREATE TABLE IF NOT EXISTS public.compliance_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_sector text NOT NULL,
  organization_size text NOT NULL CHECK (organization_size IN ('small', 'medium', 'large', 'enterprise')),
  framework_name text NOT NULL,
  average_score numeric(5,2) NOT NULL DEFAULT 0,
  percentile_25 numeric(5,2) NOT NULL DEFAULT 0,
  percentile_50 numeric(5,2) NOT NULL DEFAULT 0,
  percentile_75 numeric(5,2) NOT NULL DEFAULT 0,
  percentile_90 numeric(5,2) NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  benchmark_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed domain ids used by later domain tier weighting and by initial SCF imports.
INSERT INTO public.scf_domains (id, name, scf_version) VALUES
  ('IAC', 'Identification & Authentication', 'seed'),
  ('IRO', 'Incident Response', 'seed'),
  ('CRY', 'Cryptographic Protections', 'seed'),
  ('DCH', 'Data Classification & Handling', 'seed'),
  ('GOV', 'Cybersecurity & Data Privacy Governance', 'seed'),
  ('CPL', 'Compliance', 'seed'),
  ('PRI', 'Privacy', 'seed'),
  ('RSK', 'Risk Management', 'seed'),
  ('TDA', 'Third-Party Data Assessment', 'seed'),
  ('AST', 'Asset Management', 'seed'),
  ('BCD', 'Business Continuity & Disaster Recovery', 'seed'),
  ('CFG', 'Configuration Management', 'seed'),
  ('CLD', 'Cloud Security', 'seed'),
  ('END', 'Endpoint Security', 'seed'),
  ('HRS', 'Human Resources Security', 'seed'),
  ('MON', 'Continuous Monitoring', 'seed'),
  ('NET', 'Network Security', 'seed'),
  ('PES', 'Physical & Environmental Security', 'seed'),
  ('SEA', 'Secure Engineering & Architecture', 'seed'),
  ('THR', 'Threat & Vulnerability Management', 'seed'),
  ('WEB', 'Web Security', 'seed'),
  ('IAO', 'Information Assurance', 'seed'),
  ('VPM', 'Vulnerability & Patch Management', 'seed')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- User-owned product tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  organization text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  document_type text NOT NULL,
  standard_name text,
  extracted_text text,
  analysis_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.user_documents(id) ON DELETE SET NULL,
  title text,
  description text,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.8,
  created_at timestamptz NOT NULL DEFAULT now(),
  scf_domain text,
  analysis_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_text_original text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  scf_control_id text REFERENCES public.scf_controls(id) ON DELETE SET NULL,
  user_text_match text,
  mapping_status text NOT NULL DEFAULT 'confirmed' CHECK (mapping_status IN ('suggested', 'confirmed', 'rejected', 'modified')),
  implementation_status text NOT NULL DEFAULT 'not_implemented' CHECK (implementation_status IN ('not_implemented', 'planned', 'in_progress', 'implemented', 'needs_review')),
  implementation_notes text,
  last_reviewed_date timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_compliance_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  soc2_score integer NOT NULL DEFAULT 0,
  iso27001_score integer NOT NULL DEFAULT 0,
  nist_score integer NOT NULL DEFAULT 0,
  gdpr_score integer NOT NULL DEFAULT 0,
  hipaa_score integer NOT NULL DEFAULT 0,
  overall_score integer NOT NULL DEFAULT 0,
  total_controls integer NOT NULL DEFAULT 0,
  compliant_controls integer NOT NULL DEFAULT 0,
  partial_controls integer NOT NULL DEFAULT 0,
  non_compliant_controls integer NOT NULL DEFAULT 0,
  not_assessed_controls integer NOT NULL DEFAULT 0,
  last_calculated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  domains_covered jsonb NOT NULL DEFAULT '[]'::jsonb,
  framework_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  frameworks_covered jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_analysis_date timestamptz NOT NULL DEFAULT now(),
  total_controls_mapped integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_compliance_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_name text NOT NULL,
  framework_control_id text,
  gap_type text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text,
  description text,
  recommendation text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'accepted-risk')),
  assigned_to text,
  due_date date,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  document_id uuid REFERENCES public.user_documents(id) ON DELETE SET NULL,
  priority text,
  control_description text,
  control_title text,
  coverage_percentage numeric(5,2) CHECK (coverage_percentage IS NULL OR (coverage_percentage >= 0 AND coverage_percentage <= 100)),
  priority_level text CHECK (priority_level IS NULL OR priority_level IN ('high', 'medium', 'low')),
  recommendations jsonb,
  scf_control_id text REFERENCES public.scf_controls(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Unified evidence + assessments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scf_control_id text REFERENCES public.scf_controls(id) ON DELETE SET NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('document', 'screenshot', 'policy', 'procedure', 'log', 'certificate', 'configuration', 'other', 'aws', 'azure', 'gcp', 'github', 'okta', 'supabase')),
  collection_method text NOT NULL DEFAULT 'manual' CHECK (collection_method IN ('manual', 'automated', 'integrated')),
  erl_id text,
  erl_global_id text,
  file_name text,
  file_path text,
  file_size bigint,
  file_type text,
  version integer NOT NULL DEFAULT 1,
  description text,
  evidence_status text NOT NULL DEFAULT 'pending' CHECK (evidence_status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'outdated', 'processing', 'completed', 'failed', 'skipped')),
  integration_connection_id uuid,
  data_source text,
  evidence_data jsonb,
  processed_content text,
  confidence_score numeric CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason text,
  replaces_evidence_id uuid REFERENCES public.evidence(id) ON DELETE SET NULL,
  outdated_at timestamptz,
  outdated_by integer,
  extracted_content text,
  content_extracted_at timestamptz,
  content_extraction_status text NOT NULL DEFAULT 'pending' CHECK (content_extraction_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  storage_path text,
  evidence_group_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  collection_timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON public.evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_control_id ON public.evidence(scf_control_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON public.evidence(evidence_status);
CREATE INDEX IF NOT EXISTS idx_evidence_content_status ON public.evidence(content_extraction_status);
CREATE INDEX IF NOT EXISTS idx_evidence_extracted_content_gin ON public.evidence USING gin(to_tsvector('english', coalesce(extracted_content, '')));

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scf_control_id text REFERENCES public.scf_controls(id) ON DELETE SET NULL,
  scf_ao_id text REFERENCES public.scf_assessment_objectives(scf_ao_id) ON DELETE SET NULL,
  assessment_type text NOT NULL CHECK (assessment_type IN ('manual', 'automated', 'integrated')),
  assessment_method text NOT NULL DEFAULT 'manual' CHECK (assessment_method IN ('manual', 'automated', 'ai_assisted')),
  assessment_status text NOT NULL DEFAULT 'not_started' CHECK (assessment_status IN ('not_started', 'in_progress', 'completed', 'under_review', 'approved', 'rejected', 'requires_remediation')),
  assessment_result text CHECK (assessment_result IS NULL OR assessment_result IN ('pass', 'fail', 'partial', 'not_applicable', 'not_tested', 'met', 'not_met', 'partially_met')),
  confidence_level text CHECK (confidence_level IS NULL OR confidence_level IN ('low', 'medium', 'high')),
  risk_rating text CHECK (risk_rating IS NULL OR risk_rating IN ('low', 'medium', 'high', 'critical')),
  implementation_status text NOT NULL DEFAULT 'not_implemented' CHECK (implementation_status IN ('not_implemented', 'planned', 'in_progress', 'implemented', 'needs_review')),
  assessment_frequency text NOT NULL DEFAULT 'annual' CHECK (assessment_frequency IN ('continuous', 'monthly', 'quarterly', 'semi_annual', 'annual', 'biennial')),
  evidence_id uuid REFERENCES public.evidence(id) ON DELETE SET NULL,
  assessment_notes text,
  assessment_summary text,
  remediation_plan text,
  business_impact text,
  remediation_timeline text,
  ai_reasoning text,
  deficiencies_identified text[],
  recommendations text[],
  testing_procedures text[],
  validation_rules_applied jsonb,
  sample_size integer,
  population_size integer,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  integration_source_id uuid,
  integration_source_type text,
  integration_timestamp timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  next_assessment_due timestamptz
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_control_id ON public.assessments(scf_control_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(assessment_status);

CREATE TABLE IF NOT EXISTS public.assessment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL CHECK (new_status IN ('not_started', 'in_progress', 'completed', 'under_review', 'approved', 'rejected', 'requires_remediation')),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_assessment_status_history_assessment_id
  ON public.assessment_status_history(assessment_id);

CREATE TABLE IF NOT EXISTS public.evidence_assessment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'primary',
  relevance_score numeric NOT NULL DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'primary',
  assignment_status text NOT NULL DEFAULT 'assigned',
  due_date timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  assignment_notes text,
  estimated_hours numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment_id
  ON public.assessment_assignments(assessment_id);

CREATE OR REPLACE FUNCTION public.update_assessment_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assessment_status IS DISTINCT FROM OLD.assessment_status THEN
    INSERT INTO public.assessment_status_history (
      assessment_id,
      previous_status,
      new_status,
      changed_by,
      changed_at
    )
    VALUES (
      NEW.id,
      OLD.assessment_status,
      NEW.assessment_status,
      COALESCE(NEW.reviewed_by, NEW.approved_by, NEW.assigned_to, NEW.user_id),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_assessment_status_history ON public.assessments;
CREATE TRIGGER trigger_update_assessment_status_history
AFTER UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_assessment_status_history();

-- ---------------------------------------------------------------------------
-- Permissions and policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.scf_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_control_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_principles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_authoritative_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_assessment_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_evidence_request_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_control_evidence_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_maturity_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_control_risk_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scf_control_threat_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_hierarchies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_benchmarks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_compliance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_compliance_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_assessment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read scf imports" ON public.scf_imports;
CREATE POLICY "Public can read scf imports" ON public.scf_imports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf domains" ON public.scf_domains;
CREATE POLICY "Public can read scf domains" ON public.scf_domains FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf controls" ON public.scf_controls;
CREATE POLICY "Public can read scf controls" ON public.scf_controls FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf frameworks" ON public.scf_frameworks;
CREATE POLICY "Public can read scf frameworks" ON public.scf_frameworks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf control mappings" ON public.scf_control_mappings;
CREATE POLICY "Public can read scf control mappings" ON public.scf_control_mappings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf principles" ON public.scf_principles;
CREATE POLICY "Public can read scf principles" ON public.scf_principles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf authoritative sources" ON public.scf_authoritative_sources;
CREATE POLICY "Public can read scf authoritative sources" ON public.scf_authoritative_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf assessment objectives" ON public.scf_assessment_objectives;
CREATE POLICY "Public can read scf assessment objectives" ON public.scf_assessment_objectives FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf evidence request list" ON public.scf_evidence_request_list;
CREATE POLICY "Public can read scf evidence request list" ON public.scf_evidence_request_list FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf control evidence mappings" ON public.scf_control_evidence_mappings;
CREATE POLICY "Public can read scf control evidence mappings" ON public.scf_control_evidence_mappings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf maturity levels" ON public.scf_maturity_levels;
CREATE POLICY "Public can read scf maturity levels" ON public.scf_maturity_levels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf risks" ON public.scf_risks;
CREATE POLICY "Public can read scf risks" ON public.scf_risks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf threats" ON public.scf_threats;
CREATE POLICY "Public can read scf threats" ON public.scf_threats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf control risk mappings" ON public.scf_control_risk_mappings;
CREATE POLICY "Public can read scf control risk mappings" ON public.scf_control_risk_mappings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read scf control threat mappings" ON public.scf_control_threat_mappings;
CREATE POLICY "Public can read scf control threat mappings" ON public.scf_control_threat_mappings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read control hierarchies" ON public.control_hierarchies;
CREATE POLICY "Public can read control hierarchies" ON public.control_hierarchies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read compliance benchmarks" ON public.compliance_benchmarks;
CREATE POLICY "Public can read compliance benchmarks" ON public.compliance_benchmarks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access to profiles" ON public.user_profiles;
CREATE POLICY "Service role full access to profiles" ON public.user_profiles USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users can select own profile" ON public.user_profiles;
CREATE POLICY "Users can select own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
CREATE POLICY "Users can delete own profile" ON public.user_profiles FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own user documents" ON public.user_documents;
CREATE POLICY "Users can manage own user documents" ON public.user_documents USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own user controls" ON public.user_controls;
CREATE POLICY "Users can manage own user controls" ON public.user_controls USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own compliance status" ON public.user_compliance_status;
CREATE POLICY "Users can manage own compliance status" ON public.user_compliance_status USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own compliance gaps" ON public.user_compliance_gaps;
CREATE POLICY "Users can manage own compliance gaps" ON public.user_compliance_gaps USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to evidence" ON public.evidence;
CREATE POLICY "Service role full access to evidence" ON public.evidence USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users can select own evidence" ON public.evidence;
CREATE POLICY "Users can select own evidence" ON public.evidence FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own evidence" ON public.evidence;
CREATE POLICY "Users can insert own evidence" ON public.evidence FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own evidence" ON public.evidence;
CREATE POLICY "Users can update own evidence" ON public.evidence FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own evidence" ON public.evidence;
CREATE POLICY "Users can delete own evidence" ON public.evidence FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to assessments" ON public.assessments;
CREATE POLICY "Service role full access to assessments" ON public.assessments USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users can manage own assessments" ON public.assessments;
CREATE POLICY "Users can manage own assessments" ON public.assessments USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own assessment history" ON public.assessment_status_history;
CREATE POLICY "Users can view own assessment history" ON public.assessment_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_status_history.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own assessment history" ON public.assessment_status_history;
CREATE POLICY "Users can insert own assessment history" ON public.assessment_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_status_history.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access to evidence assessment links" ON public.evidence_assessment_links;
CREATE POLICY "Service role full access to evidence assessment links" ON public.evidence_assessment_links USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users can read own evidence assessment links" ON public.evidence_assessment_links;
CREATE POLICY "Users can read own evidence assessment links" ON public.evidence_assessment_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = evidence_assessment_links.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view related assignments" ON public.assessment_assignments;
CREATE POLICY "Users can view related assignments" ON public.assessment_assignments
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_assignments.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create assignments for owned assessments" ON public.assessment_assignments;
CREATE POLICY "Users can create assignments for owned assessments" ON public.assessment_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_assignments.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update related assignments" ON public.assessment_assignments;
CREATE POLICY "Users can update related assignments" ON public.assessment_assignments
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_assignments.assessment_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_assignments.assessment_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete related assignments" ON public.assessment_assignments;
CREATE POLICY "Users can delete related assignments" ON public.assessment_assignments
  FOR DELETE USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = assessment_assignments.assessment_id
        AND a.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.scf_imports, public.scf_domains, public.scf_controls, public.scf_frameworks,
  public.scf_control_mappings, public.scf_principles, public.scf_authoritative_sources,
  public.scf_assessment_objectives, public.scf_evidence_request_list,
  public.scf_control_evidence_mappings, public.scf_maturity_levels, public.scf_risks,
  public.scf_threats, public.scf_control_risk_mappings, public.scf_control_threat_mappings,
  public.control_hierarchies, public.compliance_benchmarks
TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles, public.user_documents,
  public.user_controls, public.user_compliance_status, public.user_compliance_gaps,
  public.evidence, public.assessments, public.assessment_status_history,
  public.evidence_assessment_links, public.assessment_assignments
TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket and object policies
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Users can upload own compliance documents" ON storage.objects;
CREATE POLICY "Users can upload own compliance documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'evidence'
);

DROP POLICY IF EXISTS "Users can view own compliance documents" ON storage.objects;
CREATE POLICY "Users can view own compliance documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'evidence'
);

DROP POLICY IF EXISTS "Users can update own compliance documents" ON storage.objects;
CREATE POLICY "Users can update own compliance documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'evidence'
)
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'evidence'
);

DROP POLICY IF EXISTS "Users can delete own compliance documents" ON storage.objects;
CREATE POLICY "Users can delete own compliance documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'evidence'
);
