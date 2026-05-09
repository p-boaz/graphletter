-- Enforce idempotency for AI assessment writes keyed by metadata.assessment_run_key.
-- This prevents duplicate objective/summary/basic inserts for the same control/evidence run.

-- 1) Build duplicate-to-canonical map for existing rows so unique indexes can be created safely.
CREATE TEMP TABLE tmp_assessment_dedupe (
	duplicate_id uuid PRIMARY KEY,
	keep_id uuid NOT NULL
);

-- Objective-level AI assessments (scf_ao_id present)
WITH ranked AS (
	SELECT
		id,
		FIRST_VALUE(id) OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				scf_ao_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS keep_id,
		ROW_NUMBER() OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				scf_ao_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS rn
	FROM public.assessments
	WHERE assessment_method = 'ai_assisted'
		AND scf_ao_id IS NOT NULL
		AND (metadata->> 'assessment_run_key') IS NOT NULL
)
INSERT INTO tmp_assessment_dedupe (duplicate_id, keep_id)
SELECT id, keep_id
FROM ranked
WHERE rn > 1
ON CONFLICT (duplicate_id) DO NOTHING;

-- Control summary AI assessments (is_summary=true, scf_ao_id null)
WITH ranked AS (
	SELECT
		id,
		FIRST_VALUE(id) OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS keep_id,
		ROW_NUMBER() OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS rn
	FROM public.assessments
	WHERE assessment_method = 'ai_assisted'
		AND scf_ao_id IS NULL
		AND (metadata->> 'assessment_run_key') IS NOT NULL
		AND COALESCE((metadata->> 'is_summary')::boolean, false) = true
)
INSERT INTO tmp_assessment_dedupe (duplicate_id, keep_id)
SELECT id, keep_id
FROM ranked
WHERE rn > 1
ON CONFLICT (duplicate_id) DO NOTHING;

-- Basic AI assessments (basic_assessment=true, scf_ao_id null)
WITH ranked AS (
	SELECT
		id,
		FIRST_VALUE(id) OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS keep_id,
		ROW_NUMBER() OVER (
			PARTITION BY
				user_id,
				evidence_id,
				scf_control_id,
				(metadata->> 'assessment_run_key')
			ORDER BY created_at DESC, id DESC
		) AS rn
	FROM public.assessments
	WHERE assessment_method = 'ai_assisted'
		AND scf_ao_id IS NULL
		AND (metadata->> 'assessment_run_key') IS NOT NULL
		AND COALESCE((metadata->> 'basic_assessment')::boolean, false) = true
)
INSERT INTO tmp_assessment_dedupe (duplicate_id, keep_id)
SELECT id, keep_id
FROM ranked
WHERE rn > 1
ON CONFLICT (duplicate_id) DO NOTHING;

-- 2) Re-point FK references, then delete duplicate assessment rows.
UPDATE public.assessment_status_history h
SET assessment_id = d.keep_id
FROM tmp_assessment_dedupe d
WHERE h.assessment_id = d.duplicate_id
	AND h.assessment_id <> d.keep_id;

UPDATE public.assessment_assignments a
SET assessment_id = d.keep_id
FROM tmp_assessment_dedupe d
WHERE a.assessment_id = d.duplicate_id
	AND a.assessment_id <> d.keep_id;

DELETE FROM public.assessments a
USING tmp_assessment_dedupe d
WHERE a.id = d.duplicate_id;

-- 3) Enforce uniqueness for future writes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_ai_objective_run_unique
ON public.assessments (
	user_id,
	evidence_id,
	scf_control_id,
	scf_ao_id,
	(metadata->> 'assessment_run_key')
)
WHERE assessment_method = 'ai_assisted'
	AND scf_ao_id IS NOT NULL
	AND (metadata->> 'assessment_run_key') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_ai_summary_run_unique
ON public.assessments (
	user_id,
	evidence_id,
	scf_control_id,
	(metadata->> 'assessment_run_key')
)
WHERE assessment_method = 'ai_assisted'
	AND scf_ao_id IS NULL
	AND (metadata->> 'assessment_run_key') IS NOT NULL
	AND COALESCE((metadata->> 'is_summary')::boolean, false) = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_ai_basic_run_unique
ON public.assessments (
	user_id,
	evidence_id,
	scf_control_id,
	(metadata->> 'assessment_run_key')
)
WHERE assessment_method = 'ai_assisted'
	AND scf_ao_id IS NULL
	AND (metadata->> 'assessment_run_key') IS NOT NULL
	AND COALESCE((metadata->> 'basic_assessment')::boolean, false) = true;
