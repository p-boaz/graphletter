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
    upsert: (rows: unknown, options: unknown) => {
      calls.push({ table, method: "upsert", args: [rows, options] });
      return Promise.resolve({ data: null, error: null });
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
    version: "2026.2",
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
      version: "2026.2",
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

  // The four version-filtered cleanup deletes. scf_domains intentionally skipped:
  // it uses upsert (the baseline migration pre-seeds FK-referenced rows that
  // can't be safely deleted).
  assert.ok(tables.includes("scf_frameworks.delete.eq"));
  assert.ok(tables.includes("scf_controls.delete.eq"));
  assert.ok(tables.includes("scf_principles.delete.eq"));
  assert.ok(tables.includes("scf_authoritative_sources.delete.eq"));
  assert.ok(!tables.includes("scf_domains.delete.eq"), "scf_domains must not be deleted");

  // The three insert tables + scf_domains upsert.
  assert.ok(tables.includes("scf_principles.insert"));
  assert.ok(tables.includes("scf_domains.upsert"));
  assert.ok(tables.includes("scf_authoritative_sources.insert"));
  assert.ok(tables.includes("scf_controls.insert"));

  // scf_domains MUST be upserted before scf_principles is inserted: on a
  // freshly-wiped DB the baseline-seeded domain rows are gone, and
  // scf_principles.domain_code has a FK to scf_domains.id in prod
  // (drift from the local baseline schema, but the FK is real). Inserting
  // principles first triggers a 23503 FK violation. Surfaced by the
  // first attempt to run `pnpm seed:reset` against prod
  // (gbnxwsntyzyrpwmjaaqa) on 2026-05-12.
  const domainsUpsertIdx = tables.indexOf("scf_domains.upsert");
  const principlesInsertIdx = tables.indexOf("scf_principles.insert");
  assert.ok(
    domainsUpsertIdx < principlesInsertIdx,
    "scf_domains.upsert must precede scf_principles.insert"
  );

  // Final status update.
  assert.ok(tables.includes("scf_imports.update.eq"));
});

test("writeParsedSCF surfaces cleanup-delete errors instead of swallowing them", async () => {
  const calls: Call[] = [];
  const failingSupabase: any = {
    from: (table: string) => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
      delete: () => ({
        eq: () => {
          calls.push({ table, method: "delete.eq", args: [] });
          // First delete (scf_frameworks) returns an FK-style error so the
          // writer must throw rather than continuing to insert.
          if (table === "scf_frameworks") {
            return Promise.resolve({
              data: null,
              error: { message: "update or delete on ... violates foreign key constraint" },
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        in: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };

  await assert.rejects(
    () =>
      writeParsedSCF(
        failingSupabase,
        fixtureParseResult,
        undefined,
        "11111111-1111-1111-1111-111111111111"
      ),
    /Cleanup delete on scf_frameworks failed/
  );

  // No insert call should have been attempted after the failed cleanup.
  assert.ok(
    !calls.some((c) => c.method === "insert"),
    "writer must abort before any insert when cleanup fails"
  );
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
  assert.equal(row.scf_version, "2026.2");
});

test("writeParsedSCF derives scf_domains.control_count from parsed controls, not the hardcoded 0", async () => {
  const { supabase, calls } = makeMockSupabase();
  // The Domains-and-Principles parse path hardcodes controlCount: 0 (that 0
  // was what every prod domain carried until 2026-07). The writer must
  // override it with a count derived from the controls actually parsed.
  const parseResult: SCFImportResult = {
    ...fixtureParseResult,
    controls: [
      { ...(fixtureParseResult.controls[0] as any), id: "ACC-01" },
      { ...(fixtureParseResult.controls[0] as any), id: "ACC-02" },
    ],
    domains: [{ ...(fixtureParseResult.domains[0] as any), id: "ACC", controlCount: 0 }],
  };

  await writeParsedSCF(supabase, parseResult, undefined, "11111111-1111-1111-1111-111111111111");

  const domainsUpsert = calls.find((c) => c.table === "scf_domains" && c.method === "upsert");
  assert.ok(domainsUpsert, "scf_domains.upsert call must exist");
  const rows = domainsUpsert!.args[0] as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "ACC");
  assert.equal(rows[0].control_count, 2, "control_count must be derived from parsed controls");
});
