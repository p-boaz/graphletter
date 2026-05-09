import { expect, type Page } from "@playwright/test";
import { selectors } from "./selectors";

const TEST_BYPASS_AUTH_HEADER = "x-test-bypass-auth";

export async function openLocalApp(page: Page, route = "/"): Promise<void> {
	await page.goto(route, { waitUntil: "domcontentloaded" });
}

export async function loginTestUser(page: Page): Promise<void> {
	await page.setExtraHTTPHeaders({ [TEST_BYPASS_AUTH_HEADER]: "1" });
	await openLocalApp(page, "/dashboard");
	await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
	await expect(
		page.getByRole("heading", { name: "Compliance Dashboard" }),
	).toBeVisible();
	await expect(
		page.getByTestId(selectors.dashboard.overviewCard),
	).toBeVisible();
}
