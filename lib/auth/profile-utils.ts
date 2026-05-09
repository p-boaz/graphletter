import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib/auth/profile-utils");

export async function createUserProfileManually(
  userId: string,
  userData: { full_name: string; organization: string }
) {
  // Use service role client for admin operations during signup
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  log.info("Attempting to create profile for user", { userId });

  try {
    // First, let's check if the table exists from the API perspective
    const { data: tableCheck, error: tableError } = await supabase
      .from("user_profiles")
      .select("count")
      .limit(1);

    log.debug("Table check result", { hasData: !!tableCheck, hasError: !!tableError });

    if (tableError) {
      console.error("Table access error:", tableError);
      return { success: false, error: "Table access failed", details: tableError };
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    log.debug("Existing profile check", { exists: !!existingProfile, hasError: !!checkError });

    if (existingProfile) {
      return { success: true, profile: existingProfile, message: "Profile already exists" };
    }

    // Create new profile
    const { data: newProfile, error: createError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: userId,
        full_name: userData.full_name,
        organization: userData.organization,
      })
      .select()
      .single();

    log.info("Profile creation result", { success: !!newProfile, hasError: !!createError });

    if (createError) {
      return { success: false, error: "Profile creation failed", details: createError };
    }

    return { success: true, profile: newProfile };
  } catch (error) {
    console.error("Unexpected error in profile creation:", error);
    return { success: false, error: "Unexpected error", details: error };
  }
}

export async function debugUserProfilesTable() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    // Test basic table access
    const { data, error } = await supabase.from("user_profiles").select("*").limit(1);

    log.debug("Debug table access", { hasData: !!data, hasError: !!error });

    return { success: !error, data, error };
  } catch (error) {
    console.error("Debug table access failed:", error);
    return { success: false, error };
  }
}
