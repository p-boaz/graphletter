-- Enable Row Level Security on user_profiles table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view other profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;

-- Users can manage their own profile
CREATE POLICY "Users can manage their own profile"
  ON public.user_profiles
  USING (auth.uid() = user_id);

-- Allow users to view other profiles (but not edit them)
CREATE POLICY "Users can view other profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

-- Service role has full access
CREATE POLICY "Service role full access to profiles"
  ON public.user_profiles
  USING (auth.role() = 'service_role');

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id);
