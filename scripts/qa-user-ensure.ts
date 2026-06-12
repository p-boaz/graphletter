#!/usr/bin/env node
/**
 * Provision or reset the Playwright QA user in the linked Supabase project.
 * - If the user exists: updates their password (idempotent reset).
 * - If the user does not exist: creates them with email_confirm: true.
 *
 * Required env vars (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   QA_USER_EMAIL
 *   QA_USER_PASSWORD
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const qaEmail = requireEnv("QA_USER_EMAIL");
const qaPassword = requireEnv("QA_USER_PASSWORD");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureQaUser(): Promise<void> {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (listError) {
    console.error(`Failed to list users: ${listError.message}`);
    process.exit(1);
  }

  const existing = listData.users.find((u) => u.email === qaEmail);

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: qaPassword,
    });
    if (updateError) {
      console.error(`Failed to update QA user: ${updateError.message}`);
      process.exit(1);
    }
  } else {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: qaEmail,
      password: qaPassword,
      email_confirm: true,
    });
    if (createError) {
      console.error(`Failed to create QA user: ${createError.message}`);
      process.exit(1);
    }
  }

  console.log(`QA user ensured: ${qaEmail}`);
}

ensureQaUser().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
