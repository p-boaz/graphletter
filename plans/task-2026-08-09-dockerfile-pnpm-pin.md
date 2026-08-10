# Task Spec: Pin pnpm version in Dockerfile

## Metadata

- Date: 2026-08-09
- Owner: claude (one-state-model P−1 conformance pass)
- Status: Done
- Branch: main
- Related issue/PR: none (single-line chore)

## Goal

Make the Dockerfile pass `node-toolchain-audit`: pin pnpm 10.33.4 explicitly
instead of relying on corepack's build-time resolution of `packageManager`.

## Context Files

- [x] Dockerfile
- [x] ~/.config/node-toolchain.env (machine-wide PNPM_VERSION source)

## Constraints

- No behavior change to the image beyond the explicit pin.

## Scope

### In scope

- `RUN corepack enable` → `RUN corepack enable && corepack prepare pnpm@10.33.4 --activate`

### Out of scope

- Any other toolchain surface (already conformant per audit).

## Implementation Plan

1. Add `corepack prepare pnpm@10.33.4 --activate` to the corepack layer.

## Test Plan

- [x] `node-toolchain-audit` exits 0 machine-wide after the change.

## Acceptance Criteria

- [x] Audit reports `Docker pins pnpm 10.33.4` for graphletter.
