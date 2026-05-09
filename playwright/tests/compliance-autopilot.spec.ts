import { expect, test } from "@playwright/test";
import {
	assert_no_browser_failures,
	inspect_console_errors,
	login_test_user,
	take_snapshot,
	trace_failure,
} from "../helpers/browser-skills";
import {
	DEFAULT_ARTIFACT_NAME,
	mockComplianceAutopilotApis,
	mockDashboardApis,
	mockEvidencePageApis,
	mockUploadWorkflowApis,
} from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test.describe("compliance autopilot — Phase 4", () => {
	test("compliance inbox page loads and displays prioritized action items", async ({
		page,
	}, testInfo) => {
		const observer = inspect_console_errors(page);
		let report = observer.getReport();

		try {
			await mockDashboardApis(page);
			await mockComplianceAutopilotApis(page);
			await login_test_user(page);

			await page.goto("/dashboard/compliance-inbox");
			await page.waitForLoadState("networkidle");

			// Verify inbox page loaded
			await expect(page.getByTestId(selectors.inbox.page)).toBeVisible({
				timeout: 10_000,
			});

			// Verify posture summary is visible
			await expect(
				page.getByTestId(selectors.inbox.postureSummary),
			).toBeVisible();
			await expect(
				page.getByTestId(selectors.inbox.postureSummary),
			).toContainText("72.5%");

			// Verify inbox items rendered in priority order
			const cards = page.getByTestId(selectors.inbox.itemCard);
			await expect(cards).toHaveCount(3);

			// First item should be critical (stale evidence)
			const firstCard = cards.first();
			await expect(firstCard).toHaveAttribute("data-priority", "critical");
			await expect(firstCard).toContainText("Expired: Access Control Policy");

			// Verify action buttons exist
			const actionButtons = page.getByTestId(selectors.inbox.actionButton);
			await expect(actionButtons.first()).toBeVisible();
		} finally {
			observer.stop();
			report = observer.getReport();
			await trace_failure(testInfo, report);
			await take_snapshot(page, testInfo, "compliance-inbox");
		}

		assert_no_browser_failures(report);
	});

	test("evidence page shows freshness health dots", async ({
		page,
	}, testInfo) => {
		const observer = inspect_console_errors(page);
		let report = observer.getReport();

		try {
			await mockEvidencePageApis(page);
			await mockComplianceAutopilotApis(page);
			await login_test_user(page);

			await page.goto("/dashboard/evidence");
			await page.waitForLoadState("networkidle");

			// Wait for evidence rows to render
			await expect(
				page.getByTestId(selectors.evidence.row).first(),
			).toBeVisible({ timeout: 10_000 });

			// Verify freshness dots are present
			const freshnessDots = page.getByTestId(selectors.freshness.dot);
			const dotCount = await freshnessDots.count();
			expect(dotCount).toBeGreaterThan(0);

			// Check that at least one has a data-freshness attribute
			const firstDot = freshnessDots.first();
			const freshness = await firstDot.getAttribute("data-freshness");
			expect(["fresh", "expiring", "stale"]).toContain(freshness);
		} finally {
			observer.stop();
			report = observer.getReport();
			await trace_failure(testInfo, report);
			await take_snapshot(page, testInfo, "evidence-freshness-dots");
		}

		assert_no_browser_failures(report);
	});

	test("impact preview banner shows score improvement in upload wizard", async ({
		page,
	}, testInfo) => {
		const observer = inspect_console_errors(page);
		let report = observer.getReport();

		try {
			await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
			await mockComplianceAutopilotApis(page);
			await login_test_user(page);

			// Open upload dialog
			await page.getByTestId(selectors.upload.openSmartUploadButton).click();
			await expect(page.getByTestId(selectors.upload.dialog)).toBeVisible();

			// Select documentation artifact
			await page
				.getByTestId(selectors.upload.documentationArtifactCombobox)
				.click();
			await page.getByRole("option", { name: DEFAULT_ARTIFACT_NAME }).click();

			// Wait for impact preview banner to appear
			await expect(
				page.getByTestId(selectors.impactPreview.banner),
			).toBeVisible({ timeout: 10_000 });

			// Verify score improvement text
			await expect(
				page.getByTestId(selectors.impactPreview.banner),
			).toContainText("72.5%");
			await expect(
				page.getByTestId(selectors.impactPreview.banner),
			).toContainText("+5.8%");
		} finally {
			observer.stop();
			report = observer.getReport();
			await trace_failure(testInfo, report);
			await take_snapshot(page, testInfo, "impact-preview-banner");
		}

		assert_no_browser_failures(report);
	});

	test("dashboard shows inbox summary with top action items", async ({
		page,
	}, testInfo) => {
		const observer = inspect_console_errors(page);
		let report = observer.getReport();

		try {
			await mockDashboardApis(page);
			await mockComplianceAutopilotApis(page);
			await login_test_user(page);

			await page.goto("/dashboard");
			await page.waitForLoadState("networkidle");

			// Verify inbox summary card appears
			await expect(page.getByTestId(selectors.inbox.summaryCard)).toBeVisible({
				timeout: 15_000,
			});

			// Should show "Compliance Inbox" title
			await expect(page.getByTestId(selectors.inbox.summaryCard)).toContainText(
				"Compliance Inbox",
			);

			// Should contain at least one action item
			await expect(page.getByTestId(selectors.inbox.summaryCard)).toContainText(
				"Expired",
			);

			// Should have a "View all" link
			const viewAll = page
				.getByTestId(selectors.inbox.summaryCard)
				.getByText("View all");
			await expect(viewAll).toBeVisible();
		} finally {
			observer.stop();
			report = observer.getReport();
			await trace_failure(testInfo, report);
			await take_snapshot(page, testInfo, "dashboard-inbox-summary");
		}

		assert_no_browser_failures(report);
	});

	test("compliance inbox shows empty state when no actions", async ({
		page,
	}, testInfo) => {
		const observer = inspect_console_errors(page);
		let report = observer.getReport();

		try {
			await mockDashboardApis(page);

			// Override inbox to return empty
			await page.route("**/api/compliance/inbox**", async (route) => {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						inbox: {
							items: [],
							totalItems: 0,
							generatedAt: new Date().toISOString(),
							cachedUntil: new Date(Date.now() + 300000).toISOString(),
						},
					}),
				});
			});

			await login_test_user(page);

			await page.goto("/dashboard/compliance-inbox");
			await page.waitForLoadState("networkidle");

			// Verify empty state
			await expect(page.getByTestId(selectors.inbox.emptyState)).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByTestId(selectors.inbox.emptyState)).toContainText(
				"All clear",
			);
		} finally {
			observer.stop();
			report = observer.getReport();
			await trace_failure(testInfo, report);
			await take_snapshot(page, testInfo, "inbox-empty-state");
		}

		assert_no_browser_failures(report);
	});
});
