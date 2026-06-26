import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse } from "csv-parse/sync";

import type { ArtifactCatalogEntry } from "@/lib/artifact-classifier/types";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const catalog: ArtifactCatalogEntry[] = [
  { artifact: "Incident Response Plan (IRP)", erlId: "E-IRO-01" },
  { artifact: "IRP Testing", erlId: "E-IRO-04" },
  { artifact: "IRP Training", erlId: "E-IRO-06" },
  { artifact: "IRP Updates", erlId: "E-IRO-07" },
  { artifact: "Root Cause Analysis (RCA)", erlId: "E-IRO-08" },
];

test("classifyArtifactFromFilename maps explicit IR plan filenames to E-IRO-01", async () => {
  const { classifyArtifactFromFilename } = await import("@/lib/artifact-classifier/classify");

  for (const filename of [
    "SEC-IR-001_Incident Response Plan.pdf",
    "Security IRP 2026.docx",
    "customer-ir-plan-v4.docx",
  ]) {
    const result = await classifyArtifactFromFilename(filename, { catalog });

    assert.equal(result.artifact, "Incident Response Plan (IRP)", filename);
    assert.equal(result.erlId, "E-IRO-01", filename);
    assert.equal(result.confidence, "high", filename);
  }
});

test("E-IRO-01 maps Incident Response Plan evidence to incident response controls", () => {
  const rows = parse(fs.readFileSync("data/evidence-request-list.csv", "utf8"), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;

  const row = rows.find((entry) => entry["ERL #"] === "E-IRO-01");

  assert.ok(row, "expected E-IRO-01 in evidence-request-list.csv");
  assert.equal(row["Documentation Artifact"], "Incident Response Plan (IRP)");
  assert.equal(row["Area of Focus"], "Incident Response");

  const mappedControls = new Set(row["SCF Control Mappings"].split(/\s+/).filter(Boolean));
  for (const controlId of ["IRO-01", "IRO-04", "IRO-10"]) {
    assert.ok(mappedControls.has(controlId), `expected ${controlId} mapping`);
  }
});
