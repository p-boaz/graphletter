import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";

function qaUserIsAdminAllowlisted() {
  const qaEmail = process.env.QA_USER_EMAIL?.trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(qaEmail && adminEmails.includes(qaEmail));
}

test.describe("admin artifacts denied state", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders a safe denial for signed-out users", async ({ page }, testInfo) => {
    const observer = inspect_console_errors(page);
    let report = observer.getReport();

    try {
      await page.goto("/admin/artifacts");

      await expect(page.getByTestId("admin-artifacts-denied")).toBeVisible();
      await expect(page.getByTestId("admin-artifacts-denied")).toContainText("Sign in required");
      await expect(page.getByTestId("admin-artifacts-page")).toHaveCount(0);
    } finally {
      observer.stop();
      report = observer.getReport();
      await trace_failure(testInfo, report);
      await take_snapshot(page, testInfo, "admin-artifacts-denied");
    }

    assert_no_browser_failures(report);
  });
});

test.describe("admin artifacts editor", () => {
  test.skip(
    !qaUserIsAdminAllowlisted(),
    "Set ADMIN_EMAILS=$QA_USER_EMAIL to exercise the authorized admin editor UI"
  );

  test("renders artifacts for an allowlisted admin", async ({ page }, testInfo) => {
    const observer = inspect_console_errors(page);
    let report = observer.getReport();
    const apiCalls: string[] = [];

    try {
      await page.route("**/api/admin/artifacts**", async (route) => {
        apiCalls.push(route.request().method());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            artifacts: [
              {
                id: "artifact-1",
                documentation_artifact: "Access Control Policy",
                artifact_description: "Policy evidence",
                scf_control_mappings: ["AC-01"],
              },
            ],
          }),
        });
      });

      await page.goto("/admin/artifacts");
      await page.waitForLoadState("networkidle");

      await expect(page.getByTestId("admin-artifacts-page")).toBeVisible();
      await expect(page.getByTestId("admin-artifacts-table")).toBeVisible();
      await expect(page.getByTestId("admin-artifacts-row-artifact-1")).toContainText(
        "Access Control Policy"
      );
      expect(apiCalls).toContain("GET");
    } finally {
      observer.stop();
      report = observer.getReport();
      await trace_failure(testInfo, report);
      await take_snapshot(page, testInfo, "admin-artifacts-page");
    }

    assert_no_browser_failures(report);
  });
});
