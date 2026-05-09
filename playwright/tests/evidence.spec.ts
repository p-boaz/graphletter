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
		await expect(
			page.getByTestId(selectors.evidence.detailFileName),
		).toHaveText("incident-response-playbook.pdf");
		await expect(
			page.getByTestId(selectors.evidence.detailControls),
		).toContainText("IRO-05");
		await expect(
			page.getByTestId(selectors.evidence.detailControls),
		).toContainText("IRM-02");
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
