# Task Spec: SCF License Audit

> ⛔ **SUPERSEDED.** The git-history-only audit approach was structurally unsound (`data/` had a
> single import commit, so the audit was non-discriminating). Replaced by Phase 1 of the SCF
> 2026.1.1 pivot, which performs offline byte-comparison against the vendored upstream XLSX. See
> `plans/task-2026-05-11-scf-2026-1-1-pivot.md` for the active task and
> `docs/superpowers/specs/2026-05-11-scf-2026-1-1-pivot-design.md` for the authoritative design.

## Metadata

- Date: 2026-05-11
- Owner: claude (agent)
- Status: Superseded
- Branch: chore/scf-license-audit
- Related issue/PR: n/a
- Superseded by: `plans/task-2026-05-11-scf-2026-1-1-pivot.md` (2026-05-12)

## Goal

Classify every `data/*` file via git history and emit `data/LICENSE_AUDIT.json` + `data/README.md` so we know whether each file can be redistributed under CC BY-ND 4.0.

## Context Files

- [ ] data/scf_data_import_strategy.md
- [ ] data/scf_import_usage_guide.md
- [ ] README.md
- [ ] docs/superpowers/plans/2026-05-11-scf-license-audit.md

## Constraints

- Read-only over `data/`. Audit never rewrites a CSV.
- No network. No upstream fetch. Classification uses git history only.
- No service-role key or `.env.*` files in the audit script.

## Scope

### In scope

- Per-file `git log --follow --name-status` parsing.
- Authoring-source lookup (upstream-SCF vs graphletter-authored).
- `data/LICENSE_AUDIT.json` and `data/README.md`.
- Surface flagged commits (M-status) to peter with diff summary.

### Out of scope

- Byte-level diff against upstream.
- Fixing any flagged file. If a file is flagged, surface — don't auto-revert.
- Seeding work. That's the sibling plan.

## Implementation Plan

See `docs/superpowers/plans/2026-05-11-scf-license-audit.md`.

## Test Plan

- [ ] `pnpm test:integration` includes `tests/scripts/scf-license-audit.test.ts` and passes.
- [ ] `pnpm audit:scf-license` exits 0 on a fresh clone and writes both output files.

## Acceptance Criteria

- [ ] `data/LICENSE_AUDIT.json` exists with one entry per `data/*` file and a top-level `verdict` of `clean` | `attribution-required` | `derivative-blocker`.
- [ ] `data/README.md` lists each file's classification and attributes upstream SCF 2025.1.1.
- [ ] Pre-push hook (`pnpm lint && pnpm typecheck`) passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved
