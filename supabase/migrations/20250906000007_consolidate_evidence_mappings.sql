-- Migration: Consolidate evidence mapping tables/views
-- Description: Keep scf_control_evidence_mappings as the main table and replace views with improved versions

-- Step 1: Drop existing views
DROP VIEW IF EXISTS public.v_control_evidence_relationships;
DROP VIEW IF EXISTS public.scf_evidence_control_mappings;

-- Step 2: Create a new improved view that combines functionality of both previous views
CREATE OR REPLACE VIEW public.v_control_evidence_relationships AS
SELECT 
    c.id AS control_id,
    c.title AS control_title,
    c.description AS control_description,
    e.id AS evidence_uuid,
    e.erl_id AS evidence_id,
    e.documentation_artifact,
    e.artifact_description,
    m.relationship_type,
    m.priority,
    m.is_active,
    m.notes,
    m.created_at AS relationship_created
FROM 
    public.scf_controls c
JOIN 
    public.scf_control_evidence_mappings m ON c.id = m.scf_control_id
JOIN 
    public.scf_evidence_request_list e ON m.evidence_request_id = e.id
WHERE 
    m.is_active = true;

-- Add comments to explain the purpose of the tables and views
COMMENT ON TABLE public.scf_control_evidence_mappings IS 'Primary junction table linking SCF controls to evidence requests with proper referential integrity';
COMMENT ON VIEW public.v_control_evidence_relationships IS 'Consolidated view providing rich relationships between controls and evidence for reporting and UI display';

-- Set or update permissions on the tables and views
ALTER VIEW public.v_control_evidence_relationships OWNER TO postgres;
GRANT ALL ON TABLE public.v_control_evidence_relationships TO postgres;
GRANT SELECT ON TABLE public.v_control_evidence_relationships TO service_role;
GRANT SELECT ON TABLE public.v_control_evidence_relationships TO authenticated;
