-- Domain tier weights for risk-weighted compliance posture scoring.
-- Critical domains (3x), high (2x), standard (1x).
-- Public read, admin (service role) write.

CREATE TABLE IF NOT EXISTS public.domain_tier_weights (
  domain_id text PRIMARY KEY REFERENCES public.scf_domains(id),
  tier text NOT NULL CHECK (tier IN ('critical', 'high', 'standard')) DEFAULT 'standard',
  weight numeric(3,1) NOT NULL DEFAULT 1.0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.domain_tier_weights IS 'SCF domain risk tier classifications for weighted posture scoring';

ALTER TABLE public.domain_tier_weights ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view domain tier weights"
  ON public.domain_tier_weights FOR SELECT
  USING (true);

-- Service role only write (no authenticated insert/update/delete policies)

-- Seed domain tier classifications based on SCF domain risk profiles
-- Critical (3x): domains where failure has direct security/compliance impact
INSERT INTO public.domain_tier_weights (domain_id, tier, weight) VALUES
  ('IAC', 'critical', 3.0),  -- Identification & Authentication
  ('IRO', 'critical', 3.0),  -- Incident Response
  ('CRY', 'critical', 3.0),  -- Cryptographic Protections
  ('DCH', 'critical', 3.0),  -- Data Classification & Handling
  ('GOV', 'critical', 3.0),  -- Cybersecurity & Data Privacy Governance
  ('CPL', 'critical', 3.0),  -- Compliance
  ('PRI', 'critical', 3.0),  -- Privacy
  ('RSK', 'critical', 3.0),  -- Risk Management
  ('TDA', 'critical', 3.0),  -- Third-Party Data Assessment
  -- High (2x): domains with significant operational risk
  ('AST', 'high', 2.0),      -- Asset Management
  ('BCD', 'high', 2.0),      -- Business Continuity & Disaster Recovery
  ('CFG', 'high', 2.0),      -- Configuration Management
  ('CLD', 'high', 2.0),      -- Cloud Security
  ('END', 'high', 2.0),      -- Endpoint Security
  ('HRS', 'high', 2.0),      -- Human Resources Security
  ('MON', 'high', 2.0),      -- Continuous Monitoring
  ('NET', 'high', 2.0),      -- Network Security
  ('PES', 'high', 2.0),      -- Physical & Environmental Security
  ('SEA', 'high', 2.0),      -- Secure Engineering & Architecture
  ('THR', 'high', 2.0),      -- Threat & Vulnerability Management
  ('WEB', 'high', 2.0),      -- Web Security
  ('IAO', 'high', 2.0),      -- Information Assurance
  ('VPM', 'high', 2.0)       -- Vulnerability & Patch Management
ON CONFLICT (domain_id) DO NOTHING;

-- All other domains default to standard (1x) when looked up
-- The posture scorer falls back to weight=1.0 for domains not in this table

CREATE INDEX idx_domain_tier_weights_tier ON public.domain_tier_weights(tier);
