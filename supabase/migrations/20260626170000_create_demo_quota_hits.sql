-- Durable quota tracking for unauthenticated /try demo runs.
--
-- The app enforces a small fixed-window quota before running AI-backed demo
-- assessments. This table replaces per-process memory so all serverless
-- instances share the same quota state. Raw IP addresses are not stored; the
-- application sends a SHA-256 quota key.

CREATE TABLE IF NOT EXISTS public.demo_quota_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_key text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_quota_hits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS demo_quota_hits_quota_key_consumed_at_idx
  ON public.demo_quota_hits (quota_key, consumed_at);

CREATE INDEX IF NOT EXISTS demo_quota_hits_consumed_at_idx
  ON public.demo_quota_hits (consumed_at);

GRANT SELECT, INSERT, DELETE ON public.demo_quota_hits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_demo_quota(
  p_quota_key text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS TABLE(ok boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_hit_count integer;
  v_oldest_hit timestamptz;
BEGIN
  IF p_quota_key IS NULL OR length(p_quota_key) = 0 THEN
    RAISE EXCEPTION 'quota key is required';
  END IF;

  IF p_max_hits < 1 THEN
    RAISE EXCEPTION 'max hits must be positive';
  END IF;

  IF p_window_seconds < 1 THEN
    RAISE EXCEPTION 'window seconds must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_quota_key, 0));

  DELETE FROM public.demo_quota_hits
  WHERE consumed_at <= v_cutoff;

  SELECT count(*)::integer, min(consumed_at)
    INTO v_hit_count, v_oldest_hit
  FROM public.demo_quota_hits
  WHERE quota_key = p_quota_key
    AND consumed_at > v_cutoff;

  IF v_hit_count >= p_max_hits THEN
    RETURN QUERY
    SELECT
      false,
      0,
      greatest(
        1,
        ceil(extract(epoch from ((v_oldest_hit + make_interval(secs => p_window_seconds)) - v_now)))::integer
      );
    RETURN;
  END IF;

  INSERT INTO public.demo_quota_hits (quota_key, consumed_at)
  VALUES (p_quota_key, v_now);

  RETURN QUERY
  SELECT
    true,
    greatest(0, p_max_hits - v_hit_count - 1),
    0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_demo_quota(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_demo_quota(text, integer, integer) TO service_role;

COMMENT ON TABLE public.demo_quota_hits IS
  'Durable hashed-IP quota hits for unauthenticated demo usage.';

COMMENT ON FUNCTION public.consume_demo_quota(text, integer, integer) IS
  'Atomically consumes one demo quota hit for a hashed quota key.';
