-- This function changes shared quota state and is called only by the server's
-- service-role client. Revoking PUBLIC alone leaves explicit role grants intact.
REVOKE ALL ON FUNCTION public.consume_demo_quota(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_demo_quota(text, integer, integer)
  TO service_role;
