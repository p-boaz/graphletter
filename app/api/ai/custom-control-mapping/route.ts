import { generateObject } from "ai";
import { type NextRequest } from "next/server";
import { getModel } from "@/lib/ai-client";
import { validateAIEnvironment } from "@/lib/ai-config";
import { createCustomControlMappingHandler } from "@/lib/ai/custom-control-mapping-handler";
import { supabase } from "@/lib/database/supabase";
import { enforceUserRateLimit, requireAuthenticatedUser } from "@/utils/api-guards";

const post = createCustomControlMappingHandler({
  requireAuthenticatedUser,
  enforceUserRateLimit,
  validateAIEnvironment,
  controlStore: supabase as unknown as Parameters<
    typeof createCustomControlMappingHandler
  >[0]["controlStore"],
  generateObject,
  getModel,
});

export async function POST(request: NextRequest) {
  return post(request);
}
