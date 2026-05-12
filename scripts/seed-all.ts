#!/usr/bin/env node
/**
 * Phase 2 orchestrator. Runs in order:
 *   1. Core SCF write via writeParsedSCF (data/controls.csv +
 *      Domains and Principles.csv + Authoritative Sources.csv).
 *   2. scripts/import-scf-data.js as subprocess (risks, threats, maturity,
 *      control_risk_mappings, control_threat_mappings).
 *   3. seed-erl (data/evidence-request-list.csv).
 *   4. seed-assessment-objectives (data/Assessment_objectives.csv).
 *   5. seed-control-evidence-mappings (derived from DB state).
 *   6. seed-scf-control-integrations (4 graphletter-authored fixtures).
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env. Targets ONLY the
 * sandbox; never run against production.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SCFParser } from "../lib/scf-parser";
import { writeParsedSCF } from "../lib/scf/writer";
import { seedERL } from "./seed-erl";
import { seedAssessmentObjectives } from "./seed-assessment-objectives";
import { seedControlEvidenceMappings } from "./seed-control-evidence-mappings";
import { seedScfControlIntegrations } from "./seed-scf-control-integrations";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function dataPath(name: string): string {
  return resolve(REPO_ROOT, "data", name);
}

async function runLegacyImporter(): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn("node", ["scripts/import-scf-data.js"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", rejectP);
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`legacy importer exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  // Guard rail: refuse to run against the production graphletter project.
  if (url.includes("gbnxwsntyzyrpwmjaaqa")) {
    throw new Error(
      "seed-all: refusing to run against the production graphletter Supabase project."
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log(`seed-all: target ${url}`);

  // Step 1: core SCF write
  const [principlesCSV, authSourcesCSV, controlsCSV] = await Promise.all([
    readFile(dataPath("Domains and Principles.csv"), "utf8"),
    readFile(dataPath("Authoritative Sources.csv"), "utf8"),
    readFile(dataPath("controls.csv"), "utf8"),
  ]);
  const parseResult = SCFParser.parseAllSCFData(principlesCSV, authSourcesCSV, controlsCSV);
  if (parseResult.errors.length > 0) {
    console.error("seed-all: parser errors:", parseResult.errors);
    throw new Error("seed-all: parser errors — abort");
  }

  // Create a synthetic scf_imports row that ties together this seed run.
  // NB: scf_imports has filename + file_size + scf_version as NOT NULL columns
  // (see supabase/migrations/20250731000000_create_scf_baseline.sql). There is
  // no `triggered_by` column — the writer doesn't claim one and we shouldn't
  // either. Use a sentinel filename so app-uploaded rows remain distinguishable.
  const importId = randomUUID();
  const { error: impError } = await supabase.from("scf_imports").insert([
    {
      id: importId,
      filename: "seed-all-orchestrator",
      file_size: 0,
      scf_version: parseResult.summary.version,
      import_status: "processing",
    },
  ]);
  if (impError) throw new Error(`seed-all: scf_imports insert failed: ${impError.message}`);

  const writerSummary = await writeParsedSCF(supabase, parseResult, controlsCSV, importId);
  console.log("seed-all: writer summary", writerSummary);

  // Step 2: legacy importer subprocess
  console.log("seed-all: running scripts/import-scf-data.js …");
  await runLegacyImporter();

  // Step 3: ERL
  const erlSummary = await seedERL(supabase, dataPath("evidence-request-list.csv"));
  console.log("seed-all: erl summary", erlSummary);

  // Step 4: AO
  const aoSummary = await seedAssessmentObjectives(supabase, dataPath("Assessment_objectives.csv"));
  console.log("seed-all: ao summary", aoSummary);

  // Step 5: derived mappings
  const cemSummary = await seedControlEvidenceMappings(supabase);
  console.log("seed-all: cem summary", cemSummary);

  // Step 6: graphletter-authored control_integrations fixtures
  const sciSummary = await seedScfControlIntegrations(supabase);
  console.log("seed-all: sci summary", sciSummary);

  console.log("\nseed-all: ✓ all steps complete");
}

main().catch((err) => {
  console.error("\nseed-all: ✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
