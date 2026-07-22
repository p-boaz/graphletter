import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  open_local_app,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { selectors } from "../helpers/selectors";
import {
  CONTROL_COUNT,
  CROSSWALK_COUNT,
  FRAMEWORK_COUNT,
  SCF_EDITION,
  formatStat,
} from "../../lib/scf/catalog-stats";

test("public pages: dogfood report regressions are covered", async ({ page }, testInfo) => {
  test.setTimeout(60_000);

  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await open_local_app(page, "/docs");

    const nav = page.getByTestId(selectors.public.navHeader);
    await expect(nav).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 260));
    const navBackground = await nav.evaluate((element) => {
      return window.getComputedStyle(element).backgroundColor;
    });
    expect(navBackground).not.toBe("rgba(0, 0, 0, 0)");

    // The lean-nav redesign removed "Frameworks" from the header (it lives in
    // the footer, which has no active styling) — the page content assertions
    // below are the regression coverage for this route.
    await open_local_app(page, "/frameworks");

    const searchInput = page.getByTestId(selectors.public.frameworkSearchInput);
    const resultsCount = page.getByTestId(selectors.public.frameworkResultsCount);
    const frameworkCardLinks = page.getByTestId(selectors.public.frameworkCardLink);

    await expect(searchInput).toBeVisible();
    await expect(resultsCount).toBeVisible();
    await expect(frameworkCardLinks.first()).toBeVisible();

    const descriptions = await page
      .getByTestId(selectors.public.frameworkCardDescription)
      .allTextContents();
    const uniqueDescriptionCount = new Set(
      descriptions.slice(0, 12).map((description) => description.trim())
    ).size;
    expect(uniqueDescriptionCount).toBeGreaterThan(1);

    const firstTitle = await page
      .getByTestId(selectors.public.frameworkCardTitle)
      .first()
      .innerText();
    const searchToken =
      firstTitle
        .split(/\s+/)
        .map((token) => token.replace(/[^a-zA-Z0-9-]/g, ""))
        .find((token) => /[a-zA-Z]/.test(token) && !/^v\d/i.test(token)) || firstTitle;

    await searchInput.fill(searchToken);
    await expect(resultsCount).toContainText("of");
    await expect(frameworkCardLinks.first()).toBeVisible();

    const firstFrameworkHref = await frameworkCardLinks.first().getAttribute("href");
    expect(firstFrameworkHref).toMatch(/^\/frameworks\/[^/]+$/);

    await frameworkCardLinks.first().click();
    await expect(page).toHaveURL(/\/frameworks\/[^/]+$/, { timeout: 20_000 });
    const detailHeading = page.getByTestId(selectors.public.frameworkDetailHeading);
    await expect(detailHeading).toBeVisible();
    // Versions are stored "v2017"-style; formatFrameworkVersion must not
    // double the prefix into "vv2017" on the detail heading.
    await expect(detailHeading).not.toContainText(/vv\d/i);
    await expect(page.getByTestId(selectors.public.frameworkDetailMappings)).toBeVisible();

    await open_local_app(page, "/try");
    await expect(page.getByTestId(selectors.public.tryItOutHeading)).toBeVisible();
    await expect(page.getByTestId(selectors.public.tryItOutSummary)).toContainText(
      "Smart Evidence Upload flow"
    );
    await expect(page.getByTestId(selectors.public.tryItOutLiveUploadSection)).toBeVisible();
    await expect(page.getByTestId(selectors.upload.openSmartUploadButton)).toBeVisible();
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "public-pages");
  }

  assert_no_browser_failures(report);
});

test("framework detail: mappings paginate honestly and search narrows", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);

  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    // SOC 2 is the largest supported framework (1,478 mappings in 2026.2) —
    // the real test of the old first-20 cutoff this replaced.
    await open_local_app(page, "/frameworks");
    await page.getByTestId(selectors.public.frameworkSearchInput).fill("SOC 2");
    const cardLink = page.getByTestId(selectors.public.frameworkCardLink).first();
    await expect(cardLink).toBeVisible();
    await cardLink.click();
    await expect(page).toHaveURL(/\/frameworks\/[^/]+$/, { timeout: 20_000 });
    const detailUrl = page.url();

    const range = page.getByTestId(selectors.public.frameworkMappingsRange);
    await expect(range).toContainText(/Showing 1–24 of \d+/);
    const totalText = (await range.innerText()).match(/of (\d+)/)?.[1];
    expect(Number(totalText)).toBeGreaterThan(48);

    // Tier badge states the actual catalog tier, never a generic "Active".
    await expect(page.getByTestId(selectors.public.frameworkTierBadge)).toHaveText(
      /Supported|Preview/
    );

    // Page 2 is a distinct window onto the same total.
    const firstCardPage1 = await page
      .getByTestId(selectors.public.frameworkDetailMappings)
      .locator("span")
      .first()
      .innerText();
    await page.getByTestId(selectors.public.frameworkMappingsNext).click();
    await expect(range).toContainText(new RegExp(`Showing 25–48 of ${totalText}`));
    const firstCardPage2 = await page
      .getByTestId(selectors.public.frameworkDetailMappings)
      .locator("span")
      .first()
      .innerText();
    expect(firstCardPage2).not.toBe(firstCardPage1);

    // Server-side search narrows the range and the result set together.
    await page.getByTestId(selectors.public.frameworkMappingSearchInput).fill("CC1");
    await page.getByTestId(selectors.public.frameworkMappingSearchInput).press("Enter");
    await expect(range).toContainText(/matching "CC1"/);
    const narrowedTotal = (await range.innerText()).match(/of (\d+)/)?.[1];
    expect(Number(narrowedTotal)).toBeLessThan(Number(totalText));

    // Out-of-range page degrades to the empty state with the honest total.
    await page.goto(`${detailUrl}?page=9999`);
    await expect(page.getByTestId(selectors.public.frameworkMappingsRange)).toBeVisible();
    await expect(page.getByText(/out of range/)).toBeVisible();
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "framework-detail-pagination");
  }

  assert_no_browser_failures(report);
});

test("stage-7 cohort: promoted frameworks are listed and badged Supported", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);

  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    // First preview → supported promotion (plans/task-2026-07-11-scf-cohort-1-promotion.md):
    // the FedRAMP ×4 / GovRAMP ×6 / NIST-profile ×5 cohort must surface in the
    // public catalog as full supported-tier members, not previews.
    await open_local_app(page, "/frameworks");
    const searchInput = page.getByTestId(selectors.public.frameworkSearchInput);
    const cardLinks = page.getByTestId(selectors.public.frameworkCardLink);
    const cardTitles = page.getByTestId(selectors.public.frameworkCardTitle);

    await searchInput.fill("FedRAMP");
    await expect(cardTitles.first()).toContainText("FedRAMP");
    expect(await cardLinks.count()).toBeGreaterThanOrEqual(4);

    await cardLinks.first().click();
    await expect(page).toHaveURL(/\/frameworks\/[^/]+$/, { timeout: 20_000 });
    // Exactly "Supported" — a "Preview" badge here means the promotion did
    // not reach the serving path.
    await expect(page.getByTestId(selectors.public.frameworkTierBadge)).toHaveText("Supported");
    await expect(page.getByTestId(selectors.public.frameworkMappingsRange)).toContainText(
      /Showing 1–\d+ of \d+/
    );

    await open_local_app(page, "/frameworks");
    await searchInput.fill("GovRAMP");
    await expect(cardTitles.first()).toContainText("GovRAMP");
    expect(await cardLinks.count()).toBeGreaterThanOrEqual(6);

    // The NIST third of the cohort: presence in this list pins the tier,
    // because the /frameworks feed serves supported-only by default.
    const nistCohort = [
      "NIST AI 600-1",
      "NIST SP 800-66 R2",
      "NIST 800-82 R3",
      "NIST 800-172A R3",
      "NIST CSWP 39",
    ];
    for (const name of nistCohort) {
      await searchInput.fill(name);
      await expect(cardTitles.first()).toContainText(name);
    }

    // Detail badge on one NIST member too, not just FedRAMP.
    await cardLinks.first().click();
    await expect(page).toHaveURL(/\/frameworks\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByTestId(selectors.public.frameworkTierBadge)).toHaveText("Supported");
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "stage-7-cohort");
  }

  assert_no_browser_failures(report);
});

test("landing hero: SCF edition and catalog stats match the seeded catalog", async ({ page }) => {
  // The 2026.2 migration shipped while the hero still hardcoded "2026.1.1" /
  // "1,468 controls" (plans/task-2026-07-17-homepage-scf-edition-stats.md).
  // The hero now derives from data/seed/expected_row_counts.json via
  // lib/scf/catalog-stats — assert the derived values render and the stale
  // edition string is gone from the whole page.
  await open_local_app(page, "/");

  const stats = page.getByTestId(selectors.public.heroStats);
  await expect(stats).toBeVisible();
  await expect(stats).toContainText(SCF_EDITION);
  await expect(stats).toContainText(String(FRAMEWORK_COUNT));
  await expect(stats).toContainText(formatStat(CONTROL_COUNT));
  await expect(stats).toContainText(formatStat(CROSSWALK_COUNT));

  await expect(page.locator("body")).not.toContainText("2026.1.1");
});

test("public pages: meta-description framework count stays truthful", async ({ page }) => {
  // Truth line (plans/task-2026-07-11-framework-count-truth-line.md): the
  // description's "60+" is a durable floor for MAPPED_FRAMEWORK_COUNT; the
  // stale "76 other" / "79+" claims must never come back.
  await open_local_app(page, "/");
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description).toContain("60+ other frameworks");
  expect(description).not.toMatch(/7[69]\+? other/);
});
