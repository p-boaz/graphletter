#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const FILENAME_REGEX = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const args = process.argv.slice(2);
const asJson = args.includes("--json");

function print(result) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (result.status === "ok") {
    console.log(`OK: ${result.message}`);
    return;
  }

  console.error(`ERROR: ${result.message}`);
  for (const detail of result.details || []) {
    console.error(`  - ${detail}`);
  }
}

if (!fs.existsSync(MIGRATIONS_DIR)) {
  const result = {
    status: "error",
    message: "supabase/migrations directory does not exist",
    details: [path.relative(ROOT, MIGRATIONS_DIR)],
  };
  print(result);
  process.exit(1);
}

const files = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const issues = [];
const timestamps = [];

for (const filename of files) {
  const match = filename.match(FILENAME_REGEX);
  if (!match) {
    issues.push(
      `${filename} must match YYYYMMDDHHMMSS_description.sql (description in snake_case)`
    );
    continue;
  }
  timestamps.push({
    filename,
    value: Number(match[1]),
    raw: match[1],
  });
}

for (let i = 1; i < timestamps.length; i += 1) {
  const prev = timestamps[i - 1];
  const current = timestamps[i];
  if (current.value <= prev.value) {
    issues.push(
      `non-monotonic timestamp sequence: ${current.filename} must be after ${prev.filename}`
    );
  }
  if (current.raw === prev.raw) {
    issues.push(`duplicate migration timestamp: ${current.raw}`);
  }
}

if (issues.length > 0) {
  const result = {
    status: "error",
    message: `${issues.length} migration naming/order violation(s)`,
    details: issues,
  };
  print(result);
  process.exit(1);
}

const result = {
  status: "ok",
  message: `${files.length} migration files match naming convention and monotonic timestamp ordering`,
  details: [],
};
print(result);
