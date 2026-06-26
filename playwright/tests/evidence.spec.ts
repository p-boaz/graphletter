import { expect, test } from "@playwright/test";
import {
  assert_no_browser_failures,
  inspect_console_errors,
  login_test_user,
  open_local_app,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";
import { mockEvidencePageApis } from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test("evidence view action opens evidence details without upload modal", async ({
  page,
}, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockEvidencePageApis(page);
    await login_test_user(page);
    await open_local_app(page, "/dashboard/evidence");

    await expect(page).toHaveURL(/\/dashboard\/evidence(?:\?|$)/);
    await expect(page.getByTestId(selectors.evidence.row)).toHaveCount(1);

    const firstRow = page.getByTestId(selectors.evidence.row).first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText("2 uploads");
    await firstRow.getByTestId(selectors.evidence.viewAction).click();

    const detailDialog = page.getByTestId(selectors.evidence.detailDialog);
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText("Evidence details");
    await expect(page.getByTestId(selectors.evidence.detailFileName)).toHaveText(
      "incident-response-playbook.pdf"
    );
    await expect(page.getByTestId(selectors.evidence.detailControls)).toContainText("IRO-05");
    await expect(page.getByTestId(selectors.evidence.detailControls)).toContainText("IRM-02");
    await expect(detailDialog).toContainText("Uploads merged");
    await expect(detailDialog).toContainText("2");

    await expect(page.getByTestId(selectors.upload.dialog)).toHaveCount(0);
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "evidence-page");
  }

  assert_no_browser_failures(report);
});

test("bulk evidence import previews errors and commits valid rows", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();
  const importRequests: Array<Record<string, unknown>> = [];

  try {
    await mockEvidencePageApis(page);
    await page.route("**/api/evidence/import", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}") as {
        mode?: string;
        content?: string;
      };
      importRequests.push(body);

      if (body.mode === "preview" && body.content?.includes("bad-row.pdf")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            summary: { totalRows: 2, validRows: 1, invalidRows: 1 },
            rows: [
              {
                rowNumber: 2,
                status: "valid",
                errors: [],
                values: {
                  file_name: "incident-response-playbook.pdf",
                  scf_control_id: "IRO-05",
                  evidence_type: "document",
                  erl_global_id: "ERL-IRO-001",
                  documentation_artifact: "Incident Response Program Documentation",
                  description: "Current response plan",
                  submitted_at: null,
                },
              },
              {
                rowNumber: 3,
                status: "invalid",
                errors: ['scf_control_id "NOPE" does not match an SCF control.'],
                values: {
                  file_name: "bad-row.pdf",
                  scf_control_id: "NOPE",
                  evidence_type: "document",
                  erl_global_id: null,
                  documentation_artifact: null,
                  description: null,
                  submitted_at: null,
                },
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          summary: { totalRows: 1, validRows: 1, invalidRows: 0 },
          committedRows: 1,
          rows: [
            {
              rowNumber: 2,
              status: "valid",
              errors: [],
              values: {
                file_name: "incident-response-playbook.pdf",
                scf_control_id: "IRO-05",
                evidence_type: "document",
                erl_global_id: "ERL-IRO-001",
                documentation_artifact: "Incident Response Program Documentation",
                description: "Current response plan",
                submitted_at: null,
              },
            },
          ],
        }),
      });
    });
    await login_test_user(page);
    await open_local_app(page, "/dashboard/evidence");

    await expect(page.getByTestId(selectors.evidence.row)).toHaveCount(1);
    await expect(page.getByTestId(selectors.evidence.importOpen)).toBeVisible();
    await page.getByTestId(selectors.evidence.importOpen).click();
    await expect(page.getByTestId(selectors.evidence.importDialog)).toBeVisible();

    await page.getByTestId(selectors.evidence.importFile).setInputFiles({
      name: "evidence-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "file_name,scf_control_id,evidence_type",
          "incident-response-playbook.pdf,IRO-05,document",
          "bad-row.pdf,NOPE,document",
        ].join("\n")
      ),
    });

    await page.getByTestId(selectors.evidence.importPreviewButton).click();
    await expect(page.getByTestId(selectors.evidence.importSummary)).toContainText("Invalid");
    await expect(page.getByTestId(selectors.evidence.importRow)).toHaveCount(2);
    await expect(page.getByTestId(selectors.evidence.importPreview)).toContainText("NOPE");
    await expect(page.getByTestId(selectors.evidence.importCommitButton)).toBeDisabled();

    await page.getByTestId(selectors.evidence.importFile).setInputFiles({
      name: "evidence-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "file_name,scf_control_id,evidence_type",
          "incident-response-playbook.pdf,IRO-05,document",
        ].join("\n")
      ),
    });
    await page.getByTestId(selectors.evidence.importPreviewButton).click();
    await expect(page.getByTestId(selectors.evidence.importRow)).toHaveCount(1);
    await expect(page.getByTestId(selectors.evidence.importCommitButton)).toBeEnabled();

    await page.getByTestId(selectors.evidence.importCommitButton).click();
    await expect(page.getByTestId(selectors.evidence.importSuccess)).toContainText(
      "Imported 1 evidence record."
    );
    expect(importRequests.map((request) => request.mode)).toEqual(["preview", "preview", "commit"]);
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "evidence-import");
  }

  assert_no_browser_failures(report);
});

test("evidence detail dialog approves and rejects evidence", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();
  const approveCalls: string[] = [];
  const rejectCalls: string[] = [];
  let reviewState = {
    status: "under_review",
    reviewedBy: null as string | null,
    reviewedAt: null as string | null,
    rejectionReason: null as string | null,
  };

  const evidencePayload = () => ({
    evidence: [
      {
        id: "review-evidence-1",
        evidence_group_id: "review-group-1",
        file_name: "vendor-risk-review.pdf",
        scf_control_id: "TPM-11",
        evidence_type: "document",
        evidence_status: reviewState.status,
        submitted_at: "2026-03-06T09:00:00.000Z",
        reviewed_by: reviewState.reviewedBy,
        reviewed_at: reviewState.reviewedAt,
        rejection_reason: reviewState.rejectionReason,
        metadata: {
          documentation_artifact: "Vendor Risk Review",
        },
      },
    ],
  });

  try {
    await mockEvidencePageApis(page);
    await page.route("**/api/evidence/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(evidencePayload()),
      });
    });
    await page.route("**/api/evidence/**/approve", async (route) => {
      approveCalls.push(route.request().url());
      reviewState = {
        status: "approved",
        reviewedBy: "reviewer-user",
        reviewedAt: "2026-06-26T18:00:00.000Z",
        rejectionReason: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Evidence approved successfully",
          updated_count: 1,
        }),
      });
    });
    await page.route("**/api/evidence/**/reject", async (route) => {
      rejectCalls.push(route.request().postData() || "");
      const body = JSON.parse(route.request().postData() || "{}") as {
        rejection_reason?: string;
      };
      reviewState = {
        status: "rejected",
        reviewedBy: "reviewer-user",
        reviewedAt: "2026-06-26T18:05:00.000Z",
        rejectionReason: body.rejection_reason || null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Evidence rejected successfully",
          updated_count: 1,
        }),
      });
    });

    await login_test_user(page);
    await open_local_app(page, "/dashboard/evidence");

    await expect(page.getByTestId(selectors.evidence.row)).toHaveCount(1);
    await page.getByTestId(selectors.evidence.viewAction).click();

    const detailDialog = page.getByTestId(selectors.evidence.detailDialog);
    await expect(detailDialog).toBeVisible();
    await detailDialog.getByTestId(selectors.evidence.approveButton).click();

    await expect(detailDialog.getByTestId(selectors.evidence.reviewFeedback)).toContainText(
      "Evidence approved successfully"
    );
    await expect(detailDialog).toContainText("approved");
    await expect(detailDialog.getByTestId(selectors.evidence.reviewer)).toHaveText("You");

    await detailDialog.getByTestId(selectors.evidence.rejectionInput).fill("Evidence is stale.");
    await expect(detailDialog.getByTestId(selectors.evidence.rejectButton)).toBeEnabled();
    await detailDialog.getByTestId(selectors.evidence.rejectButton).click();

    await expect(detailDialog.getByTestId(selectors.evidence.reviewFeedback)).toContainText(
      "Evidence rejected successfully"
    );
    await expect(detailDialog).toContainText("rejected");
    await expect(detailDialog.getByTestId(selectors.evidence.rejectionReason)).toContainText(
      "Evidence is stale."
    );
    expect(approveCalls).toHaveLength(1);
    expect(rejectCalls).toHaveLength(1);
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "evidence-approval-actions");
  }

  assert_no_browser_failures(report);
});

test("evidence approval authorization failures stay visible", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await mockEvidencePageApis(page);
    await page.route("**/api/evidence/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          evidence: [
            {
              id: "unauthorized-evidence-1",
              evidence_group_id: "unauthorized-group-1",
              file_name: "access-review.pdf",
              scf_control_id: "AC-01",
              evidence_type: "document",
              evidence_status: "under_review",
              submitted_at: "2026-03-06T09:00:00.000Z",
              reviewed_by: null,
              reviewed_at: null,
              rejection_reason: null,
              metadata: {
                documentation_artifact: "Access Review",
              },
            },
          ],
        }),
      });
    });
    await page.route("**/api/evidence/**/approve", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Evidence not found or unauthorized" }),
      });
    });

    await login_test_user(page);
    await open_local_app(page, "/dashboard/evidence");

    await expect(page.getByTestId(selectors.evidence.row)).toHaveCount(1);
    await page.getByTestId(selectors.evidence.viewAction).click();

    const detailDialog = page.getByTestId(selectors.evidence.detailDialog);
    await expect(detailDialog).toBeVisible();
    await detailDialog.getByTestId(selectors.evidence.approveButton).click();

    await expect(detailDialog.getByTestId(selectors.evidence.reviewFeedback)).toContainText(
      "Evidence not found or unauthorized"
    );
    await expect(detailDialog).toContainText("under review");
    await expect(detailDialog.getByTestId(selectors.evidence.reviewer)).toHaveText("-");
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "evidence-approval-authorization-failure");
  }

  const expectedForbiddenResponse = report.failedResponses.some(
    (response) => response.status === 403 && response.url.includes("/api/evidence/")
  );
  expect(expectedForbiddenResponse).toBe(true);

  assert_no_browser_failures({
    ...report,
    consoleErrors: report.consoleErrors.filter(
      (error) => !error.includes("the server responded with a status of 403")
    ),
    failedResponses: report.failedResponses.filter(
      (response) => !(response.status === 403 && response.url.includes("/api/evidence/"))
    ),
  });
});
