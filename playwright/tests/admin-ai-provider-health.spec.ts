import { expect, test } from "@playwright/test";

// Admin specs test unauthenticated and mock-auth paths — clear storage state
// so the 401 assertion and mock-driven page renders are not confused by a
// real QA session.
test.use({ storageState: { cookies: [], origins: [] } });
import {
  assert_no_browser_failures,
  inspect_console_errors,
  take_snapshot,
  trace_failure,
} from "../helpers/browser-skills";

test("admin AI provider health API requires authentication", async ({ request }) => {
  const response = await request.get("/api/admin/ai-provider-health");
  expect(response.status()).toBe(401);

  const payload = (await response.json()) as { error?: string };
  expect(payload.error).toBe("Unauthorized");
});

test("admin AI provider health page renders provider rows", async ({ page }, testInfo) => {
  const observer = inspect_console_errors(page);
  let report = observer.getReport();

  try {
    await page.route("**/api/admin/ai-provider-health**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: [
            {
              provider: "openai",
              status: "healthy",
              consecutiveFailures: 0,
              lastFailureAt: null,
              trippedAt: null,
              secondsUntilAutoReset: null,
            },
            {
              provider: "anthropic",
              status: "tripped",
              consecutiveFailures: 5,
              lastFailureAt: "2026-03-21T10:00:00.000Z",
              trippedAt: "2026-03-21T10:00:00.000Z",
              secondsUntilAutoReset: 42,
            },
          ],
          fetchedAt: "2026-03-21T10:00:00.000Z",
        }),
      });
    });

    await page.goto("/admin/ai-provider-health");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("admin-ai-provider-health-page")).toBeVisible();
    await expect(page.getByTestId("admin-ai-provider-health-table")).toBeVisible();
    await expect(page.getByTestId("admin-ai-provider-health-row-openai")).toContainText("healthy");
    await expect(page.getByTestId("admin-ai-provider-health-row-anthropic")).toContainText(
      "tripped"
    );
  } finally {
    observer.stop();
    report = observer.getReport();
    await trace_failure(testInfo, report);
    await take_snapshot(page, testInfo, "admin-ai-provider-health-page");
  }

  assert_no_browser_failures(report);
});

test("admin AI provider health page shows forbidden state", async ({ page }, testInfo) => {
  await page.route("**/api/admin/ai-provider-health**", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Forbidden" }),
    });
  });

  await page.goto("/admin/ai-provider-health");
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("admin-ai-provider-health-error")).toContainText("Forbidden");
  await take_snapshot(page, testInfo, "admin-ai-provider-health-forbidden");
});
