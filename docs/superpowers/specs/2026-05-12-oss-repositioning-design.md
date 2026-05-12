# Open-Source Repositioning — Design

**Date:** 2026-05-12
**Status:** Design (pending implementation plan)
**Reference:** [mikeoss.com](https://mikeoss.com/) — structural inspiration

## Goal

Shift the public-facing surface of the Graphletter app from a SaaS-marketing tone to an open-source-project tone, while keeping the hosted product functional. The OSS framing should be present but quiet — a credibility signal, not the pitch.

This is not a redesign of the product (dashboard, assessments, auth flows). It is a repositioning of the marketing and landing surface: hero, landing sections, navigation, footer, and the small set of marketing routes.

## Non-goals

- No changes to the product experience behind auth (`/dashboard`, `/assessments`, `/evidence`, `/reports`, `/profile`, `/admin`, `/auth`).
- No competitive anti-SaaS framing (no "no per-seat fees", no "open-source alternative to Vanta/Drata", no "zero license cost").
- No visual redesign — keep the existing FT-style serif typography and color palette (`ft-serif`, `ft-pink`, `ft-cream`, `ft-black`).
- No README rewrite — the README already reads OSS-friendly.

## Audience model (hybrid)

The hosted product and signup flow remain. The landing accommodates two readers in parallel:

- Hosted-product reader: lands, tries a sample, signs up. Existing path preserved.
- OSS reader: lands, sees the GitHub link in the nav and a "Built in the open" block, jumps to the repo. New path added.

Neither audience is treated as primary in the hero copy. The hosted CTA stays; a GitHub CTA gets equal weight next to it.

## Landing page (`app/page.tsx`) — five sections

### 1. Hero

**Headline (unchanged from current):**

> Prove your policies meet the frameworks that matter.

**Subhead (lightly tightened):**

> Upload an evidence document. Graphletter reads it against 1,200+ SCF controls and maps the outcome to 79 frameworks — with AI reasoning quoted back to your source.

Removed from current subhead: the explicit framework name list ("NIST, ISO 27001, SOC 2, GDPR, PCI DSS, and HIPAA — in minutes, with reasoning for every pass, partial, and fail"). The count + cross-framework framing carries the same signal more compactly.

**CTAs (equal weight):**

```
[Try with a sample doc]   [GitHub →]
```

The current secondary CTA `[How it works →]` is replaced by `[GitHub →]` because `/how-it-works` is being deleted.

**Mini-fact line (unchanged):**

> 79 frameworks · 1,200+ controls · 25,000+ cross-framework mappings

No "MIT licensed" or "open source" wording here. The OSS signal in the hero is exclusively the GitHub button and the nav GitHub link.

### 2. Example output

The current "What You Get Back" section, renamed and lightly retitled:

- Heading: `Example output` (was `What You Get Back`)
- Subhead: keep current.
- Table content: keep current (Control / Result / Risk / Frameworks / Deficiencies / Recommendations / Remediation).

No structural changes — this section is already strong and serves as the proof for the headline claim.

### 3. Built in the open

New section, replaces the previous Pipeline 3-card section and the Stats panel.

**Heading:**

> Built in the open

**Body:**

> Graphletter is MIT-licensed and developed in public. The code, the prompts, the SCF mappings, and the schema migrations all live in the repository.

**Three quiet facts (bulleted):**

- **Self-hostable** — run it on your own infrastructure if you'd rather keep evidence inside your perimeter.
- **Inspectable** — read how the assessments are scored, how citations are parsed, how data flows.
- **Forkable** — extend it with your own evidence types or framework mappings.

**Link:**

> `View the code on GitHub →`

Tone constraint: this section is the OSS pitch, and it is deliberately small. No anti-SaaS framing, no manifesto, no four-pillar callouts.

### 4. Closing CTA

Essentially the current closing CTA, kept warm and direct.

**Heading:** `Ready to see a real assessment?`

**Body:** `Pick one of three sample policies and watch Graphletter map it against SCF objectives in under a minute. No signup required.`

**CTAs:**

```
[Try it now]   [Create a free account]
```

### 5. Lean footer

Replace the current four-column dark-slate footer with a single-row lean footer.

```
Graphletter · MIT-licensed · © 2026
Frameworks  Research  Privacy  Terms  Security  GitHub  hello@graphletter.com
```

Removed from footer:

- The "Project" column (Frameworks, How It Works, Try It Out, Research)
- The "Resources" column (Documentation, Privacy, Terms, Security, Status)
- The duplicate `/how-it-works` link labelled "Documentation"
- The "Contact" column (replaced by inline `hello@graphletter.com` mailto)
- The dark slate-900 background — switch to a light/neutral footer matching the rest of the page

Retained: brand wordmark, the routes that survive the trim, GitHub link, contact email, copyright.

## Removed sections from current landing

- **Pipeline 3-card section** ("Upload your evidence" / "AI reads it against the framework" / "Get a gap report you can act on") — content moves implicitly into the subhead.
- **Stats panel** ("79 frameworks", "1,200+ controls", "25,000+ cross-framework mappings", "230+ evidence artifact types") — same numbers survive as the inline mini-fact line under the hero CTAs.

## Top navigation (`components/navigation.tsx`)

Lean nav, modeled on the OSS-project pattern.

**Current nav** (inferred from footer / page links): includes `How It Works`, `Frameworks`, `Research`, `Contact`, and auth links.

**New nav:**

```
Graphletter         Try    GitHub    Log in    Sign up
```

- `Try` links to the renamed `/try` route (see Routes section).
- `GitHub` is an external link to the public repo, opens in a new tab.
- `Log in` and `Sign up` retain current behavior.
- `Frameworks`, `Research`, and `Security` are reachable from the footer; no top-nav surface.
- The mobile menu mirrors this same set.

## Routes

### Keep

- `/` — landing (rewritten per sections above)
- `/try` — renamed from `/try-it-out`; sample-doc upload flow. The functional behavior of `TryItOutContent` is unchanged.
- `/research`
- `/frameworks`
- `/privacy`, `/terms`, `/security`, `/scf-attribution`
- All product routes behind auth: `/dashboard`, `/assessments`, `/evidence`, `/reports`, `/profile`, `/admin`, `/auth/*`
- All API routes under `/api`

### Delete

- `/how-it-works` — 669-line marketing deep-dive; the landing absorbs what's needed.
- `/demo` — currently just a redirect to `/how-it-works`. Dead route.
- `/contact` — sales-funnel page ("primary framework focus", "target timeline"). Replaced by `mailto:hello@graphletter.com` link in footer.

### Rename

- `/try-it-out` → `/try`. Add a redirect from `/try-it-out` to `/try` to preserve any external links.

### Link cleanup

After route deletes and the rename, scan and update every internal `Link` and `href` reference:

- `components/footer.tsx` — drops `/how-it-works`, `/try-it-out` → `/try`, removes "Documentation" link
- `components/navigation.tsx` — drops marketing links, adds GitHub external link
- `app/page.tsx` — secondary hero CTA changes from `/how-it-works` to GitHub external
- Anywhere else that links `/how-it-works`, `/demo`, `/contact`, `/try-it-out`: update or remove

### Tone passes

- `/research/page.tsx` — already OSS-friendly; the "Get in touch" CTA is a mailto. Leave unchanged.
- `/try/page.tsx` — soften the page heading copy if needed (currently "Try It Out / See how AI compliance assessment works…"). The functional `<TryItOutContent />` block is unchanged.
- `/security/page.tsx` — verify a security-disclosure email is already presented here (the deleted `/contact` page hosts a "Security Reports" bucket with a `security@graphletter.com` mailto; if `/security` doesn't already expose the same contact, add it). `SECURITY.md` covers the GitHub-facing path.

## Components touched

- `app/page.tsx` — rewrite per Sections 1–4 above
- `components/navigation.tsx` — lean nav + GitHub link
- `components/footer.tsx` — collapse to single-row lean footer; remove dark slate background
- `app/try-it-out/page.tsx` → move/rename to `app/try/page.tsx`
- `app/try-it-out/` → add a redirect (or leave a thin `redirect()` stub at the old path)
- `app/how-it-works/`, `app/demo/`, `app/contact/` — delete the directories

## Implementation order

1. Rename `app/try-it-out/page.tsx` to `app/try/page.tsx`. Add a thin `app/try-it-out/page.tsx` that calls `redirect("/try")` so external links don't 404.
2. Update `app/page.tsx` to the five-section structure.
3. Update `components/navigation.tsx` and `components/footer.tsx`.
4. Delete `app/how-it-works/`, `app/demo/`, `app/contact/` directories.
5. Sweep for any remaining string references (`grep -r "how-it-works\|/demo\|/contact\|try-it-out"` excluding node_modules and .next); fix or remove each. Note: the existing `/try-it-out` redirect is the only valid post-trim usage of that string.
6. Update Playwright selectors and assertions broken by the structural changes.
7. Run `pnpm typecheck`, `pnpm lint`, `pnpm build`. Type errors from `.next/types/validator.ts` on deleted routes are expected — clear `.next/types/` if so (see memory ID 7572).

## Risks

- **Playwright tests** likely reference `data-testid="hero-primary-cta"`, `data-testid="pipeline-card-title"`, `data-testid="landing-closing-cta"`, `data-testid="try-it-out-heading"`, `data-testid="footer-link-how-it-works"`, etc. Removing the pipeline cards, renaming the page, and dropping the dark footer will break some assertions. Plan to update tests in the same change.
- **External SEO / inbound links** to `/how-it-works`, `/demo`, `/contact` will 404 unless we add stub redirects. Acceptable for a newly open-sourced project — but worth a conscious decision.
- **`Navigation` is `"use client"`** (per recent observation IDs 7568, 7572). Verify the new GitHub external link plays well with client navigation.
- **`.next/types/validator.ts` staleness** on route deletes — clear `.next/types/` after deletes (memory ID 7572 confirms this pattern).

## Out of scope (deliberately)

- Visual redesign (typography, color palette)
- Hero imagery / classical-art-style hero
- README changes
- Pricing page (none exists)
- Status page (`status.graphletter.com` — external, untouched)
- Any change to dashboard / authenticated UI

## Success criteria

- A reader who lands on `/` and doesn't scan the nav sees a focused product pitch with no marketing chest-thumping.
- A reader who scans the nav sees the GitHub link and reaches the repo in one click.
- A reader who scrolls all the way down hits the "Built in the open" block and the closing CTA — the OSS framing is _present_ but not _loud_.
- No marketing-funnel pages remain in the route tree.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- Playwright UI suite passes (with tests updated where the landing structure changed).
