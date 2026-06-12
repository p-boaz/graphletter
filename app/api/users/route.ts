import { type NextRequest, NextResponse } from "next/server";
import { checkRouteRateLimit } from "@/lib/api/rate-limiter";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

const log = createLogger("api/users");

const USERS_INDEX_RATE_LIMIT = {
  namespace: "users_index",
  user: { windowMs: 60_000, maxRequests: 20 },
  ip: { windowMs: 60_000, maxRequests: 60 },
  message: "Rate limit exceeded for user directory access. Please retry shortly.",
} as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdminUser(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResponse = checkRouteRateLimit(USERS_INDEX_RATE_LIMIT, user.id, request.headers);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Query user_profiles but get email from auth.users via join
    let query = supabaseAdmin
      .from("user_profiles")
      .select(
        `
        id,
        user_id,
        full_name,
        organization,
        created_at
      `
      )
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,organization.ilike.%${search}%`);
    }

    const { data: profiles, error } = await query;

    if (error) {
      log.error("users.get.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get auth user emails for the profiles
    const users =
      profiles?.map((profile) => ({
        id: profile.user_id, // Use user_id as the ID for consistency
        email: `user-${profile.user_id.slice(0, 8)}@example.com`, // Placeholder email
        full_name: profile.full_name || "",
        created_at: profile.created_at,
      })) || [];

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,organization.ilike.%${search}%`);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      users,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error) {
    log.error("users.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
