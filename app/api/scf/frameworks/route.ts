import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/frameworks");

export async function GET() {
  try {
    const { data: frameworks, error } = await supabase
      .from("scf_frameworks")
      .select("id, framework_name, framework_version, total_mappings")
      .order("total_mappings", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(frameworks || []);
  } catch (error) {
    log.error("frameworks.fetch_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch frameworks" }, { status: 500 });
  }
}
