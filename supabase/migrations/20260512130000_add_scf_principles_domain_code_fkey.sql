-- Add scf_principles_domain_code_fkey to bring local baseline in line with prod.
--
-- Drift surfaced on 2026-05-12 when `pnpm seed:reset --env-file .env.prod`
-- against project gbnxwsntyzyrpwmjaaqa returned PG error 23503:
--   "Key (domain_code)=(GOV) is not present in table \"scf_domains\"
--    violates foreign key constraint scf_principles_domain_code_fkey"
-- The constraint exists in prod but was never defined in the local baseline
-- (20250731000000_create_scf_baseline.sql line 93). Adding it forward here
-- makes fork-clone schemas match prod and prevents future divergence.
--
-- Idempotent via pg_constraint lookup so re-applying against prod (where
-- the constraint already exists) is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scf_principles_domain_code_fkey'
      AND conrelid = 'public.scf_principles'::regclass
  ) THEN
    ALTER TABLE public.scf_principles
      ADD CONSTRAINT scf_principles_domain_code_fkey
      FOREIGN KEY (domain_code)
      REFERENCES public.scf_domains (id);
  END IF;
END $$;
