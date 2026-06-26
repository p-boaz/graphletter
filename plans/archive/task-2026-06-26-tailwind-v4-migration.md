# Task Spec: Tailwind CSS V4 Migration

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/30

## Goal

Upgrade Graphletter from Tailwind CSS v3 to v4 while preserving the existing
shadcn/ui tokens, custom Financial Times utilities, and production CSS output.

## Context Files

- [x] `package.json`
- [x] `pnpm-lock.yaml`
- [x] `postcss.config.mjs`
- [x] `app/globals.css`
- [x] `tailwind.config.ts`
- [x] `docs/TAILWIND_V4_MIGRATION.md`
- [x] `playwright/tests/public-pages.spec.ts`
- [x] `playwright/tests/dashboard.spec.ts`
- [x] `plans/task-2026-06-26-tailwind-v4-migration.md`

## Constraints

- Use official Tailwind v4/Next.js setup: `tailwindcss` plus
  `@tailwindcss/postcss`.
- Keep the legacy JavaScript config explicitly loaded with `@config` unless
  proving a full CSS-first config is lower risk.
- Preserve shadcn CSS-variable color names such as `border`, `background`,
  `primary`, `muted`, and `ring`.
- Preserve custom FT utility classes used by marketing/public pages.
- Do not broaden this into a design refresh.

## Compatibility Risks

- Tailwind v4 targets Safari 16.4+, Chrome 111+, and Firefox 128+.
- Tailwind v4 no longer auto-detects JavaScript config files; `@config` is
  required while `tailwind.config.ts` remains.
- The default border and ring behavior changed in v4; shadcn-style components
  that rely on bare `border`/`ring` need compatibility variables/base styles.
- Some utility names changed (`shadow-sm`, bare `ring`, `outline-none`, etc.);
  visual regression must cover pages with cards, forms, dialogs, and focus
  states.
- The `tailwindcss-animate` plugin must continue to load for accordion/dialog
  animations.

## Scope

### In scope

- Dependency and lockfile update.
- PostCSS plugin migration.
- Global CSS entrypoint migration.
- Compatibility documentation.
- Focused Playwright visual/critical coverage.
- Build/lint/typecheck validation.

### Out of scope

- Converting the entire Tailwind theme to CSS-first variables.
- Redesigning pages or changing the shadcn component library.
- Dropping legacy FT utility classes.
- Browser support below Tailwind v4's stated baseline.

## Implementation Plan

1. Update dependencies to Tailwind CSS v4 and `@tailwindcss/postcss`; remove
   now-redundant `autoprefixer`.
2. Change PostCSS config to use `@tailwindcss/postcss`.
3. Replace `@tailwind` directives with `@import "tailwindcss"` and explicitly
   load `tailwind.config.ts` with `@config`.
4. Add compatibility CSS for v3-like border and ring defaults where needed.
5. Document migration risks and decisions in `docs/TAILWIND_V4_MIGRATION.md`.
6. Run build, unit/static gates, and Playwright coverage over public and
   authenticated dashboard surfaces.

## Test Plan

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm build`.
- [x] Run `pnpm test:ui:bg playwright/tests/public-pages.spec.ts`.
- [x] Run `pnpm test:ui:bg playwright/tests/dashboard.spec.ts`.
- [x] Run `pnpm check:spec`.

## Acceptance Criteria

- [x] Tailwind v4 and `@tailwindcss/postcss` are installed and used.
- [x] Production build emits CSS successfully.
- [x] Public and dashboard Playwright coverage remains green.
- [x] Compatibility risks and mitigation decisions are documented.
- [x] No unrelated UI redesign or broad component churn is introduced.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
