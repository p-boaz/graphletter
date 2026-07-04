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

test("dashboard smoke flow renders key states and framework focus", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();
  const reviewDialogSpamLogs: string[] = [];
  const handleConsole = (msg: { type: () => string; text: () => string }) => {
    if (
      msg.type() === "log" &&
      msg.text().includes("[AssessmentReviewDialog] No result or empty assessments array")
    ) {
      reviewDialogSpamLogs.push(msg.text());
    }
  };
  page.on("console", handleConsole);

  try {
    await mockDashboardApis(page);
    await login_test_user(page);

    await expect(page.getByTestId(selectors.dashboard.overviewCard)).toBeVisible();
    await expect(page.getByTestId(selectors.public.navHeader)).not.toContainText("Sign in");
    await expect(page.getByTestId(selectors.dashboard.coverageSummaryCard)).toContainText("1/2");
    await expect(page.getByTestId(selectors.dashboard.coverageSummaryCard)).toContainText(
      "100% Coverage"
    );
    await expect(page.getByText("Coverage by Domain")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Analytics drill-down" })).toBeVisible();

    await page.getByTestId(selectors.dashboard.frameworkFilterTrigger).click();
    await page
      .getByRole("option", {
        name: "NIST CSF v2.0 (2 linked controls)",
        exact: true,
      })
      .click();

    await expect(page.getByTestId(selectors.dashboard.coverageModeBadge)).toHaveText(
      "Framework focus mode"
    );
    await expect(page.getByTestId(selectors.dashboard.clearFrameworkFocusButton)).toBeVisible();
    await page.getByTestId(selectors.dashboard.clearFrameworkFocusButton).click();
    await expect(page.getByTestId(selectors.dashboard.coverageModeBadge)).toHaveText(
      "SCF coverage"
    );
    expect(reviewDialogSpamLogs).toHaveLength(0);
  } finally {
    observer.stop();
    report = observer.getReport();
    page.off("console", handleConsole);
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "dashboard-smoke");
  }

  assert_no_browser_failures(report);
});
