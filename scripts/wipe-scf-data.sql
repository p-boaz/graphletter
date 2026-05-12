-- =============================================================================
-- wipe-scf-data.sql
--
-- One-off destructive wipe of every scf_* table plus every customer table
-- whose foreign keys point into one. Designed for the "upgrade SCF version"
-- flow: TRUNCATE everything, then re-seed from data/ via `pnpm seed`.
--
-- IRREVERSIBLE. Take a Supabase point-in-time snapshot before running on prod.
--
-- Run via:
--   psql "$DATABASE_URL" -f scripts/wipe-scf-data.sql
-- or paste into the Supabase Dashboard SQL Editor.
--
-- The DO block surfaces what will get cascaded before the TRUNCATE runs, so
-- the operator can audit which non-scf tables (evidence_control_map,
-- control_gap_analysis, domain_tier_weights, …) are about to be cleared.
-- TRUNCATE … CASCADE recursively truncates every table with an inbound FK
-- regardless of the FK's ON DELETE action.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '--- wipe-scf-data plan ---';
  RAISE NOTICE 'Direct targets (scf_* tables):';
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'scf_%'
    ORDER BY table_name
  LOOP
    RAISE NOTICE '  scf  %', r.table_name;
  END LOOP;

  RAISE NOTICE 'Non-scf tables that will be cascaded:';
  FOR r IN
    SELECT DISTINCT tc.table_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
     AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name LIKE 'scf_%'
      AND tc.table_name NOT LIKE 'scf_%'
    ORDER BY tc.table_name
  LOOP
    RAISE NOTICE '  fk   % (on delete: %)', r.table_name, r.delete_rule;
  END LOOP;
END $$;

-- Explicit table list (matches `grep -h "CREATE TABLE.*scf_" supabase/migrations/`).
-- TRUNCATE … RESTART IDENTITY CASCADE: clears each row, resets serial seqs,
-- and recursively truncates every table with an inbound FK to any of these.
TRUNCATE TABLE
  public.scf_assessment_objectives,
  public.scf_authoritative_sources,
  public.scf_control_evidence_mappings,
  public.scf_control_integrations,
  public.scf_control_mappings,
  public.scf_control_risk_mappings,
  public.scf_control_threat_mappings,
  public.scf_controls,
  public.scf_domains,
  public.scf_evidence_request_list,
  public.scf_frameworks,
  public.scf_imports,
  public.scf_maturity_levels,
  public.scf_principles,
  public.scf_risks,
  public.scf_threats
RESTART IDENTITY CASCADE;

COMMIT;
