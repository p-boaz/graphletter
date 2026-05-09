import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

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
    console.error("Error fetching frameworks:", error);
    return NextResponse.json({ error: "Failed to fetch frameworks" }, { status: 500 });
  }
}
