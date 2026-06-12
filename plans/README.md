# Implementation Plans

This directory holds the repo's task specs (`task-YYYY-MM-DD-<slug>.md`, per
AGENTS.md). The table below indexes the **advisor-generated plans from the
2026-06-11 codebase audit** (improve skill, planned at commit `ea65d95`).
Executors: read the plan fully before starting, honor its STOP conditions,
get the Approval Gate signed off before implementing, and update your status
row when done.

Selection note: this audit ran non-interactively, so per the skill's default
the top 5 findings by leverage were planned. The full findings table and the
rejected findings are recorded below so nothing gets re-audited from scratch.

## Execution order & status (2026-06-11 audit)

| #   | Plan file                                          | Title                                                | Priority | Effort | Depends on | Status                                                                |
| --- | -------------------------------------------------- | ---------------------------------------------------- | -------- | ------ | ---------- | --------------------------------------------------------------------- |
| 001 | `task-2026-06-11-paginate-compliance-reads.md`     | Paginate compliance reads past 1000-row cap          | P1       | M      | —          | DONE (merged to main `37d931e`, 2026-06-11)                           |
| 002 | `task-2026-06-11-sanitize-api-error-responses.md`  | Stop leaking internal error details in API responses | P1       | M      | —          | DONE (merged to main `26b6d22`, 2026-06-11; 2 review revision rounds) |
| 003 | `task-2026-06-11-structured-logging-api-routes.md` | console.\* → createLogger in app/api + lib, enforced | P2       | M      | 002        | DONE (merged to main `4056e23`, 2026-06-11)                           |
| 004 | `task-2026-06-11-dashboard-framework-counts.md`    | Batch dashboard framework counts (N+1) + pagination  | P2       | M      | 001        | DONE (merged to main `0b3ceb8`, 2026-06-12)                           |
| 005 | `task-2026-06-11-durable-progress-tracking.md`     | DB-backed progress sessions across serverless        | P2       | L      | —          | DONE (merged to main `03f3c4e`, 2026-06-12; 1 review revision)        |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) |
REJECTED (one-line rationale).

## Dependency notes

- 003 depends on 002: the error-response sweep rewrites many of the same
  `console.error` lines; doing 002 first avoids double-touching files.
- 004 depends on 001: it reuses `lib/database/paged-select.ts` created there.
- 001, 002, 005 are mutually independent and can run in parallel branches.

## Audited but not planned this round (backlog, by leverage)

- **Test baseline for the AI assessment pipeline** (`lib/ai/assessment-engine.ts`,
  `lib/compliance/posture-scorer.ts`, `inbox-generator.ts`,
  `guidance-generator.ts` have zero tests; `app/api/` has zero route-level
  tests). Highest long-term leverage in the audit, but L-effort each and
  needs a human decision on mocking strategy for the Vercel AI SDK.
  Recommended as the headline of the next planning round.
- **Assessment POST swallows secondary-write failures**
  (`app/api/assessments/route.ts:241–273` — evidence link + assignment insert
  failures are `console.warn`'d and the response still says success). Real;
  S/M fix (report partial status or fail hard).
- **Demo quota is per-instance in-memory** (`lib/demo/demo-quota.ts`,
  limitation documented in its header) — quota multiplies by instance count
  on the unauthenticated `/try` AI endpoint. Fix pattern = plan 005's table.
- **xlsx installed from CDN tarball** (`package.json:100`) — outside npm
  audit/provenance tooling. Decide: npm-registry version or document the
  SheetJS licensing rationale inline.
- **Upload validation is MIME/size only** (`lib/services/evidence/upload-utils.ts:18–39`)
  — no magic-byte check before files hit pdf-parse/mammoth/tesseract.
- **Dead code sweep**: `components/ui/chart.tsx` (sole importer of the
  `recharts` dependency, itself unimported) and `components/coverage-heatmap.tsx`
  have no consumers. A knip audit (2026-05-09) found ~57 unused files.
- **AI keyword-fallback responses indistinguishable from AI success** for
  monitoring (`app/api/ai/custom-control-mapping/route.ts:256+`) — response
  text mentions the fallback but there's no structured `method` field.
- **`request.json().catch(() => ({}))`** treats malformed bodies as valid
  empty requests (e.g. `app/api/analysis/run-gap-analysis/route.ts:99`,
  triggering an expensive whole-framework run) — fold into a validation pass.
- **Tailwind v3 → v4 migration** — deliberate "not now": M effort, MED risk
  across all shadcn/ui components, no current cost beyond staying one major
  behind.

## Direction options (maintainer's call — grounded in repo evidence, not ranked against bugs)

- **Wire assessment export to the UI.** `lib/assessments/export.ts`
  (CSV/JSON serializers, fully tested) has zero callers outside its tests;
  the 2026-06-04 task spec explicitly deferred the UI. One API route + a
  download button finishes a feature that's 50% shipped.
- **Bulk import as the export counterpart.** Export just shipped; there is no
  import path (no `/api/evidence/import-bulk` or assessment-results import).
  Compliance teams live in spreadsheets — the asymmetry is the product gap.
- **Surface or fold in the `enhanced` API.** `app/api/enhanced/search` is
  consumed by `FrameworkCrosswalk` (dashboard/frameworks page) but its other
  actions (heatmap, analytics) have a dead component
  (`coverage-heatmap.tsx`) as their only would-be consumer. Either ship the
  heatmap on the dashboard or prune the unused actions.
- **Evidence approval workflow UI.** Approve/reject endpoints exist
  (`app/api/evidence/[id]/approve|reject`) with no UI that calls them
  (MED confidence — verify before investing).

## Findings considered and rejected (do not re-audit)

- _Assignments IDOR / user enumeration_ (`app/api/assessments/assignments/route.ts`):
  rejected — the `.or(assigned_to.eq.user,assigned_by.eq.user)` scope at
  line 45 is applied unconditionally; extra query params only narrow within
  the user's own rows (PostgREST ANDs the filters).
- _`USING (true)` RLS policies on `erl_guidance_cache` /
  `scf_control_evidence_mappings`_: by design — migration
  `20260512160000_advisor_rls_hardening.sql` documents these as public
  reference data read by user-session clients.
- _Race condition in `progressTracker.subscribe`_: impossible — the
  check-then-add is synchronous on a single-threaded event loop.
- _"Unbounded cleanup timers" in progress-tracker_: misread — cleanup
  timeouts are scheduled only on complete/error, not per update. (The module
  is being replaced by plan 005 anyway.)
- _Service-role client in `try-it-out/demo` route_: by design — key stays
  server-side; reads public SCF reference data.
- _pnpm audit moderates (postcss/ws/yaml/etc.)_: below the repo's CI bar
  (`pnpm audit --audit-level=high` gates CI); dev-chain noise floor.
- _Legacy redirect pages `app/try-it-out/page.tsx`, `app/how-it-works/page.tsx`_:
  idiomatic Next `redirect()` stubs preserving old URLs — keep.
- _Assessment status check-then-act race_ (`app/api/assessments/route.ts:324–346`):
  real pattern but ownership is re-checked and the write is user-scoped;
  optimistic locking isn't worth the complexity at current concurrency.
