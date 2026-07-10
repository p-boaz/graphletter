import { createLogger } from "@/lib/logger";
import { SCFParser } from "@/lib/scf-parser";
import type { SCFImportResult } from "@/lib/scf-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger("lib/scf/writer");

export interface WriteSummary {
  principles: number;
  domains: number;
  authoritativeSources: number;
  controls: number;
  mappings: number;
}

export async function writeParsedSCF(
  supabase: SupabaseClient,
  parseResult: SCFImportResult,
  controlsCSV: string | undefined,
  importId: string
): Promise<WriteSummary> {
  // Clean up any existing data for this version to avoid conflicts
  log.info("Cleaning up existing data for version", { version: parseResult.summary.version });

  // Errors here used to be silently swallowed (no destructure of `error`),
  // which produced confusing downstream PK violations when an FK RESTRICT
  // blocked a DELETE. Throw on failure so the operator sees the real cause.
  const failOnDeleteError = (table: string) => (res: { error: { message: string } | null }) => {
    if (res.error) {
      throw new Error(`Cleanup delete on ${table} failed: ${res.error.message}`);
    }
  };

  // First get framework IDs to clean up mappings
  const { data: frameworksToDelete } = await supabase
    .from("scf_frameworks")
    .select("id")
    .eq("scf_version", parseResult.summary.version);

  if (frameworksToDelete && frameworksToDelete.length > 0) {
    const frameworkIds = frameworksToDelete.map((fw: { id: string }) => fw.id);
    failOnDeleteError("scf_control_mappings")(
      await supabase.from("scf_control_mappings").delete().in("framework_id", frameworkIds)
    );
  }

  failOnDeleteError("scf_frameworks")(
    await supabase.from("scf_frameworks").delete().eq("scf_version", parseResult.summary.version)
  );

  failOnDeleteError("scf_controls")(
    await supabase.from("scf_controls").delete().eq("scf_version", parseResult.summary.version)
  );

  // scf_domains uses upsert below (not delete-then-insert) so we leave existing
  // rows in place: the baseline migration seeds 23 domains with scf_version='seed'
  // that are referenced by domain_tier_weights via FK; deleting them would either
  // fail (RESTRICT) or orphan downstream weights.

  failOnDeleteError("scf_principles")(
    await supabase.from("scf_principles").delete().eq("scf_version", parseResult.summary.version)
  );

  failOnDeleteError("scf_authoritative_sources")(
    await supabase
      .from("scf_authoritative_sources")
      .delete()
      .eq("scf_version", parseResult.summary.version)
  );

  // Import domains FIRST — scf_principles.domain_code has an FK to
  // scf_domains.id in prod (drift from local baseline; surfaced when
  // `pnpm seed:reset` ran against prod on 2026-05-12). The baseline
  // migration's 'seed' rows are wiped by scripts/wipe-scf-data.sql, so
  // the writer can't rely on them being present in the post-wipe seed
  // path. Upserting domains before principles makes the writer correct
  // for both fresh-install and post-wipe environments.
  if (parseResult.domains && parseResult.domains.length > 0) {
    const domainsData = parseResult.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      description: domain.description,
      principles: domain.principles,
      principle_intent: domain.principleIntent, // Map camelCase to snake_case
      control_count: domain.controlCount, // Map camelCase to snake_case
      scf_version: parseResult.summary.version,
      import_id: importId,
    }));

    // Upsert (not insert): the baseline migration pre-seeds 23 domain rows
    // (scf_version='seed') that are FK targets of domain_tier_weights. Upserting
    // on PK preserves those FK references while updating name/description with
    // the fresh seed-version values.
    const { error: domainsError } = await supabase
      .from("scf_domains")
      .upsert(domainsData, { onConflict: "id" });

    if (domainsError) {
      log.error("writer.domains_import_failed", {
        detail: domainsError instanceof Error ? domainsError.message : String(domainsError),
      });
      throw new Error(`Failed to import domains: ${domainsError.message}`);
    }
  }

  // Import principles (now safe — domains exist either from the upsert
  // above or from a pre-existing baseline that this writer didn't touch).
  if (parseResult.principles && parseResult.principles.length > 0) {
    const principlesData = parseResult.principles.map((principle) => ({
      number: principle.number,
      domain_code: principle.domainCode, // Map camelCase to snake_case
      domain_name: principle.domainName, // Map camelCase to snake_case
      principle_name: principle.principleName, // Map camelCase to snake_case
      principle_intent: principle.principleIntent, // Map camelCase to snake_case
      scf_version: parseResult.summary.version,
      import_id: importId,
    }));

    const { error: principlesError } = await supabase.from("scf_principles").insert(principlesData);

    if (principlesError) {
      log.error("writer.principles_import_failed", {
        detail:
          principlesError instanceof Error ? principlesError.message : String(principlesError),
      });
      throw new Error(`Failed to import principles: ${principlesError.message}`);
    }
  }

  // Import authoritative sources if available
  if (parseResult.authoritativeSources && parseResult.authoritativeSources.length > 0) {
    const authSourcesData = parseResult.authoritativeSources.map((source) => ({
      geography: source.geography,
      mapping_column_header: source.mappingColumnHeader,
      source_organization: source.sourceOrganization,
      authoritative_source: source.authoritativeSource,
      strm_url: source.strmUrl,
      source_url: source.sourceUrl,
      scf_version: source.version,
      import_id: importId,
    }));

    const { error: authSourcesError } = await supabase
      .from("scf_authoritative_sources")
      .insert(authSourcesData);

    if (authSourcesError) {
      log.error("writer.auth_sources_import_failed", {
        detail:
          authSourcesError instanceof Error ? authSourcesError.message : String(authSourcesError),
      });
      throw new Error(`Failed to import authoritative sources: ${authSourcesError.message}`);
    }
  }

  // Import controls if available
  if (parseResult.controls && parseResult.controls.length > 0) {
    const controlsData = parseResult.controls.map((control) => {
      // Extract domain code from control ID (e.g., "ACC-01" -> "ACC")
      const domainCode =
        control.id.match(/^([A-Z]+)-/)?.[1] || control.id.substring(0, 3).toUpperCase();

      return {
        id: control.id,
        title: control.title,
        description: control.description,
        domain_id: domainCode, // Use extracted domain code instead of domain name
        principle: control.principle,
        control_questions: control.controlQuestions, // Map camelCase to snake_case
        guidance_micro: control.organizationGuidance?.micro,
        guidance_small: control.organizationGuidance?.small,
        guidance_medium: control.organizationGuidance?.medium,
        guidance_large: control.organizationGuidance?.large,
        guidance_enterprise: control.organizationGuidance?.enterprise,
        applies_to_people: control.applicability?.people || false, // Map camelCase to snake_case
        applies_to_process: control.applicability?.process || false, // Map camelCase to snake_case
        applies_to_technology: control.applicability?.technology || false, // Map camelCase to snake_case
        applies_to_governance: control.applicability?.governance || false, // Map camelCase to snake_case
        risk_ids: control.riskIds, // Map camelCase to snake_case
        threat_ids: control.threatIds, // Map camelCase to snake_case
        assessment_objectives: control.assessmentObjectives, // Map camelCase to snake_case
        evidence_requests: control.evidenceRequests, // Map camelCase to snake_case
        scf_version: parseResult.summary.version,
        import_id: importId,
      };
    });

    const { error: controlsError } = await supabase.from("scf_controls").insert(controlsData);

    if (controlsError) {
      log.error("writer.controls_import_failed", {
        detail: controlsError instanceof Error ? controlsError.message : String(controlsError),
      });
      throw new Error(`Failed to import controls: ${controlsError.message}`);
    }
  }

  // Import control mappings if controls CSV is available
  let mappingsInserted = 0;
  if (controlsCSV && parseResult.controls && parseResult.controls.length > 0) {
    log.info("Processing control mappings");

    // Parse control mappings from the controls CSV
    const controlMappings = SCFParser.parseControlMappings(controlsCSV);

    if (controlMappings.length > 0) {
      // Get list of valid control IDs that were actually imported
      const validControlIds = new Set(parseResult.controls.map((c) => c.id));

      // Filter mappings to only include valid controls
      const validMappings = controlMappings.filter((mapping) => {
        if (!validControlIds.has(mapping.controlId)) {
          log.warn("writer.mapping_skipped_invalid_control", {
            detail: `Skipping mapping for non-existent control: ${mapping.controlId}`,
          });
          return false;
        }
        return true;
      });

      log.info("Filtered mappings", {
        total: controlMappings.length,
        valid: validMappings.length,
      });

      if (validMappings.length === 0) {
        log.info("No valid control mappings to process");
      } else {
        // Group mappings by framework to create framework records efficiently
        const frameworksMap = new Map<string, { name: string; version?: string }>();

        validMappings.forEach((mapping) => {
          const frameworkKey = `${mapping.frameworkName}_${mapping.frameworkVersion || "default"}`;
          if (!frameworksMap.has(frameworkKey)) {
            frameworksMap.set(frameworkKey, {
              name: mapping.frameworkName,
              version: mapping.frameworkVersion,
            });
          }
        });
        // Create framework records
        const frameworksData = Array.from(frameworksMap.values()).map((fw) => ({
          framework_name: fw.name,
          framework_version: fw.version,
          mapping_type: "direct" as const,
          total_mappings: validMappings.filter(
            (m) => m.frameworkName === fw.name && m.frameworkVersion === fw.version
          ).length,
          scf_version: parseResult.summary.version,
          import_id: importId,
        }));

        const { data: frameworkRecords, error: frameworksError } = await supabase
          .from("scf_frameworks")
          .insert(frameworksData)
          .select();

        if (frameworksError) {
          log.error("writer.framework_records_create_failed", {
            detail:
              frameworksError instanceof Error ? frameworksError.message : String(frameworksError),
          });
          throw new Error(`Failed to create framework records: ${frameworksError.message}`);
        }

        // Create a lookup map for framework IDs
        const frameworkIdMap = new Map<string, string>();
        frameworkRecords?.forEach(
          (fw: { id: string; framework_name: string; framework_version: string | null }) => {
            const key = `${fw.framework_name}_${fw.framework_version || "default"}`;
            frameworkIdMap.set(key, fw.id);
          }
        );

        // Create control mapping records
        const mappingsData = validMappings
          .map((mapping) => {
            const frameworkKey = `${mapping.frameworkName}_${
              mapping.frameworkVersion || "default"
            }`;
            const frameworkId = frameworkIdMap.get(frameworkKey);

            if (!frameworkId) {
              log.warn("writer.framework_id_not_found", {
                detail: `Framework ID not found for ${frameworkKey}`,
              });
              return null;
            }

            return {
              control_id: mapping.controlId,
              framework_id: frameworkId,
              framework_control_id: mapping.frameworkControlId,
              mapping_type: mapping.mappingType,
              confidence_score: 1.0,
            };
          })
          .filter(Boolean);

        log.info("Inserting control mappings", { count: mappingsData.length });

        // Insert mappings in batches to avoid overwhelming the database
        const batchSize = 1264;
        for (let i = 0; i < mappingsData.length; i += batchSize) {
          const batch = mappingsData.slice(i, i + batchSize);

          const { error: mappingsError } = await supabase
            .from("scf_control_mappings")
            .insert(batch);

          if (mappingsError) {
            log.error("writer.mapping_batch_insert_failed", {
              detail:
                mappingsError instanceof Error ? mappingsError.message : String(mappingsError),
              batch: i / batchSize + 1,
            });
            throw new Error(`Failed to insert control mappings: ${mappingsError.message}`);
          }
          mappingsInserted += batch.length;
        }

        log.info("Successfully imported control mappings", { count: mappingsInserted });
      }
    }
  }

  // Update import status to completed
  await supabase
    .from("scf_imports")
    .update({
      import_status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  return {
    principles: parseResult.principles?.length ?? 0,
    domains: parseResult.domains?.length ?? 0,
    authoritativeSources: parseResult.authoritativeSources?.length ?? 0,
    controls: parseResult.controls?.length ?? 0,
    mappings: mappingsInserted,
  };
}
