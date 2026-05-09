-- Enable Row Level Security on user_evidence table
ALTER TABLE public.user_evidence ENABLE ROW LEVEL SECURITY;

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access" ON public.user_evidence;
DROP POLICY IF EXISTS "Users can view their own evidence" ON public.user_evidence;
DROP POLICY IF EXISTS "Users can insert their own evidence" ON public.user_evidence;
DROP POLICY IF EXISTS "Users can update their own evidence" ON public.user_evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON public.user_evidence;
DROP POLICY IF EXISTS "Reviewers can access evidence they're reviewing" ON public.user_evidence;
DROP POLICY IF EXISTS "Reviewers can update evidence they're reviewing" ON public.user_evidence;
DROP POLICY IF EXISTS "Approvers can access evidence they're approving" ON public.user_evidence;
DROP POLICY IF EXISTS "Approvers can update evidence they're approving" ON public.user_evidence;

-- Service role full access
CREATE POLICY "Service role full access"
  ON public.user_evidence
  USING (auth.role() = 'service_role');

-- Users can view their own evidence
CREATE POLICY "Users can view their own evidence"
  ON public.user_evidence FOR SELECT
  USING ((auth.uid() = user_id) OR (auth.role() = 'service_role'));

-- Users can insert their own evidence
CREATE POLICY "Users can insert their own evidence"
  ON public.user_evidence FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR (auth.role() = 'service_role') OR (auth.role() = 'authenticated'));

-- Users can update their own evidence
CREATE POLICY "Users can update their own evidence"
  ON public.user_evidence FOR UPDATE
  USING ((auth.uid() = user_id) OR (auth.role() = 'service_role'));

-- Users can delete their own evidence
CREATE POLICY "Users can delete their own evidence"
  ON public.user_evidence FOR DELETE
  USING ((auth.uid() = user_id) OR (auth.role() = 'service_role'));

-- Add policy for reviewers to view and update evidence they're reviewing
CREATE POLICY "Reviewers can access evidence they're reviewing"
  ON public.user_evidence FOR SELECT
  USING (auth.uid() = reviewed_by);

CREATE POLICY "Reviewers can update evidence they're reviewing"
  ON public.user_evidence FOR UPDATE
  USING (auth.uid() = reviewed_by)
  WITH CHECK (auth.uid() = reviewed_by);

-- Add policy for approvers to view and update evidence they're approving
CREATE POLICY "Approvers can access evidence they're approving"
  ON public.user_evidence FOR SELECT
  USING (auth.uid() = approved_by);

CREATE POLICY "Approvers can update evidence they're approving"
  ON public.user_evidence FOR UPDATE
  USING (auth.uid() = approved_by)
  WITH CHECK (auth.uid() = approved_by);
