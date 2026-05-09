-- Migration to clean up remaining redundant views and tables after schema normalization

-- =========== UP MIGRATION ===========

-- STEP 1: Handle view dependencies so we can drop the old tables

-- Drop views that depend on the tables/fields we're removing (views need to be dropped first)
DROP VIEW IF EXISTS public.integration_compliance_coverage; -- Depends on automated_assessments which we're dropping

-- Create replacements for views using new schema where needed
CREATE OR REPLACE VIEW public.integration_compliance_coverage AS
SELECT 
  ic.user_id,
  ic.provider_id,
  ip.provider_name,
  ic.connection_name,
  COUNT(DISTINCT a.scf_control_id) AS controls_covered,
  COUNT(DISTINCT ae.id) AS evidence_records,
  COUNT(DISTINCT a.id) AS assessments_completed,
  AVG(CASE 
    WHEN a.confidence_level = 'high' THEN 0.9
    WHEN a.confidence_level = 'medium' THEN 0.6
    WHEN a.confidence_level = 'low' THEN 0.3
    ELSE 0.0
  END) AS avg_confidence,
  MAX(a.created_at) AS last_evidence_collected
FROM 
  integration_connections ic
JOIN 
  integration_providers ip ON ic.provider_id = ip.provider_id
LEFT JOIN 
  automated_evidence ae ON ic.id = ae.integration_connection_id
LEFT JOIN 
  assessments a ON ae.id = a.automated_evidence_id AND a.assessment_type = 'automated'
WHERE 
  ic.connection_status = 'active'
GROUP BY 
  ic.user_id, ic.provider_id, ip.provider_name, ic.connection_name;

-- Clean up redundant view that's been replaced by scf_evidence_control_mappings
DROP VIEW IF EXISTS public.v_evidence_control_mappings_new;

-- STEP 2: Now we can safely drop the tables
DROP TABLE IF EXISTS public.user_assessments;
DROP TABLE IF EXISTS public.automated_assessments;

-- =========== DOWN MIGRATION ===========
/*
-- Recreate the original view if needed
CREATE VIEW public.integration_compliance_coverage AS
SELECT 
  ic.user_id,
  ic.provider_id,
  ip.provider_name,
  ic.connection_name,
  COUNT(DISTINCT ae.scf_control_id) AS controls_covered,
  COUNT(DISTINCT ae.id) AS evidence_records,
  COUNT(DISTINCT aa.id) AS assessments_completed,
  AVG(aa.confidence_score) AS avg_confidence,
  MAX(ae.collection_timestamp) AS last_evidence_collected
FROM 
  integration_connections ic
JOIN 
  integration_providers ip ON ic.provider_id = ip.provider_id
LEFT JOIN 
  automated_evidence ae ON ic.id = ae.integration_connection_id
LEFT JOIN 
  automated_assessments aa ON ae.id = aa.automated_evidence_id
WHERE 
  ic.connection_status = 'active'
GROUP BY 
  ic.user_id, ic.provider_id, ip.provider_name, ic.connection_name;

-- Recreate v_evidence_control_mappings_new
CREATE VIEW public.v_evidence_control_mappings_new AS
SELECT 
  e.id AS evidence_uuid,
  e.erl_id,
  e.area_of_focus,
  e.documentation_artifact,
  e.artifact_description,
  m.scf_control_id,
  e.scf_version,
  e.import_id,
  e.created_at,
  e.updated_at,
  m.relationship_type,
  m.priority,
  m.is_active,
  m.notes AS mapping_notes
FROM 
  scf_control_evidence_mappings m
JOIN 
  scf_evidence_request_list e ON m.evidence_request_id = e.id
WHERE 
  m.is_active = true;
*/
