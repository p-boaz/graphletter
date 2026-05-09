-- Migration to unify evidence tables (user_evidence and automated_evidence)
-- Similar to the assessment consolidation, this creates a single evidence source of truth

-- =========== UP MIGRATION ===========

-- Create the new unified evidence table
CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Common fields from both tables
  scf_control_id TEXT REFERENCES public.scf_controls(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('document', 'screenshot', 'policy', 'procedure', 'log', 'certificate', 'configuration', 'other', 'aws', 'azure', 'gcp', 'github', 'okta', 'supabase')),
  
  -- Collection method discriminator
  collection_method TEXT NOT NULL DEFAULT 'manual' CHECK (collection_method IN ('manual', 'automated', 'integrated')),
  
  -- Fields from user_evidence
  erl_id TEXT,
  erl_global_id TEXT, -- Denormalized for easier querying and display
  file_name TEXT,
  file_path TEXT,
  file_size BIGINT,
  file_type TEXT,
  version INTEGER DEFAULT 1,
  description TEXT,
  evidence_status TEXT NOT NULL DEFAULT 'pending' CHECK (evidence_status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'outdated', 'processing', 'completed', 'failed', 'skipped')),
  
  -- Integration-related fields from automated_evidence
  integration_connection_id UUID,
  data_source TEXT,
  evidence_data JSONB,
  processed_content TEXT,
  confidence_score NUMERIC CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  
  -- User roles
  submitted_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- Version tracking
  replaces_evidence_id UUID REFERENCES public.evidence(id), -- Self-reference for version tracking
  outdated_at TIMESTAMPTZ,
  outdated_by INTEGER,
  
  -- Content extraction
  extracted_content TEXT,
  content_extracted_at TIMESTAMPTZ,
  content_extraction_status TEXT DEFAULT 'pending' CHECK (content_extraction_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  
  -- Storage paths
  storage_path TEXT,
  evidence_group_id UUID,
  
  -- Extended metadata (keeps flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  collection_timestamp TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policy to the unified evidence table
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evidence" 
ON public.evidence 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evidence" 
ON public.evidence 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evidence" 
ON public.evidence 
FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_evidence_user_id ON public.evidence(user_id);
CREATE INDEX idx_evidence_scf_control_id ON public.evidence(scf_control_id);
CREATE INDEX idx_evidence_evidence_type ON public.evidence(evidence_type);
CREATE INDEX idx_evidence_evidence_status ON public.evidence(evidence_status);
CREATE INDEX idx_evidence_collection_method ON public.evidence(collection_method);
CREATE INDEX idx_evidence_integration_connection_id ON public.evidence(integration_connection_id) WHERE integration_connection_id IS NOT NULL;

-- Migrate data from user_evidence table
INSERT INTO public.evidence (
  id,
  user_id,
  scf_control_id,
  evidence_type,
  collection_method,
  erl_id,
  erl_global_id,
  file_name,
  file_path,
  file_size,
  file_type,
  version,
  description,
  evidence_status,
  submitted_by,
  reviewed_by,
  approved_by,
  rejection_reason,
  metadata,
  storage_path,
  evidence_group_id,
  extracted_content,
  content_extracted_at,
  content_extraction_status,
  created_at,
  updated_at,
  submitted_at,
  reviewed_at,
  approved_at,
  -- Handle replaces_evidence_id later in an update statement
  outdated_at,
  outdated_by
)
SELECT
  id,
  user_id,
  scf_control_id,
  evidence_type,
  upload_method, -- Maps to collection_method
  erl_id,
  erl_global_id,
  file_name,
  file_path,
  file_size,
  file_type,
  version,
  description,
  evidence_status,
  submitted_by,
  reviewed_by,
  approved_by,
  rejection_reason,
  metadata,
  storage_path,
  evidence_group_id,
  extracted_content,
  content_extracted_at,
  content_extraction_status,
  created_at,
  updated_at,
  submitted_at,
  reviewed_at,
  approved_at,
  outdated_at,
  outdated_by
FROM public.user_evidence;

-- Update the replaces_evidence_id references for user evidence
UPDATE public.evidence e
SET replaces_evidence_id = ue.replaces_evidence_id
FROM public.user_evidence ue
WHERE e.id = ue.id AND ue.replaces_evidence_id IS NOT NULL;

-- Migrate data from automated_evidence table with new IDs to avoid conflicts
INSERT INTO public.evidence (
  user_id,
  scf_control_id,
  evidence_type,
  collection_method,
  integration_connection_id,
  data_source,
  evidence_data,
  processed_content,
  confidence_score,
  metadata,
  created_at,
  collection_timestamp
)
SELECT
  user_id,
  scf_control_id,
  evidence_type,
  'automated' as collection_method,
  integration_connection_id,
  data_source,
  evidence_data,
  processed_content,
  confidence_score,
  metadata,
  created_at,
  collection_timestamp
FROM public.automated_evidence;

-- Update assessments to point to the new evidence table
-- First add new columns to reference the unified evidence table
ALTER TABLE public.assessments
ADD COLUMN evidence_id UUID REFERENCES public.evidence(id);

-- Update existing references from user_evidence
UPDATE public.assessments a
SET evidence_id = a.user_evidence_id
WHERE a.user_evidence_id IS NOT NULL;

-- Update existing references from automated_evidence
-- We need a mapping of old automated_evidence IDs to new evidence IDs
WITH automated_evidence_mapping AS (
  SELECT 
    ae.id AS old_id,
    e.id AS new_id
  FROM 
    public.automated_evidence ae
  JOIN 
    public.evidence e 
    ON e.collection_method = 'automated' 
    AND e.integration_connection_id = ae.integration_connection_id
    AND e.scf_control_id = ae.scf_control_id
    AND e.data_source = ae.data_source
    AND e.collection_timestamp = ae.collection_timestamp
)
UPDATE public.assessments a
SET evidence_id = aem.new_id
FROM automated_evidence_mapping aem
WHERE a.automated_evidence_id = aem.old_id;

-- Since we don't need backward compatibility, we'll drop existing views instead of recreating them
DROP VIEW IF EXISTS public.user_evidence_current;
DROP VIEW IF EXISTS public.evidence_version_history;

-- We're not dropping the original tables yet to ensure a safe migration
-- These can be dropped in a future migration after verifying everything works

-- =========== DOWN MIGRATION ===========
/*
-- This would be a complex migration to reverse
-- It would involve recreating the original tables and migrating data back
-- Not included for safety reasons
*/
