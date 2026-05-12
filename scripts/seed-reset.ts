#!/usr/bin/env node
/**
 * seed-reset — wipe every scf_* table (and cascading customer rows) then
 * re-run the full seed pipeline. The standard "upgrade SCF version" path
 * once there's a vendored XLSX bump; also the public-repo onboarding flow.
 *
 * Reads connection details from .env.local (override with --env-file):
 *   DATABASE_URL                – Postgres URI; shelled to `psql -f`.
 *   NEXT_PUBLIC_SUPABASE_URL    – sanity-check the wipe target; the
 *                                 confirmation token is derived from its
 *                                 hostname so prod can't be wiped by typo.
 *   SUPABASE_SERVICE_ROLE_KEY   – passed through to `pnpm seed` /
 *                                 `pnpm seed:verify` subprocesses.
 *
 * Flags:
 *   --env-file <path>   defaults to ".env.local"
 *   --yes               skip the typed confirmation (unattended runs)
 *   --dry-run           print the plan and exit; no writes
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadDotenv } from "dotenv";

export interface Config {
  envFile: string;
  yes: boolean;
  dryRun: boolean;
}

export function parseConfig(argv: string[]): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      "env-file": { type: "string", default: ".env.local" },
      yes: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    envFile: values["env-file"] ?? ".env.local",
    yes: values.yes ?? false,
    dryRun: values["dry-run"] ?? false,
  };
}

export function validateEnv(env: Record<string, string | undefined>): {
  databaseUrl: string;
  supabaseUrl: string;
  serviceKey: string;
} {
  const databaseUrl = env.DATABASE_URL;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl) throw new Error("seed-reset: missing DATABASE_URL.");
  if (!supabaseUrl) throw new Error("seed-reset: missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceKey) throw new Error("seed-reset: missing SUPABASE_SERVICE_ROLE_KEY.");
  return { databaseUrl, supabaseUrl, serviceKey };
}

export function expectedConfirmationToken(supabaseUrl: string): string {
  const { hostname } = new URL(supabaseUrl);
  return `wipe ${hostname}`;
}

export function matchesConfirmationToken(input: string, supabaseUrl: string): boolean {
  return input.trim() === expectedConfirmationToken(supabaseUrl);
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROD_PROJECT_REF = "gbnxwsntyzyrpwmjaaqa";

function runChild(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: "inherit", env });
    child.on("error", rejectP);
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const config = parseConfig(process.argv.slice(2));
  const envPath = resolve(REPO_ROOT, config.envFile);
  if (!existsSync(envPath)) {
    throw new Error(`seed-reset: env file not found: ${envPath}`);
  }
  loadDotenv({ path: envPath, override: true });

  const { databaseUrl, supabaseUrl, serviceKey } = validateEnv(process.env);
  const { hostname } = new URL(supabaseUrl);
  const targetingProd = supabaseUrl.includes(PROD_PROJECT_REF);

  console.log("seed-reset plan");
  console.log(`  env file:           ${config.envFile}`);
  console.log(`  supabase host:      ${hostname}`);
  console.log(`  targeting prod:     ${targetingProd ? "YES — DESTRUCTIVE" : "no (sandbox)"}`);
  console.log(`  wipe via:           psql -f scripts/wipe-scf-data.sql`);
  console.log(`  then:               pnpm seed && pnpm seed:verify`);

  if (config.dryRun) {
    console.log("\nseed-reset: --dry-run, exiting before any writes.");
    return;
  }

  if (!config.yes) {
    if (!input.isTTY) {
      throw new Error(
        "seed-reset: stdin is not a TTY. Re-run with --yes for unattended execution."
      );
    }
    const expected = expectedConfirmationToken(supabaseUrl);
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      `\nThis will TRUNCATE every scf_* table on ${hostname} (and any\n` +
        `customer rows that FK into them). To proceed, type:\n\n  ${expected}\n\n> `
    );
    rl.close();
    if (!matchesConfirmationToken(answer, supabaseUrl)) {
      throw new Error("seed-reset: confirmation did not match. Aborting.");
    }
  }

  if (targetingProd) {
    console.log("\nseed-reset: ⚠ targeting production. Take a Supabase point-in-time");
    console.log("snapshot now if you haven't already. Continuing in 5 s…");
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("\nseed-reset: wiping via psql…");
  // Pass DATABASE_URL via env (PGURL is not standard; psql reads positional
  // connection string OR the PG* family). Use stdin-less invocation with
  // the URI inline — psql accepts a libpq URI as its first positional.
  // We don't echo it; only the SQL file path is logged.
  await runChild("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", "scripts/wipe-scf-data.sql"]);

  console.log("\nseed-reset: re-running pnpm seed…");
  await runChild("pnpm", ["seed"], {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    ...(targetingProd ? { ALLOW_PROD_SEED: "1" } : {}),
  });

  console.log("\nseed-reset: running pnpm seed:verify…");
  await runChild("pnpm", ["seed:verify"], {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  });

  console.log("\nseed-reset: ✓ wipe + reseed + verify complete.");
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/seed-reset.ts") ||
  process.argv[1]?.endsWith("/seed-reset.js");

if (isMain) {
  main().catch((err) => {
    console.error("\nseed-reset: ✗", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
