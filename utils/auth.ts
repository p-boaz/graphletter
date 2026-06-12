import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAuthUser = Awaited<
  ReturnType<SupabaseServerClient["auth"]["getUser"]>
>["data"]["user"];

export async function getCurrentUser(supabase?: SupabaseServerClient) {
  const client = supabase || (await createClient());

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    // A missing or rejected session means "no user" — return null so routes
    // answer 401. Only infrastructure failures (network/retryable errors,
    // auth-server 5xx) should throw and surface as 500.
    if (
      isAuthSessionMissingError(error) ||
      (typeof error.status === "number" && error.status >= 400 && error.status < 500)
    ) {
      return null;
    }
    throw new Error(`Authentication error: ${error.message}`);
  }

  return user;
}

function parseCsvEnvSet(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function isUserInAdminAllowlist(
  user:
    | {
        id?: string | null;
        email?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!user?.id) {
    return false;
  }

  const adminUserIds = parseCsvEnvSet(process.env.ADMIN_USER_IDS);
  const adminEmails = parseCsvEnvSet(process.env.ADMIN_EMAILS);

  if (adminUserIds.has(user.id)) {
    return true;
  }

  return Boolean(user.email && adminEmails.has(user.email));
}

export async function isAdminUser(user: SupabaseAuthUser): Promise<boolean> {
  return isUserInAdminAllowlist(user);
}
