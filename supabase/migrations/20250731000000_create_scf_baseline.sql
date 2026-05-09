-- Pre-existing baseline: legacy tables created out-of-band (e.g., by
-- scripts/import-scf-data.js and earlier manual setup) that were never
-- captured in the migration chain.
--
-- Why this file exists: `supabase db diff --local` (used by
-- `pnpm schema:validate` in CI) starts a fresh shadow Postgres and replays
-- every migration in order. Downstream migrations
-- (20250731212500_integration_system_baseline, 20250805000000_enable_rls_user_evidence,
-- 20250805000001_enable_rls_user_profiles, 20250906000000_unify_assessment_models,
-- 20250906000001_normalize_control_evidence_relationships,
-- 20250906000002_normalize_domain_principles_relationship,
-- 20250906000003_drop_legacy_assessment_tables,
-- 20250906000005_unify_evidence_models,
-- 20250926000000_create_framework_crosswalk_view, and others) reference these
-- tables (FK targets, ALTER TABLE, INSERT/SELECT FROM, RLS policies, views),
-- so without this baseline the replay fails with:
--   ERROR: relation "public.user_evidence" does not exist (SQLSTATE 42P01)
-- and similar for every legacy table.
--
-- Design rules:
--  * All DDL is IF NOT EXISTS. Production already has these tables (created
--    out-of-band), so this is a no-op there; the shadow DB in CI is empty
--    and receives stubs sufficient to satisfy downstream migrations.
--  * Columns included are the minimum needed for downstream migrations'
--    FK targets, RLS policy predicates, ALTER TABLE statements, and
--    INSERT/SELECT column lists. Column-level drift vs. the live DB
--    (search_vector, detailed constraints, etc.) is out of scope.
--  * A few columns are intentionally OMITTED because later migrations do
--    `ALTER TABLE ... ADD COLUMN <col>` without IF NOT EXISTS. Adding them
--    here would make those ALTERs fail on replay. Documented inline.
--  * No seed data beyond the SCF domain/control rows that a later migration
--    INSERTs by hard-coded id. ON CONFLICT DO NOTHING keeps re-apply safe.
--
-- See plans/archive/task-2026-04-19-fix-ci-scf-baseline.md for the full rationale.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- SCF reference tables (populated in production by scripts/import-scf-data.js)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scf_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_domains (
  id text PRIMARY KEY,
  name text,
  scf_version text,
  import_id uuid REFERENCES public.scf_imports(id),
  principles text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_controls (
  id text PRIMARY KEY,
  domain_id text REFERENCES public.scf_domains(id),
  import_id uuid REFERENCES public.scf_imports(id),
  title text,
  description text,
  evidence_requests text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_name text,
  framework_version text,
  import_id uuid REFERENCES public.scf_imports(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id text REFERENCES public.scf_controls(id),
  framework_id uuid REFERENCES public.scf_frameworks(id),
  framework_control_id text,
  mapping_type text,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer,
  domain_code text,
  domain_name text,
  principle_name text,
  principle_intent text,
  scf_version text,
  import_id uuid REFERENCES public.scf_imports(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_assessment_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_ao_id text UNIQUE,
  scf_control_id text REFERENCES public.scf_controls(id),
  objective_text text,
  import_id uuid REFERENCES public.scf_imports(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_evidence_request_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erl_id text,
  documentation_artifact text,
  artifact_description text,
  scf_control_mappings text[] DEFAULT '{}'::text[],
  import_id uuid REFERENCES public.scf_imports(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scf_control_evidence_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text REFERENCES public.scf_controls(id),
  evidence_request_id uuid REFERENCES public.scf_evidence_request_list(id),
  relationship_type text,
  priority integer,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Legacy user-data tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- NOTE: Intentionally OMITS extracted_content, content_extracted_at, and
-- content_extraction_status. Migration 20250821000000_add_evidence_content_search
-- adds those via `ALTER TABLE ... ADD COLUMN` without IF NOT EXISTS; including
-- them here would make that migration fail on replay.
CREATE TABLE IF NOT EXISTS public.user_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  scf_control_id text,
  evidence_type text,
  upload_method text,
  erl_id text,
  erl_global_id text,
  file_name text,
  file_path text,
  file_size bigint,
  file_type text,
  version integer DEFAULT 1,
  description text,
  evidence_status text,
  submitted_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  rejection_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  storage_path text,
  evidence_group_id uuid,
  outdated_at timestamptz,
  outdated_by integer,
  replaces_evidence_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  scf_control_id text,
  scf_ao_id text,
  assessment_status text,
  assessment_result text,
  confidence_level text,
  risk_rating text,
  implementation_status text,
  assessment_frequency text,
  assessment_notes text,
  assessment_summary text,
  remediation_plan text,
  business_impact text,
  remediation_timeline text,
  deficiencies_identified text[],
  recommendations text[],
  testing_procedures text[],
  sample_size integer,
  population_size integer,
  assigned_to uuid,
  reviewed_by uuid,
  approved_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  next_assessment_due timestamptz
);

CREATE TABLE IF NOT EXISTS public.evidence_assessment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid,
  evidence_id uuid,
  created_at timestamptz DEFAULT now()
);

-- NOTE: Intentionally OMITS new_assessment_id. Migration
-- 20250906000003_drop_legacy_assessment_tables adds that column via
-- `ALTER TABLE ... ADD COLUMN` without IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS public.assessment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid,
  user_id uuid,
  assigned_to uuid,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seed rows that later migrations INSERT-reference by hard-coded id
-- (see 20250804000001_add_supabase_control_mappings.sql). In production these
-- are already present via scripts/import-scf-data.js; ON CONFLICT DO NOTHING
-- keeps this safe to re-apply.
-- ---------------------------------------------------------------------------

-- Domain ids covered here satisfy two downstream INSERT/FK paths:
--  * 20250804000001 scf_control_integrations rows that reference IAC-02/NET-03/CRY-03/RSK-01
--    (the matching scf_controls seed below).
--  * 20260322000001 domain_tier_weights rows keyed on the 23 domain ids listed here.
INSERT INTO public.scf_domains (id) VALUES
  ('IAC'), ('IRO'), ('CRY'), ('DCH'), ('GOV'), ('CPL'), ('PRI'), ('RSK'), ('TDA'),
  ('AST'), ('BCD'), ('CFG'), ('CLD'), ('END'), ('HRS'), ('MON'), ('NET'), ('PES'),
  ('SEA'), ('THR'), ('WEB'), ('IAO'), ('VPM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.scf_controls (id, domain_id) VALUES
  ('IAC-02', 'IAC'),
  ('NET-03', 'NET'),
  ('CRY-03', 'CRY'),
  ('RSK-01', 'RSK')
ON CONFLICT (id) DO NOTHING;
