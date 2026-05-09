-- Cache table for AI-generated ERL guidance (Phase 2: Close the Loop)
-- Stores per-artifact guidance keyed by erl_id + control set hash

CREATE TABLE IF NOT EXISTS public.erl_guidance_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  erl_id text NOT NULL,
  control_ids_hash text NOT NULL,
  guidance_text text NOT NULL,
  example_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_effort text NOT NULL DEFAULT 'medium'
    CHECK (estimated_effort IN ('low', 'medium', 'high')),
  model_provider text,
  model_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CONSTRAINT erl_guidance_cache_pkey PRIMARY KEY (id),
  CONSTRAINT erl_guidance_cache_lookup UNIQUE (erl_id, control_ids_hash)
);

CREATE INDEX idx_erl_guidance_cache_expires ON public.erl_guidance_cache (expires_at);

GRANT ALL ON public.erl_guidance_cache TO service_role;
GRANT SELECT ON public.erl_guidance_cache TO authenticated;

COMMENT ON TABLE public.erl_guidance_cache IS
  'Cached AI-generated remediation guidance per ERL artifact and control set.';
