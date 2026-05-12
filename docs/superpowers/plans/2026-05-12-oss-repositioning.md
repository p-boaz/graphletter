# OSS Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift the public-facing surface of Graphletter from a SaaS-marketing tone to an open-source-project tone, preserving the hosted product and the in-app docs surface.

**Architecture:** Five-section single-page landing (Hero → Example output → Built in the open → Closing CTA → Lean footer). Lean nav with GitHub. Marketing routes deleted; the docs/help page survives as `/docs`; the sample-doc flow renames to `/try`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind, shadcn/ui, Playwright. Repo: `https://github.com/p-boaz/graphletter`.

---

## File Structure

**Created**

- `app/try/page.tsx` — sample-doc flow at new path
- `app/docs/page.tsx` — docs/help surface at new path
- `plans/task-2026-05-12-oss-repositioning.md` — task spec (required by pre-commit hook)

**Replaced with thin `redirect()` stubs**

- `app/try-it-out/page.tsx` → `redirect("/try")`
- `app/how-it-works/page.tsx` → `redirect("/docs")`
- `app/demo/page.tsx` → already a redirect; update target to `/docs`
- `app/architecture/page.tsx` → already a redirect; update target to `/docs`

**Modified**

- `app/page.tsx` — full rewrite (five-section landing)
- `components/navigation.tsx` — slim nav, GitHub link, `/try` href
- `components/footer.tsx` — collapse to single row, drop dark slate
- `components/smart-evidence-upload/upload-form.tsx` — `/how-it-works#...` → `/docs#...`
- `components/assessment-results-display/control-row.tsx` — same (3 hrefs)
- `components/assessment-review-dialog/detailed-view.tsx` — same (3 hrefs)
- `app/dashboard/page.tsx:649` — `/how-it-works#workflow` → `/docs#workflow`
- `playwright/helpers/selectors.ts` — drop footer/contact selectors that no longer exist
- `playwright/tests/onboarding-funnel.spec.ts` — update landing-page assertions
- `playwright/tests/public-pages.spec.ts` — drop contact + how-it-works assertions
- `playwright/tests/upload.spec.ts` — update artifact-mapping-link test target

**Deleted**

- `app/contact/page.tsx`

**Untouched (deliberate)**

- All `/api/try-it-out/*` routes — API surface stays stable; only public page paths rename
- All authenticated product routes (`/dashboard`, `/assessments`, etc.)
- README, AGENTS.md, CHANGELOG.md, license files

---

## Pre-commit constraints

Husky pre-commit (`/Users/boaz/Projects/graphletter/.husky/pre-commit`) enforces:

- **Blast radius ≤ 15 staged files per commit** (split commits accordingly)
- **`pnpm check:spec`** — if any implementation file is staged, a `plans/task-*.md` file must also be staged. Therefore: each implementation commit appends a one-line progress note to `plans/task-2026-05-12-oss-repositioning.md` and stages it.
- **`pnpm lint-staged`** runs prettier on staged files

Pre-push runs `pnpm lint` and `pnpm typecheck` — both must pass.

---

## Task 0: Create branch + task spec

**Files:**

- Create: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Create a branch**

```bash
git checkout -b chore/oss-repositioning
```

- [ ] **Step 2: Create the task spec from template**

Create `plans/task-2026-05-12-oss-repositioning.md` with this content:

```markdown
# Task Spec: OSS Repositioning

## Metadata

- Date: 2026-05-12
- Owner: agent
- Status: In Progress
- Branch: chore/oss-repositioning
- Related design: docs/superpowers/specs/2026-05-12-oss-repositioning-design.md
- Related plan: docs/superpowers/plans/2026-05-12-oss-repositioning.md

## Goal

Shift the public-facing surface from SaaS-marketing tone to OSS-project tone. Keep hosted product and in-app docs functional.

## Constraints

- No README rewrite
- No visual redesign (typography/color palette unchanged)
- No anti-SaaS copy ("no per-seat fees" etc.)
- API surface (`/api/try-it-out/*`) stays stable
- Authenticated product UI unchanged

## Progress Log

- 2026-05-12: Task spec created.
```

- [ ] **Step 3: Commit the task spec**

```bash
git add plans/task-2026-05-12-oss-repositioning.md
git commit -m "docs(plan): task spec for OSS repositioning"
```

Expected: commit succeeds; docs-only changes pass `check:spec`.

---

## Task 1: Stand up `/docs` and `/try` (new homes, keep old redirects)

This task moves content to new URLs and adds redirects, but does NOT yet update the in-product links or the marketing landing. Order matters: standing the new routes up first keeps every link working at every commit boundary.

**Files:**

- Create: `app/docs/page.tsx`
- Create: `app/try/page.tsx`
- Modify: `app/how-it-works/page.tsx` (replace with redirect stub)
- Modify: `app/try-it-out/page.tsx` (replace with redirect stub)
- Modify: `app/demo/page.tsx` (change redirect target)
- Modify: `app/architecture/page.tsx` (change redirect target)
- Modify: `playwright/tests/onboarding-funnel.spec.ts` (delete the `how-it-works restructure` test block; see Step 1 rule 6)
- Modify: `plans/task-2026-05-12-oss-repositioning.md` (progress note)

- [ ] **Step 1: Copy the current `/how-it-works` page to `/docs`, preserving all anchor IDs**

```bash
cp app/how-it-works/page.tsx app/docs/page.tsx
```

Then strip the marketing wrappers from `app/docs/page.tsx`. Apply these rules in order:

1. **Find every `id="..."` attribute** in the file. The four anchors targeted from in-app links are required: `id="assessment-objectives"`, `id="result-states"`, `id="artifacts-and-controls"`, `id="workflow"`. Each of these anchors and the surrounding section that explains the concept MUST stay.

2. **Find every `data-testid` attribute** — the existing tests `hiw-tldr`, `hiw-primary-cta`, `hiw-closing-cta`, `pipeline-diagram` will be retargeted/removed in this task. Replace:
   - `data-testid="hiw-tldr"` → keep the testid only if the element survives; otherwise delete the element entirely
   - `data-testid="hiw-primary-cta"` → delete the CTA element; docs pages should not have a "Try it out" hero button
   - `data-testid="hiw-closing-cta"` → delete the closing CTA section; docs don't close with a conversion CTA
   - `data-testid="pipeline-diagram"` → keep IF the diagram is genuinely informative documentation; otherwise delete

3. **Remove any element with the text** "Try it out", "Sign up free", "Create a free account", "Request a demo" — these are conversion CTAs that don't belong on a docs page.

4. **Replace the H1** from "How It Works" (or similar) to "Docs".

5. **Replace the metadata** at the top of the file:

```tsx
export const metadata: Metadata = { title: pageTitle("Docs") };
```

6. Also update the matching Playwright tests in `playwright/tests/onboarding-funnel.spec.ts`. The `test.describe("how-it-works restructure", ...)` block tests three things that no longer apply:
   - `hiw-tldr` text contains "upload" — DELETE this test
   - `hiw-primary-cta` href is `/try-it-out` — DELETE this test
   - `pipeline-diagram` renders 6 step labels — DELETE this test if you removed the diagram in rule 2; KEEP if you preserved it (but update the navigation from `/how-it-works` to `/docs`)
   - `hiw-closing-cta` scrolls into view — DELETE this test

   Rename `test.describe("how-it-works restructure", ...)` to `test.describe("docs page", ...)` if any tests survive.

- [ ] **Step 2: Copy `app/try-it-out/page.tsx` to `app/try/page.tsx`**

```bash
cp app/try-it-out/page.tsx app/try/page.tsx
```

Then in `app/try/page.tsx`, soften the heading copy. Replace:

```tsx
<h1
  className="ft-headline text-4xl text-ft-black lg:text-5xl"
  data-testid="try-it-out-heading"
>
  Try It Out
</h1>
<p
  className="ft-sans text-lg text-slate-700 leading-relaxed"
  data-testid="try-it-out-summary"
>
  See how AI compliance assessment works. Pick a sample document and watch Graphletter
  evaluate it against SCF controls in real time.
</p>
```

With:

```tsx
<h1
  className="ft-headline text-4xl text-ft-black lg:text-5xl"
  data-testid="try-it-out-heading"
>
  Try it with a sample doc
</h1>
<p
  className="ft-sans text-lg text-slate-700 leading-relaxed"
  data-testid="try-it-out-summary"
>
  Pick a sample policy and watch Graphletter evaluate it against SCF controls. Uses the same Smart Evidence Upload flow the product runs on.
</p>
```

Update the metadata title in the same file:

```tsx
export const metadata: Metadata = { title: pageTitle("Try") };
```

Keep `data-testid` attributes unchanged — the Playwright selectors `tryItOutHeading`, `tryItOutSummary`, `tryItOutLiveUploadSection` should still resolve.

- [ ] **Step 3: Replace `app/how-it-works/page.tsx` with a redirect stub**

```tsx
import { redirect } from "next/navigation";

export default function HowItWorksPage() {
  redirect("/docs");
}
```

- [ ] **Step 4: Replace `app/try-it-out/page.tsx` with a redirect stub**

```tsx
import { redirect } from "next/navigation";

export default function TryItOutPage() {
  redirect("/try");
}
```

- [ ] **Step 5: Update `app/demo/page.tsx` and `app/architecture/page.tsx` redirect targets**

In both files replace the redirect target string `"/how-it-works"` with `"/docs"`:

```tsx
import { redirect } from "next/navigation";

export default function DemoPage() {
  redirect("/docs");
}
```

```tsx
import { redirect } from "next/navigation";

export default function ArchitecturePage() {
  redirect("/docs");
}
```

- [ ] **Step 6: Build to verify nothing broke**

```bash
pnpm build
```

Expected: build succeeds. (`.next/types/validator.ts` may complain about stale routes — if it does, run `rm -rf .next/types` and re-run.)

- [ ] **Step 7: Append progress note and commit**

Append a line to the Progress Log section of `plans/task-2026-05-12-oss-repositioning.md`:

```
- 2026-05-12: Stood up /docs and /try; redirected /how-it-works, /try-it-out, /demo, /architecture.
```

Then commit:

```bash
git add app/docs/page.tsx app/try/page.tsx app/how-it-works/page.tsx app/try-it-out/page.tsx app/demo/page.tsx app/architecture/page.tsx playwright/tests/onboarding-funnel.spec.ts plans/task-2026-05-12-oss-repositioning.md
git commit -m "$(cat <<'EOF'
refactor(routes): rename /how-it-works to /docs and /try-it-out to /try

Keeps old URLs alive via redirect stubs so this commit is non-breaking.
In-app links and the landing page are updated in follow-up commits.
EOF
)"
```

Expected: 8 staged files. Commit succeeds.

---

## Task 2: Update in-app links to `/docs`

These are help links inside the authenticated product that previously pointed to `/how-it-works#...` anchors. Now they target `/docs#...`. Behavior is unchanged because the redirect stub from Task 1 keeps the old URLs working, but updating the source removes the indirection.

**Files:**

- Modify: `components/smart-evidence-upload/upload-form.tsx` (1 href)
- Modify: `components/assessment-results-display/control-row.tsx` (3 hrefs)
- Modify: `components/assessment-review-dialog/detailed-view.tsx` (3 hrefs)
- Modify: `app/dashboard/page.tsx` (1 href)
- Modify: `playwright/tests/upload.spec.ts` (artifact-mapping anchor URL assertion)
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Update the Playwright assertion first (TDD-style)**

In `playwright/tests/upload.spec.ts:160`, change:

```ts
await expect(page).toHaveURL(/\/how-it-works#artifacts-and-controls$/);
```

To:

```ts
await expect(page).toHaveURL(/\/docs#artifacts-and-controls$/);
```

- [ ] **Step 2: Run the test to confirm it fails against the current code**

```bash
pnpm exec playwright test playwright/tests/upload.spec.ts -g "artifact mapping link"
```

Expected: FAIL — the upload form still points at `/how-it-works#artifacts-and-controls`.

- [ ] **Step 3: Sweep and replace `/how-it-works` → `/docs` across product source**

In each of the following files, find the `href="/how-it-works#..."` string(s) listed and replace `/how-it-works` with `/docs` (preserving the `#anchor` part):

- `components/smart-evidence-upload/upload-form.tsx:116` → `href="/docs#artifacts-and-controls"`
- `components/assessment-results-display/control-row.tsx:265` → `href="/docs#assessment-objectives"`
- `components/assessment-results-display/control-row.tsx:271` → `href="/docs#result-states"`
- `components/assessment-results-display/control-row.tsx:309` → `href="/docs#result-states"`
- `components/assessment-review-dialog/detailed-view.tsx:50` → `href="/docs#assessment-objectives"`
- `components/assessment-review-dialog/detailed-view.tsx:57` → `href="/docs#result-states"`
- `components/assessment-review-dialog/detailed-view.tsx:258` → `href="/docs#result-states"`
- `app/dashboard/page.tsx:649` → `href="/docs#workflow"`

Verify completeness:

```bash
grep -rn "/how-it-works" app components lib 2>/dev/null | grep -v -E '\.test\.|\.spec\.|page\.tsx:.*redirect'
```

Expected: empty output. (The redirect stub in `app/how-it-works/page.tsx` is allowed.)

- [ ] **Step 4: Re-run the upload test to confirm it passes**

```bash
pnpm exec playwright test playwright/tests/upload.spec.ts -g "artifact mapping link"
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: passes.

- [ ] **Step 6: Append progress note and commit**

Append to the Progress Log:

```
- 2026-05-12: Updated 8 in-app help links from /how-it-works to /docs.
```

Commit:

```bash
git add components/smart-evidence-upload/upload-form.tsx components/assessment-results-display/control-row.tsx components/assessment-review-dialog/detailed-view.tsx app/dashboard/page.tsx playwright/tests/upload.spec.ts plans/task-2026-05-12-oss-repositioning.md
git commit -m "refactor(links): point in-app help anchors to /docs"
```

Expected: ≤6 staged files.

---

## Task 3: Rewrite the landing page

Full rewrite of `app/page.tsx` per the design spec: Hero (with GitHub CTA) → Example output → Built in the open → Closing CTA. The Pipeline 3-card section and the standalone Stats panel are removed.

**Files:**

- Modify: `app/page.tsx` (full rewrite)
- Modify: `playwright/tests/onboarding-funnel.spec.ts` (drop pipeline-card assertion, update hero CTA href)
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Update the Playwright assertions for the new landing**

In `playwright/tests/onboarding-funnel.spec.ts`:

Find:

```ts
const primary = page.getByTestId("hero-primary-cta");
// ...
await expect(primary).toHaveAttribute("href", "/try-it-out");
```

Replace with:

```ts
const primary = page.getByTestId("hero-primary-cta");
// ...
await expect(primary).toHaveAttribute("href", "/try");
```

Find:

```ts
const closer = page.getByTestId("landing-closing-cta");
// ...
("/try-it-out");
```

Replace `"/try-it-out"` with `"/try"`.

Delete the pipeline-card assertion entirely:

```ts
const titles = await page.getByTestId("pipeline-card-title").allInnerTexts();
// ...remove this assertion block...
```

(The new landing has no pipeline cards.)

In the "per-page titles are distinct" test, replace `/how-it-works` and `/try-it-out` with `/docs` and `/try`:

```ts
const paths = ["/", "/docs", "/research", "/try", "/auth", "/privacy", "/terms"];
```

- [ ] **Step 2: Run the affected tests; expect them to fail**

```bash
pnpm exec playwright test playwright/tests/onboarding-funnel.spec.ts -g "landing|titles"
```

Expected: FAIL — current landing still has pipeline cards and CTAs pointing at `/try-it-out`.

- [ ] **Step 3: Rewrite `app/page.tsx`**

Replace the entire file contents with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { authUrl } from "@/lib/auth/auth-tabs";
import { pageTitle } from "@/lib/seo/page-title";

const GITHUB_URL = "https://github.com/p-boaz/graphletter";

export const metadata: Metadata = {
  title: pageTitle("Compliance analysis for regulatory frameworks"),
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <section className="ft-container py-20">
        <p className="ft-mono text-xs uppercase tracking-[0.2em] text-ft-pink">Graphletter</p>
        <h1 className="ft-serif mt-4 text-5xl font-bold tracking-tight text-ft-black lg:text-6xl">
          Prove your policies meet the frameworks that matter.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-700 leading-relaxed">
          Upload an evidence document. Graphletter reads it against 1,200+ SCF controls and maps the
          outcome to 79 frameworks — with AI reasoning quoted back to your source.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" data-testid="hero-primary-cta">
            <Link href="/try">Try with a sample doc</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub →
            </a>
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          79 frameworks · 1,200+ controls · 25,000+ cross-framework mappings
        </p>
      </section>

      {/* Example output */}
      <section className="py-20">
        <div className="ft-container">
          <h2 className="ft-serif font-bold text-2xl text-ft-black mb-4">Example output</h2>
          <p className="ft-sans text-slate-600 mb-8 max-w-2xl">
            Upload a document — a policy, a training record, a vendor assessment. Graphletter maps
            it to every relevant SCF control and returns structured findings per objective.
          </p>
          <div className="ft-card rounded-2xl border-2 border-ft-cream p-8 max-w-3xl overflow-x-auto">
            <table className="ft-sans text-sm w-full">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Control
                  </td>
                  <td className="py-3 text-ft-black">
                    <span className="font-mono text-xs text-slate-400 mr-2">SCF-IAC-15</span>
                    Account Management
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Result
                  </td>
                  <td className="py-3">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 font-medium">
                      Partial
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Risk
                  </td>
                  <td className="py-3">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 font-medium">
                      Medium
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Frameworks
                  </td>
                  <td className="py-3 text-ft-black">
                    <span className="inline-flex flex-wrap gap-1.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        NIST 800-53 AC-2
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        ISO 27001 A.9.2.1
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">SOC 2 CC6.1</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Deficiencies
                  </td>
                  <td className="py-3 text-slate-600 leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li>No process for disabling dormant accounts after 90 days</li>
                      <li>Shared/service account inventory not referenced</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Recommendations
                  </td>
                  <td className="py-3 text-slate-600 leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Add dormant-account deprovisioning policy with 90-day threshold</li>
                      <li>Maintain a service account register with quarterly review</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-6 font-medium text-slate-500 whitespace-nowrap align-top">
                    Remediation
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center space-x-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                        Effort: Low
                      </span>
                      <span className="text-slate-400 text-xs">·</span>
                      <span className="text-slate-500 text-xs">
                        Policy update, no tooling changes
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Built in the open */}
      <section className="bg-ft-cream py-16">
        <div className="ft-container max-w-3xl">
          <h2 className="ft-serif font-bold text-2xl text-ft-black mb-4">Built in the open</h2>
          <p className="ft-sans text-slate-700 leading-relaxed mb-6">
            Graphletter is MIT-licensed and developed in public. The code, the prompts, the SCF
            mappings, and the schema migrations all live in the repository.
          </p>
          <ul className="space-y-3 mb-6">
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Self-hostable</strong> — run it on your own
              infrastructure if you'd rather keep evidence inside your perimeter.
            </li>
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Inspectable</strong> — read how the assessments are
              scored, how citations are parsed, how data flows.
            </li>
            <li className="ft-sans text-slate-700 leading-relaxed">
              <strong className="text-ft-black">Forkable</strong> — extend it with your own evidence
              types or framework mappings.
            </li>
          </ul>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-sans text-ft-pink font-medium underline underline-offset-4 hover:text-ft-black transition-colors"
          >
            View the code on GitHub →
          </a>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        className="border-ft-pink/30 border-t bg-gradient-to-br from-ft-cream to-white py-16"
        data-testid="landing-closing-cta"
      >
        <div className="ft-container text-center">
          <h2 className="ft-serif text-3xl font-bold text-ft-black">
            Ready to see a real assessment?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-slate-700 leading-relaxed">
            Pick one of three sample policies and watch Graphletter map it against SCF objectives in
            under a minute. No signup required.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/try">Try it now</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={authUrl("signup")}>Create a free account</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
```

Key changes vs current `app/page.tsx`:

- `stats` array removed; the Stats section is gone
- Pipeline 3-card section removed
- Hero subhead trimmed (no explicit framework name list)
- Secondary hero CTA: `/how-it-works` → external GitHub link
- Hero primary CTA href: `/try-it-out` → `/try`
- Closing CTA href: `/try-it-out` → `/try`
- New "Built in the open" section between Example output and Closing CTA
- "What You Get Back" heading renamed to "Example output"

- [ ] **Step 4: Run the updated Playwright tests; expect them to pass**

```bash
pnpm exec playwright test playwright/tests/onboarding-funnel.spec.ts -g "landing|titles"
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: passes.

- [ ] **Step 6: Append progress note and commit**

Append to Progress Log:

```
- 2026-05-12: Rewrote landing page to five-section layout with GitHub CTA and 'Built in the open' block.
```

```bash
git add app/page.tsx playwright/tests/onboarding-funnel.spec.ts plans/task-2026-05-12-oss-repositioning.md
git commit -m "feat(landing): five-section OSS-tone landing with GitHub CTA"
```

Expected: 3 staged files.

---

## Task 4: Slim the top navigation

Drop marketing-route links from the nav. Add a GitHub external link. Surviving nav targets: `Try` → `/try`. Mobile menu mirrors the same set.

**Files:**

- Modify: `components/navigation.tsx`
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Update `navigationItems` and add the GitHub link**

In `components/navigation.tsx`, find:

```tsx
const navigationItems = [
  { href: "/frameworks", label: "Frameworks" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/try-it-out", label: "Try It Out" },
  { href: "/research", label: "Research" },
];
```

Replace with:

```tsx
const GITHUB_URL = "https://github.com/p-boaz/graphletter";

const navigationItems = [{ href: "/try", label: "Try" }];
```

- [ ] **Step 2: Add the GitHub link to the desktop nav**

Find the desktop nav block:

```tsx
<nav className="hidden items-center space-x-6 md:flex">
  {navigationItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={`ft-nav-link text-base outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2 ${!isProtectedRoute && pathname === item.href ? "active" : ""}`}
    >
      {item.label}
    </Link>
  ))}
</nav>
```

Replace with:

```tsx
<nav className="hidden items-center space-x-6 md:flex">
  {navigationItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={`ft-nav-link text-base outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2 ${!isProtectedRoute && pathname === item.href ? "active" : ""}`}
    >
      {item.label}
    </Link>
  ))}
  <a
    href={GITHUB_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="ft-nav-link text-base outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2"
  >
    GitHub
  </a>
</nav>
```

- [ ] **Step 3: Add the GitHub link to the mobile menu**

Find the mobile menu's `navigationItems.map(...)` block:

```tsx
<nav className="mt-8 flex flex-col space-y-6">
  {navigationItems.map((item) => (
    <Link
      key={item.href}
      // ...
    >
      {item.label}
    </Link>
  ))}
  <div className="mt-6 flex flex-col space-y-3 border-slate-200 border-t pt-6">
```

Insert a GitHub anchor after the `navigationItems.map` but before the divider div:

```tsx
<nav className="mt-8 flex flex-col space-y-6">
  {navigationItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={`ft-nav-link text-lg outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2 ${!isProtectedRoute && pathname === item.href ? "active" : ""}`}
      onClick={() => setIsOpen(false)}
    >
      {item.label}
    </Link>
  ))}
  <a
    href={GITHUB_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="ft-nav-link text-lg outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2"
    onClick={() => setIsOpen(false)}
  >
    GitHub
  </a>
  <div className="mt-6 flex flex-col space-y-3 border-slate-200 border-t pt-6">
```

- [ ] **Step 4: Run the mobile-nav Playwright test to confirm signup/signin still resolve**

```bash
pnpm exec playwright test playwright/tests/onboarding-funnel.spec.ts -g "mobile nav"
```

Expected: PASS — the `nav-mobile-signin` and `nav-mobile-signup` testids are untouched.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Append progress note and commit**

Append:

```
- 2026-05-12: Slimmed top nav: dropped marketing links, kept /try, added GitHub.
```

```bash
git add components/navigation.tsx plans/task-2026-05-12-oss-repositioning.md
git commit -m "refactor(nav): drop marketing links, add GitHub"
```

Expected: 2 staged files.

---

## Task 5: Lean footer

Collapse the four-column dark-slate footer into a single row on a light background. Drop the "Project" and "Resources" marketing columns. Inline the contact email.

**Files:**

- Modify: `components/footer.tsx`
- Modify: `playwright/helpers/selectors.ts` (remove footer link selectors)
- Modify: `playwright/tests/public-pages.spec.ts` (remove footer-link assertions)
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Remove obsolete footer selectors from `playwright/helpers/selectors.ts`**

In `playwright/helpers/selectors.ts`, find:

```ts
public: {
  // ...
  footerLinkHowItWorks: "footer-link-how-it-works",
  footerLinkTryItOut: "footer-link-try-it-out",
  // ...
},
```

Delete the two `footerLink*` lines. Result:

```ts
public: {
  navHeader: "primary-navigation",
  tryItOutHeading: "try-it-out-heading",
  tryItOutSummary: "try-it-out-summary",
  tryItOutLiveUploadSection: "try-it-out-live-upload-section",
  frameworkResultsCount: "framework-results-count",
  frameworkSearchInput: "framework-search-input",
  frameworkCardLink: "framework-card-link",
  frameworkCardTitle: "framework-card-title",
  frameworkCardDescription: "framework-card-description",
  frameworkDetailHeading: "framework-detail-heading",
  frameworkDetailMappings: "framework-detail-mappings",
  contactPageHeading: "contact-page-heading",
  contactResponseTime: "contact-response-time",
},
```

(`contactPageHeading`/`contactResponseTime` are removed in Task 6 when `/contact` is deleted.)

- [ ] **Step 2: Remove footer-link assertions from `playwright/tests/public-pages.spec.ts`**

In `playwright/tests/public-pages.spec.ts`, find:

```ts
await expect(page.getByTestId(selectors.public.footerLinkHowItWorks)).toBeVisible();
await expect(page.getByTestId(selectors.public.footerLinkTryItOut)).toBeVisible();
```

Delete those two assertions.

Also find the second `/how-it-works` block:

```ts
await open_local_app(page, "/how-it-works");
await expect(page.getByRole("link", { name: "How It Works" }).first()).toHaveClass(/active/);
await expect(page.getByRole("link", { name: "Frameworks" }).first()).not.toHaveClass(/active/);
await expect(page.getByRole("link", { name: "Try It Out" }).first()).not.toHaveClass(/active/);

await open_local_app(page, "/try-it-out");
await expect(page.getByTestId(selectors.public.tryItOutHeading)).toBeVisible();
await expect(page.getByRole("link", { name: "Try It Out" }).first()).toHaveClass(/active/);
await expect(page.getByRole("link", { name: "How It Works" }).first()).not.toHaveClass(/active/);
```

Replace this whole block with a simpler check that targets the new routes:

```ts
await open_local_app(page, "/try");
await expect(page.getByTestId(selectors.public.tryItOutHeading)).toBeVisible();
await expect(page.getByRole("link", { name: "Try" }).first()).toHaveClass(/active/);
```

The earlier `/how-it-works` block at lines 20-37 of this file (top of the test) navigates to `/how-it-works` to check the nav-on-scroll background color. Since `/how-it-works` is now just a redirect, update that navigation to `/docs`:

```ts
await open_local_app(page, "/docs");
```

And update the assertion that says `await expect(page.getByRole("link", { name: "How It Works" }).first()).not.toHaveClass(/active/);` — delete it; "How It Works" is no longer in the nav.

- [ ] **Step 3: Rewrite `components/footer.tsx`**

Replace the entire file with:

```tsx
import Image from "next/image";
import Link from "next/link";

const GITHUB_URL = "https://github.com/p-boaz/graphletter";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-slate-200 border-t bg-white">
      <div className="ft-container py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center">
              <Image
                src="/logo.svg"
                alt="Graphletter Logo"
                width={40}
                height={40}
                className="h-10 w-10"
              />
            </div>
            <span className="ft-serif font-bold text-lg text-ft-black">Graphletter</span>
            <span className="ft-sans text-xs text-slate-500">
              · MIT-licensed · © {currentYear}
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link
              href="/docs"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/frameworks"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Frameworks
            </Link>
            <Link
              href="/research"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Research
            </Link>
            <Link
              href="/privacy"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/security"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              Security
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              GitHub
            </a>
            <a
              href="mailto:hello@graphletter.com"
              className="ft-sans text-slate-600 hover:text-ft-black transition-colors"
            >
              hello@graphletter.com
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
```

Key changes from current footer:

- `"use client"` directive removed (no client state here)
- Background switched from `bg-slate-900` (dark) to `bg-white` with top border
- Four-column grid replaced with single flex row
- Brand wordmark + "MIT-licensed · © {year}" inline on the left
- All surviving links in a single horizontal nav on the right
- Removed: "Project"/"Resources" column headers, "Documentation" duplicate, "Status" link, separate "Contact" column
- Added: `mailto:hello@graphletter.com` inline; GitHub link
- Removed `data-testid="footer-link-how-it-works"` / `footer-link-try-it-out` (selectors deleted in Step 1)

- [ ] **Step 4: Run the public-pages test to confirm it still passes**

```bash
pnpm exec playwright test playwright/tests/public-pages.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Append progress note and commit**

Append:

```
- 2026-05-12: Collapsed footer to single-row light layout; removed marketing columns.
```

```bash
git add components/footer.tsx playwright/helpers/selectors.ts playwright/tests/public-pages.spec.ts plans/task-2026-05-12-oss-repositioning.md
git commit -m "refactor(footer): collapse to lean single-row footer"
```

Expected: 4 staged files.

---

## Task 6: Delete `/contact` and clean up its references

`/contact` is the last sales-funnel page. It is deleted entirely; the footer mailto handles the contact need.

**Files:**

- Delete: `app/contact/page.tsx` (and `app/contact/` directory)
- Modify: `playwright/helpers/selectors.ts` (remove contact selectors)
- Modify: `playwright/tests/public-pages.spec.ts` (remove contact assertions)
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Remove contact selectors**

In `playwright/helpers/selectors.ts`, delete:

```ts
contactPageHeading: "contact-page-heading",
contactResponseTime: "contact-response-time",
```

- [ ] **Step 2: Remove contact assertions from `playwright/tests/public-pages.spec.ts`**

Find and delete this block:

```ts
await open_local_app(page, "/contact");
await expect(page.getByTestId(selectors.public.contactPageHeading)).toBeVisible();
await expect(page.getByTestId(selectors.public.contactResponseTime)).toBeVisible();
```

- [ ] **Step 3: Delete the `/contact` directory**

```bash
rm -rf app/contact
```

- [ ] **Step 4: Clear stale Next.js types**

The deleted route will leave stale entries in `.next/types/validator.ts` (see memory ID 7572). Clear them:

```bash
rm -rf .next/types
```

- [ ] **Step 5: Verify no remaining string references**

```bash
grep -rn "/contact" app components lib playwright --include='*.ts' --include='*.tsx' 2>/dev/null
```

Expected: empty (any matches indicate something still references the deleted route).

- [ ] **Step 6: Build, typecheck, lint**

```bash
pnpm build && pnpm typecheck && pnpm lint
```

Expected: all pass.

- [ ] **Step 7: Run the full Playwright suite for the affected files**

```bash
pnpm exec playwright test playwright/tests/public-pages.spec.ts playwright/tests/onboarding-funnel.spec.ts playwright/tests/upload.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Append progress note and commit**

Append:

```
- 2026-05-12: Deleted /contact page; mailto handles contact in footer.
```

```bash
git add -A app/contact playwright/helpers/selectors.ts playwright/tests/public-pages.spec.ts plans/task-2026-05-12-oss-repositioning.md
git commit -m "refactor(routes): delete /contact; footer mailto replaces it"
```

(The `git add -A app/contact` form picks up the deletion.)

Expected: 4 file changes (1 deletion + 3 modifications).

---

## Task 7: Final sweep + branch finalization

Catch anything missed: stray string references, stale test fixtures, status badges, anything that grep finds.

**Files:**

- Possibly: any straggler files surfaced by grep
- Modify: `plans/task-2026-05-12-oss-repositioning.md`

- [ ] **Step 1: Sweep for remaining string references**

```bash
grep -rn "how-it-works\|try-it-out\|/demo[^-]\|/contact" app components lib playwright \
  --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v -E 'redirect\("/docs"\)|redirect\("/try"\)|api/try-it-out|try-it-out-heading|try-it-out-summary|try-it-out-live-upload-section|tryItOutHeading|tryItOutSummary|tryItOutLiveUploadSection'
```

Allowed remaining matches:

- The redirect stubs at `app/how-it-works/page.tsx`, `app/try-it-out/page.tsx`, `app/demo/page.tsx`, `app/architecture/page.tsx`
- API route paths under `app/api/try-it-out/...` (deliberately unchanged)
- `data-testid="try-it-out-*"` strings (the testids are kept stable; only routes renamed)
- Internal fetches to `/api/try-it-out/demo` and `/api/try-it-out/demo/quota`

Anything else found in this sweep needs to be addressed before continuing.

- [ ] **Step 2: Spot-check the homepage in a browser**

```bash
pnpm dev
```

Open `http://localhost:3000/`. Confirm:

- Hero matches the spec headline + subhead + CTAs
- Pipeline 3-card section is gone
- Stats section is gone
- Example output table is present
- "Built in the open" section is present with three bullets and GitHub link
- Closing CTA is present
- Footer is single-row, light, with all expected links

Also visit:

- `/try` → loads the sample-doc page with the softened heading
- `/try-it-out` → redirects to `/try`
- `/docs` → loads the docs page (formerly /how-it-works)
- `/how-it-works` → redirects to `/docs`
- `/contact` → 404
- `/demo` → redirects to `/docs`
- `/architecture` → redirects to `/docs`

Stop the dev server.

- [ ] **Step 3: Run full validation**

```bash
pnpm audit --audit-level=high
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass. The audit step should still pass (the recent overrides remain).

- [ ] **Step 4: Run the public/onboarding test suites end-to-end**

```bash
pnpm exec playwright test playwright/tests/public-pages.spec.ts playwright/tests/onboarding-funnel.spec.ts playwright/tests/upload.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Mark the task spec Done and commit**

Edit `plans/task-2026-05-12-oss-repositioning.md`:

- Set the `Status:` field from `In Progress` to `Done`
- Append a final Progress Log line:

```
- 2026-05-12: All sub-tasks complete; sweep clean; full Playwright suite green.
```

```bash
git add plans/task-2026-05-12-oss-repositioning.md
git commit -m "docs(plan): mark OSS repositioning task complete"
```

- [ ] **Step 6: Push and open a PR**

```bash
git push -u origin chore/oss-repositioning
gh pr create --title "chore: reposition landing surface to OSS-project tone" --body "$(cat <<'EOF'
## Summary

- Five-section single-page landing (Hero → Example output → Built in the open → Closing CTA)
- Slim top nav with a GitHub link; lean single-row footer
- `/how-it-works` → `/docs` (kept as the in-app docs surface, marketing intro stripped)
- `/try-it-out` → `/try`
- `/contact` deleted; mailto in footer
- API surface (`/api/try-it-out/*`) untouched

Design: \`docs/superpowers/specs/2026-05-12-oss-repositioning-design.md\`
Plan: \`docs/superpowers/plans/2026-05-12-oss-repositioning.md\`

## Test plan

- [x] \`pnpm typecheck\`
- [x] \`pnpm lint\`
- [x] \`pnpm build\`
- [x] \`pnpm exec playwright test playwright/tests/public-pages.spec.ts playwright/tests/onboarding-funnel.spec.ts playwright/tests/upload.spec.ts\`
- [x] Manual smoke: \`/\`, \`/try\`, \`/docs\`, redirects from \`/how-it-works\`, \`/try-it-out\`, \`/demo\`, \`/architecture\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; CI runs typecheck, lint, build, audit. All pass.

---

## Self-review notes

**Spec coverage:**

- Hero rewrite — Task 3
- Example output rename — Task 3
- "Built in the open" block — Task 3
- Closing CTA preserved — Task 3
- Lean footer — Task 5
- Slim nav with GitHub — Task 4
- Delete `/contact` — Task 6
- Rename `/try-it-out` → `/try` (redirect) — Task 1
- Rename `/how-it-works` → `/docs` (redirect, rewrite) — Task 1
- Update in-app help links — Task 2
- Update redirect targets at `/demo`, `/architecture` — Task 1
- Test updates — distributed across Tasks 2, 3, 5, 6

**Blast radius check:** Largest commit is Task 6 (4 files) — well under the 15-file cap.

**Open variable:** The `GITHUB_URL` constant appears in three files (`app/page.tsx`, `components/navigation.tsx`, `components/footer.tsx`). If a follow-up refactor wants to centralize it, that's outside this plan's scope.

- 2026-05-12 Task 5: lean light footer; drop Resources/Project/Contact columns and Status link; clean up obsolete footer + nav-active assertions in playwright tests
