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
