import test from "node:test";
import assert from "node:assert/strict";
import { writeParsedSCF } from "./writer";
import type { SCFImportResult } from "../scf-types";

type Call = { table: string; method: string; args: unknown[] };

function makeMockSupabase(): { supabase: any; calls: Call[] } {
  const calls: Call[] = [];
  const builder = (table: string): any => ({
    // .from(table).select(cols).eq(col, val) — must chain, not resolve early.
    select: (...selectArgs: unknown[]) => {
      calls.push({ table, method: "select", args: selectArgs });
      const selectChain = {
        eq: (...a: unknown[]) => {
          calls.push({ table, method: "select.eq", args: a });
          // Terminal: returns rows for the framework lookup. Empty so the
          // writer skips the scf_control_mappings.delete.in branch.
          return Promise.resolve({ data: [], error: null });
        },
      };
      return selectChain;
    },
    delete: () => ({
      eq: (...a: unknown[]) => {
        calls.push({ table, method: "delete.eq", args: a });
        return Promise.resolve({ data: null, error: null });
      },
      in: (...a: unknown[]) => {
        calls.push({ table, method: "delete.in", args: a });
        return Promise.resolve({ data: null, error: null });
      },
    }),
    insert: (rows: unknown) => {
      calls.push({ table, method: "insert", args: [rows] });
      return {
        // For `.insert(...).select()` on scf_frameworks.
        select: () => Promise.resolve({ data: Array.isArray(rows) ? rows : [rows], error: null }),
        // For bare `await supabase.from(t).insert(...)`.
        then: (resolve: (v: { data: null; error: null }) => unknown) =>
          resolve({ data: null, error: null }),
      };
    },
    update: (patch: unknown) => ({
      eq: (...a: unknown[]) => {
        calls.push({ table, method: "update.eq", args: [patch, ...a] });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });
  return {
    supabase: { from: (table: string) => builder(table) },
    calls,
  };
}

const fixtureParseResult: SCFImportResult = {
  success: true,
  summary: {
    totalControls: 1,
    totalDomains: 1,
    totalFrameworks: 0,
    totalMappings: 0,
    totalPrinciples: 1,
    totalAuthoritativeSources: 1,
    version: "2026.1.1",
  },
  controls: [
    {
      id: "ACC-01",
      title: "Access Control",
      description: "Mechanisms exist...",
      domain: "Access Control",
      principle: "Need-to-know",
      controlQuestions: "Q?",
      organizationGuidance: { micro: "m", small: "s", medium: "M", large: "L", enterprise: "E" },
      applicability: { people: true, process: true, technology: true, governance: false },
      riskIds: ["R-AC-1"],
      threatIds: ["T-AC-1"],
      assessmentObjectives: ["AO-1"],
      evidenceRequests: ["E-AC-1"],
    } as any,
  ],
  domains: [
    {
      id: "ACC",
      name: "Access Control",
      description: "...",
      principles: ["Need-to-know"],
      principleIntent: "Limit access",
      controlCount: 1,
    } as any,
  ],
  frameworks: [],
  principles: [
    {
      number: 1,
      domainCode: "ACC",
      domainName: "Access Control",
      principleName: "Need-to-know",
      principleIntent: "Limit access",
    } as any,
  ],
  authoritativeSources: [
    {
      geography: "US",
      mappingColumnHeader: "NIST 800-53 R5",
      sourceOrganization: "NIST",
      authoritativeSource: "SP 800-53 R5",
      strmUrl: "",
      sourceUrl: "https://nist.gov",
      version: "2026.1.1",
    } as any,
  ],
  risks: [],
  threats: [],
  errors: [],
  warnings: [],
};

test("writeParsedSCF deletes by version then inserts principles, domains, sources, controls", async () => {
  const { supabase, calls } = makeMockSupabase();
  await writeParsedSCF(
    supabase,
    fixtureParseResult,
    undefined,
    "11111111-1111-1111-1111-111111111111"
  );

  const tables = calls.map((c) => `${c.table}.${c.method}`);

  // Cleanup happens before any insert.
  const firstInsertIdx = tables.findIndex((t) => t.endsWith(".insert"));
  const lastDeleteIdx = tables.findLastIndex((t) => t.startsWith("scf_") && t.includes("delete"));
  assert.ok(firstInsertIdx > lastDeleteIdx, "all deletes must precede first insert");

  // The five cleanup deletes by scf_version.
  assert.ok(tables.includes("scf_frameworks.delete.eq"));
  assert.ok(tables.includes("scf_controls.delete.eq"));
  assert.ok(tables.includes("scf_domains.delete.eq"));
  assert.ok(tables.includes("scf_principles.delete.eq"));
  assert.ok(tables.includes("scf_authoritative_sources.delete.eq"));

  // The four upstream-extract insert tables.
  assert.ok(tables.includes("scf_principles.insert"));
  assert.ok(tables.includes("scf_domains.insert"));
  assert.ok(tables.includes("scf_authoritative_sources.insert"));
  assert.ok(tables.includes("scf_controls.insert"));

  // Final status update.
  assert.ok(tables.includes("scf_imports.update.eq"));
});

test("writeParsedSCF maps camelCase parseResult fields to snake_case DB columns on controls", async () => {
  const { supabase, calls } = makeMockSupabase();
  await writeParsedSCF(
    supabase,
    fixtureParseResult,
    undefined,
    "11111111-1111-1111-1111-111111111111"
  );

  const controlsInsert = calls.find((c) => c.table === "scf_controls" && c.method === "insert");
  assert.ok(controlsInsert, "scf_controls.insert call must exist");
  const rows = controlsInsert!.args[0] as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.id, "ACC-01");
  assert.equal(row.domain_id, "ACC"); // derived from regex on id, not from .domain string
  assert.equal(row.guidance_micro, "m");
  assert.equal(row.applies_to_governance, false);
  assert.deepEqual(row.risk_ids, ["R-AC-1"]);
  assert.deepEqual(row.assessment_objectives, ["AO-1"]);
  assert.equal(row.scf_version, "2026.1.1");
});
