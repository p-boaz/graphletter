import { type NextRequest, NextResponse } from "next/server";
import { evidenceStorage } from "@/lib/storage/evidence-storage";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("id");
    const action = searchParams.get("action") || "download"; // 'download' or 'view'

    if (!evidenceId) {
      return NextResponse.json({ error: "Evidence ID is required" }, { status: 400 });
    }

    // Get evidence record to verify ownership and get file path
    const { data: evidence, error: fetchError } = await supabase
      .from("evidence")
      .select("user_id, file_path, file_name")
      .eq("id", evidenceId)
      .single();

    if (fetchError || !evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    if (evidence.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized to access this evidence" }, { status: 403 });
    }

    // Generate download URL
    const expiresIn = action === "view" ? 3600 : 300; // 1 hour for view, 5 minutes for download
    const downloadResult = await evidenceStorage.getDownloadUrl(evidence.file_path, expiresIn);

    if (!downloadResult.success) {
      return NextResponse.json(
        {
          error: downloadResult.error || "Failed to generate download URL",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      downloadUrl: downloadResult.url,
      filename: evidence.file_name,
      expiresIn,
      action,
    });
  } catch (error) {
    console.error("Error in evidence download:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
