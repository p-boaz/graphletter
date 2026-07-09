# Task Spec: Framework Explorer — fit the dashboard shell, virtualize the control list

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/framework-explorer-dashboard-fit
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

The Framework Explorer tab embeds the public mapping-explorer component wholesale, producing a stacked double header ("Framework Explorer" + "← Back to Home" + "SCF Mapping Explorer"), a nonsensical "Back to Home" link inside a dashboard tab, three saturated gradient stat cards that match no other dashboard surface, and — because all 1,468 control cards render inline — a **183,000px-tall page**. Make it a dashboard citizen: one header, house styling, and a virtualized/paginated list.

## Context Files

- [ ] app/dashboard/frameworks/page.tsx
- [ ] components/mapping-explorer.tsx
- [ ] app/architecture/page.tsx (public consumer of mapping-explorer — must not regress)

## Constraints

- `mapping-explorer.tsx` serves the public page too; add props (e.g. `embedded`/`showHeader`) rather than forking the component.
- Virtualization: prefer windowing without a new heavy dependency if practical (simple pagination or incremental "load more" is acceptable); measure before choosing.
- Search and the domain/framework filters must keep working across the full 1,468-control set regardless of what is rendered.

## Scope

### In scope

- Header dedup: in the dashboard context, suppress the component's internal "SCF Mapping Explorer" title, subtitle, and "Back to Home" link; the dashboard page header ("Framework Explorer" + subtitle) is the only header.
- Stat cards (Total Controls / Frameworks / Cross-Mappings blue/green/purple gradients): restyle to the dashboard's neutral card language (white card, eyebrow label, large numeral) in the embedded context at minimum.
- Control list rendering: cap initial render (e.g. 50) with windowing/pagination/load-more; "1468 shown of 1468" counter reflects filtered totals vs rendered honestly ("Showing 50 of 1,468").
- Verify keyboard/scroll performance on the 8 GB dev machine after the change.

### Out of scope

- Redesigning the mappings side panel.
- The public `/architecture` page's visual identity (only must not break).
- SCF data-shape changes.

## Implementation Plan

1. Add embedded-mode props to `mapping-explorer.tsx`; wire from `app/dashboard/frameworks/page.tsx`.
2. Suppress internal header/back-link and restyle stat cards in embedded mode.
3. Implement list windowing/pagination; keep filters/search operating on the full dataset.
4. Confirm the public page renders unchanged (visual diff by screenshot).

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` explorer specs; add one asserting the dashboard tab has a single h1-level header and initial DOM contains far fewer than 1,468 control cards.
- [ ] Manual dogfood: search + filters return correct results beyond the first render window; full-page screenshot height is bounded (< ~10,000px).

## Acceptance Criteria

- [ ] One header in the dashboard tab; no "Back to Home".
- [ ] No gradient stat cards inside the dashboard shell.
- [ ] Initial render is windowed; scroll/search remain smooth; total-count copy is honest.
- [ ] Public /architecture page unchanged.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
