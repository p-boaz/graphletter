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
	DEFAULT_DOCUMENT_ID,
	DEFAULT_EVIDENCE_ID,
	mockUploadWorkflowApis,
} from "../helpers/mocks";
import { selectors } from "../helpers/selectors";

test("upload flow runs end-to-end and posts expected graph payloads", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
		await login_test_user(page);

		await run_critical_path(page, {
			artifactName: DEFAULT_ARTIFACT_NAME,
		});

		await expect.poll(() => calls.documentsCalls.length).toBe(1);
		await expect.poll(() => calls.mapControlsCalls.length).toBe(1);
		await expect
			.poll(() => calls.gapAnalysisCalls.length)
			.toBeGreaterThanOrEqual(2);
		await expect
			.poll(() => calls.coverageCalls.length)
			.toBeGreaterThanOrEqual(2);

		expect(calls.documentsCalls[0]).toMatchObject({
			sourceEvidenceId: DEFAULT_EVIDENCE_ID,
			content: "Access control policy evidence content",
			extractEvidence: true,
			metadata: {
				documentation_artifact: DEFAULT_ARTIFACT_NAME,
				evidence_type: "document",
			},
		});

		expect(calls.mapControlsCalls[0]).toMatchObject({
			documentId: DEFAULT_DOCUMENT_ID,
			scfControlIds: ["AC-01", "AC-02"],
			mappingMethod: "rule",
			coverageStrength: "moderate",
		});
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "upload-flow");
	}

	assert_no_browser_failures(report);
});

test("upload flow skips graph mapping when extracted content is not usable", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		const calls = await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
		await page.route("**/api/evidence/extract-content", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					content:
						"[PDF document loaded (2 pages, 64KB) but text extraction failed. The PDF may be image-based]",
					imageData: null,
					fileName: "anthropic-controls.pdf",
					fileType: "application/pdf",
					fileSize: 1024,
				}),
			});
		});
		await page.route("**/api/documents", async (route) => {
			const body = JSON.parse(route.request().postData() || "{}");
			calls.documentsCalls.push(body);

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					document: { id: DEFAULT_DOCUMENT_ID },
					extraction: {
						chunkCount: 0,
						createdAtomCount: 0,
						mappedCount: 0,
						atomIds: [],
						quality: "limited",
						content_length: 0,
						requested_extraction: false,
						executed_extraction: false,
						limited_reason: "empty_content",
					},
				}),
			});
		});
		await login_test_user(page);

		await run_critical_path(page, {
			artifactName: DEFAULT_ARTIFACT_NAME,
		});

		await expect.poll(() => calls.documentsCalls.length).toBe(1);
		await expect.poll(() => calls.mapControlsCalls.length).toBe(0);

		expect(calls.documentsCalls[0]).toMatchObject({
			sourceEvidenceId: DEFAULT_EVIDENCE_ID,
			content: "",
			extractEvidence: false,
			metadata: {
				documentation_artifact: DEFAULT_ARTIFACT_NAME,
				evidence_type: "document",
				graph_content_quality: {
					usable: false,
					reason: "extraction_failed",
				},
			},
		});
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "upload-flow-limited-graph");
	}

	assert_no_browser_failures(report);
});

test("upload dialog artifact mapping link navigates to how-it-works anchor", async ({
	page,
}, testInfo) => {
	const observer = inspect_console_errors(page);
	let report = observer.getReport();

	try {
		await mockUploadWorkflowApis(page, DEFAULT_ARTIFACT_NAME);
		await login_test_user(page);

		await page.getByTestId(selectors.upload.openSmartUploadButton).click();
		await expect(page.getByTestId(selectors.upload.dialog)).toBeVisible();

		await page.getByTestId(selectors.upload.artifactMappingLink).click();
		await expect(page).toHaveURL(/\/how-it-works#artifacts-and-controls$/);
	} finally {
		observer.stop();
		report = observer.getReport();
		await trace_failure(testInfo, report);
		await take_snapshot(page, testInfo, "upload-artifact-link");
	}

	assert_no_browser_failures(report);
});
