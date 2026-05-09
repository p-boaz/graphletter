-- Compliance posture score history for trending.
-- User-scoped via auth.uid() RLS.

CREATE TABLE IF NOT EXISTS public.compliance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_id text,  -- NULL = overall posture, non-null = framework-specific
  score numeric(5,2) NOT NULL,
  total_controls integer NOT NULL DEFAULT 0,
  compliant_controls integer NOT NULL DEFAULT 0,
  partial_controls integer NOT NULL DEFAULT 0,
  missing_controls integer NOT NULL DEFAULT 0,
  domain_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.compliance_snapshots IS 'Posture score history for compliance trend analysis';

ALTER TABLE public.compliance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own compliance snapshots"
  ON public.compliance_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own compliance snapshots"
  ON public.compliance_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can also insert (for background recalc)
CREATE POLICY "Service role full access to compliance snapshots"
  ON public.compliance_snapshots
  USING (true)
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_compliance_snapshots_user_framework
  ON public.compliance_snapshots(user_id, framework_id, created_at DESC);

CREATE INDEX idx_compliance_snapshots_user_created
  ON public.compliance_snapshots(user_id, created_at DESC);
