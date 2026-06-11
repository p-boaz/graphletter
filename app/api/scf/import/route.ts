import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/database/supabase";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";
import { SCFParser } from "@/lib/scf-parser";
import { writeParsedSCF } from "@/lib/scf/writer";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/utils/auth";

const log = createLogger("api/scf/import");

export async function POST(request: NextRequest) {
  try {
    const userSupabase = await createClient();
    const user = await getCurrentUser(userSupabase);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const hasAdminAccess = await isAdminUser(user);
    if (!hasAdminAccess) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();

    const principlesFile = formData.get("principlesFile") as File | null;
    const authSourcesFile = formData.get("authSourcesFile") as File | null;
    const controlsFile = formData.get("controlsFile") as File | null;

    if (!principlesFile && !authSourcesFile && !controlsFile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one CSV file is required (principles, authoritative sources, or controls)",
        },
        { status: 400 }
      );
    }

    // Read file contents
    const principlesCSV = principlesFile ? await principlesFile.text() : undefined;
    const authSourcesCSV = authSourcesFile ? await authSourcesFile.text() : undefined;
    const controlsCSV = controlsFile ? await controlsFile.text() : undefined;

    // Parse all provided CSV data
    const parseResult = SCFParser.parseAllSCFData(principlesCSV, authSourcesCSV, controlsCSV);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse CSV data",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    // Create import record
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from("scf_imports")
      .insert({
        filename: [principlesFile?.name, authSourcesFile?.name, controlsFile?.name]
          .filter(Boolean)
          .join(", "),
        file_size:
          (principlesFile?.size || 0) + (authSourcesFile?.size || 0) + (controlsFile?.size || 0),
        scf_version: parseResult.summary.version,
        import_status: "processing",
        total_controls: parseResult.summary.totalControls,
        total_domains: parseResult.summary.totalDomains,
        total_frameworks: parseResult.summary.totalFrameworks,
        total_mappings: parseResult.summary.totalMappings,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      })
      .select()
      .single();

    if (importError) {
      log.error("import.record_create_failed", {
        detail: importError instanceof Error ? importError.message : String(importError),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create import record",
        },
        { status: 500 }
      );
    }

    const importId = importRecord.id;

    try {
      const summary = await writeParsedSCF(supabaseAdmin, parseResult, controlsCSV, importId);

      return NextResponse.json({
        success: true,
        importId,
        summary,
      });
    } catch (error) {
      log.error("Writer failed", { importId, error });
      await supabaseAdmin
        .from("scf_imports")
        .update({
          import_status: "failed",
          errors: [...parseResult.errors, error instanceof Error ? error.message : "Unknown error"],
        })
        .eq("id", importId);
      throw error;
    }
  } catch (error) {
    return apiError("scf.import_failed", "SCF import failed", 500, error);
  }
}
