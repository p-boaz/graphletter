import type { Page } from "@playwright/test";

export const DEFAULT_ARTIFACT_NAME = "Access Control Policy";
export const DEFAULT_DOCUMENT_ID = "doc-graph-001";
export const DEFAULT_EVIDENCE_ID = "evidence-001";

export interface UploadMockCalls {
  documentsCalls: Array<Record<string, unknown>>;
  mapControlsCalls: Array<Record<string, unknown>>;
  gapAnalysisCalls: Array<Record<string, unknown>>;
  coverageCalls: Array<Record<string, unknown>>;
}

export async function mockDashboardApis(page: Page): Promise<void> {
  await page.route("**/api/evidence/count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 1 }),
    });
  });

  await page.route("**/api/evidence/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ evidence: [] }),
    });
  });

  await page.route("**/api/assessments/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ assessments: [] }),
    });
  });

  await page.route("**/api/scf/frameworks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "fw-nist-csf",
          framework_name: "NIST CSF",
          framework_version: "v2.0",
          total_mappings: 2,
        },
      ]),
    });
  });

  await page.route("**/api/scf/controls?limit=all", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "AC-01",
          title: "Access control policy",
          domain_id: "IAC",
          scf_domains: {
            name: "Identification & Authentication Control",
            description: "Controls for identity lifecycle, authentication, and access governance.",
          },
        },
        {
          id: "AC-02",
          title: "Privileged access",
          domain_id: "IAC",
          scf_domains: {
            name: "Identification & Authentication Control",
            description: "Controls for identity lifecycle, authentication, and access governance.",
          },
        },
      ]),
    });
  });

  await page.route("**/api/analysis/run-gap-analysis", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/controls/build-coverage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        coverage: {
          total_controls: 2,
          covered_controls: 1,
          partial_controls: 1,
          missing_controls: 0,
          conflicting_controls: 0,
          coverage_percentage: 100,
        },
        controls: [
          {
            scf_control_id: "AC-01",
            status: "compliant",
            strongest_coverage_rank: 1,
          },
          {
            scf_control_id: "AC-02",
            status: "partial",
            strongest_coverage_rank: 1,
          },
        ],
      }),
    });
  });

  // The dashboard's GapRemediationPanel always POSTs here with the mocked
  // framework id ("fw-nist-csf"), which the real API rejects as an invalid
  // UUID (500). An empty list renders the panel's empty state.
  await page.route("**/api/compliance/gap-remediation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ remediations: [] }),
    });
  });
}

export async function mockAssessmentsPageApis(page: Page): Promise<void> {
  await page.route("**/api/evidence/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        evidence: [
          {
            id: "evidence-history-1",
            file_name: "incident-response-playbook.pdf",
            scf_control_id: "IRO-05",
            evidence_type: "document",
            evidence_status: "submitted",
            submitted_at: "2026-03-06T09:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/assessments/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        assessments: [
          {
            id: "assessment-iro-05",
            scf_control_id: "IRO-05",
            assessment_result: "partial",
            assessment_status: "completed",
            assessment_notes: "Training cadence exists but simulation coverage is incomplete.",
            completed_at: "2026-03-06T01:43:00.000Z",
            metadata: {
              confidence: 0.61,
              ai_generated: true,
              objective_results: [
                {
                  scf_ao_id: "IRO-05_A01",
                  assessment_objective:
                    "Validate incident response training exists for relevant personnel.",
                  result: "pass",
                  confidence: 0.82,
                  reasoning: "Training evidence and completion records were observed.",
                },
                {
                  scf_ao_id: "IRO-05_A02",
                  assessment_objective:
                    "Validate exercises and simulations are routinely performed.",
                  result: "partial",
                  confidence: 0.54,
                  reasoning:
                    "Tabletop exercises are documented but simulation frequency is inconsistent.",
                },
              ],
            },
            scf_controls: {
              title: "Incident Response Training",
              description: "Provide role-based incident response training.",
            },
            linked_evidence: [
              {
                id: "evidence-history-1",
                file_name: "incident-response-playbook.pdf",
                evidence_type: "document",
              },
            ],
          },
          {
            id: "assessment-iro-05-run2",
            scf_control_id: "IRO-05",
            assessment_result: "pass",
            assessment_status: "completed",
            assessment_notes: "Latest drill report demonstrates improved simulation coverage.",
            completed_at: "2026-03-06T12:36:00.000Z",
            metadata: {
              confidence: 0.88,
              ai_generated: true,
              objective_results: [
                {
                  scf_ao_id: "IRO-05_A01",
                  assessment_objective:
                    "Validate incident response training exists for relevant personnel.",
                  result: "pass",
                  confidence: 0.9,
                  reasoning: "Recent drill and completion evidence show strong participation.",
                },
              ],
            },
            scf_controls: {
              title: "Incident Response Training",
              description: "Provide role-based incident response training.",
            },
            linked_evidence: [
              {
                id: "evidence-history-2",
                file_name: "incident-drill-report.docx",
                evidence_type: "document",
              },
            ],
          },
          {
            id: "assessment-tpm-11",
            scf_control_id: "TPM-11",
            assessment_result: "fail",
            assessment_status: "completed",
            assessment_notes:
              "Third-party recovery playbook is incomplete and missing validation artifacts.",
            completed_at: "2026-03-06T10:36:00.000Z",
            metadata: {
              confidence: 0.62,
              ai_generated: true,
              objective_results: [
                {
                  scf_ao_id: "TPM-11_A01",
                  assessment_objective:
                    "Validate third-party incident recovery requirements are contractually defined.",
                  result: "fail",
                  confidence: 0.62,
                  reasoning: "No evidence of executed recovery SLAs for key vendors.",
                },
              ],
            },
            scf_controls: {
              title: "Third-Party Incident Response & Recovery Capabilities",
              description: "Ensure vendors can support incident response and recovery obligations.",
            },
            linked_evidence: [],
          },
        ],
      }),
    });
  });
}

export async function mockEvidencePageApis(page: Page): Promise<void> {
  await mockDashboardApis(page);

  await page.route("**/api/evidence/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        evidence: [
          {
            id: "evidence-group-1-record-1",
            evidence_group_id: "evidence-group-1",
            file_name: "incident-response-playbook.pdf",
            scf_control_id: "IRO-05",
            evidence_type: "document",
            evidence_status: "submitted",
            submitted_at: "2026-03-06T09:00:00.000Z",
            metadata: {
              documentation_artifact: "Incident Response Program Documentation",
              smart_upload: true,
            },
          },
          {
            id: "evidence-group-1-record-2",
            evidence_group_id: "evidence-group-1",
            file_name: "incident-response-playbook.pdf",
            scf_control_id: "IRM-02",
            evidence_type: "document",
            evidence_status: "submitted",
            submitted_at: "2026-03-06T09:00:00.000Z",
            metadata: {
              documentation_artifact: "Incident Response Program Documentation",
              smart_upload: true,
            },
          },
          {
            id: "evidence-group-2-record-1",
            evidence_group_id: "evidence-group-2",
            file_name: "incident-response-playbook.pdf",
            scf_control_id: "IRO-05",
            evidence_type: "document",
            evidence_status: "under_review",
            submitted_at: "2026-03-06T10:00:00.000Z",
            metadata: {
              documentation_artifact: "Incident Response Program Documentation",
              smart_upload: true,
            },
          },
          {
            id: "evidence-group-2-record-2",
            evidence_group_id: "evidence-group-2",
            file_name: "incident-response-playbook.pdf",
            scf_control_id: "IRM-02",
            evidence_type: "document",
            evidence_status: "under_review",
            submitted_at: "2026-03-06T10:00:00.000Z",
            metadata: {
              documentation_artifact: "Incident Response Program Documentation",
              smart_upload: true,
            },
          },
        ],
      }),
    });
  });

  // The evidence page always fetches freshness alongside history. Specs that
  // assert freshness dots register mockComplianceAutopilotApis afterwards,
  // whose richer mock wins (page.route is last-registered-first).
  await page.route("**/api/compliance/freshness**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        freshness: {
          items: [],
          summary: { fresh: 0, expiring: 0, stale: 0 },
          scannedAt: new Date().toISOString(),
        },
      }),
    });
  });
}

export async function mockComplianceAutopilotApis(page: Page): Promise<void> {
  await page.route("**/api/compliance/inbox**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        inbox: {
          items: [
            {
              id: "stale-ev-001",
              type: "stale_evidence",
              priority: "critical",
              title: "Expired: Access Control Policy",
              description:
                "This policy evidence expired 45 days ago. Re-upload a current version to maintain compliance.",
              actionLabel: "Re-upload",
              actionUrl: "/dashboard/evidence",
              metadata: { evidenceId: "ev-001", daysExpired: 45 },
            },
            {
              id: "missing-IRO-01",
              type: "missing_control",
              priority: "high",
              title: "Missing: IRO-01 — Incident Response Plan",
              description:
                "No evidence uploaded for this control. Upload documentation to close this gap.",
              actionLabel: "Upload Evidence",
              actionUrl: "/dashboard",
              context: { controlIds: ["IRO-01"] },
              metadata: { controlId: "IRO-01", domainId: "IRO" },
            },
            {
              id: "leverage-ERL-BCP-001",
              type: "high_leverage_upload",
              priority: "medium",
              title: "Upload: Business Continuity Plan",
              description:
                "Covers 5 missing controls. Documents business continuity procedures and recovery objectives.",
              actionLabel: "Upload Evidence",
              actionUrl: "/dashboard",
              context: {
                controlIds: ["BCP-01", "BCP-02", "BCP-03", "BCP-04", "BCP-05"],
                documentationArtifact: "Business Continuity Plan",
              },
              metadata: { erlId: "ERL-BCP-001", controlsOverlap: 5 },
            },
          ],
          totalItems: 3,
          generatedAt: new Date().toISOString(),
          cachedUntil: new Date(Date.now() + 300000).toISOString(),
          postureSummary: { score: 72.5, trend: "stable", lastChange: 0 },
        },
      }),
    });
  });

  await page.route("**/api/compliance/freshness**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        freshness: {
          items: [
            {
              evidenceId: "evidence-group-1-record-1",
              fileName: "incident-response-playbook.pdf",
              evidenceType: "document",
              scfControlId: "IRO-05",
              submittedAt: "2026-03-06T09:00:00.000Z",
              expiresAt: "2027-03-06T09:00:00.000Z",
              daysUntilExpiry: 350,
              status: "fresh",
              ruleSource: "type_default",
            },
            {
              evidenceId: "evidence-group-2-record-1",
              fileName: "old-access-policy.pdf",
              evidenceType: "policy",
              scfControlId: "AC-01",
              submittedAt: "2025-01-01T00:00:00.000Z",
              expiresAt: "2026-01-01T00:00:00.000Z",
              daysUntilExpiry: -80,
              status: "stale",
              ruleSource: "type_default",
            },
          ],
          summary: { fresh: 1, expiring: 0, stale: 1 },
          scannedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route("**/api/compliance/impact-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        preview: {
          currentScore: 72.5,
          projectedScore: 78.3,
          improvementPct: 5.8,
          frameworkImpacts: [],
        },
      }),
    });
  });
}

export async function mockUploadWorkflowApis(
  page: Page,
  artifactName = DEFAULT_ARTIFACT_NAME
): Promise<UploadMockCalls> {
  const calls: UploadMockCalls = {
    documentsCalls: [],
    mapControlsCalls: [],
    gapAnalysisCalls: [],
    coverageCalls: [],
  };

  await mockDashboardApis(page);

  await page.route("**/api/analysis/run-gap-analysis", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    calls.gapAnalysisCalls.push(body);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, refreshed: true }),
    });
  });

  await page.route("**/api/controls/build-coverage", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    calls.coverageCalls.push(body);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        coverage: {
          total_controls: 2,
          covered_controls: 1,
          partial_controls: 1,
          missing_controls: 0,
          conflicting_controls: 0,
          coverage_percentage: 100,
        },
        controls: [
          {
            scf_control_id: "AC-01",
            status: "compliant",
            strongest_coverage_rank: 1,
          },
          {
            scf_control_id: "AC-02",
            status: "partial",
            strongest_coverage_rank: 1,
          },
        ],
      }),
    });
  });

  // The upload results view (and its NextUploadSuggestion child) POSTs here
  // after assessment. The real endpoint is rate-limited, so repeated suite
  // runs start returning 429s and fail the observer.
  await page.route("**/api/controls/framework-impact", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_frameworks_impacted: 2,
        total_controls_submitted: 2,
        frameworks: [
          {
            id: "fw-soc-2",
            framework_name: "SOC_2",
            framework_version: "Latest",
            total_framework_mappings: 1,
            controls_advanced: 1,
            control_ids: ["AC-01"],
            unique_requirements_touched: 1,
          },
          {
            id: "fw-iso-27001",
            framework_name: "ISO_27001",
            framework_version: "2022",
            total_framework_mappings: 1,
            controls_advanced: 1,
            control_ids: ["AC-02"],
            unique_requirements_touched: 1,
          },
        ],
      }),
    });
  });

  await page.route("**/api/erl/artifacts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        artifacts: [
          {
            erl_id: "ERL-AC-001",
            artifact: artifactName,
            controls: [
              {
                scf_control_id: "AC-01",
                title: "Access control policy",
                description: "",
              },
              {
                scf_control_id: "AC-02",
                title: "Privileged access",
                description: "",
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route("**/api/artifacts/classify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ artifact: artifactName }),
    });
  });

  await page.route("**/api/progress/session", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "session-upload-001" }),
    });
  });

  await page.route("**/api/progress/session/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/ws/progress**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: 'data: {"type":"connected"}\n\n',
    });
  });

  await page.route("**/api/evidence/extract-content", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        content: "Access control policy evidence content",
        imageData: null,
        fileName: "anthropic-controls.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
      }),
    });
  });

  await page.route("**/api/evidence/upload-only", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        evidence: {
          id: DEFAULT_EVIDENCE_ID,
          file_name: "anthropic-controls.pdf",
          evidence_status: "pending_review",
        },
        evidence_records: [
          {
            id: "er-1",
            scf_control_id: "AC-01",
            file_name: "anthropic-controls.pdf",
          },
          {
            id: "er-2",
            scf_control_id: "AC-02",
            file_name: "anthropic-controls.pdf",
          },
        ],
        discovered_controls: ["AC-01", "AC-02"],
        controls_details: [
          {
            scf_control_id: "AC-01",
            erl_id: "ERL-AC-001",
            title: "Access control policy",
            description: "",
          },
          {
            scf_control_id: "AC-02",
            erl_id: "ERL-AC-001",
            title: "Privileged access",
            description: "",
          },
        ],
        documentation_artifact: artifactName,
        awaiting_assessment: true,
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
          chunkCount: 2,
          createdAtomCount: 3,
          mappedCount: 2,
          atomIds: ["atom-1", "atom-2", "atom-3"],
          quality: "ready",
          content_length: 38,
          requested_extraction: true,
          executed_extraction: true,
          limited_reason: null,
        },
      }),
    });
  });

  await page.route("**/api/evidence/map-controls", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    calls.mapControlsCalls.push(body);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        mapped_atoms: 3,
        mapped_controls: 2,
        mapping_records: 2,
      }),
    });
  });

  await page.route("**/api/evidence/assess-uploaded", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        assessed_controls: 2,
        message: "Assessment completed",
        assessments: [
          {
            id: "assessment-1",
            scf_control_id: "AC-01",
            overall_result: "pass",
            overall_confidence: 0.94,
            summary: "Control evidence is sufficient",
            control_title: "Access control policy",
            objective_results: [
              {
                scf_ao_id: "AC-01.A1",
                assessment_objective: "Verify access control policy is documented.",
                result: "pass",
                confidence: 0.94,
                reasoning: "The uploaded policy states the access control requirement.",
                evidence_quotes: [
                  {
                    start: 0,
                    end: 21,
                    text: "Access control policy",
                    supports: "Documents the access control policy.",
                  },
                ],
              },
            ],
          },
          {
            id: "assessment-2",
            scf_control_id: "AC-02",
            overall_result: "partial",
            overall_confidence: 0.81,
            summary: "Additional evidence recommended",
            control_title: "Privileged access",
            objective_results: [],
          },
        ],
      }),
    });
  });

  await page.route("**/api/evidence/*/approve", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  return calls;
}
