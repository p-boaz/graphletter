# Task Spec: README live-site links + status badges

## Metadata

- Date: 2026-07-04
- Owner: agent (Claude Code), approval: Peter (standing "keep working" directive, 2026-07-04)
- Status: Done
- Branch: `docs/readme-live-links`
- Related issue/PR: complements PR #38 (site copy) and PR #39 (prod smoke)

## Goal

The README — the front door for GitHub visitors — never links to the live
site. A reader can clone the repo but can't try the product. Add a prominent
live-demo link and CI/Prod-Smoke status badges. (A full README copy review
found it already matches the plain-language standard; no rewrite needed.)

## Context Files

- [ ] `README.md`
- [ ] this spec

## Constraints

- Additive only — the existing copy is good; don't rewrite it.
- The Prod Smoke badge resolves once PR #39 merges (noted in the PR body).

## Implementation Plan

1. Add a live-demo line under the intro paragraph linking
   `https://www.graphletter.com/try` (no signup) and the site root.
2. Add CI and Prod Smoke workflow badges beside the existing license/stack
   badges.

## Test Plan

- [x] Links resolve (curl 200 on both URLs, verified 2026-07-04).
- [x] Badge URLs follow `actions/workflows/<file>/badge.svg` convention; CI
      badge renders now, smoke badge after #39 merges.

## Acceptance Criteria

- [x] A GitHub visitor can reach the live demo from the README's first screen.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (standing directive)
