-- This migration:
-- 1. Ensures all principles from the scf_domains.principles array exist in the scf_principles table
-- 2. Adds proper foreign key relationship between scf_principles and scf_domains
-- 3. Removes the redundant principles array from scf_domains

-- =========== UP MIGRATION ===========

-- Step 1: Create a function to check if all principles in arrays are represented in the scf_principles table
CREATE OR REPLACE FUNCTION verify_domain_principles_migration()
RETURNS TABLE (
  missing_count BIGINT,
  missing_principles TEXT[]
) AS $$
DECLARE
  missing BIGINT;
  missing_p TEXT[];
BEGIN
  WITH domain_array_entries AS (
    SELECT 
      d.id AS domain_id,
      unnest(d.principles) AS principle_name
    FROM 
      public.scf_domains d
    WHERE 
      d.principles IS NOT NULL AND array_length(d.principles, 1) > 0
  )
  SELECT 
    COUNT(*),
    array_agg(DISTINCT dae.principle_name)
  INTO 
    missing,
    missing_p
  FROM 
    domain_array_entries dae
  LEFT JOIN 
    public.scf_principles p ON dae.domain_id = p.domain_code AND dae.principle_name = p.principle_name
  WHERE 
    p.id IS NULL;
    
  -- Return the results
  missing_count := COALESCE(missing, 0);
  missing_principles := missing_p;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Call the verification function (doesn't modify data)
-- SELECT * FROM verify_domain_principles_migration();

-- Step 2: Insert any missing principles into the scf_principles table
INSERT INTO public.scf_principles (
  number,
  domain_code,
  domain_name,
  principle_name,
  principle_intent,
  scf_version,
  import_id,
  created_at
)
WITH domain_array_entries AS (
  SELECT 
    d.id AS domain_id,
    d.name AS domain_name,
    d.scf_version,
    d.import_id,
    unnest(d.principles) AS principle_name,
    -- Generate a number based on the position in the array
    unnest(array_positions(d.principles, unnest(d.principles))) AS principle_position
  FROM 
    public.scf_domains d
  WHERE 
    d.principles IS NOT NULL AND array_length(d.principles, 1) > 0
)
SELECT DISTINCT
  dae.principle_position,
  dae.domain_id,
  dae.domain_name,
  dae.principle_name,
  'Migrated from domain principles array' AS principle_intent,
  dae.scf_version,
  dae.import_id,
  now() AS created_at
FROM 
  domain_array_entries dae
LEFT JOIN 
  public.scf_principles p 
  ON dae.domain_id = p.domain_code 
  AND dae.principle_name = p.principle_name
WHERE 
  p.id IS NULL;

-- Step 3: Add foreign key constraint from scf_principles to scf_domains (if not exists)
-- First check if the constraint exists
DO $$
BEGIN
  -- If the constraint doesn't exist, create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scf_principles_domain_code_fkey'
  ) THEN
    ALTER TABLE public.scf_principles
    ADD CONSTRAINT scf_principles_domain_code_fkey
    FOREIGN KEY (domain_code)
    REFERENCES public.scf_domains(id);
  END IF;
END $$;

-- Step 4: Remove the redundant principles array from scf_domains
ALTER TABLE public.scf_domains 
DROP COLUMN IF EXISTS principles;

-- Clean up
DROP FUNCTION IF EXISTS verify_domain_principles_migration();

-- =========== DOWN MIGRATION ===========
-- In case we need to rollback, uncomment these statements
/*
-- Add back the principles array
ALTER TABLE public.scf_domains
ADD COLUMN principles TEXT[] DEFAULT '{}'::TEXT[];

-- Populate the array from the scf_principles table
UPDATE public.scf_domains d
SET principles = array_agg(p.principle_name)
FROM public.scf_principles p
WHERE p.domain_code = d.id
GROUP BY d.id;

-- If we need to remove the foreign key constraint
ALTER TABLE public.scf_principles
DROP CONSTRAINT IF EXISTS scf_principles_domain_code_fkey;
*/
