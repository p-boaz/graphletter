import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  login_test_user,
  open_local_app,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { mockAssessmentsPageApis, mockDashboardApis } from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test("assessments page keeps explainer in-context and opens row details without upload modal", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockDashboardApis(page);
    await mockAssessmentsPageApis(page);
    await login_test_user(page);
    await open_local_app(page, "/dashboard/assessments");

    await expect(page).toHaveURL(/\/dashboard\/assessments(?:\?|$)/);

    const explainerButton = page.getByTestId(selectors.assessments.openExplainerButton);
    const inlineExplainer = page.getByTestId(selectors.assessments.inlineExplainer);
    await expect(explainerButton).toBeVisible();
    // A click can land before Next dev finishes hydrating and get lost
    // (the old single re-click still flaked under load) — retry the
    // toggle until the explainer actually opens.
    await expect(async () => {
      if (!(await inlineExplainer.isVisible())) {
        await explainerButton.click();
      }
      await expect(inlineExplainer).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard\/assessments(?:\?|$)/);

    const firstAssessmentRow = page.getByTestId(selectors.assessments.controlRow).first();
    await expect(firstAssessmentRow).toBeVisible();
    await firstAssessmentRow.click();

    await expect(page.getByTestId(selectors.assessments.detailDialog)).toBeVisible();
    await expect(page.getByTestId(selectors.assessments.detailDialog)).toContainText(
      "Assessment details"
    );
    await expect(page.getByTestId(selectors.assessments.detailRunGroup)).toHaveCount(2);
    await expect(page.getByTestId(selectors.assessments.detailDialog)).toContainText(
      "incident-response-playbook.pdf"
    );
    await expect(page.getByTestId(selectors.assessments.detailDialog)).toContainText(
      "incident-drill-report.docx"
    );

    await expect(page.getByTestId(selectors.upload.dialog)).toHaveCount(0);
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "assessments-page");
  }

  assert_no_browser_failures(report);
});

test("assessments page exports results as a CSV download", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockDashboardApis(page);
    await mockAssessmentsPageApis(page);

    const csvBody = [
      "Control ID,Title,Frameworks,Verdict,Confidence %,Objectives Passed,Objectives Total,Summary",
      "AC-01,Access control policy,NIST CSF,PASS,90,2,2,All objectives passed",
    ].join("\r\n");

    await page.route("**/api/assessments/export**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="graphletter-assessments-2026-06-12.csv"',
        },
        body: csvBody,
      });
    });

    await login_test_user(page);
    await open_local_app(page, "/dashboard/assessments");

    const exportButton = page.getByTestId(selectors.assessments.exportButton);
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(selectors.assessments.exportCsv).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("graphletter-assessments-2026-06-12.csv");
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "assessments-export");
  }

  assert_no_browser_failures(report);
});

test("export route serves a real CSV end-to-end (unmocked)", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    // History is mocked so the export menu renders; the export route itself
    // is NOT mocked — this exercises real auth, the loader, and the
    // serializer against the live database.
    await mockDashboardApis(page);
    await mockAssessmentsPageApis(page);
    await login_test_user(page);
    await open_local_app(page, "/dashboard/assessments");

    await page.getByTestId(selectors.assessments.exportButton).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(selectors.assessments.exportCsv).click();
    const download = await downloadPromise;

    const today = new Date().toISOString().slice(0, 10);
    expect(download.suggestedFilename()).toBe(`graphletter-assessments-${today}.csv`);

    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(path, "utf-8");
    expect(content.split("\r\n")[0]).toBe(
      "Control ID,Title,Frameworks,Verdict,Confidence %,Objectives Passed,Objectives Total,Summary"
    );
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "assessments-export-real");
  }

  assert_no_browser_failures(report);
});
