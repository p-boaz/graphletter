#!/usr/bin/env node

/**
 * Copy-jargon gate for user-facing surfaces.
 *
 * The 2026-07-04 de-jargon sweep (plans/archive/task-2026-07-04-copy-dejargon.md)
 * established a copy standard for compliance-professional readers: GRC
 * vocabulary stays, engineering vocabulary goes. This checker keeps that
 * standard enforced — CI fails any change that reintroduces a banned term in
 * user-facing code.
 *
 * Scope: app/ (excluding app/api/), components/, lib/content/,
 * lib/how-it-works/. lib/research/ is deliberately out of scope (the research
 * page is addressed to the technically curious).
 *
 * Allowlist: content that renders only inside the docs "Under the Hood"
 * section may keep its technical vocabulary. Entries are per-file AND
 * per-term, so new files and new terms never inherit an exemption.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "..");

const SCAN_DIRS = ["app", "components", "lib/content", "lib/how-it-works"];
const EXCLUDED_DIR_PREFIXES = ["app/api"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

const BANNED_TERMS = [
  { name: "evidence atom(s)", pattern: /evidence atoms?/i },
  { name: "graph-native", pattern: /graph-native/i },
  { name: "SCF normalization", pattern: /scf normalization/i },
  { name: "mapping polarity", pattern: /mapping polarity/i },
  { name: "AI model name", pattern: /\bgpt-\d|claude-(?:sonnet|opus|haiku|fable|\d)/i },
  { name: "documentation artifact-based", pattern: /documentation artifact-based/i },
  { name: "ERL documentation", pattern: /erl documentation/i },
];

// file (repo-relative, posix) -> terms allowed there. Under-the-Hood-only content.
const ALLOWLIST = {
  "lib/content/compliance-explainer.ts": new Set(["evidence atom(s)", "mapping polarity"]),
  "app/docs/page.tsx": new Set(["evidence atom(s)"]),
};

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function isExcluded(relative) {
  return EXCLUDED_DIR_PREFIXES.some(
    (prefix) => relative === prefix || relative.startsWith(`${prefix}/`)
  );
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    if (isExcluded(relative)) continue;

    const allowedTerms = ALLOWLIST[relative] ?? new Set();
    const content = fs.readFileSync(file, "utf8");
    const fileLines = content.split(/\r?\n/);

    fileLines.forEach((line, index) => {
      for (const term of BANNED_TERMS) {
        if (allowedTerms.has(term.name)) continue;
        if (term.pattern.test(line)) {
          violations.push({ file: relative, line: index + 1, term: term.name });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error("check:copy failed — engineering jargon in user-facing copy:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — banned term: ${v.term}`);
  }
  console.error("\nUser-facing copy targets compliance professionals: keep GRC vocabulary,");
  console.error("translate engineering vocabulary (or move it to the docs Under the Hood");
  console.error(
    "section and allowlist it here). Standard: plans/archive/task-2026-07-04-copy-dejargon.md"
  );
  process.exit(1);
}

console.log("check:copy passed — no banned jargon in user-facing surfaces");
