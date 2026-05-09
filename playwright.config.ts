import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./playwright/tests",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: 1,
	outputDir: "./playwright/artifacts/test-results",
	reporter: [
		["list"],
		[
			"html",
			{
				open: "never",
				outputFolder: "./playwright/artifacts/html-report",
			},
		],
	],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
		headless: process.env.PLAYWRIGHT_HEADLESS === "1" || !!process.env.CI,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
	},
});
