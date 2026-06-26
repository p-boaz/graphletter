import { generateGuidance } from "@/lib/compliance/guidance-generator";
import { createGapGuidancePostHandler } from "@/lib/compliance/gap-guidance-route";
import { supabaseAdmin } from "@/lib/database/supabase";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export const POST = createGapGuidancePostHandler({
  createClient,
  getCurrentUser,
  supabaseAdmin,
  generateGuidance,
});
