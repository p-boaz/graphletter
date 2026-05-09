# Contributing to Graphletter

Thanks for considering a contribution.

## How to contribute

1. **Open an issue first** for anything beyond a typo. Describe what you want to change and why; we'll align on scope before code.
2. Fork the repo, create a topic branch from `main`.
3. Make your change. Keep PRs focused — one concern per PR.
4. Run the local checks:
   ```sh
   pnpm typecheck && pnpm lint && pnpm test:scf
   ```
   All must pass.
5. Open a pull request that references the issue.

## Code conventions

- TypeScript strict — no `as any` without a justifying comment on the same line.
- Use `createLogger` from `@/lib/logger`, not `console.log`, inside `app/api/` and `lib/`. For request-scoped API logging, use `createRequestLogger` from `@/lib/observability/logger`.
- Conventional Commits format for commit messages (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Per-task spec files under `plans/task-YYYY-MM-DD-slug.md` for non-trivial changes — see `plans/task-template.md`.
- See [AGENTS.md](AGENTS.md) for the full coding standard, scope rules, and testing expectations.

## Scope

Graphletter is primarily authored and maintained by one person. Response times may vary. The bar for changes to the AI assessment pipeline is high — correctness matters more than velocity. Small UI fixes, typos, and documentation improvements are welcome and will be reviewed promptly.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

If you find a security vulnerability, please **do not file a public issue**. Email the maintainer directly at `security@graphletter.com` with the details. We'll respond within a reasonable window and credit you in the fix unless you prefer otherwise.
