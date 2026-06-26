# Dependency Provenance

This file records dependency sources that need extra supply-chain handling beyond
normal registry package installation.

## SheetJS `xlsx`

### Decision

Graphletter keeps `xlsx` pinned to the official SheetJS CDN tarball:

```text
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

The package is used by the SCF extraction/verifier pipeline:

- `scripts/extract-scf.ts`
- `scripts/verify-scf-extraction.ts`
- related Node tests that build and parse XLSX fixtures

The dependency remains CDN-pinned because the current SheetJS Community Edition
release used here is distributed from SheetJS infrastructure rather than npm.
Moving back to an older npm-registry package would downgrade the parser and risk
changing deterministic XLSX extraction output.

### Pin

The committed lockfile must pin all of the following:

- Package specifier: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- Tarball URL: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- Package version: `0.20.3`
- Integrity:
  `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`

Verify the committed package and lockfile pins with:

```sh
pnpm verify:sheetjs-provenance
```

This check is offline. It verifies committed files only; it does not trust the
network or the current contents served by the CDN.

### License Rationale

The installed `xlsx@0.20.3` package declares `Apache-2.0` in its package
metadata and ships a `LICENSE` file in the tarball. That license is compatible
with Graphletter's MIT-licensed source distribution.

Keep the vendored SCF data license posture separate from this dependency:
SCF data provenance is tracked in `data/PROVENANCE.json`,
`data/README.md`, and `data/LICENSE_AUDIT.json`.

### Audit Gap

Because `xlsx` is installed from a direct tarball URL, it can sit outside some
npm-registry advisory and provenance workflows. Treat `pnpm audit` as necessary
but not sufficient for this package. The compensating controls are:

- exact tarball URL pin in `package.json`;
- exact sha512 integrity pin in `pnpm-lock.yaml`;
- offline verification through `pnpm verify:sheetjs-provenance`;
- SCF extraction determinism checks through `pnpm verify:scf-extraction`.

### Update Procedure

Only update SheetJS when the SCF extraction pipeline needs a parser fix or a
security issue requires an upgrade.

1. Change the `xlsx` URL in `package.json` to the exact new SheetJS tarball.
2. Run `pnpm install` so `pnpm-lock.yaml` records the new tarball URL, version,
   and integrity.
3. Update the expected constants in `scripts/verify-sheetjs-provenance.js`.
4. Run:

   ```sh
   pnpm verify:sheetjs-provenance
   pnpm verify:scf-extraction
   pnpm test:integration
   pnpm lint
   pnpm typecheck
   ```

5. Review any changed `data/` outputs. A parser upgrade must not silently alter
   SCF CSV bytes. If data bytes change, the commit must explain why the parser
   change is correct and update the SCF provenance artifacts in the same change.
6. Record the reason for the update in the commit body.
