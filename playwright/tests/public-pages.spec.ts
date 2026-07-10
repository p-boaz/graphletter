import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  open_local_app,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { selectors } from "../helpers/selectors";

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
