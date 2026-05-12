-- Creates the scf_control_integrations table (DDL only). The 4
-- graphletter-authored integration fixtures are seeded by
-- scripts/seed-scf-control-integrations.ts (invoked by scripts/seed-all.ts) so
-- the migration can apply cleanly on a fresh sandbox where scf_controls is
-- still empty.
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
