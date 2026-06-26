import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type {
  SCFControl,
  SCFDomain,
  SCFFrameworkMapping,
  SCFImportResult,
  SCFRisk,
  SCFThreat,
} from "@/lib/scf-types";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

const log = createLogger("lib/database/supabase");

// Initialize Supabase clients
const supabaseUrl = getSupabaseServerUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const supabaseServiceKey = getSupabaseServiceRoleKey();

// Client-side Supabase client (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database types
export interface SCFImportRecord {
  id: string;
  filename: string;
  file_size: number;
  scf_version: string;
  import_status: "processing" | "completed" | "failed";
  total_controls: number;
  total_domains: number;
  total_frameworks: number;
  total_mappings: number;
  errors: string[];
  warnings: string[];
  imported_by?: string;
  imported_at: string;
  completed_at?: string;
}

// Minimal control record with only essential fields - updated to match schema nullability
export interface SCFControlRecord {
  id: string;
  title: string;
  description: string;
  domain_id: string | null; // Changed to allow null to match schema
  scf_version: string;
  import_id: string;
}

// Storage functions - using admin client for server-side operations
export class SCFDatabase {
  // Create a new import session
  static async createImportSession(
    filename: string,
    fileSize: number,
    scfVersion: string,
    userId?: string
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from("scf_imports")
      .insert({
        filename,
        file_size: fileSize,
        scf_version: scfVersion,
        import_status: "processing",
        imported_by: userId || null,
      })
      .select("id")
      .single();

    if (error) {
      log.error("database.import_session_create_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to create import session: ${error.message}`);
    }

    return data.id;
  }

  // Store SCF domains using upsert to handle duplicates
  static async storeDomains(domains: SCFDomain[], importId: string, scfVersion: string) {
    const domainRecords = domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      description: domain.description || "",
      scf_version: scfVersion,
      import_id: importId,
    }));

    log.info("Upserting domains", { count: domains.length });

    const { error } = await supabaseAdmin.from("scf_domains").upsert(domainRecords, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      log.error("database.domains_upsert_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to store domains: ${error.message}`);
    }

    log.info("Successfully upserted domains", { count: domains.length });
  }

  // Store SCF frameworks with manual duplicate handling - updated to include mapping_type
  static async storeFrameworks(
    frameworks: SCFFrameworkMapping[],
    importId: string,
    scfVersion: string
  ) {
    log.info("Processing frameworks", { count: frameworks.length });

    const frameworkMap: { [name: string]: string } = {};

    for (const framework of frameworks) {
      const frameworkName = framework.frameworkName;
      const frameworkVersion = framework.frameworkVersion || "unknown";

      // Validate required fields before processing
      if (!framework.mappingType) {
        log.warn("database.framework_missing_mapping_type", {
          detail: `Framework ${frameworkName} missing mappingType, using 'direct' as default`,
        });
      }
      const mappingType = framework.mappingType || "direct";

      // Check if framework already exists
      const { data: existing, error: selectError } = await supabaseAdmin
        .from("scf_frameworks")
        .select("id")
        .eq("framework_name", frameworkName)
        .eq("framework_version", frameworkVersion)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is expected for new frameworks
        log.error("database.framework_check_failed", {
          detail: selectError instanceof Error ? selectError.message : String(selectError),
        });
        continue;
      }

      let frameworkId: string;

      if (existing) {
        // Framework exists, update it - now includes mapping_type
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("scf_frameworks")
          .update({
            mapping_type: mappingType, // Added required field
            scf_version: scfVersion,
            import_id: importId,
          })
          .eq("id", existing.id)
          .select("id")
          .single();

        if (updateError) {
          log.error("database.framework_update_failed", {
            detail: updateError instanceof Error ? updateError.message : String(updateError),
            frameworkName,
            frameworkVersion,
            mappingType,
          });
          continue;
        }

        frameworkId = updated.id;
        log.info("Updated existing framework", { frameworkName });
      } else {
        // Framework doesn't exist, create it - now includes mapping_type
        const { data: created, error: insertError } = await supabaseAdmin
          .from("scf_frameworks")
          .insert({
            framework_name: frameworkName,
            framework_version: frameworkVersion,
            mapping_type: mappingType, // Added required field
            scf_version: scfVersion,
            import_id: importId,
          })
          .select("id")
          .single();

        if (insertError) {
          log.error("database.framework_create_failed", {
            detail: insertError instanceof Error ? insertError.message : String(insertError),
            frameworkName,
            frameworkVersion,
            mappingType,
          });
          continue;
        }

        frameworkId = created.id;
        log.info("Created new framework", { frameworkName });
      }

      frameworkMap[frameworkName] = frameworkId;
    }

    log.info("Successfully processed frameworks", { count: Object.keys(frameworkMap).length });
    return Object.entries(frameworkMap).map(([name, id]) => ({
      id,
      framework_name: name,
    }));
  }

  // Store SCF controls using upsert to handle duplicates
  static async storeControls(controls: SCFControl[], importId: string, scfVersion: string) {
    // Only store the essential fields that definitely exist - updated to handle null domain_id
    const controlRecords: SCFControlRecord[] = controls.map((control) => ({
      id: control.id,
      title: control.title,
      description: control.description,
      domain_id: control.domain || null, // Handle potential null value
      scf_version: scfVersion,
      import_id: importId,
    }));

    log.info("Upserting controls", { count: controls.length });

    // Insert in batches to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < controlRecords.length; i += batchSize) {
      const batch = controlRecords.slice(i, i + batchSize);

      const { error } = await supabaseAdmin.from("scf_controls").upsert(batch, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

      if (error) {
        log.error("database.controls_upsert_failed", {
          detail: error instanceof Error ? error.message : String(error),
          sample: JSON.stringify(batch[0], null, 2),
        });
        throw new Error(`Failed to store controls: ${error.message}`);
      }

      log.debug("Upserted controls batch", { batch: i / batchSize + 1, batchSize: batch.length });
    }

    log.info("Successfully upserted all controls", { count: controls.length });
  }

  // Store control mappings - delete existing ones first to avoid duplicates
  static async storeControlMappings(
    controls: SCFControl[],
    frameworkMap: { [name: string]: string },
    _importId: string
  ) {
    void _importId;
    const mappingRecords = [];

    for (const control of controls) {
      for (const [frameworkName, mappings] of Object.entries(control.mappings)) {
        const frameworkId = frameworkMap[frameworkName];
        if (!frameworkId) continue;

        for (const mapping of mappings) {
          mappingRecords.push({
            control_id: control.id,
            framework_id: frameworkId,
            framework_control_id: mapping,
          });
        }
      }
    }

    if (mappingRecords.length === 0) {
      log.info("No control mappings to store");
      return;
    }

    log.info("Processing control mappings", { count: mappingRecords.length });

    // Delete existing mappings for these controls first
    const controlIds = controls.map((c) => c.id);
    const { error: deleteError } = await supabaseAdmin
      .from("scf_control_mappings")
      .delete()
      .in("control_id", controlIds);

    if (deleteError) {
      log.warn("database.mappings_delete_failed", {
        detail: deleteError instanceof Error ? deleteError.message : String(deleteError),
      });
    } else {
      log.info("Deleted existing mappings for controls");
    }

    // Insert new mappings in batches
    const batchSize = 1000;
    for (let i = 0; i < mappingRecords.length; i += batchSize) {
      const batch = mappingRecords.slice(i, i + batchSize);

      const { error } = await supabaseAdmin.from("scf_control_mappings").insert(batch);

      if (error) {
        log.error("database.control_mappings_store_failed", {
          detail: error instanceof Error ? error.message : String(error),
          sample: JSON.stringify(batch[0], null, 2),
        });
        throw new Error(`Failed to store control mappings: ${error.message}`);
      }

      log.debug("Stored mappings batch", { batch: i / batchSize + 1, batchSize: batch.length });
    }

    log.info("Successfully stored all control mappings", { count: mappingRecords.length });
  }

  // Skip risks and threats for now
  static async storeRisksAndThreats(
    _risks: SCFRisk[],
    _threats: SCFThreat[],
    _importId: string,
    _scfVersion: string
  ) {
    void _risks;
    void _threats;
    void _importId;
    void _scfVersion;
    log.debug("Skipping risks and threats storage for now");
  }

  // Complete import session
  static async completeImportSession(
    importId: string,
    summary: SCFImportResult["summary"],
    errors: string[],
    warnings: string[]
  ) {
    // Ensure errors and warnings are proper arrays
    const cleanErrors = Array.isArray(errors) ? errors : [];
    const cleanWarnings = Array.isArray(warnings) ? warnings : [];

    const { error } = await supabaseAdmin
      .from("scf_imports")
      .update({
        import_status: "completed",
        total_controls: summary.totalControls,
        total_domains: summary.totalDomains,
        total_frameworks: summary.totalFrameworks,
        total_mappings: summary.totalMappings,
        errors: cleanErrors,
        warnings: cleanWarnings,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (error) {
      log.error("database.import_session_complete_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to complete import session: ${error.message}`);
    }

    log.info("Import session completed successfully");
  }

  // Mark import as failed
  static async failImportSession(importId: string, errorMessage: string) {
    const { error: updateError } = await supabaseAdmin
      .from("scf_imports")
      .update({
        import_status: "failed",
        errors: [errorMessage],
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (updateError) {
      log.error("database.import_session_fail_mark_failed", {
        detail: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  }

  // Query functions - using regular client for read operations
  static async getImportHistory(limit = 10) {
    const { data, error } = await supabase
      .from("scf_imports")
      .select("*")
      .order("imported_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("database.import_history_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    return data as SCFImportRecord[];
  }

  static async getLatestSCFVersion() {
    const { data, error } = await supabase
      .from("scf_imports")
      .select("scf_version")
      .eq("import_status", "completed")
      .order("imported_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.scf_version;
  }

  static async getSCFControls(domainId?: string, limit = 100) {
    let query = supabase
      .from("scf_controls")
      .select(
        `
        *,
        scf_domains (
          name,
          description
        )
      `
      )
      .order("id")
      .limit(limit);

    if (domainId) {
      query = query.eq("domain_id", domainId);
    }

    const { data, error } = await query;

    if (error) {
      log.error("database.scf_controls_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    return data;
  }

  static async getSCFDomains() {
    const { data, error } = await supabase.from("scf_domains").select("*").order("id");

    if (error) {
      log.error("database.scf_domains_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    return data;
  }

  static async getControlMappings(controlId: string) {
    const { data, error } = await supabase
      .from("scf_control_mappings")
      .select(
        `
        *,
        scf_frameworks (
          framework_name,
          framework_version
        )
      `
      )
      .eq("control_id", controlId);

    if (error) {
      log.error("database.control_mappings_fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    return data;
  }
}
