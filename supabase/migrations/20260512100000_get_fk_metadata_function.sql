-- Read-only helper used by scripts/check-scf-deletion-safety.ts.
-- Returns, for every FK in the schema, the referring table/column, the
-- referenced table/column, and the ON DELETE rule. Exposed via PostgREST
-- so the JS client can call it as supabase.rpc("get_fk_metadata").

CREATE OR REPLACE FUNCTION public.get_fk_metadata(referenced_schema text DEFAULT 'public')
RETURNS TABLE (
  referring_table text,
  referring_column text,
  referenced_table text,
  referenced_column text,
  delete_rule text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    kcu.table_name::text          AS referring_table,
    kcu.column_name::text         AS referring_column,
    ccu.table_name::text          AS referenced_table,
    ccu.column_name::text         AS referenced_column,
    rc.delete_rule::text          AS delete_rule
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = rc.constraint_name
   AND kcu.constraint_schema = rc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = rc.constraint_name
   AND ccu.constraint_schema = rc.constraint_schema
  WHERE ccu.table_schema = referenced_schema;
$$;

REVOKE ALL ON FUNCTION public.get_fk_metadata(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fk_metadata(text) TO service_role;
