-- Enable Row Level Security on integration_providers table
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view integration providers" ON public.integration_providers;
DROP POLICY IF EXISTS "Service role can manage integration providers" ON public.integration_providers;
DROP POLICY IF EXISTS "Public can view active integration providers" ON public.integration_providers;
DROP POLICY IF EXISTS "Service role can insert integration providers" ON public.integration_providers;
DROP POLICY IF EXISTS "Service role can update integration providers" ON public.integration_providers;
DROP POLICY IF EXISTS "Service role can delete integration providers" ON public.integration_providers;

-- Allow all authenticated users to view integration providers
CREATE POLICY "Authenticated users can view integration providers"
  ON public.integration_providers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can modify integration providers
CREATE POLICY "Service role can manage integration providers"
  ON public.integration_providers
  USING (auth.role() = 'service_role');

-- Allow anon users to view active integration providers (for public pages)
CREATE POLICY "Public can view active integration providers"
  ON public.integration_providers FOR SELECT
  USING (is_active = true);

-- Allow insert for service role only
CREATE POLICY "Service role can insert integration providers"
  ON public.integration_providers FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow update for service role only
CREATE POLICY "Service role can update integration providers"
  ON public.integration_providers FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow delete for service role only
CREATE POLICY "Service role can delete integration providers"
  ON public.integration_providers FOR DELETE
  USING (auth.role() = 'service_role');
