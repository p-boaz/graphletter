import test from "node:test";
import assert from "node:assert/strict";
import {
  parseConfig,
  validateEnv,
  expectedConfirmationToken,
  matchesConfirmationToken,
} from "../../scripts/seed-reset";

test("parseConfig: defaults are .env.local, --yes false, --dry-run false", () => {
  const config = parseConfig([]);
  assert.equal(config.envFile, ".env.local");
  assert.equal(config.yes, false);
  assert.equal(config.dryRun, false);
});

test("parseConfig: --env-file overrides default", () => {
  const config = parseConfig(["--env-file", ".env.sandbox.local"]);
  assert.equal(config.envFile, ".env.sandbox.local");
});

test("parseConfig: --yes and --dry-run flip flags", () => {
  const config = parseConfig(["--yes", "--dry-run"]);
  assert.equal(config.yes, true);
  assert.equal(config.dryRun, true);
});

test("parseConfig: rejects unknown flags so typos can't silently no-op", () => {
  assert.throws(() => parseConfig(["--purge-everything"]), /unknown option/i);
});

test("validateEnv: throws when DATABASE_URL is missing", () => {
  assert.throws(
    () =>
      validateEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xyz",
      }),
    /DATABASE_URL/
  );
});

test("validateEnv: throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
  assert.throws(
    () =>
      validateEnv({
        DATABASE_URL: "postgresql://x@y/z",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xyz",
      }),
    /NEXT_PUBLIC_SUPABASE_URL/
  );
});

test("validateEnv: throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
  assert.throws(
    () =>
      validateEnv({
        DATABASE_URL: "postgresql://x@y/z",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      }),
    /SUPABASE_SERVICE_ROLE_KEY/
  );
});

test("validateEnv: returns all three values when present", () => {
  const result = validateEnv({
    DATABASE_URL: "postgresql://postgres:pw@db.example.com:5432/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xyz",
  });
  assert.equal(result.databaseUrl, "postgresql://postgres:pw@db.example.com:5432/postgres");
  assert.equal(result.supabaseUrl, "https://abc.supabase.co");
  assert.equal(result.serviceKey, "sb_secret_xyz");
});

test("expectedConfirmationToken: derives a wipe token from the project hostname", () => {
  const token = expectedConfirmationToken("https://abc123.supabase.co");
  assert.equal(token, "wipe abc123.supabase.co");
});

test("matchesConfirmationToken: returns true for an exact match", () => {
  const url = "https://gbnxwsntyzyrpwmjaaqa.supabase.co";
  assert.equal(matchesConfirmationToken("wipe gbnxwsntyzyrpwmjaaqa.supabase.co", url), true);
});

test("matchesConfirmationToken: returns false for a near miss", () => {
  const url = "https://gbnxwsntyzyrpwmjaaqa.supabase.co";
  assert.equal(matchesConfirmationToken("wipe wrong.supabase.co", url), false);
  assert.equal(matchesConfirmationToken("wipe", url), false);
  assert.equal(matchesConfirmationToken("", url), false);
});

test("matchesConfirmationToken: trims surrounding whitespace before comparing", () => {
  const url = "https://abc.supabase.co";
  assert.equal(matchesConfirmationToken("  wipe abc.supabase.co  ", url), true);
});
