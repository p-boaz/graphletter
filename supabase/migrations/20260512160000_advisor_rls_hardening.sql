-- Wave 3 Supabase advisor RLS remediation (2026-05-12).
--
-- Drops 13 over-permissive RLS policies (advisor: `rls_policy_always_true`)
-- and adds minimal policies on the 3 tables that had RLS enabled with no
-- policy (advisor: `rls_enabled_no_policy`):
--
--   1. 13 INSERT/UPDATE/ALL policies with USING (true) / WITH CHECK (true)
--      that granted writes to anon or authenticated roles. Every code path
--      that writes to these tables uses the service role (which bypasses
--      RLS) via `supabaseAdmin` from @/lib/database/supabase or directly via
--      SUPABASE_SERVICE_ROLE_KEY in scripts/seed-*.ts. The policies were
--      vestiges from an earlier era when imports may have been done by
--      authenticated users.
--   2. Public SELECT policies on `erl_guidance_cache` and
--      `scf_control_evidence_mappings` — both are referenced by app routes
--      that use the user-session Supabase client (e.g. app/api/scf/erl/
--      route.ts), so they need to be readable by anon and authenticated.
--   3. Deny-all policies on `ai_provider_health` and `integration_sync_logs`
--      — both are accessed only via the service role (circuit-breaker.ts,
--      admin/ai-provider-health/route.ts), so the explicit deny-all
--      documents the intent and silences the INFO lint while preserving
--      service-role bypass.
--
-- Every operation is guarded by a pg_class existence check so the migration
-- is safe to apply against fork-clones or the sandbox project (which lacks
-- the `integration_sync_logs` table — pre-repo drift). All DROP statements
-- use `IF EXISTS` and all CREATE statements are paired with `DROP IF EXISTS`,
-- so the migration is idempotent across fork-clones and re-applies.

-- 1. Drop 13 over-permissive policies (advisor: rls_policy_always_true).
DO $$
DECLARE
  spec RECORD;
  specs RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('compliance_snapshots',        'Service role full access to compliance snapshots'),
      ('integration_sync_logs',       'Service can manage sync logs'),
      ('scf_assessment_objectives',   'Authenticated users can insert SCF assessment objectives'),
      ('scf_assessment_objectives',   'Authenticated users can update SCF assessment objectives'),
      ('scf_authoritative_sources',   'Allow public insert access'),
      ('scf_control_mappings',        'Authenticated users can insert SCF mappings'),
      ('scf_controls',                'Authenticated users can insert SCF controls'),
      ('scf_domains',                 'Authenticated users can insert SCF domains'),
      ('scf_evidence_request_list',   'Authenticated users can insert SCF evidence request list'),
      ('scf_evidence_request_list',   'Authenticated users can update SCF evidence request list'),
      ('scf_frameworks',              'Authenticated users can insert SCF frameworks'),
      ('scf_imports',                 'Authenticated users can import SCF data'),
      ('scf_principles',              'Allow public insert access')
    ) AS t(tbl, policy)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = spec.tbl AND c.relkind = 'r'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', spec.policy, spec.tbl);
    END IF;
  END LOOP;
END$$;

-- 2. Add public SELECT policies on the two tables read by user-session
-- clients (advisor: rls_enabled_no_policy).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'erl_guidance_cache' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read erl_guidance_cache" ON public.erl_guidance_cache';
    EXECUTE 'CREATE POLICY "Public read erl_guidance_cache" ON public.erl_guidance_cache FOR SELECT USING (true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'scf_control_evidence_mappings' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public read scf_control_evidence_mappings" ON public.scf_control_evidence_mappings';
    EXECUTE 'CREATE POLICY "Public read scf_control_evidence_mappings" ON public.scf_control_evidence_mappings FOR SELECT USING (true)';
  END IF;
END$$;

-- 3. Deny-all policies on the service-role-only tables. Service role
-- bypasses RLS regardless of policy, so the deny-all documents intent
-- and silences the INFO lint without affecting circuit-breaker.ts or
-- the admin route.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'ai_provider_health' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Deny all non-service-role access" ON public.ai_provider_health';
    EXECUTE 'CREATE POLICY "Deny all non-service-role access" ON public.ai_provider_health FOR ALL USING (false) WITH CHECK (false)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'integration_sync_logs' AND c.relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Deny all non-service-role access" ON public.integration_sync_logs';
    EXECUTE 'CREATE POLICY "Deny all non-service-role access" ON public.integration_sync_logs FOR ALL USING (false) WITH CHECK (false)';
  END IF;
END$$;
