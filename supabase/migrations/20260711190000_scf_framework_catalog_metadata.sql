-- Catalog metadata for scf_frameworks (roadmap stages 3-4,
-- plans/task-2026-07-11-scf-catalog-metadata.md).
--
-- Defaults are chosen so pre-existing rows are immediately correct without a
-- backfill: every framework currently in production is precisely the
-- supported/public tier of data/framework-manifest.json. The seeder writes
-- explicit manifest values on every reseed.
--
-- visibility and exposure_status are deliberately separate axes: a framework
-- can be supported-but-non-public (licensing) or catalog-inspectable-but-not-
-- yet-supported (curation). 'excluded' frameworks are never imported, so the
-- CHECK admits only the two importable tiers.

ALTER TABLE public.scf_frameworks
  ADD COLUMN IF NOT EXISTS catalog_key text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS geography text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'supported',
  ADD COLUMN IF NOT EXISTS exposure_status text NOT NULL DEFAULT 'public';

ALTER TABLE public.scf_frameworks
  ADD CONSTRAINT scf_frameworks_kind_check
    CHECK (kind IS NULL OR kind IN ('standard', 'law', 'baseline', 'implementation-group', 'historical', 'reference')),
  ADD CONSTRAINT scf_frameworks_visibility_check
    CHECK (visibility IN ('supported', 'preview')),
  ADD CONSTRAINT scf_frameworks_exposure_status_check
    CHECK (exposure_status IN ('public', 'non-public'));

-- Stable identity per SCF release: the writer deletes-then-inserts per
-- scf_version, and distinct versions may briefly coexist during a reseed.
CREATE UNIQUE INDEX IF NOT EXISTS scf_frameworks_catalog_key_scf_version_idx
  ON public.scf_frameworks (catalog_key, scf_version)
  WHERE catalog_key IS NOT NULL;

-- The frameworks API and denominator queries filter on visibility.
CREATE INDEX IF NOT EXISTS scf_frameworks_visibility_idx
  ON public.scf_frameworks (visibility);

-- framework_crosswalk joined every framework in scf_frameworks; once
-- preview-tier frameworks can coexist in the table (catalog imports), the
-- crosswalk must only relate supported frameworks. Recreated with visibility
-- predicates; grants match the 2026-05-12 hardening (service_role only).
DROP MATERIALIZED VIEW IF EXISTS public.framework_crosswalk;

CREATE MATERIALIZED VIEW public.framework_crosswalk AS
SELECT
  gen_random_uuid() as id,
  src_fw.framework_name as source_framework,
  src_map.framework_control_id as source_control_id,
  tgt_fw.framework_name as target_framework,
  tgt_map.framework_control_id as target_control_id,
  COALESCE(
    CASE
      WHEN src_map.mapping_type = 'direct' AND tgt_map.mapping_type = 'direct' THEN 'equivalent'
      WHEN src_map.mapping_type IN ('subset', 'superset') OR tgt_map.mapping_type IN ('subset', 'superset') THEN 'related'
      ELSE 'related'
    END,
    'related'
  ) as mapping_type,
  COALESCE(
    (COALESCE(src_map.confidence_score, 0.7) + COALESCE(tgt_map.confidence_score, 0.7)) / 2,
    0.7
  ) as confidence_score,
  null::uuid as verified_by,
  null::timestamptz as verified_at,
  now() as created_at,
  now() as updated_at
FROM public.scf_control_mappings src_map
  JOIN public.scf_control_mappings tgt_map
    ON src_map.control_id = tgt_map.control_id
  JOIN public.scf_frameworks src_fw ON src_map.framework_id = src_fw.id
  JOIN public.scf_frameworks tgt_fw ON tgt_map.framework_id = tgt_fw.id
WHERE
  src_map.framework_id <> tgt_map.framework_id
  AND src_map.control_id IS NOT NULL
  AND tgt_map.control_id IS NOT NULL
  AND src_fw.framework_name IS NOT NULL
  AND tgt_fw.framework_name IS NOT NULL
  AND src_fw.visibility = 'supported'
  AND tgt_fw.visibility = 'supported';

CREATE INDEX IF NOT EXISTS idx_framework_crosswalk_source_target
ON public.framework_crosswalk (source_framework, target_framework);

CREATE INDEX IF NOT EXISTS idx_framework_crosswalk_confidence
ON public.framework_crosswalk (confidence_score DESC);

GRANT SELECT ON public.framework_crosswalk TO service_role;

COMMENT ON MATERIALIZED VIEW public.framework_crosswalk IS
'Cross-framework control mappings via shared SCF controls; supported-visibility frameworks only (see plans/scf-catalog-roadmap.md).';
