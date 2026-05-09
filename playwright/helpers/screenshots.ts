import type { Page, TestInfo } from "@playwright/test";

export async function takeSnapshot(
	page: Page,
	testInfo: TestInfo,
	name: string,
): Promise<string> {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(`snapshot-${name}`, {
		path,
		contentType: "image/png",
	});
	return path;
}
