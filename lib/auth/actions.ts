"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { createUserProfileManually } from "./profile-utils";

const log = createLogger("lib/auth/actions");

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const userData = {
    full_name: formData.get("full_name") as string,
    organization: formData.get("organization") as string,
  };

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: userData,
    },
  };

  log.info("Starting signup process");

  const { error, data: authData } = await supabase.auth.signUp(data);

  if (error) {
    log.error("Auth signup error", { error: error.message });
    const params = new URLSearchParams({
      tab: "signup",
      error:
        "We could not create your account. Please try again or contact hello@graphletter.com if it persists.",
    });
    if (userData.full_name) params.set("name", userData.full_name);
    if (data.email) params.set("email", data.email);
    redirect(`/auth?${params.toString()}`);
  }

  log.info("User created successfully", { userId: authData.user?.id });

  // Manually create profile after successful user creation
  if (authData.user) {
    log.info("Creating user profile manually");
    const profileResult = await createUserProfileManually(authData.user.id, userData);
    log.info("Profile creation result", { success: profileResult.success });

    if (!profileResult.success) {
      log.error("Profile creation failed", { error: String(profileResult.error) });
      // Don't fail the signup, but log the issue
    }
  }

  revalidatePath("/", "layout");
  redirect("/auth?message=Check email to continue sign in process");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/auth?error=Could not authenticate user");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth");
}
