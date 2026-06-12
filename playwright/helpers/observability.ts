import type { Page, TestInfo } from "@playwright/test";

interface FailedRequest {
  method: string;
  url: string;
  errorText: string;
}

interface FailedResponse {
  method: string;
  url: string;
  status: number;
}

export interface BrowserObservationReport {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  failedResponses: FailedResponse[];
}

const IGNORABLE_REQUEST_PATTERNS = [
  /\/_next\/webpack-hmr/i,
  /\/sockjs-node/i,
  // Vercel Analytics — blocked by CSP in local dev, generates a spurious
  // csp failed-request entry that is not a test concern.
  /va\.vercel-scripts\.com/i,
];
const IGNORABLE_CONSOLE_ERROR_PATTERNS = [
  /Progress EventSource error/i,
  /^Connection lost$/i,
  // Vercel Analytics script is blocked by the app's CSP in local dev — not
  // a test concern; ignore the resulting console error and failed request.
  /va\.vercel-scripts\.com/i,
  // supabase auth-js getUser() aborted by a test navigation while in flight
  // (e.g. login lands on /dashboard, the spec immediately navigates away).
  // The matching request shows up as net::ERR_ABORTED, which is also ignored.
  /TypeError: Failed to fetch[\s\S]*auth-js/i,
];

export function inspectConsoleErrors(page: Page) {
  const report: BrowserObservationReport = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    failedResponses: [],
  };

  const handleConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (IGNORABLE_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
        return;
      }
      report.consoleErrors.push(text);
    }
  };

  const handlePageError = (error: Error) => {
    report.pageErrors.push(error.message);
  };

  const handleRequestFailed = (request: {
    url: () => string;
    method: () => string;
    failure: () => { errorText?: string } | null;
  }) => {
    const url = request.url();
    if (IGNORABLE_REQUEST_PATTERNS.some((pattern) => pattern.test(url))) {
      return;
    }

    // ERR_ABORTED means the browser canceled the request (test navigation,
    // image unmount, RSC prefetch) — not a server failure. Genuine backend
    // problems surface as non-2xx responses in failedResponses instead.
    if (request.failure()?.errorText === "net::ERR_ABORTED") {
      return;
    }

    report.failedRequests.push({
      method: request.method(),
      url,
      errorText: request.failure()?.errorText || "request failed",
    });
  };

  const handleResponse = (response: {
    url: () => string;
    status: () => number;
    request: () => { method: () => string };
  }) => {
    const url = response.url();
    const status = response.status();
    if (!url.includes("/api/") || status < 400) {
      return;
    }

    report.failedResponses.push({
      method: response.request().method(),
      url,
      status,
    });
  };

  page.on("console", handleConsole);
  page.on("pageerror", handlePageError);
  page.on("requestfailed", handleRequestFailed);
  page.on("response", handleResponse);

  return {
    getReport: () => report,
    stop: () => {
      page.off("console", handleConsole);
      page.off("pageerror", handlePageError);
      page.off("requestfailed", handleRequestFailed);
      page.off("response", handleResponse);
    },
  };
}

export async function attachObservationReport(
  testInfo: TestInfo,
  report: BrowserObservationReport
): Promise<void> {
  await testInfo.attach("browser-observation.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
}

export function summarizeFailures(report: BrowserObservationReport): string {
  const lines: string[] = [];

  if (report.consoleErrors.length > 0) {
    lines.push("Console errors:");
    for (const error of report.consoleErrors) {
      lines.push(`- ${error}`);
    }
  }

  if (report.pageErrors.length > 0) {
    lines.push("Unhandled page errors:");
    for (const error of report.pageErrors) {
      lines.push(`- ${error}`);
    }
  }

  if (report.failedRequests.length > 0) {
    lines.push("Failed network requests:");
    for (const request of report.failedRequests) {
      lines.push(`- ${request.method} ${request.url} (${request.errorText})`);
    }
  }

  if (report.failedResponses.length > 0) {
    lines.push("Non-2xx API responses:");
    for (const response of report.failedResponses) {
      lines.push(`- ${response.method} ${response.url} (${response.status})`);
    }
  }

  return lines.join("\n");
}
