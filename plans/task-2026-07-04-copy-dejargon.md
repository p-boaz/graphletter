# Task Spec: De-jargon user-facing copy for compliance professionals

## Metadata

- Date: 2026-07-04
- Owner: agent (Claude Code), approval: Peter
- Status: In Progress
- Branch: `copy/dejargon-sweep`
- Related issue/PR: —

## Goal

Rewrite user-facing copy across the site so a first-time visitor who is a compliance
professional (GRC manager, auditor) finds it simple, approachable, and clear on the
value-add. Governing rule: **keep her jargon, cut ours** — GRC vocabulary (controls,
gap analysis, maturity, crosswalk, evidence, auditor-ready) stays; engineering
vocabulary (graph, atoms, chunks, polarity, normalization, LLM/GPT-5, serverless,
RLS, DB table names, raw enums) gets translated or moved into a clearly labeled
"under the hood" section.

## Context Files

Commit 1 — product surfaces (jargon that lands mid-task): DONE (50cd033)

- [x] `components/smart-evidence-upload/assessment-progress-view.tsx`
- [x] `components/smart-evidence-upload/upload-form.tsx`
- [x] `app/reports/page.tsx`
- [x] `app/dashboard/compliance-posture/page.tsx`
- [x] `app/dashboard/compliance-inbox/page.tsx`
- [x] `app/dashboard/analytics/page.tsx`
- [x] `app/dashboard/frameworks/page.tsx`
- [x] `app/dashboard/evidence/page.tsx`
- [x] `app/dashboard/page.tsx`

Commit 2 — docs/explainer layer: DONE

- [x] `lib/content/compliance-explainer.ts`
- [x] `app/docs/page.tsx`
- [x] `components/how-it-works/pipeline-diagram.tsx`

Commit 3 — first impressions (marketing/meta):

- [ ] `app/layout.tsx`
- [ ] `app/page.tsx`
- [ ] `app/frameworks/page.tsx`
- [ ] `app/frameworks/[id]/page.tsx`
- [ ] `lib/content/framework-descriptions.ts`
- [ ] `app/security/page.tsx`
- [ ] `app/research/page.tsx`

Commit 4 — dead code and mock data:

- [ ] `components/dashboard-content.tsx` (delete)
- [ ] `components/try-it-out/scenario-runner.tsx` (delete)
- [ ] `app/assessments/page.tsx` (convert to redirect)

Plus: any Playwright specs under `playwright/tests/` that assert strings changed
above (updated in the same commit as the string they assert).

## Constraints

- Copy/string changes only — no behavior, routing (except the `app/assessments`
  redirect), schema, or styling changes.
- Each commit ≤ 15 files; four sequential commits as grouped above.
- `pnpm lint` + `pnpm typecheck` clean before every commit.
- Verified stats stay as-is: **79 frameworks / 1,468 controls / 34,619 mappings**
  (confirmed against live `scf_frameworks` / `scf_controls` /
  `scf_control_mappings` counts on 2026-07-04). Do not "correct" to 245 — that
  figure counts raw CSV source strings, not seeded frameworks.
- Tone models (do not touch, imitate): `components/dashboard/first-run-hero.tsx`,
  demo explainer box in `components/demo-smart-evidence-upload.tsx`,
  `app/not-found.tsx`, `version-dialog.tsx`, the `plainDefinition` /
  `resultGuidance` / `maturityLevels` entries in `compliance-explainer.ts`.

## Scope

### In scope

**Commit 1 — product surfaces.** Exact rewrites:

| File                                           | Before                                                                                                                                                                                                                                           | After                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessment-progress-view.tsx:83-89`           | "Graph extraction is limited for this upload… We could not extract reliable text for graph evidence atoms. AI assessment can still run, but graph-native coverage/report traceability may be reduced until a text-extractable file is uploaded." | "We couldn't reliably read the text in this file. The assessment can still run, but findings won't be traceable back to specific passages until you upload a text-readable version (for example, a PDF or Word file instead of a scanned image)." |
| `assessment-progress-view.tsx:92-93`           | `Reason: {graphExtractionSkipReason}` in monospace                                                                                                                                                                                               | Translate known skip-reason codes to plain sentences; drop the monospace styling. Unknown codes: omit the line.                                                                                                                                   |
| `upload-form.tsx:96`                           | "Documentation Artifact-Based Evidence Upload"                                                                                                                                                                                                   | "Upload evidence"                                                                                                                                                                                                                                 |
| `upload-form.tsx:342`                          | "Choose from ERL documentation artifacts"                                                                                                                                                                                                        | "Choose the type of document you're uploading"                                                                                                                                                                                                    |
| `upload-form.tsx:202-206`                      | "No documentation artifacts available. This usually means no active control mappings exist yet."                                                                                                                                                 | "No document types are available yet. Contact support if this persists."                                                                                                                                                                          |
| `upload-form.tsx:334`                          | "How Artifact-Based Upload Works:"                                                                                                                                                                                                               | "How this works:"                                                                                                                                                                                                                                 |
| `reports/page.tsx:113`                         | "Graph-native coverage rank ${rank}."                                                                                                                                                                                                            | Map rank → "Based on strong supporting evidence." / "Based on moderate supporting evidence." / "Based on weak supporting evidence." / "No supporting evidence found."                                                                             |
| `reports/page.tsx` type badge                  | raw enum rendered as "Graph_coverage"                                                                                                                                                                                                            | "Coverage"                                                                                                                                                                                                                                        |
| `compliance-posture/page.tsx:361-364`          | "Using equal weights (tier data unavailable)"                                                                                                                                                                                                    | "All security areas weighted equally"                                                                                                                                                                                                             |
| `compliance-posture/page.tsx:421-423, 494-496` | "Risk-weighted domain tiers… Critical domains (3x) impact the overall score more than standard domains (1x)."                                                                                                                                    | "Critical security areas count more toward your score than routine ones."                                                                                                                                                                         |
| `compliance-posture/page.tsx:451, 665`         | raw `domain_id` in monospace under domain names                                                                                                                                                                                                  | Remove the raw ID from the UI.                                                                                                                                                                                                                    |
| `compliance-inbox/page.tsx:227-228`            | "Cached until {time}"                                                                                                                                                                                                                            | "Next refresh at {time}"                                                                                                                                                                                                                          |
| `analytics/page.tsx:536-538`                   | "Evidence and assessment throughput with graph-aligned coverage metrics."                                                                                                                                                                        | "How much evidence you've processed and what it covers."                                                                                                                                                                                          |
| `analytics/page.tsx:618-619`                   | "…using the same coverage model as the Overview dashboard."                                                                                                                                                                                      | "…using the same coverage rules as the Overview dashboard."                                                                                                                                                                                       |
| `analytics/page.tsx:712-713`                   | "Generate audit-ready extracts from current graph and assessment data."                                                                                                                                                                          | "Export audit-ready reports from your current evidence and assessment results."                                                                                                                                                                   |
| `dashboard/frameworks/page.tsx:11-12`          | "Discover SCF controls, understand how they map across frameworks, and investigate crosswalk opportunities."                                                                                                                                     | "Browse the controls behind every framework and see how one piece of evidence crosswalks to many requirements."                                                                                                                                   |
| `dashboard/page.tsx:681`                       | "({n} mapping links)"                                                                                                                                                                                                                            | "({n} linked controls)"                                                                                                                                                                                                                           |
| `dashboard/page.tsx:432` (toast)               | "Failed to load graph-based compliance coverage"                                                                                                                                                                                                 | "Failed to load compliance coverage"                                                                                                                                                                                                              |
| `dashboard/evidence/page.tsx:537`              | "No evidence groups found"                                                                                                                                                                                                                       | "No evidence found"                                                                                                                                                                                                                               |
| `dashboard/evidence/page.tsx:636-637`          | "Preview CSV or JSON evidence inventory rows before creating records."                                                                                                                                                                           | "Preview the rows in your CSV or JSON file before importing."                                                                                                                                                                                     |

**Commit 2 — docs/explainer layer.** Restructure `/docs` into two labeled halves:

1. **"How it works"** (top, for compliance professionals): pipeline diagram with
   de-jargoned labels, six workflow steps rewritten in outcome language, plain
   glossary (`plainDefinition` entries), result states, maturity levels.
2. **"Under the hood"** (bottom, badged e.g. "For engineers and auditors who want
   to verify the mechanism"): graph pipeline stages with DB table names, decision
   rules, signal legend — content kept, but explicitly framed as internals.

String rewrites in `compliance-explainer.ts`:

| Before                                                                                                                                                  | After                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| workflowSteps `extract`: "…normalized into chunked content so evidence can be traced to source locations."                                              | "Graphletter reads your file and keeps track of where every statement came from, so findings can quote your document back to you."                           |
| workflowSteps `map`: "creates evidence atoms from chunks and maps those atoms to one or more SCF controls with mapping polarity and coverage strength." | "Graphletter breaks your document into individual claims and links each one to the controls it supports — so one policy can count toward many requirements." |
| workflowSteps `objectives`: "GPT-5 evaluates each SCF assessment objective…"                                                                            | "AI evaluates each assessment objective…" (model name moves to Under the hood)                                                                               |
| workflowSteps `aggregate`: "…using strongest support rank and contradiction rank…"                                                                      | "Each control is scored by the strength of its supporting evidence; any contradictory evidence flags it for review."                                         |
| workflowSteps `project`: "SCF control outcomes are projected across mapped frameworks…"                                                                 | "Results carry over automatically to every mapped framework — one set of evidence informs SOC 2, ISO 27001, NIST, and more."                                 |
| analysisLayers engine "AI reasoning (GPT-5)"                                                                                                            | "AI reasoning" (model named only in Under the hood)                                                                                                          |
| glossary term "Framework Mapping (SCF Normalization)"                                                                                                   | "One assessment, many frameworks"                                                                                                                            |
| glossary term "Evidence Request List (ERL) Artifact"                                                                                                    | "Document type (ERL artifact)" — expand ERL on first use                                                                                                     |
| graphDecisionRules `gapType` raw enums (`covered_by_strong_or_moderate_evidence`, `no_evidence_mapping`, …)                                             | Human labels ("Covered by strong or moderate evidence", "No evidence yet", …); raw enum may remain in Under the hood table                                   |

`pipeline-diagram.tsx`: "Extract / Text extracted; graph built when reliable" →
"Read / We read your document and index every statement"; "Map to SCF" →
"Match to controls"; "Graph scoring / Weak/moderate/strong support rolled up" →
"Score / Evidence strength rolled up per control".

**Commit 3 — first impressions.**

| File                                      | Before                                                                                                                                                                                                                    | After                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.tsx:12-13` (meta description)     | "Open compliance analysis engine that maps evidence against 79+ regulatory frameworks using SCF normalization and LLM-based assessment."                                                                                  | "Upload your policies and evidence — Graphletter checks them against SOC 2, ISO 27001, NIST, and 76 other frameworks, and shows exactly what passes, what's missing, and why."                                                                                                                                                                                          |
| `page.tsx:40-43` (hero subhead)           | "…reads it against 1,468 SCF controls and maps the outcome to 79 frameworks…"                                                                                                                                             | "…reads it against the Secure Controls Framework — a master catalog of 1,468 controls that crosswalks to SOC 2, ISO 27001, NIST, and 76 more — with AI reasoning quoted back to your source."                                                                                                                                                                           |
| `page.tsx:14-19` (stat labels)            | "Frameworks / Controls / Mappings / SCF Edition"                                                                                                                                                                          | "Frameworks covered / Controls checked / Cross-framework links / SCF edition"                                                                                                                                                                                                                                                                                           |
| `frameworks/page.tsx:88-92`               | "Graphletter normalizes compliance requirements through the Secure Controls Framework (SCF 2026.1.1). Each framework below is mapped to SCF controls, enabling cross-framework traceability from a single evidence base." | "Upload evidence once. Graphletter maps it to every framework below through the Secure Controls Framework, so a SOC 2 policy also counts toward ISO 27001, NIST, and more."                                                                                                                                                                                             |
| `frameworks/page.tsx:99-100`              | "{n} Frameworks indexed"                                                                                                                                                                                                  | "{n} frameworks covered"                                                                                                                                                                                                                                                                                                                                                |
| `frameworks/page.tsx:249`                 | "Framework data needs to be imported. Please contact your administrator."                                                                                                                                                 | "Framework data isn't available right now. Please try again later."                                                                                                                                                                                                                                                                                                     |
| `frameworks/[id]/page.tsx:136-139`        | "Use these to trace requirements back to SCF evidence and objective-level assessments."                                                                                                                                   | "Each mapping shows which SCF control satisfies this framework's requirement."                                                                                                                                                                                                                                                                                          |
| `frameworks/[id]/page.tsx:183-184`        | "…no associated control mappings in the indexed dataset."                                                                                                                                                                 | "…no control mappings yet."                                                                                                                                                                                                                                                                                                                                             |
| `framework-descriptions.ts:40` (fallback) | "${name} requirements normalized to SCF controls for consistent evidence assessment and cross-framework traceability."                                                                                                    | "${name} requirements, mapped to SCF controls so your evidence counts toward this framework automatically."                                                                                                                                                                                                                                                             |
| `framework-descriptions.ts`               | "ISMS", "PHI" unexpanded                                                                                                                                                                                                  | Expand on first use: "information security management system (ISMS)", "protected health information (PHI)".                                                                                                                                                                                                                                                             |
| `security/page.tsx`                       | "enforced at the database layer via Supabase RLS policies" / "processed in serverless functions" / "server-side auth guards verify the user on every protected route handler and server component"                        | Outcome-first with mechanism in parentheses: "Your organization's data is isolated from every other tenant at the database layer (Postgres row-level security)." / "Documents are processed in short-lived compute and not retained by AI providers — they receive only extracted text." / "Every protected page and API call re-verifies your identity on the server." |
| `research/page.tsx`                       | (page intro)                                                                                                                                                                                                              | Add one framing line: "This page documents open technical questions behind Graphletter. No compliance background needed elsewhere on the site — this one is for the technically curious." Leave topic cards as-is (research audience).                                                                                                                                  |

**Commit 4 — dead code and mock data.**

- Delete `components/dashboard-content.tsx` — unreferenced (verified 2026-07-04);
  contains "Authentication Test Successful" scaffold, raw user UUID, internal TODO
  roadmap.
- Delete `components/try-it-out/scenario-runner.tsx` — unreferenced (verified
  2026-07-04); jargon-heavy replay demo superseded by `/try`.
- `app/assessments/page.tsx` — currently renders hardcoded fake assessments
  (ast-001…ast-005, 2024 dates). Replace the page body with
  `redirect("/dashboard/assessments")`, matching the existing pattern of
  `/demo`, `/compliance`, `/how-it-works`, `/try-it-out`. Check
  `playwright/tests/` for specs targeting `/assessments` and update.

### Out of scope

- Any behavior, data, schema, or visual/styling change beyond the strings above.
- `app/scf-attribution/page.tsx` (required legal notice — density is appropriate).
- Admin pages (`app/admin/*`).
- README / AGENTS.md copy (repo-facing, different audience).
- Rewriting `research-topics.ts` card content (research audience is technical).
- The framework-count "correction" to 245 (resolved: 79 is correct).

## Implementation Plan

1. Branch `copy/dejargon-sweep` off `main`.
2. Commit 1: product-surface strings (9 files + affected Playwright specs).
   `grep` the exact old strings across `playwright/tests/` first; update
   assertions in the same commit.
3. Commit 2: docs/explainer restructure (3 files). Two-section layout in
   `app/docs/page.tsx`; string rewrites in `compliance-explainer.ts` and
   `pipeline-diagram.tsx`.
4. Commit 3: marketing/meta strings (7 files).
5. Commit 4: delete two dead components, convert `app/assessments/page.tsx` to a
   redirect, update any specs referencing them.
6. Full validation pass (below), then PR.

## Test Plan

- [ ] `pnpm lint` and `pnpm typecheck` clean after each commit.
- [ ] `grep -rn` for removed jargon strings ("evidence atoms", "graph-native",
      "SCF normalization", "GPT-5", "mapping polarity", "Graph-native coverage
      rank", "Documentation Artifact-Based") returns no hits in user-facing
      files (`app/` non-api, `components/`, `lib/content/`, `lib/how-it-works/`)
      except the clearly labeled "Under the hood" docs section.
- [ ] `pnpm test:ui:bg` full suite green (copy assertions updated).
- [ ] Dogfood in browser (per CLAUDE.md): load `/`, `/try` (run one demo),
      `/docs`, `/frameworks`, `/security`, `/dashboard` (first-run + populated),
      `/reports`, `/assessments` (redirects); confirm no console errors via
      `playwright/helpers/observability.ts`.
- [ ] Verify `/assessments` returns a redirect to `/dashboard/assessments`.

## Acceptance Criteria

- [ ] No user-facing surface outside the docs "Under the hood" section contains:
      DB table names, "evidence atoms", "chunks", "polarity", "graph-native",
      "normalization/normalized", "LLM", model names, raw enum strings, or
      "serverless/RLS/route handler" phrasing.
- [ ] SCF is defined in one clause at first mention on: landing hero,
      `/frameworks`, Framework Explorer, and the upload dialog.
- [ ] ERL, ISMS, PHI expanded at first use wherever shown.
- [ ] `components/dashboard-content.tsx` and
      `components/try-it-out/scenario-runner.tsx` no longer exist; build passes.
- [ ] `/assessments` no longer shows fabricated data.
- [ ] Hero/docs stats still read 79 / 1,468 / 34,619 and match the live DB.
- [ ] Full Playwright suite green twice consecutively (flake gate).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter, 2026-07-04)
