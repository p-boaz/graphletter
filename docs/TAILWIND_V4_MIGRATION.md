# Tailwind CSS V4 Migration

Graphletter migrated to Tailwind CSS v4 on 2026-06-26 for issue
[#30](https://github.com/p-boaz/graphletter/issues/30).

## Runtime Setup

- `tailwindcss` is pinned to v4 in `package.json`.
- `@tailwindcss/postcss` is the PostCSS plugin in `postcss.config.mjs`.
- `app/globals.css` imports Tailwind with `@import "tailwindcss"`.
- `app/globals.css` loads the existing shadcn-oriented config with
  `@config "../tailwind.config.ts"`.

The migration deliberately keeps `tailwind.config.ts` instead of converting the
theme to CSS-first configuration. That preserves the current shadcn/ui token
names, custom font families, custom animations, and `tailwindcss-animate`
plugin behavior with the smallest production blast radius.

## Compatibility Decisions

- **Browser baseline:** Tailwind v4 targets modern browsers: Safari 16.4+,
  Chrome 111+, and Firefox 128+. Graphletter does not claim support below that
  baseline.
- **Border defaults:** Tailwind v4 changed default border color behavior. The
  app keeps an explicit base border color tied to `--border` so existing
  shadcn-style `border` utilities remain visually stable.
- **Ring defaults:** Tailwind v4 changed bare ring width/color. The app sets
  `--default-ring-width` and `--default-ring-color` to preserve v3-like focus
  treatment for existing controls.
- **Legacy config:** Tailwind v4 does not automatically discover JavaScript
  config files. `@config` is required while the project keeps
  `tailwind.config.ts`.
- **FT utilities:** Custom Financial Times utility classes remain in
  `app/globals.css`; they are product styles, not migration artifacts.

## Validation Coverage

The migration is considered valid only when these pass:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:ui:bg playwright/tests/public-pages.spec.ts
pnpm test:ui:bg playwright/tests/dashboard.spec.ts
pnpm check:spec
```

Public pages cover marketing/global styles and custom FT utilities. Dashboard
coverage exercises authenticated shadcn surfaces, cards, forms, borders, focus
states, and app navigation.
