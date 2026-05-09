# Playwright Dogfooding Layer

This folder is the dedicated browser-testing harness for local dogfooding against `http://localhost:3000`.

## Canonical Commands

- `pnpm test:ui`: full suite (headed)
- `pnpm test:ui:critical`: critical path only
- `pnpm test:ui:auth`: auth smoke flow only
- `pnpm test:ui:debug`: interactive debug mode

Legacy `tests/e2e` Playwright specs were removed during cleanup; use `playwright/tests` as the only browser test path.

## Structure

- `playwright/tests/auth.spec.ts`: auth form smoke flow.
- `playwright/tests/dashboard.spec.ts`: dashboard smoke and framework filtering.
- `playwright/tests/upload.spec.ts`: upload + assessment workflow with payload assertions.
- `playwright/tests/critical-path.spec.ts`: main user journey (login -> upload -> assess -> approve).
- `playwright/helpers/login.ts`: `openLocalApp` and deterministic `loginTestUser`.
- `playwright/helpers/selectors.ts`: stable `data-testid` selector map.
- `playwright/helpers/screenshots.ts`: snapshot helper for test artifacts.
- `playwright/helpers/observability.ts`: structured console/page/network failure capture.
- `playwright/helpers/browser-skills.ts`: reusable high-level "agent skills" wrappers.

## Agent Workflow Contract

1. Read relevant code.
2. Run a focused Playwright spec.
3. Capture browser observations (`browser-observation.json`, screenshots, traces/videos on failure).
4. Fix implementation.
5. Re-run until green.

Prefer `data-testid` selectors from `playwright/helpers/selectors.ts`.
