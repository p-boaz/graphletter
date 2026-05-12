-- Seeds the scf_control_integrations table with the four graphletter-authored
-- integration fixtures. This is graphletter-authored content (not derived from
-- the upstream SCF release) — it lives in a migration rather than a CSV.
--
-- The table CREATE is idempotent (IF NOT EXISTS) so prod (which already has
-- the table from a pre-migration era) is unaffected.

CREATE TABLE IF NOT EXISTS public.scf_control_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scf_control_id text REFERENCES public.scf_controls(id),
  provider_id text,
  service_name text NOT NULL,
  check_type text NOT NULL,
  validation_rules jsonb NOT NULL,
  priority integer DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- The provider_id FK references public.integration_providers(provider_id), which
-- is created in a later migration. We add the constraint only if it doesn't
-- already exist AND if integration_providers has been created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'scf_control_integrations_provider_id_fkey'
      AND table_name = 'scf_control_integrations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_providers'
  ) THEN
    ALTER TABLE public.scf_control_integrations
      ADD CONSTRAINT scf_control_integrations_provider_id_fkey
      FOREIGN KEY (provider_id) REFERENCES public.integration_providers(provider_id);
  END IF;
END$$;

-- RLS: public read, no write policy (admin-only via service role).
ALTER TABLE public.scf_control_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read scf control integrations" ON public.scf_control_integrations;
CREATE POLICY "Public can read scf control integrations"
  ON public.scf_control_integrations FOR SELECT USING (true);

-- Seed rows. Use deterministic UUIDs so re-running is idempotent.
INSERT INTO public.scf_control_integrations (id, scf_control_id, provider_id, service_name, check_type, validation_rules, priority, is_active)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'AAT-02',
    'github',
    'GitHub',
    'mfa_enforced',
    '{"endpoint": "/orgs/{org}", "field": "two_factor_requirement_enabled"}'::jsonb,
    100,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'AAT-02',
    'aws',
    'AWS IAM',
    'mfa_enforced',
    '{"action": "iam:GetAccountSummary", "field": "AccountMFAEnabled"}'::jsonb,
    100,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'ACC-22',
    'github',
    'GitHub',
    'branch_protection',
    '{"endpoint": "/repos/{owner}/{repo}/branches/{branch}/protection"}'::jsonb,
    100,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'CFG-02',
    'aws',
    'AWS Config',
    'config_recorder',
    '{"action": "config:DescribeConfigurationRecorders"}'::jsonb,
    100,
    true
  )
ON CONFLICT (id) DO NOTHING;
