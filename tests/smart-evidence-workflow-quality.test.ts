import assert from "node:assert/strict";
import test from "node:test";
import { assessExtractedGraphContent } from "@/lib/client/smart-evidence-workflow";

test("treats meaningful extracted text as graph-usable content", () => {
	const result = assessExtractedGraphContent(
		"Access policy requires MFA for privileged accounts.",
	);

	assert.equal(result.isUsable, true);
	assert.equal(result.reason, null);
	assert.equal(result.contentLength > 0, true);
});

test("marks empty extracted content as limited", () => {
	const result = assessExtractedGraphContent("   ");

	assert.equal(result.isUsable, false);
	assert.equal(result.reason, "empty_content");
	assert.equal(result.contentLength, 0);
});

test("marks extractor error placeholders as limited", () => {
	const result = assessExtractedGraphContent(
		"[PDF document loaded (2 pages, 64KB) but text extraction failed. The PDF may be image-based]",
	);

	assert.equal(result.isUsable, false);
	assert.equal(result.reason, "extraction_failed");
});
