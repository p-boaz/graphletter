# Task Spec: Catalog inspectability — framework detail pagination, mapping search, tier coherence

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Draft
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

- [ ] `app/frameworks/[id]/page.tsx` — server-side pagination (`?page=`), mapping search (`?q=`), "Showing X–Y of Z" range, prev/next links; visibility/exposure gating to match the API (direct DB query is currently ungated); hardcoded "Active" badge replaced by tier badge (Supported/Preview)
- [ ] `app/api/scf/frameworks/[id]/route.ts` — mappings paginated (`?limit=` default 50 max 200, `?offset=`), `?q=` filter, response gains `total`/`limit`/`offset` (mappings array shape unchanged)
- [ ] `playwright/helpers/selectors.ts` — testids for pagination controls, range label, search input, tier badge
- [ ] `playwright/tests/public-pages.spec.ts` — detail-page assertions: range label honest, page-through works, search narrows, deep page loads
- [ ] `lib/frameworks/format-version.ts` — read-only reference

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

## Test Plan

- [ ] Playwright: SOC 2 range label shows 24-per-page and total 1,478; page 2 loads distinct mappings; `?q=` narrows results and range label updates
- [ ] Playwright: out-of-range page renders empty state with honest total (no 500)
- [ ] API: `limit` clamped to 200; `total` equals `total_mappings`; `q` filter returns subset
- [ ] Sandbox: public-flipped preview framework renders paginated detail with Preview badge; non-public preview 404s on page AND API
- [ ] All existing gates green (lint, typecheck, test:scf, test:integration, manifest:check)

## Acceptance Criteria

- [ ] No framework detail response or page render ever loads more than one page of mappings
- [ ] Range/total displayed is exact for every framework, matching `total_mappings`
- [ ] Page and API agree on gating for all four tier×exposure combinations
- [ ] Search works server-side on both surfaces
- [ ] Sandbox preview-inspection proof recorded in this spec

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
