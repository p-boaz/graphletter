import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

export async function GET() {
  try {
    // Get counts for all tables
    const [controlsResult, frameworksResult, mappingsResult] = await Promise.all([
      supabase.from("scf_controls").select("id", { count: "exact", head: true }),
      supabase.from("scf_frameworks").select("id", { count: "exact", head: true }),
      supabase.from("scf_control_mappings").select("id", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      controls: controlsResult.count || 0,
      frameworks: frameworksResult.count || 0,
      mappings: mappingsResult.count || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
