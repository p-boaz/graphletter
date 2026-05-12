#!/usr/bin/env node
/**
 * Seeds the 4 graphletter-authored scf_control_integrations fixtures.
 * Skips rows whose scf_control_id is not yet present in scf_controls (FK safety),
 * matching the pattern in seed-control-evidence-mappings. Idempotent via upsert
 * on the deterministic UUID primary key.
 *
 * Run AFTER the SCF core seed (which populates scf_controls).
 */
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SCIRow {
  id: string;
  scf_control_id: string;
  provider_id: string;
  service_name: string;
  check_type: string;
  validation_rules: Record<string, unknown>;
  priority: number;
  is_active: boolean;
}

export interface SCISeedSummary {
  inserted: number;
  skipped: number;
}

export const SCI_FIXTURES: ReadonlyArray<SCIRow> = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    scf_control_id: "AAT-02",
    provider_id: "github",
    service_name: "GitHub",
    check_type: "mfa_enforced",
    validation_rules: { endpoint: "/orgs/{org}", field: "two_factor_requirement_enabled" },
    priority: 100,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    scf_control_id: "AAT-02",
    provider_id: "aws",
    service_name: "AWS IAM",
    check_type: "mfa_enforced",
    validation_rules: { action: "iam:GetAccountSummary", field: "AccountMFAEnabled" },
    priority: 100,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    scf_control_id: "CHG-04",
    provider_id: "github",
    service_name: "GitHub",
    check_type: "branch_protection",
    validation_rules: { endpoint: "/repos/{owner}/{repo}/branches/{branch}/protection" },
    priority: 100,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    scf_control_id: "CFG-02",
    provider_id: "aws",
    service_name: "AWS Config",
    check_type: "config_recorder",
    validation_rules: { action: "config:DescribeConfigurationRecorders" },
    priority: 100,
    is_active: true,
  },
];

export async function seedScfControlIntegrations(
  supabase: SupabaseClient
): Promise<SCISeedSummary> {
  const { data: controls, error: cError } = await supabase.from("scf_controls").select("id");
  if (cError) throw new Error(`seed-sci: read controls failed: ${cError.message}`);

  const validControlIds = new Set((controls ?? []).map((c: { id: string }) => c.id));

  const eligible = SCI_FIXTURES.filter((row) => validControlIds.has(row.scf_control_id));
  const skipped = SCI_FIXTURES.length - eligible.length;

  if (eligible.length === 0) return { inserted: 0, skipped };

  const { error: upError } = await supabase
    .from("scf_control_integrations")
    .upsert(eligible, { onConflict: "id" });
  if (upError) throw new Error(`seed-sci: upsert failed: ${upError.message}`);

  return { inserted: eligible.length, skipped };
}

async function runCli(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const summary = await seedScfControlIntegrations(supabase);
  console.log(`seed-sci: inserted ${summary.inserted} rows, skipped ${summary.skipped}`);
}

const isCli =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
