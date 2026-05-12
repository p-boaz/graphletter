-- Wave 2 Supabase security advisor remediation (2026-05-12).
--
-- This migration closes the safe one-shot advisor findings on the prod project
-- (gbnxwsntyzyrpwmjaaqa):
--   - 4 SECURITY DEFINER views (ERROR) → security_invoker = true.
--   - 36 functions with mutable search_path (WARN) → pin to `public, pg_temp`.
--   - 16 SECURITY DEFINER function exposure to anon/auth (WARN, 8 functions
--     × 2 roles) → REVOKE EXECUTE from PUBLIC, anon, authenticated.
--     Trigger-attached functions (create_user_profile,
--     update_assessment_status_history) still fire via their triggers
--     regardless of EXECUTE grants.
--   - 2 materialized views in the API (WARN: framework_crosswalk +
--     mv_framework_control_totals) → REVOKE all from anon, authenticated.
--     Matviews don't support security_invoker; removing API role access is
--     the only mitigation.
--
-- Every operation is guarded by an existence check so the migration is safe to
-- apply against fork-clones or the sandbox project (which don't have the full
-- set of prod-only views and matviews). Idempotent — re-applies are no-ops.

-- 1. SECURITY DEFINER views → INVOKER (4 ERROR lints). Each view is
-- prod-only; guard with pg_class lookup so the statement is a no-op
-- against environments where the view isn't installed.
DO $$
DECLARE
  view_name text;
  view_names text[] := ARRAY[
    'control_maturity_view', 'control_threats_view',
    'control_risks_view', 'comprehensive_control_view'
  ];
BEGIN
  FOREACH view_name IN ARRAY view_names LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = view_name AND c.relkind = 'v'
    ) THEN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = true)', view_name);
    END IF;
  END LOOP;
END$$;

-- 2. Pin search_path on every public.* function flagged by the advisor
-- (36 WARN lints). DO-block + pg_proc dynamic SQL handles each function's
-- argument signature without hard-coding 36 ALTER FUNCTION statements, and
-- silently skips functions that don't exist in the current environment.
DO $$
DECLARE
  fn RECORD;
  fn_names text[] := ARRAY[
    'handle_new_user', 'handle_updated_at', 'update_assessment_status_history',
    'refresh_framework_crosswalk', 'get_evidence_for_control',
    'get_controls_for_evidence', 'update_updated_at_column',
    'begin_compliance_transaction', 'refresh_dashboard_views',
    'commit_compliance_transaction', 'rollback_compliance_transaction',
    'update_scf_controls_search_vector', 'import_risks_from_csv',
    'import_threats_from_csv', 'create_user_profile', 'clean_csv_text',
    'extract_ids_from_text', 'split_csv_line', 'is_valid_id',
    'import_risks_from_csv_lines', 'import_risks_from_file',
    'import_threats_from_csv_lines', 'import_threats_from_file',
    'extract_maturity_level', 'import_maturity_levels_from_csv_lines',
    'import_maturity_levels_from_file', 'extract_risk_ids_from_control',
    'import_control_risk_mappings_from_csv_lines',
    'import_control_risk_mappings_from_file', 'extract_threat_ids_from_control',
    'import_control_threat_mappings_from_csv_lines',
    'import_control_threat_mappings_from_file', 'refresh_compliance_views',
    'import_all_scf_extension_data', 'run_scf_data_import',
    'trigger_refresh_views'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = ANY(fn_names)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END$$;

-- 3. Revoke EXECUTE on SECURITY DEFINER functions exposed to anon/auth
-- (16 WARN lints: 8 functions × 2 roles).
DO $$
DECLARE
  fn RECORD;
  fn_names text[] := ARRAY[
    'begin_compliance_transaction', 'commit_compliance_transaction',
    'create_user_profile', 'handle_new_user', 'refresh_dashboard_views',
    'refresh_framework_crosswalk', 'rollback_compliance_transaction',
    'update_assessment_status_history'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(fn_names)
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;
END$$;

-- 4. Revoke API role access on the 2 materialized views (2 WARN lints).
DO $$
DECLARE
  mv_name text;
  mv_names text[] := ARRAY['framework_crosswalk', 'mv_framework_control_totals'];
BEGIN
  FOREACH mv_name IN ARRAY mv_names LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = mv_name AND c.relkind = 'm'
    ) THEN
      EXECUTE format(
        'REVOKE ALL ON public.%I FROM anon, authenticated', mv_name);
    END IF;
  END LOOP;
END$$;
