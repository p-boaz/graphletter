-- Per-item user overrides for individual evidence expiry dates.
-- Escape hatch: users can override the computed expiry for any evidence item.

CREATE TABLE IF NOT EXISTS public.evidence_expiry_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_expiry_overrides_evidence_unique UNIQUE (evidence_id)
);

ALTER TABLE public.evidence_expiry_overrides ENABLE ROW LEVEL SECURITY;

-- User-scoped RLS (matches compliance_snapshots pattern)
CREATE POLICY "Users can view own evidence expiry overrides"
  ON public.evidence_expiry_overrides FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evidence expiry overrides"
  ON public.evidence_expiry_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evidence expiry overrides"
  ON public.evidence_expiry_overrides FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_evidence_expiry_overrides_user
  ON public.evidence_expiry_overrides(user_id);

CREATE INDEX idx_evidence_expiry_overrides_evidence
  ON public.evidence_expiry_overrides(evidence_id);
