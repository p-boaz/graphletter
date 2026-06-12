CREATE OR REPLACE FUNCTION public.framework_mapping_counts(p_framework_ids uuid[])
RETURNS TABLE (framework_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.framework_id, count(*)::bigint AS total
  FROM public.scf_control_mappings m
  WHERE m.framework_id = ANY (p_framework_ids)
  GROUP BY m.framework_id;
$$;

GRANT EXECUTE ON FUNCTION public.framework_mapping_counts(uuid[]) TO authenticated, anon;
