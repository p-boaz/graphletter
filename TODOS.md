# TODOs

## ⚠️ LOUD REMINDER — pristine on-disk text produced exceptional assessment results (2026-07-08)

During the ADR-001 probe runs (`scripts/out/assessment-probe-2026-07-08T17-44-14-071Z.*`),
the assessor was fed the document text **read directly from disk — pristine, full,
uncorrupted** — and the results were exceptional: exact offset-verified citations
(e.g. the Okta/SAML/2FA mandate at chars 8,223–8,975 of GitLab's Password
Standard), correct maturity movement (L1→L2), and reasoning that survives an
assessor's read. The production path at the time reconstructed text from
overlapping stored chunks and could not reproduce this quality (PR #45 review,
finding #1).

Two things to remember here:

1. **Pristine full text is the proven quality bar.** Any evidence-serving path
   (chunk store, extraction cache, retrieval packets) must be measured against
   the direct-read baseline in the probe JSONL before it ships. If a serving
   layer degrades the text, it degrades the product.
2. **Direct-from-disk assessment may be a product path of its own.** An
   agent/CLI that assesses documents straight off a filesystem (a repo, a
   policy folder, a GRC export) skips upload/extraction/chunking entirely and
   inherits the exceptional-quality path for free. Peter flagged this as
   potentially interesting for a later date (2026-07-08) — revisit when the
   ADR-001 fix round has shipped.

Context: `docs/adr/001-assessment-evidence-architecture.md`, probe eyeball sheet
at `scripts/out/assessment-probe-eyeball-sheet.md`.
