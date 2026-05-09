-- Evidence freshness rules: layered defaults for evidence expiry
-- Layer 1: evidence_type defaults (framework_id IS NULL)
-- Layer 2: framework-specific overrides (evidence_type IS NULL or specific)
-- Resolution: most specific match wins (framework+type > framework > type > global)

CREATE TABLE IF NOT EXISTS public.evidence_freshness_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_type text,
  framework_id text,
  max_age_days integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_freshness_rules_unique UNIQUE (evidence_type, framework_id)
);

ALTER TABLE public.evidence_freshness_rules ENABLE ROW LEVEL SECURITY;

-- Public read, admin write (matches domain_tier_weights pattern)
CREATE POLICY "Anyone can view freshness rules"
  ON public.evidence_freshness_rules FOR SELECT USING (true);

CREATE INDEX idx_freshness_rules_type_framework
  ON public.evidence_freshness_rules(evidence_type, framework_id);
