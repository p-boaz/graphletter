-- This migration:
-- 1. Confirms all control-evidence relationships have been migrated to the junction table
-- 2. Removes redundant array columns from scf_controls and scf_evidence_request_list tables

-- =========== UP MIGRATION ===========

-- First, let's verify that all relationships in the array columns have been migrated to the junction table
-- Create a temporary function to help with the verification
CREATE OR REPLACE FUNCTION verify_control_evidence_migration()
RETURNS TABLE (
  missing_count BIGINT,
  control_ids TEXT[],
  evidence_request_ids TEXT[]
) AS $$
DECLARE
  missing_mappings BIGINT;
  missing_controls TEXT[];
  missing_evidence TEXT[];
BEGIN
  -- Check for control_ids in evidence_requests array that don't have a junction record
  WITH control_array_entries AS (
    SELECT 
      c.id AS control_id,
      unnest(c.evidence_requests) AS evidence_req_id
    FROM 
      public.scf_controls c
    WHERE 
      c.evidence_requests IS NOT NULL AND array_length(c.evidence_requests, 1) > 0
  )
  SELECT 
    COUNT(*),
    array_agg(DISTINCT cae.control_id),
    array_agg(DISTINCT cae.evidence_req_id)
  INTO 
    missing_mappings,
    missing_controls,
    missing_evidence
  FROM 
    control_array_entries cae
  LEFT JOIN 
    public.scf_evidence_request_list erl ON cae.evidence_req_id = erl.erl_id
  LEFT JOIN 
    public.scf_control_evidence_mappings cem ON cae.control_id = cem.scf_control_id 
      AND erl.id = cem.evidence_request_id
  WHERE 
    cem.id IS NULL AND erl.id IS NOT NULL;
    
  -- Return the results
  missing_count := COALESCE(missing_mappings, 0);
  control_ids := missing_controls;
  evidence_request_ids := missing_evidence;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Call the verification function (this doesn't modify data)
-- SELECT * FROM verify_control_evidence_migration();

-- Create any missing mappings for relationships that exist in the arrays but not in the junction table
INSERT INTO public.scf_control_evidence_mappings (
  scf_control_id,
  evidence_request_id,
  relationship_type,
  notes,
  created_at
)
WITH control_array_entries AS (
  SELECT 
    c.id AS control_id,
    unnest(c.evidence_requests) AS evidence_req_id
  FROM 
    public.scf_controls c
  WHERE 
    c.evidence_requests IS NOT NULL AND array_length(c.evidence_requests, 1) > 0
),
evidence_ids AS (
  SELECT 
    id, 
    erl_id
  FROM 
    public.scf_evidence_request_list
)
SELECT DISTINCT
  cae.control_id,
  e.id,
  'required',
  'Auto-created during schema migration from array column',
  now()
FROM 
  control_array_entries cae
JOIN 
  evidence_ids e ON cae.evidence_req_id = e.erl_id
LEFT JOIN 
  public.scf_control_evidence_mappings cem 
    ON cae.control_id = cem.scf_control_id 
    AND e.id = cem.evidence_request_id
WHERE 
  cem.id IS NULL;

-- Also check the other direction - scf_evidence_request_list.scf_control_mappings
INSERT INTO public.scf_control_evidence_mappings (
  scf_control_id,
  evidence_request_id,
  relationship_type,
  notes,
  created_at
)
WITH evidence_array_entries AS (
  SELECT 
    erl.id AS evidence_id,
    unnest(erl.scf_control_mappings) AS control_id
  FROM 
    public.scf_evidence_request_list erl
  WHERE 
    erl.scf_control_mappings IS NOT NULL AND array_length(erl.scf_control_mappings, 1) > 0
)
SELECT DISTINCT
  eae.control_id,
  eae.evidence_id,
  'required',
  'Auto-created during schema migration from evidence scf_control_mappings array',
  now()
FROM 
  evidence_array_entries eae
LEFT JOIN 
  public.scf_control_evidence_mappings cem 
    ON eae.control_id = cem.scf_control_id 
    AND eae.evidence_id = cem.evidence_request_id
WHERE 
  cem.id IS NULL;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS verify_control_evidence_migration();

-- Now that we've ensured all relationships are in the junction table,
-- handle dependencies before dropping columns

-- First, drop or modify any dependent views
DROP VIEW IF EXISTS public.scf_evidence_control_mappings;

-- Then remove the redundant array columns from both tables
ALTER TABLE public.scf_controls 
DROP COLUMN IF EXISTS evidence_requests;

ALTER TABLE public.scf_evidence_request_list 
DROP COLUMN IF EXISTS scf_control_mappings;

-- Recreate the view using the junction table instead
CREATE OR REPLACE VIEW public.scf_evidence_control_mappings AS
SELECT 
  erl.id AS evidence_request_id,
  erl.erl_id,
  erl.documentation_artifact,
  cem.scf_control_id,
  cem.relationship_type
FROM 
  public.scf_evidence_request_list erl
JOIN 
  public.scf_control_evidence_mappings cem ON erl.id = cem.evidence_request_id;

-- =========== DOWN MIGRATION ===========
-- In case we need to rollback, uncomment these statements
/*
-- Re-add the array columns (without data)
ALTER TABLE public.scf_controls
ADD COLUMN evidence_requests TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE public.scf_evidence_request_list
ADD COLUMN scf_control_mappings TEXT[] DEFAULT '{}'::TEXT[];

-- Populate the arrays from the junction table
UPDATE public.scf_controls c
SET evidence_requests = array_agg(erl.erl_id)
FROM public.scf_control_evidence_mappings cem
JOIN public.scf_evidence_request_list erl ON cem.evidence_request_id = erl.id
WHERE cem.scf_control_id = c.id
GROUP BY c.id;

UPDATE public.scf_evidence_request_list erl
SET scf_control_mappings = array_agg(cem.scf_control_id)
FROM public.scf_control_evidence_mappings cem
WHERE cem.evidence_request_id = erl.id
GROUP BY erl.id;
*/
