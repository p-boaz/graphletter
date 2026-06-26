#!/usr/bin/env tsx
/**
 * Evaluation harness for the filename→artifact classifier.
 * Reads a CSV with source_path,documentation_artifact,erl_id and prints
 * per-row predictions plus overall accuracy.
 *
 * Usage:
 *   pnpm eval:artifact-classifier [csv-path]
 *   pnpm eval:artifact-classifier ./fixtures/classifier-mapping.csv
 */
import fs from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { config as loadDotenv } from "dotenv";

// Load env BEFORE importing the classifier — its import chain eagerly
// constructs a Supabase admin client that requires NEXT_PUBLIC_SUPABASE_URL.
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });
loadDotenv();

type ClassifierModule = typeof import("../lib/artifact-classifier/classify");
let classifierModule: ClassifierModule | null = null;
async function getClassifier(): Promise<ClassifierModule> {
  if (!classifierModule) {
    classifierModule = await import("../lib/artifact-classifier/classify");
  }
  return classifierModule;
}

interface Row {
  source_path: string;
  documentation_artifact: string;
  erl_id: string;
  confidence: string;
  notes: string;
}

const csvPath = process.argv[2] ?? "./fixtures/classifier-mapping.csv";
const CATALOG_SOURCE = process.env.EVAL_CATALOG_SOURCE ?? "supabase";
// Empirical baseline ~52% on the validation set across runs; 45% gives
// headroom for model nondeterminism. Many misses are judgment-call
// disagreements on customer-specific labels (e.g. "Acceptable Use Policy"
// → "Rules of Behavior").
const ACCURACY_FLOOR = Number(process.env.EVAL_ACCURACY_FLOOR ?? 0.45);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4);

function catalogFromFixtureRows(rows: Row[]): Array<{ artifact: string; erlId: string }> {
  const seen = new Set<string>();
  const catalog: Array<{ artifact: string; erlId: string }> = [];

  for (const row of rows) {
    const artifact = row.documentation_artifact.trim();
    if (!artifact || seen.has(artifact)) continue;
    seen.add(artifact);
    catalog.push({ artifact, erlId: row.erl_id.trim() });
  }

  return catalog;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows: Row[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const { classifyArtifactFromFilename, loadArtifactCatalog } = await getClassifier();
  console.log(`Loading catalog (${CATALOG_SOURCE})...`);
  const catalog =
    CATALOG_SOURCE === "fixture" ? catalogFromFixtureRows(rows) : await loadArtifactCatalog();
  console.log(`Catalog has ${catalog.length} artifacts.`);
  console.log(`Evaluating ${rows.length} rows from ${csvPath}\n`);

  let matched = 0;
  let missed = 0;
  let noPrediction = 0;
  const misses: Array<{
    filename: string;
    expected: string;
    predicted: string | null;
    reasoning: string;
  }> = [];

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => {
        const filename = path.basename(row.source_path);
        try {
          const res = await classifyArtifactFromFilename(filename, { catalog });
          return { row, filename, result: res, error: null as string | null };
        } catch (error) {
          return {
            row,
            filename,
            result: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
    for (const { row, filename, result, error } of results) {
      if (error || !result) {
        noPrediction += 1;
        const flag = "ERROR";
        console.log(`${flag}  ${filename}  → ${error ?? "no result"}`);
        continue;
      }
      const predicted = result.artifact;
      const expected = row.documentation_artifact.trim();
      const isMatch =
        predicted !== null && predicted.trim().toLowerCase() === expected.toLowerCase();
      if (isMatch) {
        matched += 1;
        console.log(`PASS  ${filename}  → ${predicted} (${result.confidence})`);
      } else if (predicted === null) {
        noPrediction += 1;
        misses.push({ filename, expected, predicted: null, reasoning: result.reasoning });
        console.log(`NOMATCH  ${filename}  expected "${expected}"`);
      } else {
        missed += 1;
        misses.push({ filename, expected, predicted, reasoning: result.reasoning });
        console.log(
          `FAIL  ${filename}  expected "${expected}" got "${predicted}" (${result.confidence})`
        );
      }
    }
  }

  const total = rows.length;
  const accuracy = total > 0 ? matched / total : 0;
  console.log("\n=== Summary ===");
  console.log(`Total:         ${total}`);
  console.log(`Exact match:   ${matched}`);
  console.log(`Wrong pick:    ${missed}`);
  console.log(`No prediction: ${noPrediction}`);
  console.log(`Accuracy:      ${(accuracy * 100).toFixed(1)}%`);

  if (misses.length > 0) {
    console.log("\n=== Miss details ===");
    for (const m of misses.slice(0, 20)) {
      console.log(`- ${m.filename}`);
      console.log(`    expected:  ${m.expected}`);
      console.log(`    predicted: ${m.predicted ?? "(none)"}`);
      console.log(`    reasoning: ${m.reasoning}`);
    }
  }

  if (accuracy < ACCURACY_FLOOR) {
    console.error(
      `\nAccuracy ${(accuracy * 100).toFixed(1)}% is below floor ${(ACCURACY_FLOOR * 100).toFixed(
        1
      )}%.`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Eval failed:", error);
  process.exit(1);
});
