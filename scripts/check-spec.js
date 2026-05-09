#!/usr/bin/env node

const { execSync } = require("node:child_process");

function run(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function lines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isNonImplementationFile(file) {
  return (
    file.startsWith("plans/") ||
    file.startsWith("docs/") ||
    file.startsWith("test-docs/") ||
    file.startsWith(".logs/") ||
    file.endsWith(".md") ||
    file.endsWith(".mdx")
  );
}

if (process.env.SKIP_SPEC_CHECK === "1") {
  console.log("check:spec skipped (SKIP_SPEC_CHECK=1)");
  process.exit(0);
}

if (run("git rev-parse --is-inside-work-tree") !== "true") {
  console.log("check:spec skipped (not a git repository)");
  process.exit(0);
}

const trackedChanges = lines(run("git diff --name-only HEAD"));
const untrackedChanges = lines(run("git ls-files --others --exclude-standard"));
const changedFiles = [...new Set([...trackedChanges, ...untrackedChanges])].filter(
  (file) => !file.startsWith("node_modules/") && !file.startsWith(".next/")
);

if (changedFiles.length === 0) {
  console.log("check:spec passed (no changes detected)");
  process.exit(0);
}

const implementationFiles = changedFiles.filter((file) => !isNonImplementationFile(file));

if (implementationFiles.length === 0) {
  console.log("check:spec passed (docs/plans-only changes)");
  process.exit(0);
}

const hasTaskSpecUpdate = changedFiles.some((file) => /^plans\/task-[^/]+\.md$/i.test(file));

if (!hasTaskSpecUpdate) {
  console.error("check:spec failed");
  console.error("");
  console.error("Implementation files changed without a task spec update:");
  for (const file of implementationFiles) {
    console.error(`- ${file}`);
  }
  console.error("");
  console.error("Add or update a task spec file:");
  console.error("- plans/task-<date>-<short-name>.md");
  console.error("- Start from plans/task-template.md");
  console.error("");
  console.error("To bypass once: SKIP_SPEC_CHECK=1 pnpm check:spec");
  process.exit(1);
}

console.log("check:spec passed");
