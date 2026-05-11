# One-time Supabase migration-ledger reconciliation

**Run once, before the first `supabase db push` against the live production project from this repo.** After that, this file is historical.

## What this fixes

The live production Supabase project's migration ledger (`supabase_migrations.schema_migrations`) records 32 migrations applied during this codebase's pre-OSS history. When the codebase went public on 2026-05-09, the migration history was rebaselined: 16 historical migrations were absorbed into a comprehensive `20250731000000_create_scf_baseline.sql`, and 2 surviving files had cosmetic content changes (different baseline design + a schema-qualified `digest()` call).

Result: the ledger has 32 rows; this repo has 16 files. The Supabase CLI refuses `db push` until they match.

The reconciliation is **metadata-only**. It edits the `supabase_migrations.schema_migrations` ledger table. It does not touch schema, data, RLS policies, or anything else. Tables and rows are unaffected.

## Procedure

Prereqs: `supabase login` and `supabase link --project-ref <PROD_REF>` already done.

```sh
# 1. Mark the 16 absorbed-into-baseline migrations as reverted (removes ledger rows).
for v in \
  20250731212500 \
  20250804000000 \
  20250804000001 \
  20250805000000 \
  20250805000001 \
  20250805000002 \
  20250805000003 \
  20250821000000 \
  20250906000000 \
  20250906000001 \
  20250906000002 \
  20250906000003 \
  20250906000004 \
  20250906000005 \
  20250906000006 \
  20250906000007 \
; do
  pnpm dlx supabase migration repair --status reverted "$v"
done

# 2. Re-stamp the 2 migrations whose content changed (revert old row, insert with new checksum).
for v in 20250731000000 20260304000002; do
  pnpm dlx supabase migration repair --status reverted "$v"
  pnpm dlx supabase migration repair --status applied  "$v"
done

# 3. Verify: should report no drift and no pending migrations.
pnpm dlx supabase migration list
```

After this, `pnpm dlx supabase db push` works normally, and you can delete this file.

## Why we deferred this

When the cutover from `graphletter-private` to public happened on 2026-05-11, prod was running fine and no schema change was queued. Doing the repair in the moment would have added 30 minutes of CLI work for zero immediate value. So we documented it and scheduled it to be done lazily, at the moment when someone actually wants to ship a schema migration.
