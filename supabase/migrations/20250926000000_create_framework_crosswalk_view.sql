-- Create materialized view for framework crosswalks
-- This view creates cross-framework mappings by joining controls that map to the same SCF control

CREATE MATERIALIZED VIEW IF NOT EXISTS public.framework_crosswalk AS
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
  AND tgt_fw.framework_name IS NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_framework_crosswalk_source_target 
ON public.framework_crosswalk (source_framework, target_framework);

CREATE INDEX IF NOT EXISTS idx_framework_crosswalk_confidence 
ON public.framework_crosswalk (confidence_score DESC);

-- Grant permissions to service role (used by Supabase API)
GRANT SELECT ON public.framework_crosswalk TO service_role;

-- Grant permissions to authenticated users (if needed for direct access)
GRANT SELECT ON public.framework_crosswalk TO authenticated;

-- Grant permissions to anon users (if needed for public access)
GRANT SELECT ON public.framework_crosswalk TO anon;

-- Add RLS policy (optional - depends on your security requirements)
-- ALTER TABLE public.framework_crosswalk ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow read access to framework crosswalk" ON public.framework_crosswalk
--   FOR SELECT USING (true);

-- Comment on the view
COMMENT ON MATERIALIZED VIEW public.framework_crosswalk IS 
'Materialized view that provides cross-framework control mappings by joining controls that map to the same SCF control';

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_framework_crosswalk()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.framework_crosswalk;
END;
$$;

-- Grant execute permissions on the refresh function
GRANT EXECUTE ON FUNCTION refresh_framework_crosswalk() TO service_role;

COMMENT ON FUNCTION refresh_framework_crosswalk() IS 
'Function to refresh the framework_crosswalk materialized view. Should be called after importing new framework mappings.';
