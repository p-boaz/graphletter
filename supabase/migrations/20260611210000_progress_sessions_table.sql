-- Progress sessions table for durable cross-instance progress tracking (2026-06-11).
--
-- Replaces the in-process Map-based ProgressTracker singleton with a Supabase
-- table so that the session-creating request, progress-writing requests, and
-- the SSE-reading request can land on different Vercel serverless instances
-- without losing state.
--
-- Design notes:
-- - Rows are user-scoped; RLS enforces that users can only read/write their own rows.
-- - No TTL cleanup timer — rows are small and the client hook closes streams on
--   completion; a periodic maintenance job can prune old rows if needed in the future.
-- - Poll interval on the SSE side is 1500ms (see app/api/ws/progress/route.ts).
--
-- All DDL is idempotent (IF NOT EXISTS / DROP IF EXISTS + CREATE).

CREATE TABLE IF NOT EXISTS public.progress_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  current_stage text NOT NULL DEFAULT 'initializing',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','error')),
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own progress sessions" ON public.progress_sessions;
CREATE POLICY "Users manage own progress sessions"
  ON public.progress_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS progress_sessions_user_id_idx
  ON public.progress_sessions (user_id);
