import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/user/profile");

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile from user_profiles table
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      log.error("user.profile.get.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    log.error("user.profile.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : null;
    const organization = typeof body.organization === "string" ? body.organization.trim() : null;

    // Update user profile in user_profiles table
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .update({
        full_name,
        organization,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      log.error("user.profile.put.update_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    log.error("user.profile.put.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
