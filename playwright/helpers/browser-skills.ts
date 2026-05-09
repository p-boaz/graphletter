import type { Page, TestInfo } from "@playwright/test";
import { type CriticalPathOptions, runCriticalPath } from "./critical-path";
import { loginTestUser, openLocalApp } from "./login";
import {
	attachObservationReport,
	type BrowserObservationReport,
	inspectConsoleErrors,
	summarizeFailures,
} from "./observability";
import { takeSnapshot } from "./screenshots";

export type BrowserObserver = ReturnType<typeof inspectConsoleErrors>;

export async function open_local_app(page: Page, route = "/"): Promise<void> {
	await openLocalApp(page, route);
}

export async function login_test_user(page: Page): Promise<void> {
	await loginTestUser(page);
}

export async function run_critical_path(
	page: Page,
	options: CriticalPathOptions,
): Promise<void> {
	await runCriticalPath(page, options);
}

export function inspect_console_errors(page: Page): BrowserObserver {
	return inspectConsoleErrors(page);
}

export async function take_snapshot(
	page: Page,
	testInfo: TestInfo,
	name: string,
): Promise<string> {
	return takeSnapshot(page, testInfo, name);
}

export async function trace_failure(
	testInfo: TestInfo,
	report: BrowserObservationReport,
): Promise<void> {
	await attachObservationReport(testInfo, report);
}

export function assert_no_browser_failures(
	report: BrowserObservationReport,
): void {
	const summary = summarizeFailures(report);
	if (summary) {
		throw new Error(summary);
	}
}
