function downloadBlob(blob: Blob, fileName: string) {
	const objectUrl = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(objectUrl);
}

function parseFileNameFromDisposition(
	disposition: string | null,
): string | null {
	if (!disposition) return null;
	const match = disposition.match(/filename="([^"]+)"/i);
	return match?.[1] || null;
}

export async function exportGraphComplianceReport(format: "csv" | "json") {
	const response = await fetch(
		`/api/reports/compliance-export?format=${format}&details=true`,
		{
			method: "GET",
		},
	);

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		throw new Error(
			payload.error || "Failed to export graph compliance report",
		);
	}

	const blob = await response.blob();
	const datePart = new Date().toISOString().split("T")[0];
	const fallbackFileName =
		format === "csv"
			? `graph-compliance-report-${datePart}.csv`
			: `graph-compliance-report-${datePart}.json`;
	const fileName =
		parseFileNameFromDisposition(response.headers.get("content-disposition")) ||
		fallbackFileName;

	downloadBlob(blob, fileName);
}
