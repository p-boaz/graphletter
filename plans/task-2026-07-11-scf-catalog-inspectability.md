# Task Spec: Catalog inspectability — framework detail pagination, mapping search, tier coherence

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Done (implemented 2026-07-11; archive after merge)
- Branch: feat/scf-catalog-inspectability
- Related issue/PR: roadmap `plans/scf-catalog-roadmap.md` stage 5; builds on PRs #51/#52

## Goal

Make every framework inspectable at full catalog scale: the detail page's
first-20 mapping cutoff becomes server-side pagination with an honest
total/range, mappings are searchable by control identifier, and the detail
surface enforces the same visibility/exposure gates as the API — proven
against the largest framework (SOC 2, 1,478 mappings) and a preview framework
in the sandbox.

## Context Files

- [x] `app/frameworks/[id]/page.tsx` — server-side pagination (`?page=`), mapping search (`?q=`), "Showing X–Y of Z" range, prev/next links; visibility/exposure gating to match the API (direct DB query is currently ungated); hardcoded "Active" badge replaced by tier badge (Supported/Preview)
- [x] `app/api/scf/frameworks/[id]/route.ts` — mappings paginated (`?limit=` default 50 max 200, `?offset=`), `?q=` filter, response gains `total`/`limit`/`offset` (mappings array shape unchanged)
- [x] `playwright/helpers/selectors.ts` — testids for pagination controls, range label, search input, tier badge
- [x] `playwright/tests/public-pages.spec.ts` — detail-page assertions: range label honest, page-through works, search narrows, deep page loads
- [x] `lib/frameworks/format-version.ts` — read-only reference

## Constraints

- **No visual redesign** — same cards/grid; pagination controls and search
  follow existing page idiom (ft-\* classes, shadcn components).
- **State coherence** (2026-07-09 QA lesson): the detail page must never
  render a framework the list/API would hide. Gate = `exposure_status =
'public'` AND `visibility IN ('supported','preview')`, else `notFound()`.
  Badge must state the actual tier, not a hardcoded "Active".
- Pagination is server-side (`range()` + `count: "exact"`); the page never
  fetches more than one page of mappings. Page size 24 (2-col grid, 12 rows).
- Search filters on control identifiers (`framework_control_id`,
  `control_id`) server-side; no client-side full-list filtering.
- Invalid `?page`/`?q` degrade gracefully (clamp/ignore, never 500).
  Out-of-range page shows the empty state with the honest total.
- API `mappings` array shape unchanged for backward compatibility; new fields
  are additive.
- Production behavior for the current 66 frameworks changes only in that >24
  mappings now page instead of truncating at 20 — an improvement to the same
  surface, no copy/count changes elsewhere.

## Scope

### In scope

1. Detail-page pagination + search + honest range + tier badge + gating.
2. API route pagination/search mirroring the page's contract.
3. Playwright coverage: SOC 2 (largest, 1,478 mappings) — range label, deep
   page, search narrowing; 404 coherence for a non-public framework.
4. Sandbox proof: with the 249-framework catalog loaded, flip one preview
   framework to `exposure_status='public'` in the sandbox DB and verify its
   detail page renders paginated with a Preview badge — the stage-5
   "preview frameworks inspectable without loading complete mapping sets"
   criterion.

### Out of scope

- Catalog browsing/list UI for preview frameworks (needs stage-6 licensing
  outcomes to be non-empty publicly).
- Any `exposure_status` flips in committed overrides (stage 6).
- Cohort promotion (stage 7).
- Framework Explorer list-page changes.

## Implementation Plan

1. Rework `app/api/scf/frameworks/[id]/route.ts`: gated framework fetch (as
   is), mappings via `range(offset, offset+limit-1)` with `count: "exact"`,
   optional `q` → `or(framework_control_id.ilike.%q%,control_id.ilike.%q%)`;
   response `{ framework, mappings, total, limit, offset }`.
2. Rework the detail page: parse/clamp `page` + `q` from `searchParams`,
   same gated queries, render range label ("Showing 25–48 of 1,478"),
   prev/next links preserving `q`, search form (GET), tier badge from
   `visibility`.
3. Add selectors + Playwright assertions; run `pnpm test:ui:bg` on the spec.
4. Sandbox proof per In-scope 4 (local stack still has the catalog seed).
5. Gates: lint, typecheck, test:scf, test:integration, manifest:check.
6. Live proof post-merge: SOC 2 detail page in prod — page through, search,
   verify range totals match `total_mappings`.

## Sandbox proof (2026-07-11, local stack with 249-framework catalog)

Flipped `usa-federal-gsa-fedramp-5-mod` (US FedRAMP R5 moderate, 711
mappings — a stage-7 cohort candidate) to `exposure_status='public'` in the
sandbox DB, then reverted after proof:

- Detail page rendered with **Preview** tier badge and "Showing 1–24 of 711"
  — 24 mappings loaded, never the full set.
- API detail: `limit=999` clamped to 200; `?q=AC-2` narrowed to 28/711 with
  every row matching; `offset=99999` returned an empty page with the honest
  total (no PostgREST 416).
- Appeared in `?scope=catalog` list (67 rows) while default scope stayed 66.
- A still-non-public preview framework: API 404, page renders the 404
  boundary (dev server streams HTTP 200 for the not-found boundary — the
  production build returns a real 404 status; verify post-merge).
- Playwright `framework detail: mappings paginate honestly and search
narrows` green against SOC 2 (1,478 mappings): range labels, page 2
  distinct, search narrowing, out-of-range empty state.
- New local-only ignore pattern in `playwright/helpers/observability.ts`:
  the local stack's plain-http Supabase URL violates the https-only CSP —
  environment artifact, scoped to `127.0.0.1:54321`.

## Test Plan

- [x] Playwright: SOC 2 range label shows 24-per-page and total 1,478; page 2 loads distinct mappings; `?q=` narrows results and range label updates
- [x] Playwright: out-of-range page renders empty state with honest total (no 500)
- [x] API: `limit` clamped to 200; `total` equals `total_mappings`; `q` filter returns subset
- [x] Sandbox: public-flipped preview framework renders paginated detail with Preview badge; non-public preview 404s on page AND API
- [x] All existing gates green (lint, typecheck, test:scf, test:integration, manifest:check)

## Acceptance Criteria

- [x] No framework detail response or page render ever loads more than one page of mappings
- [x] Range/total displayed is exact for every framework, matching `total_mappings`
- [x] Page and API agree on gating for all four tier×exposure combinations
- [x] Search works server-side on both surfaces
- [x] Sandbox preview-inspection proof recorded in this spec

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
