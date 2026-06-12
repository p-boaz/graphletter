import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  login_test_user,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { DEFAULT_ARTIFACT_NAME, mockUploadWorkflowApis } from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

const FIXTURE_PATH = path.resolve(process.cwd(), "data/anthropic-controls.pdf");

test("classifier pre-fills documentation artifact from filename", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);

    // Dashboard landing page + ImpactPreviewBanner also fire these — stub
    // them to keep the observer clean without muddying mockUploadWorkflowApis.
    await page.route("**/api/compliance/inbox**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ inbox: { items: [] } }),
      });
    });
    await page.route("**/api/compliance/impact-preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          preview: {
            currentScore: 72.5,
            projectedScore: 78.3,
            improvementPct: 5.8,
            frameworkImpacts: [],
          },
        }),
      });
    });

    // The upload pipeline races the badge assertion: with every API mocked,
    // upload completes almost instantly and the dialog advances past the
    // artifact form, unmounting the badge. Hold extraction until the badge
    // is verified; fallback() then defers to mockUploadWorkflowApis's handler.
    let releaseExtraction: () => void = () => {};
    const extractionGate = new Promise<void>((resolve) => {
      releaseExtraction = resolve;
    });
    await page.route("**/api/evidence/extract-content", async (route) => {
      await extractionGate;
      await route.fallback();
    });

    const classifyCalls: Array<Record<string, unknown>> = [];

    await page.route("**/api/artifacts/classify", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      classifyCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          artifact: DEFAULT_ARTIFACT_NAME,
          erlId: "ERL-AC-001",
          confidence: "high",
          reasoning: "filename contains 'controls'",
        }),
      });
    });

    await login_test_user(page);

    await page.getByTestId(selectors.upload.openSmartUploadButton).first().click();

    const dialog = page.getByTestId(selectors.upload.dialog);
    await expect(dialog).toBeVisible();

    // Do NOT pick an artifact. Drop the file directly — classifier should fill it.
    await dialog.getByTestId(selectors.upload.documentUploadInput).setInputFiles(FIXTURE_PATH);

    await expect.poll(() => classifyCalls.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    expect(classifyCalls[0]).toMatchObject({
      filename: path.basename(FIXTURE_PATH),
    });

    await expect(dialog.getByTestId("artifact-ai-suggested")).toBeVisible();
    releaseExtraction();

    // Verify the classifier's artifact flowed through to the upload workflow.
    await expect
      .poll(() => calls.documentsCalls.length, { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);
    expect(calls.documentsCalls[0]).toMatchObject({
      metadata: {
        documentation_artifact: DEFAULT_ARTIFACT_NAME,
      },
    });
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "artifact-classifier-prefill");
  }

  assert_no_browser_failures(report);
});

test("classifier failure leaves combobox empty and does not block manual flow", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);

    // See prefill test above for why these dashboard stubs are needed.
    await page.route("**/api/compliance/inbox**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ inbox: { items: [] } }),
      });
    });

    await page.route("**/api/artifacts/classify", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Classifier unavailable" }),
      });
    });

    await login_test_user(page);

    await page.getByTestId(selectors.upload.openSmartUploadButton).first().click();

    const dialog = page.getByTestId(selectors.upload.dialog);
    await expect(dialog).toBeVisible();

    // Drop file without selecting an artifact; classifier returns 503.
    await dialog.getByTestId(selectors.upload.documentUploadInput).setInputFiles(FIXTURE_PATH);

    // Upload workflow must NOT have fired.
    await page.waitForTimeout(1500);
    expect(calls.documentsCalls.length).toBe(0);
    await expect(dialog.getByTestId("artifact-ai-suggested")).not.toBeVisible();
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "artifact-classifier-failure-graceful");
  }

  // Intentionally no `assert_no_browser_failures` — this test triggers a 503
  // on /api/artifacts/classify on purpose to verify graceful degradation.
  // Matches the pattern in evidence-errors.spec.ts.
});
