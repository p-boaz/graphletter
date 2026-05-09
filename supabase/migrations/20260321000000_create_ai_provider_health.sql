-- Circuit breaker state for AI providers.
-- Fail-open design: if this table is unreachable, AI calls proceed normally.
-- Service role only — no user-facing access.

CREATE TABLE IF NOT EXISTS public.ai_provider_health (
  provider text PRIMARY KEY,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  tripped_at timestamptz
);

-- Seed rows for known providers
INSERT INTO public.ai_provider_health (provider)
VALUES ('openai'), ('anthropic')
ON CONFLICT (provider) DO NOTHING;

-- Enable RLS with no policies = service role only access
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;
