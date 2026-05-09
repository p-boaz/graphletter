import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { selectors } from "./selectors";

export interface CriticalPathOptions {
	artifactName: string;
	fixturePath?: string;
}

const DEFAULT_FIXTURE_PATH = path.resolve(
	process.cwd(),
	"data/anthropic-controls.pdf",
);

export async function runCriticalPath(
	page: Page,
	options: CriticalPathOptions,
): Promise<void> {
	const fixturePath = options.fixturePath || DEFAULT_FIXTURE_PATH;

	await page
		.getByTestId(selectors.upload.openSmartUploadButton)
		.first()
		.click();

	const smartUploadDialog = page.getByTestId(selectors.upload.dialog);
	await expect(smartUploadDialog).toBeVisible();

	await smartUploadDialog
		.getByTestId(selectors.upload.documentationArtifactCombobox)
		.click();
	await page
		.getByRole("option", { name: options.artifactName, exact: true })
		.click();

	await smartUploadDialog
		.getByTestId(selectors.upload.documentUploadInput)
		.setInputFiles(fixturePath);

	await expect(
		smartUploadDialog.getByText("Evidence Uploaded Successfully!"),
	).toBeVisible();

	await smartUploadDialog
		.getByTestId(selectors.upload.startAiAssessmentButton)
		.click();

	const reviewDialog = page
		.locator('[role="dialog"]')
		.filter({ hasText: "Assessment Review Required" });
	await expect(reviewDialog).toBeVisible();

	await reviewDialog
		.getByTestId(selectors.upload.approveAssessmentButton)
		.click();
	await expect(reviewDialog).toBeHidden();

	await expect(
		smartUploadDialog.getByText("Evidence Uploaded Successfully!"),
	).toBeVisible();
	await smartUploadDialog.getByRole("button", { name: "Done" }).click();
	await expect(smartUploadDialog).toBeHidden();
}
