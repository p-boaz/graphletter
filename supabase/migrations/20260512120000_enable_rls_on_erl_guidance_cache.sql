-- Close the RLS gap on public.erl_guidance_cache.
--
-- The table was created (20260322000000_create_erl_guidance_cache.sql) without
-- enabling Row Level Security, and granted SELECT to `authenticated`. Both were
-- oversights: the only caller is lib/compliance/guidance-generator.ts, invoked
-- from app/api/compliance/gap-guidance/route.ts, which always passes
-- `supabaseAdmin` (service-role) into the generator. No client-side code reads
-- the cache directly.
--
-- Service role bypasses RLS, so enabling RLS without adding any policies yields
-- a deny-by-default posture that preserves the API route's behaviour while
-- closing the gap for anon and authenticated keys. The SELECT grant to
-- authenticated is revoked for cleanliness — without a permissive policy it
-- couldn't be used anyway.

ALTER TABLE public.erl_guidance_cache ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.erl_guidance_cache FROM authenticated;
