-- Migration to drop legacy evidence tables after unification
-- Only execute this after verifying the unified evidence table works correctly

-- =========== UP MIGRATION ===========

-- STEP 1: Drop all views that might reference the old tables or columns
DROP VIEW IF EXISTS public.integration_compliance_coverage;
DROP VIEW IF EXISTS public.evidence_version_history;
DROP VIEW IF EXISTS public.user_evidence_current;
DROP VIEW IF EXISTS public.automated_evidence_view;

-- STEP 2: Now that all dependencies are removed, we can drop the columns
ALTER TABLE public.assessments 
DROP COLUMN IF EXISTS user_evidence_id,
DROP COLUMN IF EXISTS automated_evidence_id;

-- Now drop the old tables
DROP TABLE IF EXISTS public.user_evidence;
DROP TABLE IF EXISTS public.automated_evidence;

-- =========== DOWN MIGRATION ===========
/*
-- This would be a complex migration to reverse
-- It would involve recreating the original tables and migrating data back
-- Not included for safety reasons
*/
