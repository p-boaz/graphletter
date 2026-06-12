import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { QA_STORAGE_STATE } from "../../playwright.config";
import { selectors } from "../helpers/selectors";

setup("authenticate QA user", async ({ page }) => {
  const email = process.env.QA_USER_EMAIL;
  const password = process.env.QA_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "QA_USER_EMAIL and QA_USER_PASSWORD must be set in .env.local. " +
        "Run `pnpm qa:user:ensure` to provision the QA user."
    );
  }

  await page.goto("/auth");

  // Switch to sign-in tab if needed (it may already be active)
  const signInTab = page.getByTestId(selectors.auth.signInTab);
  const tabState = await signInTab.getAttribute("data-state");
  if (tabState !== "active") {
    await signInTab.click();
  }

  await page.getByTestId(selectors.auth.signInEmailInput).fill(email);
  await page.getByTestId(selectors.auth.signInPasswordInput).fill(password);
  await page.getByTestId(selectors.auth.signInSubmitButton).click();

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Compliance Dashboard" })).toBeVisible();

  mkdirSync(dirname(QA_STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: QA_STORAGE_STATE });
});
