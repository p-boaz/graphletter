-- Enable Row Level Security on scf_control_integrations table
ALTER TABLE public.scf_control_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view control integrations" ON public.scf_control_integrations;
DROP POLICY IF EXISTS "Service role can manage control integrations" ON public.scf_control_integrations;
DROP POLICY IF EXISTS "Public can view active control integrations" ON public.scf_control_integrations;
DROP POLICY IF EXISTS "Service role can insert control integrations" ON public.scf_control_integrations;
DROP POLICY IF EXISTS "Service role can update control integrations" ON public.scf_control_integrations;
DROP POLICY IF EXISTS "Service role can delete control integrations" ON public.scf_control_integrations;

-- Allow all authenticated users to view control integrations
CREATE POLICY "Authenticated users can view control integrations"
  ON public.scf_control_integrations FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can modify control integrations
CREATE POLICY "Service role can manage control integrations"
  ON public.scf_control_integrations
  USING (auth.role() = 'service_role');

-- Allow anon users to view active control integrations (for public pages)
CREATE POLICY "Public can view active control integrations"
  ON public.scf_control_integrations FOR SELECT
  USING (is_active = true);

-- Allow insert for service role only
CREATE POLICY "Service role can insert control integrations"
  ON public.scf_control_integrations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow update for service role only
CREATE POLICY "Service role can update control integrations"
  ON public.scf_control_integrations FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow delete for service role only
CREATE POLICY "Service role can delete control integrations"
  ON public.scf_control_integrations FOR DELETE
  USING (auth.role() = 'service_role');
