-- This migration does the following:
-- 1. Creates a unified assessments table
-- 2. Creates an assessment status history table for tracking changes
-- 3. Migrates data from user_assessments and automated_assessments tables
-- 4. Adds necessary indexes and constraints
-- 5. Removes old tables after migration (commented out for safety - uncomment after verification)

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========== UP MIGRATION ===========
-- Create the new unified assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  scf_control_id TEXT REFERENCES public.scf_controls(id),
  scf_ao_id TEXT REFERENCES public.scf_assessment_objectives(scf_ao_id),
  
  -- Type discriminator
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('manual', 'automated', 'integrated')),
  assessment_method TEXT NOT NULL DEFAULT 'manual' CHECK (assessment_method IN ('manual', 'automated', 'ai_assisted')),
  
  -- Core assessment fields
  assessment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (assessment_status IN ('not_started', 'in_progress', 'completed', 'under_review', 'approved', 'rejected', 'requires_remediation')),
  assessment_result TEXT CHECK (assessment_result IN ('pass', 'fail', 'partial', 'not_applicable', 'not_tested', 'met', 'not_met', 'partially_met')),
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')),
  
  -- Normalized fields that would have been in metadata
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  implementation_status TEXT DEFAULT 'not_implemented' CHECK (implementation_status IN ('not_implemented', 'planned', 'in_progress', 'implemented', 'needs_review')),
  assessment_frequency TEXT DEFAULT 'annual' CHECK (assessment_frequency IN ('continuous', 'monthly', 'quarterly', 'semi_annual', 'annual', 'biennial')),
  
  -- Evidence relationships
  user_evidence_id UUID, -- Reference to user uploaded evidence (will be migrated to unified evidence in future)
  automated_evidence_id UUID, -- Reference to automated evidence (will be migrated to unified evidence in future)
  
  -- Textual content
  assessment_notes TEXT,
  assessment_summary TEXT,
  remediation_plan TEXT,
  business_impact TEXT,
  remediation_timeline TEXT,
  ai_reasoning TEXT, -- For AI-assisted assessments
  
  -- Arrays for structured data
  deficiencies_identified TEXT[],
  recommendations TEXT[],
  testing_procedures TEXT[],
  validation_rules_applied JSONB, -- For automated assessments
  
  -- Sample sizes if applicable
  sample_size INTEGER,
  population_size INTEGER,
  
  -- Assignment/review tracking
  assigned_to UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  
  -- Integration-related fields
  integration_source_id UUID,
  integration_source_type TEXT,
  integration_timestamp TIMESTAMPTZ,
  
  -- Only keep truly dynamic/unexpected data in metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  next_assessment_due TIMESTAMPTZ
);

-- Add RLS policy to the assessments table
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assessments" 
ON public.assessments 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessments" 
ON public.assessments 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments" 
ON public.assessments 
FOR UPDATE USING (auth.uid() = user_id);

-- Create assessment status history table
CREATE TABLE IF NOT EXISTS public.assessment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('not_started', 'in_progress', 'completed', 'under_review', 'approved', 'rejected', 'requires_remediation')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Add RLS policy to assessment_status_history
ALTER TABLE public.assessment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history for their assessments" 
ON public.assessment_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert status history for their assessments" 
ON public.assessment_status_history
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.user_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX idx_assessments_scf_control_id ON public.assessments(scf_control_id);
CREATE INDEX idx_assessments_status ON public.assessments(assessment_status);
CREATE INDEX idx_assessments_integration ON public.assessments(integration_source_id, integration_source_type);
CREATE INDEX idx_assessment_status_history ON public.assessment_status_history(assessment_id);

-- Migrate data from user_assessments table
INSERT INTO public.assessments (
  id,
  user_id,
  scf_control_id,
  scf_ao_id,
  assessment_type,
  assessment_method,
  assessment_status,
  assessment_result,
  confidence_level,
  risk_rating,
  implementation_status,
  assessment_frequency,
  assessment_notes,
  assessment_summary,
  remediation_plan,
  business_impact,
  remediation_timeline,
  deficiencies_identified,
  recommendations,
  testing_procedures,
  sample_size,
  population_size,
  assigned_to,
  reviewed_by,
  approved_by,
  metadata,
  created_at,
  updated_at,
  started_at,
  completed_at,
  reviewed_at,
  approved_at,
  next_assessment_due
)
SELECT
  id,
  user_id,
  scf_control_id,
  scf_ao_id,
  'manual' as assessment_type,
  'manual' as assessment_method,
  assessment_status,
  assessment_result,
  confidence_level,
  risk_rating,
  implementation_status,
  assessment_frequency,
  assessment_notes,
  assessment_summary,
  remediation_plan,
  business_impact,
  remediation_timeline,
  deficiencies_identified,
  recommendations,
  testing_procedures,
  sample_size,
  population_size,
  assigned_to,
  reviewed_by,
  approved_by,
  metadata,
  created_at,
  updated_at,
  started_at,
  completed_at,
  reviewed_at,
  approved_at,
  next_assessment_due
FROM public.user_assessments;

-- Migrate data from automated_assessments table
INSERT INTO public.assessments (
  id,
  user_id,
  scf_control_id,
  scf_ao_id,
  assessment_type,
  assessment_method,
  assessment_status,
  assessment_result,
  confidence_level,
  automated_evidence_id,
  assessment_summary,
  ai_reasoning,
  validation_rules_applied,
  metadata,
  created_at,
  updated_at,
  integration_timestamp
)
SELECT
  gen_random_uuid(), -- Generate a new ID to avoid conflicts
  user_id,
  scf_control_id,
  scf_ao_id,
  'automated' as assessment_type,
  'automated' as assessment_method,
  'completed' as assessment_status, -- Set a default status
  assessment_result,
  (CASE 
    WHEN confidence_score >= 0.8 THEN 'high'
    WHEN confidence_score >= 0.5 THEN 'medium'
    ELSE 'low'
  END) as confidence_level,
  automated_evidence_id,
  NULL as assessment_summary, -- No direct mapping
  ai_reasoning,
  validation_rules_applied,
  metadata,
  created_at,
  created_at as updated_at, -- Use created_at as updated_at
  assessment_timestamp as integration_timestamp
FROM public.automated_assessments;

-- Migrate evidence links for user_assessments
-- First, create a tracking table to record which assessments had evidence
CREATE TABLE IF NOT EXISTS temp_evidence_tracking (
  old_assessment_id UUID,
  new_assessment_id UUID,
  evidence_id UUID
);

-- Insert records from evidence_assessment_links
INSERT INTO temp_evidence_tracking (
  old_assessment_id,
  new_assessment_id,
  evidence_id
)
SELECT
  eal.assessment_id,
  a.id,
  eal.evidence_id
FROM public.evidence_assessment_links eal
JOIN public.assessments a ON eal.assessment_id = a.id;

-- Update the assessments table to link evidence
UPDATE public.assessments a
SET user_evidence_id = tet.evidence_id
FROM temp_evidence_tracking tet
WHERE a.id = tet.new_assessment_id;

-- Drop the temporary tracking table
DROP TABLE temp_evidence_tracking;

-- Add status history for existing assessments
INSERT INTO public.assessment_status_history (
  assessment_id,
  previous_status,
  new_status,
  changed_by,
  changed_at,
  notes
)
SELECT 
  id as assessment_id,
  NULL as previous_status,
  assessment_status as new_status,
  user_id as changed_by,
  created_at as changed_at,
  'Initial status during migration' as notes
FROM public.assessments;

-- Create a function to maintain the status history
CREATE OR REPLACE FUNCTION public.update_assessment_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.assessment_status <> NEW.assessment_status THEN
    INSERT INTO public.assessment_status_history (
      assessment_id, 
      previous_status, 
      new_status, 
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.assessment_status,
      NEW.assessment_status,
      auth.uid(),
      'Status changed via application'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for status changes
CREATE TRIGGER assessment_status_change
AFTER UPDATE OF assessment_status ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_assessment_status_history();

-- Comment out the following lines for safety; uncomment after verifying the migration
-- DROP TABLE IF EXISTS public.evidence_assessment_links;
-- DROP TABLE IF EXISTS public.user_assessments;
-- DROP TABLE IF EXISTS public.automated_assessments;

-- =========== DOWN MIGRATION ===========
-- In case we need to rollback, uncomment these statements
/*
DROP TRIGGER IF EXISTS assessment_status_change ON public.assessments;
DROP FUNCTION IF EXISTS public.update_assessment_status_history();
DROP TABLE IF EXISTS public.assessment_status_history;
DROP TABLE IF EXISTS public.assessments;
*/
