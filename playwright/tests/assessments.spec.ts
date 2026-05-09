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

		const explainerButton = page.getByTestId(
			selectors.assessments.openExplainerButton,
		);
		const inlineExplainer = page.getByTestId(
			selectors.assessments.inlineExplainer,
		);
		await expect(explainerButton).toBeVisible();
		await explainerButton.click();
		if (!(await inlineExplainer.isVisible())) {
			await explainerButton.click();
		}
		await expect(inlineExplainer).toBeVisible();
		await expect(page).toHaveURL(/\/dashboard\/assessments(?:\?|$)/);

		const firstAssessmentRow = page
			.getByTestId(selectors.assessments.controlRow)
			.first();
		await expect(firstAssessmentRow).toBeVisible();
		await firstAssessmentRow.click();

		await expect(
			page.getByTestId(selectors.assessments.detailDialog),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.assessments.detailDialog),
		).toContainText("Assessment details");
		await expect(
			page.getByTestId(selectors.assessments.detailRunGroup),
		).toHaveCount(2);
		await expect(
			page.getByTestId(selectors.assessments.detailDialog),
		).toContainText("incident-response-playbook.pdf");
		await expect(
			page.getByTestId(selectors.assessments.detailDialog),
		).toContainText("incident-drill-report.docx");

		await expect(page.getByTestId(selectors.upload.dialog)).toHaveCount(0);
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "assessments-page");
	}

	assert_no_browser_failures(report);
});
