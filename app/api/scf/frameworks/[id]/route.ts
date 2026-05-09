import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: frameworkId } = await params;

    // Get framework details
    const { data: framework, error: frameworkError } = await supabase
      .from("scf_frameworks")
      .select("*")
      .eq("id", frameworkId)
      .single();

    if (frameworkError) {
      throw frameworkError;
    }

    // Get all control mappings for this framework with control details
    const { data: mappings, error: mappingsError } = await supabase
      .from("scf_control_mappings")
      .select(
        `
        id,
        control_id,
        framework_control_id,
        mapping_type,
        confidence_score,
        scf_controls (
          id,
          title,
          description,
          domain_id,
          scf_version
        )
      `
      )
      .eq("framework_id", frameworkId)
      .order("control_id");

    if (mappingsError) {
      throw mappingsError;
    }

    return NextResponse.json({
      framework,
      mappings: mappings || [],
    });
  } catch (error) {
    console.error("Error fetching framework details:", error);
    return NextResponse.json({ error: "Failed to fetch framework details" }, { status: 500 });
  }
}
