import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  login_test_user,
  run_critical_path,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import {
  DEFAULT_ARTIFACT_NAME,
  DEFAULT_DOCUMENT_ID,
  DEFAULT_EVIDENCE_ID,
  mockUploadWorkflowApis,
} from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test.setTimeout(60_000);

test("upload flow runs end-to-end and posts expected graph payloads", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();
  let workflowCompleted = false;

  try {
    const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
    await login_test_user(page);

    const openUploadButton = page.getByTestId(selectors.upload.openSmartUploadButton).first();
    await openUploadButton.focus();
    await expect(openUploadButton).toBeFocused();
    await page.keyboard.press("Enter");

    const smartUploadDialog = page.getByTestId(selectors.upload.dialog);
    await expect(smartUploadDialog).toBeVisible();

    await smartUploadDialog.getByTestId(selectors.upload.documentationArtifactCombobox).click();
    await page.getByPlaceholder("Search artifacts...").fill(DEFAULT_ARTIFACT_NAME);
    await page.getByRole("option", { name: DEFAULT_ARTIFACT_NAME, exact: true }).click({
      force: true,
    });

    const uploadTarget = smartUploadDialog.getByRole("button", { name: "Upload evidence file" });
    await expect(uploadTarget).toBeVisible();
    await expect(uploadTarget).toHaveAttribute("aria-disabled", "false");

    await smartUploadDialog
      .getByTestId(selectors.upload.documentUploadInput)
      .setInputFiles(path.resolve(process.cwd(), "data/anthropic-controls.pdf"));

    await expect(smartUploadDialog.getByText("Ready to assess")).toBeVisible();

    await smartUploadDialog.getByTestId(selectors.upload.startAiAssessmentButton).click();

    const reviewDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: "Assessment Review Required" });
    await expect(reviewDialog).toBeVisible();

    await reviewDialog.getByRole("button", { name: "View Detailed Results" }).click();
    const detailDialog = page.locator('[role="dialog"]').filter({ hasText: "Assessment Details" });
    await expect(detailDialog.getByText("Verified Evidence")).toBeVisible();
    await expect(detailDialog.getByText('"Access control policy"')).toBeVisible();
    await expect(detailDialog.getByText("Offsets 0-21")).toHaveCount(0);
    await expect(
      detailDialog
        .locator("figure")
        .filter({ hasText: '"Access control policy"' })
        .locator("figcaption")
    ).toHaveText("Documents the access control policy.");
    await detailDialog.getByRole("button", { name: "Back to summary" }).click();

    await reviewDialog.getByTestId(selectors.upload.approveAssessmentButton).click();
    await expect(reviewDialog).toBeHidden();
    await expect(smartUploadDialog.getByText("Assessment approved")).toBeVisible();

    await expect.poll(() => calls.documentsCalls.length).toBe(1);
    await expect.poll(() => calls.mapControlsCalls.length).toBe(1);
    await expect.poll(() => calls.gapAnalysisCalls.length).toBeGreaterThanOrEqual(2);
    await expect.poll(() => calls.coverageCalls.length).toBeGreaterThanOrEqual(2);

    expect(calls.documentsCalls[0]).toMatchObject({
      sourceEvidenceId: DEFAULT_EVIDENCE_ID,
      content: "Access control policy evidence content",
      extractEvidence: true,
      metadata: {
        documentation_artifact: DEFAULT_ARTIFACT_NAME,
        evidence_type: "document",
      },
    });

    expect(calls.mapControlsCalls[0]).toMatchObject({
      documentId: DEFAULT_DOCUMENT_ID,
      scfControlIds: ["AC-01", "AC-02"],
      mappingMethod: "rule",
      coverageStrength: "moderate",
    });

    await expect(page.getByTestId("assessment-result-card")).toHaveCount(2);
    await expect(page.getByTestId(selectors.upload.resultVerdict).first()).toContainText(
      /PASS|PARTIAL|FAIL|NOT APPLICABLE/
    );
    await expect(page.getByTestId("assessment-result-card").first()).toContainText("confidence");
    await expect(page.getByTestId("results-framework-filter-trigger")).toContainText(
      "All frameworks"
    );

    const resultsFilter = page.getByTestId("results-framework-filter-trigger");
    await resultsFilter.focus();
    await expect(resultsFilter).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: "All frameworks" })).toBeVisible();
    await page.getByRole("option", { name: "All frameworks" }).click();

    await resultsFilter.click();
    await page.getByRole("option", { name: "SOC 2" }).click();

    await expect(page.getByTestId("assessment-result-card")).toHaveCount(1);
    await expect(page.getByTestId("assessment-result-card")).toContainText("AC-01");
    await expect(page.getByTestId("assessment-result-card")).not.toContainText("AC-02");

    await smartUploadDialog.getByRole("button", { name: "Done" }).click();
    await expect(smartUploadDialog).toBeHidden();
    workflowCompleted = true;
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    if (!workflowCompleted) {
      await take_snapshot(page, testInfo, "upload-flow");
    }
  }

  assert_no_browser_failures(report);
});

test("upload flow skips graph mapping when extracted content is not usable", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
    await page.route("**/api/evidence/extract-content", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          content:
            "[PDF document loaded (2 pages, 64KB) but text extraction failed. The PDF may be image-based]",
          imageData: null,
          fileName: "anthropic-controls.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
        }),
      });
    });
    await page.route("**/api/documents", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      calls.documentsCalls.push(body);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          document: { id: DEFAULT_DOCUMENT_ID },
          extraction: {
            chunkCount: 0,
            createdAtomCount: 0,
            mappedCount: 0,
            atomIds: [],
            quality: "limited",
            content_length: 0,
            requested_extraction: false,
            executed_extraction: false,
            limited_reason: "empty_content",
          },
        }),
      });
    });
    await login_test_user(page);

    await run_critical_path(page, {
      artifactName: DEFAULT_ARTIFACT_NAME,
    });

    await expect.poll(() => calls.documentsCalls.length).toBe(1);
    await expect.poll(() => calls.mapControlsCalls.length).toBe(0);

    expect(calls.documentsCalls[0]).toMatchObject({
      sourceEvidenceId: DEFAULT_EVIDENCE_ID,
      content: "",
      extractEvidence: false,
      metadata: {
        documentation_artifact: DEFAULT_ARTIFACT_NAME,
        evidence_type: "document",
        graph_content_quality: {
          usable: false,
          reason: "extraction_failed",
        },
      },
    });
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "upload-flow-limited-graph");
  }

  assert_no_browser_failures(report);
});

test("upload dialog artifact mapping help opens in-place without navigation", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
    await login_test_user(page);

    await page.getByTestId(selectors.upload.openSmartUploadButton).click();
    await expect(page.getByTestId(selectors.upload.dialog)).toBeVisible();

    const urlBeforeHelp = page.url();
    await page.getByTestId(selectors.upload.artifactMappingLink).click();

    // Explainer opens in place: popover content visible, no navigation, dialog intact.
    const helpContent = page.getByTestId(`${selectors.upload.artifactMappingLink}-content`);
    await expect(helpContent).toBeVisible();
    await expect(helpContent).toContainText("Document type");
    await expect(helpContent).toContainText("The kind of document you're uploading");
    expect(page.url()).toBe(urlBeforeHelp);
    await expect(page.getByTestId(selectors.upload.dialog)).toBeVisible();
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "upload-artifact-link");
  }

  assert_no_browser_failures(report);
});
