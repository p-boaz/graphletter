/**
 * LEGACY — invoked as a subprocess from scripts/seed-all.ts. This file is
 * preserved as-is because it is well-tested in production. See
 * docs/superpowers/specs/2026-05-11-scf-2026-1-1-pivot-design.md and
 * plans/task-2026-05-11-scf-2026-1-1-pivot.md (Phase 3 deferred task) for the
 * eventual absorption plan.
 */
const { readFileSync } = require("fs");
const { join } = require("path");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Import risks catalog data from CSV
 */
async function importRisksFromCsv() {
  console.log("Importing risks catalog data...");

  try {
    let csvData = readFileSync("./data/risks.csv", "utf-8");
    // Remove UTF-8 BOM if present
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: [
        "risk_grouping",
        "risk_id",
        "title",
        "description",
        "nist_csf_function",
        "materiality_pre_tax_income",
        "materiality_total_assets",
        "materiality_total_equity",
        "materiality_total_revenue",
      ],
      skip_empty_lines: true,
      from_line: 10, // R-AC-1 lives on physical line 10 of risks.csv; the
      // `record.risk_id.includes("Risk #")` guard below filters out any
      // residual header pseudo-rows above.
      relax_column_count: true, // Allow for variable column counts
    });

    const risks = [];

    for (const record of records) {
      // Skip empty rows or header-like rows
      if (!record.risk_id || record.risk_id.includes("Risk #")) {
        continue;
      }

      const risk = {
        id: record.risk_id.trim(),
        risk_grouping: record.risk_grouping?.trim() || "General", // Use fallback value
        title: record.title?.trim(),
        description: record.description?.trim(),
        nist_csf_function: record.nist_csf_function?.trim() || null,
      };

      if (risk.id && risk.description) {
        risks.push(risk);
      }
    }

    console.log(`Parsed ${risks.length} risk records`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < risks.length; i += batchSize) {
      const batch = risks.slice(i, i + batchSize);

      const { data, error } = await supabase.from("scf_risks").upsert(batch, { onConflict: "id" });

      if (error) {
        console.error("Error inserting risks batch:", error);
        throw error;
      }

      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(risks.length / batchSize)}`
      );
    }

    console.log("✅ Risks import completed");
    return risks.length;
  } catch (error) {
    console.error("Error importing risks:", error);
    throw error;
  }
}

/**
 * Import threats catalog data from CSV
 */
async function importThreatsFromCsv() {
  console.log("Importing threats catalog data...");

  try {
    let csvData = readFileSync("./data/threats.csv", "utf-8");
    // Remove UTF-8 BOM if present
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: [
        "threat_grouping",
        "threat_id",
        "title",
        "description",
        "materiality_pre_tax_income",
        "materiality_total_assets",
        "materiality_total_equity",
        "materiality_total_revenue",
      ],
      skip_empty_lines: true,
      from_line: 8, // NT-1 lives on physical line 8 of threats.csv; the
      // `record.threat_id.includes("Threat #")` guard below filters out any
      // residual header pseudo-rows above.
      relax_column_count: true, // Allow for variable column counts
    });

    const threats = [];

    for (const record of records) {
      // Skip empty rows or header-like rows
      if (!record.threat_id || record.threat_id.includes("Threat #")) {
        continue;
      }

      const threat = {
        id: record.threat_id.trim(),
        threat_grouping: record.threat_grouping?.trim() || "General", // Use fallback value
        title: record.title?.trim(),
        description: record.description?.trim(),
      };

      if (threat.id && threat.description) {
        threats.push(threat);
      }
    }

    console.log(`Parsed ${threats.length} threat records`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < threats.length; i += batchSize) {
      const batch = threats.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from("scf_threats")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error("Error inserting threats batch:", error);
        throw error;
      }

      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(threats.length / batchSize)}`
      );
    }

    console.log("✅ Threats import completed");
    return threats.length;
  } catch (error) {
    console.error("Error importing threats:", error);
    throw error;
  }
}

/**
 * Import maturity levels from full SCF revised CSV
 */
async function importMaturityLevels() {
  console.log("Importing maturity levels...");

  try {
    let csvData = readFileSync("./data/full_scf_rev.csv", "utf-8");
    // Remove UTF-8 BOM if present
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: false, // Don't use headers since they're complex
      skip_empty_lines: true,
      from_line: 85, // Start where actual control data begins
      relax_column_count: true,
    });

    const maturityLevels = [];

    for (const record of records) {
      // First column should be the control ID
      const controlId = record[0]?.trim();

      // Skip if not a valid control ID format (should be XXX-NN or XXX-NN.N)
      if (!controlId || !controlId.match(/^[A-Z]{2,3}-\d+(\.\d+)?$/)) {
        continue;
      }

      // Extract all 6 maturity levels (0-5) from columns 1-6
      const maturityData = {
        scf_control_id: controlId,
        level_0_description: record[1]?.trim() || null,
        level_1_description: record[2]?.trim() || null,
        level_2_description: record[3]?.trim() || null,
        level_3_description: record[4]?.trim() || null,
        level_4_description: record[5]?.trim() || null,
        level_5_description: record[6]?.trim() || null,
      };

      // Only include records that have at least one non-empty maturity level description
      if (
        Object.values(maturityData).some((val) => val && typeof val === "string" && val.length > 10)
      ) {
        maturityLevels.push(maturityData);
      }
    }

    console.log(`Parsed ${maturityLevels.length} maturity level records`);

    if (maturityLevels.length > 0) {
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < maturityLevels.length; i += batchSize) {
        const batch = maturityLevels.slice(i, i + batchSize);

        const { data, error } = await supabase.from("scf_maturity_levels").insert(batch);

        if (error) {
          console.error("Error inserting maturity levels batch:", error);
          throw error;
        }

        console.log(
          `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(maturityLevels.length / batchSize)}`
        );
      }
    }

    console.log("✅ Maturity levels import completed");
    return maturityLevels.length;
  } catch (error) {
    console.error("Error importing maturity levels:", error);
    throw error;
  }
}

/**
 * Create control-risk mappings from the full SCF revised CSV
 */
async function createControlRiskMappings() {
  console.log("Creating control-risk mappings...");

  try {
    let csvData = readFileSync("./data/full_scf_rev.csv", "utf-8");
    // Remove UTF-8 BOM if present
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: false, // Don't use headers since they're complex
      skip_empty_lines: true,
      from_line: 85, // Start where actual control data begins
      relax_column_count: true,
    });

    const mappings = [];

    for (const record of records) {
      const controlId = record[0]?.trim();

      // Skip if not a valid control ID format
      if (!controlId || !controlId.match(/^[A-Z]{2,3}-\d+(\.\d+)?$/)) {
        continue;
      }

      // Look for risk IDs in the remaining columns (after maturity levels and other data)
      // Risk IDs typically follow format R-XX-N
      for (let i = 7; i < record.length; i++) {
        const cellData = record[i]?.trim();
        if (cellData && cellData.match(/^R-[A-Z]{2,3}-\d+$/)) {
          mappings.push({
            scf_control_id: controlId,
            risk_id: cellData,
          });
        }
      }
    }

    console.log(`Parsed ${mappings.length} control-risk mapping records`);

    // Remove duplicates based on scf_control_id and risk_id combination
    const uniqueMappings = mappings.filter(
      (mapping, index, self) =>
        index ===
        self.findIndex(
          (m) => m.scf_control_id === mapping.scf_control_id && m.risk_id === mapping.risk_id
        )
    );

    console.log(`Deduplicated to ${uniqueMappings.length} unique control-risk mappings`);

    if (uniqueMappings.length > 0) {
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < uniqueMappings.length; i += batchSize) {
        const batch = uniqueMappings.slice(i, i + batchSize);

        const { data, error } = await supabase
          .from("scf_control_risk_mappings")
          .upsert(batch, { onConflict: "scf_control_id,risk_id" });

        if (error) {
          console.error("Error inserting control-risk mappings batch:", error);
          throw error;
        }

        console.log(
          `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueMappings.length / batchSize)}`
        );
      }
    }

    console.log("✅ Control-risk mappings completed");
    return uniqueMappings.length;
  } catch (error) {
    console.error("Error creating control-risk mappings:", error);
    throw error;
  }
}

/**
 * Create control-threat mappings from the full SCF revised CSV
 */
async function createControlThreatMappings() {
  console.log("Creating control-threat mappings...");

  try {
    let csvData = readFileSync("./data/full_scf_rev.csv", "utf-8");
    // Remove UTF-8 BOM if present
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
    }
    const records = parse(csvData, {
      columns: false, // Don't use headers since they're complex
      skip_empty_lines: true,
      from_line: 85, // Start where actual control data begins
      relax_column_count: true,
    });

    const mappings = [];

    for (const record of records) {
      const controlId = record[0]?.trim();

      // Skip if not a valid control ID format
      if (!controlId || !controlId.match(/^[A-Z]{2,3}-\d+(\.\d+)?$/)) {
        continue;
      }

      // Look for threat IDs in the remaining columns (after maturity levels and other data)
      // Threat IDs typically follow format NT-N, HT-N, MT-N
      for (let i = 7; i < record.length; i++) {
        const cellData = record[i]?.trim();
        if (cellData && cellData.match(/^(NT|HT|MT)-\d+$/)) {
          mappings.push({
            scf_control_id: controlId,
            threat_id: cellData,
          });
        }
      }
    }

    console.log(`Parsed ${mappings.length} control-threat mapping records`);

    // Remove duplicates based on scf_control_id and threat_id combination
    const uniqueMappings = mappings.filter(
      (mapping, index, self) =>
        index ===
        self.findIndex(
          (m) => m.scf_control_id === mapping.scf_control_id && m.threat_id === mapping.threat_id
        )
    );

    console.log(`Deduplicated to ${uniqueMappings.length} unique control-threat mappings`);

    if (uniqueMappings.length > 0) {
      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < uniqueMappings.length; i += batchSize) {
        const batch = uniqueMappings.slice(i, i + batchSize);

        const { data, error } = await supabase
          .from("scf_control_threat_mappings")
          .upsert(batch, { onConflict: "scf_control_id,threat_id" });

        if (error) {
          console.error("Error inserting control-threat mappings batch:", error);
          throw error;
        }

        console.log(
          `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueMappings.length / batchSize)}`
        );
      }
    }

    console.log("✅ Control-threat mappings completed");
    return uniqueMappings.length;
  } catch (error) {
    console.error("Error creating control-threat mappings:", error);
    throw error;
  }
}

// Import script to load CSV data into database
async function importSCFData() {
  console.log("🚀 Starting SCF Extension Data Import...\n");

  try {
    const stats = {
      risks: await importRisksFromCsv(),
      threats: await importThreatsFromCsv(),
      maturityLevels: await importMaturityLevels(),
      controlRiskMappings: await createControlRiskMappings(),
      controlThreatMappings: await createControlThreatMappings(),
    };

    console.log("\n🎉 Import process completed successfully!");
    console.log("Import Statistics:");
    console.log(`  - Risks imported: ${stats.risks}`);
    console.log(`  - Threats imported: ${stats.threats}`);
    console.log(`  - Maturity levels imported: ${stats.maturityLevels}`);
    console.log(`  - Control-risk mappings created: ${stats.controlRiskMappings}`);
    console.log(`  - Control-threat mappings created: ${stats.controlThreatMappings}`);
  } catch (error) {
    console.error("\n❌ Import process failed:", error);
    process.exit(1);
  }
}

// Run the import
importSCFData().catch(console.error);
