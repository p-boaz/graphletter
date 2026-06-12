import { expect, type Page } from "@playwright/test";
import { selectors } from "./selectors";

export async function openLocalApp(page: Page, route = "/"): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

export async function loginTestUser(page: Page): Promise<void> {
  // Session is already in storage state from playwright/setup/auth.setup.ts.
  // Navigate to the dashboard and verify the session is active.
  await page.goto("/dashboard");

  if (page.url().includes("/auth")) {
    throw new Error(
      "loginTestUser: landed on /auth instead of /dashboard. " +
        "Run `pnpm qa:user:ensure` to provision the QA user, then re-run " +
        "the suite so the setup project can capture a fresh storage state."
    );
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Compliance Dashboard" })).toBeVisible();
  await expect(page.getByTestId(selectors.dashboard.overviewCard)).toBeVisible();
}
