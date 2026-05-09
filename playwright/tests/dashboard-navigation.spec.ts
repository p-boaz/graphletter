import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  login_test_user,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { mockDashboardApis } from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test("dashboard tabs navigate on first click between overview, evidence, and assessments", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockDashboardApis(page);
    await login_test_user(page);

    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);

    await page.getByTestId(selectors.dashboard.navTabEvidence).click();
    await expect(page).toHaveURL(/\/dashboard\/evidence(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Evidence Records" }).first()).toBeVisible();

    await page.getByTestId(selectors.dashboard.navTabAssessments).click();
    await expect(page).toHaveURL(/\/dashboard\/assessments(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Assessment Results" }).first()).toBeVisible();

    await page.getByTestId(selectors.dashboard.navTabOverview).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Compliance Dashboard" })).toBeVisible();

    const publicFrameworkLink = page
      .getByTestId(selectors.public.navHeader)
      .getByRole("link", { name: "Frameworks" })
      .first();

    const navHeader = page.getByTestId(selectors.public.navHeader);
    const signInMonitorPromise = (async () => {
      let signInVisible = false;
      for (let pollCount = 0; pollCount < 12; pollCount += 1) {
        const navText = (await navHeader.textContent()) || "";
        if (navText.includes("Sign in")) {
          signInVisible = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      return signInVisible;
    })();

    await publicFrameworkLink.click();
    await expect(page).toHaveURL(/\/frameworks(?:\?|$)/);
    expect(await signInMonitorPromise).toBe(false);
  } finally {
    observer.stop();
    report = observer.getReport();
    report.failedRequests = report.failedRequests.filter(
      (request) =>
        !(request.errorText.includes("net::ERR_ABORTED") && request.url.includes("_rsc="))
    );
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "dashboard-navigation");
  }

  assert_no_browser_failures(report);
});

test.describe("dashboard first-run", () => {
  test("shows first-run hero when user has no evidence", async ({ page }) => {
    await mockDashboardApis(page);
    await page.route("**/api/evidence/count", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0 }),
      })
    );

    await page.setExtraHTTPHeaders({ "x-test-bypass-auth": "1" });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page.getByTestId("dashboard-first-run-hero")).toBeVisible();
    await expect(page.getByTestId("first-run-upload-cta")).toBeVisible();
  });
});
