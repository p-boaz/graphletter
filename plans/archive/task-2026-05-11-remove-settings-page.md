# Task Spec: Remove standalone Settings page

## Metadata

- Date: 2026-05-11
- Owner: claude (continuation of prior session work)
- Status: Done
- Branch: main
- Related issue/PR: n/a

## Goal

Consolidate user-facing UI by removing the standalone `/settings` page. The page had been reduced to a read-only profile card duplicating `/profile`, with no actively-wired functionality. Settings entry in the user dropdown is removed in the same change.

## Context Files

- [x] `app/settings/page.tsx` (deleted)
- [x] `components/navigation.tsx` (Settings dropdown item + lucide icon import removed)

## Constraints

- No new data, no new routes, no migration needed.
- `/profile` already serves the read-only profile view this page was duplicating.

## Scope

### In scope

- Delete `app/settings/page.tsx`.
- Remove `Settings` icon import and the `<DropdownMenuItem>` linking to `/settings` from `components/navigation.tsx`.

### Out of scope

- Any future editable settings UI (would be added back as a fresh page wired to `supabase.auth.updateUser`).
- Profile page changes.

## Implementation Plan

1. Delete `app/settings/page.tsx` and the now-empty `app/settings/` directory.
2. Edit `components/navigation.tsx` to drop the unused `Settings` import and the dropdown menu item.
3. Clear stale `.next/types/` cache (validator.ts holds per-route type stubs; deleting only the per-page subdir is insufficient).

## Test Plan

- [x] `pnpm typecheck` passes with zero errors.
- [x] `grep -r "/settings" --include="*.tsx" --include="*.ts" --include="*.md" --include="*.json"` returns no hits in source.

## Acceptance Criteria

- [x] No `/settings` route exists.
- [x] User dropdown contains no Settings entry.
- [x] No stale `.next/types` references to the deleted route.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (confirmed in this session)
