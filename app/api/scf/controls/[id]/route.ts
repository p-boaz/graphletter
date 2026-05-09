import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Fetch the main control data with framework mappings
    const { data: control, error } = await supabase
      .from("scf_controls")
      .select(
        `
        id,
        title,
        description,
        domain_id,
        control_questions,
        scf_control_mappings (
          id,
          framework_control_id,
          mapping_type,
          scf_frameworks (
            id,
            framework_name,
            framework_version,
            total_mappings
          )
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Control not found" }, { status: 404 });
      }
      throw error;
    }

    // Fetch associated risks
    const { data: risks } = await supabase
      .from("scf_control_risk_mappings")
      .select(`
        scf_risks (
          id,
          title,
          description,
          risk_grouping,
          nist_csf_function
        )
      `)
      .eq("scf_control_id", id);

    // Fetch associated threats
    const { data: threats } = await supabase
      .from("scf_control_threat_mappings")
      .select(`
        scf_threats (
          id,
          title,
          description,
          threat_grouping
        )
      `)
      .eq("scf_control_id", id);

    // Fetch maturity levels
    const { data: maturityLevels } = await supabase
      .from("scf_maturity_levels")
      .select("*")
      .eq("scf_control_id", id)
      .single();

    // Combine all the data
    const enhancedControl = {
      ...control,
      risks: risks?.map((r) => r.scf_risks).filter(Boolean) || [],
      threats: threats?.map((t) => t.scf_threats).filter(Boolean) || [],
      maturity_levels: maturityLevels || null,
    };

    return NextResponse.json(enhancedControl);
  } catch (error) {
    console.error("Error fetching control:", error);
    return NextResponse.json({ error: "Failed to fetch control" }, { status: 500 });
  }
}
