-- Migration to fix assessment_assignments references before we can drop legacy tables

-- =========== UP MIGRATION ===========

-- Drop junction table first (to avoid foreign key constraints)
DROP TABLE IF EXISTS public.evidence_assessment_links;

-- We need to update assessment_assignments table to reference the new assessments table
-- First create a new foreign key to the assessments table
ALTER TABLE public.assessment_assignments
ADD COLUMN new_assessment_id UUID REFERENCES public.assessments(id);

-- Update the new column with the assessment ID from the new table that matches user_assessments
UPDATE public.assessment_assignments aa
SET new_assessment_id = a.id
FROM public.assessments a
WHERE aa.assessment_id = a.id;

-- Drop the existing foreign key constraint
ALTER TABLE public.assessment_assignments
DROP CONSTRAINT IF EXISTS assessment_assignments_assessment_id_fkey;

-- Drop the old policies that depend on user_assessments
DROP POLICY IF EXISTS "Users can create assignments for their assessments" ON public.assessment_assignments;
DROP POLICY IF EXISTS "Users can view assignments for their assessments" ON public.assessment_assignments;
DROP POLICY IF EXISTS "Users can update assignments for their assessments" ON public.assessment_assignments;

-- Rename the column to use the new assessments table
ALTER TABLE public.assessment_assignments
DROP COLUMN assessment_id;

ALTER TABLE public.assessment_assignments
RENAME COLUMN new_assessment_id TO assessment_id;

-- Recreate the policies for the new structure
CREATE POLICY "Users can create assignments for their assessments" 
ON public.assessment_assignments 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view assignments for their assessments" 
ON public.assessment_assignments 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update assignments for their assessments" 
ON public.assessment_assignments 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_id AND a.user_id = auth.uid()
  )
);

-- =========== DOWN MIGRATION ===========
-- If you need to restore these tables, you would need to recreate their structure
-- and migrate data back from the assessments table. This would be a complex operation
-- and is not included here for safety reasons.
