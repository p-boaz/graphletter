import { expect, test } from "@playwright/test";
import {
	assert_no_browser_failures,
	inspect_console_errors,
	open_local_app,
	take_snapshot,
	trace_failure,
} from "../helpers/browser-skills";
import { selectors } from "../helpers/selectors";

test("auth page renders stable sign-in and sign-up controls", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		await open_local_app(page, "/auth");

		await expect(page.getByTestId(selectors.auth.form)).toBeVisible();
		await expect(page.getByTestId(selectors.auth.signInTab)).toBeVisible();
		await expect(
			page.getByTestId(selectors.auth.signInEmailInput),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.auth.signInPasswordInput),
		).toBeVisible();

		await page
			.getByTestId(selectors.auth.signInEmailInput)
			.fill("dogfood@local.dev");
		await page
			.getByTestId(selectors.auth.signInPasswordInput)
			.fill("Password123!");

		await page.getByTestId(selectors.auth.signUpTab).click();
		await expect(
			page.getByTestId(selectors.auth.signUpEmailInput),
		).toBeVisible();
		await expect(
			page.getByTestId(selectors.auth.signUpPasswordInput),
		).toBeVisible();
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "auth-page");
	}

	assert_no_browser_failures(report);
});
