import { expect, test } from "@playwright/test";
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
	mockUploadWorkflowApis,
} from "../helpers/mocks";

test("critical path: login, upload, assess, approve, and return to dashboard", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
		await login_test_user(page);

		await run_critical_path(page, {
			artifactName: DEFAULT_ARTIFACT_NAME,
		});

		await expect(
			page.getByRole("heading", { name: "Compliance Dashboard" }),
		).toBeVisible();
		await expect(page.getByText("Compliance Overview")).toBeVisible();
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "critical-path");
	}

	assert_no_browser_failures(report);
});
