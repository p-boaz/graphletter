import { expect, test } from "@playwright/test";
import {
	assert_no_browser_failures,
	inspect_console_errors,
	login_test_user,
	open_local_app,
	take_snapshot,
	trace_failure,
} from "../helpers/browser-skills";
import { mockDashboardApis } from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test("analytics page is drill-down focused and avoids overview duplication", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		await mockDashboardApis(page);
		await login_test_user(page);
		await open_local_app(page, "/dashboard/analytics");

		await expect(page).toHaveURL(/\/dashboard\/analytics(?:\?|$)/);
		await expect(
			page.getByTestId(selectors.dashboard.analyticsPurposeCard),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.dashboard.analyticsPurposeCard),
		).toContainText("Use Analytics for deep drill-down metrics");

		await expect(page.getByText("Control Coverage Overview")).toHaveCount(0);
		await expect(page.getByText("Assessment Details")).toHaveCount(0);

		await expect(
			page.getByTestId(selectors.dashboard.analyticsDomainCoverageCard),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.dashboard.analyticsDomainCoverageTable),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.dashboard.analyticsDomainCoverageTable),
		).toContainText("Identification & Authentication Control");
		await expect(
			page.getByTestId(selectors.dashboard.analyticsDomainCoverageTable),
		).toContainText("IAC");

		const controlsWithEvidenceCard = page.getByTestId(
			selectors.dashboard.analyticsControlsWithEvidenceCard,
		);
		await expect(controlsWithEvidenceCard).toBeVisible();
		await expect(controlsWithEvidenceCard).toContainText(
			"Controls with Evidence",
		);
		await expect(controlsWithEvidenceCard).toContainText("2");
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "analytics-page");
	}

	assert_no_browser_failures(report);
});
