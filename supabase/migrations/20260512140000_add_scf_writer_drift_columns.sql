-- Close column-level schema drift between prod and the local baseline that
-- blocked `pnpm seed:reset --env-file .env.prod` on 2026-05-12. The writer
-- and the ERL seeder send columns the local baseline declares but prod's
-- baseline never received (memory observation 7563 — "All 16 Remote
-- Migration Statement Sizes Differ From Local Files" — first surfaced on
-- 2026-05-11 but wasn't acted on for column drift, only for migration-
-- ledger drift).
--
-- Failure sequence:
--   1. scf_domains: PostgREST PGRST204 "Could not find the 'principles'
--      column of 'scf_domains' in the schema cache" from writer.ts line 84.
--   2. scf_controls: writer.ts line 174 sends `evidence_requests` — would
--      have triggered the same PGRST204 next.
--   3. scf_evidence_request_list: scripts/seed-erl.ts line 43 sends
--      `scf_control_mappings` — same.
--
-- All three column adds are idempotent via ADD COLUMN IF NOT EXISTS so
-- this migration is safe to re-apply against prod (the columns will all
-- exist after the first run) and forward-applies cleanly on a fork-clone
-- (whose baseline already declares them, so this is a no-op).

ALTER TABLE public.scf_domains
  ADD COLUMN IF NOT EXISTS principles text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.scf_controls
  ADD COLUMN IF NOT EXISTS evidence_requests text[];

ALTER TABLE public.scf_evidence_request_list
  ADD COLUMN IF NOT EXISTS scf_control_mappings text[] NOT NULL DEFAULT '{}'::text[];
