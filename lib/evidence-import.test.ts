import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEvidenceImportContent,
  toEvidenceInsertRows,
  validateEvidenceImportRows,
  type EvidenceImportReferences,
} from "@/lib/evidence-import";

const REFERENCES: EvidenceImportReferences = {
  controls: new Set(["IRO-05", "AC-01"]),
  evidenceRequests: new Map([
    [
      "erl-db-id-1",
      {
        id: "erl-db-id-1",
        erlId: "ERL-IRO-001",
        documentationArtifact: "Incident Response Program Documentation",
        controlMappings: ["IRO-05"],
      },
    ],
    [
      "ERL-IRO-001",
      {
        id: "erl-db-id-1",
        erlId: "ERL-IRO-001",
        documentationArtifact: "Incident Response Program Documentation",
        controlMappings: ["IRO-05"],
      },
    ],
  ]),
};

test("parseEvidenceImportContent parses CSV headers into normalized fields", () => {
  const rows = parseEvidenceImportContent(
    "csv",
    [
      "File Name,SCF Control ID,Evidence Type,ERL Global ID,Description",
      "incident-response.pdf,IRO-05,document,ERL-IRO-001,Current plan",
    ].join("\n")
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowNumber, 2);
  assert.deepEqual(rows[0].fields, {
    file_name: "incident-response.pdf",
    scf_control_id: "IRO-05",
    evidence_type: "document",
    erl_global_id: "ERL-IRO-001",
    description: "Current plan",
  });
});

test("parseEvidenceImportContent parses JSON row arrays", () => {
  const rows = parseEvidenceImportContent(
    "json",
    JSON.stringify([
      {
        file_name: "access-policy.pdf",
        scf_control_id: "AC-01",
        evidence_type: "policy",
      },
    ])
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowNumber, 1);
  assert.equal(rows[0].fields.file_name, "access-policy.pdf");
});

test("validateEvidenceImportRows resolves ERL metadata and marks valid rows", () => {
  const rows = parseEvidenceImportContent(
    "csv",
    [
      "file_name,scf_control_id,evidence_type,erl_global_id,submitted_at",
      "incident-response.pdf,IRO-05,document,ERL-IRO-001,2026-06-26",
    ].join("\n")
  );

  const result = validateEvidenceImportRows(rows, REFERENCES);

  assert.equal(result.summary.totalRows, 1);
  assert.equal(result.summary.validRows, 1);
  assert.equal(result.summary.invalidRows, 0);
  assert.equal(result.rows[0].status, "valid");
  assert.equal(result.rows[0].values.erl_id, "erl-db-id-1");
  assert.equal(result.rows[0].values.erl_global_id, "ERL-IRO-001");
  assert.equal(
    result.rows[0].values.documentation_artifact,
    "Incident Response Program Documentation"
  );
  assert.equal(result.rows[0].values.submitted_at, "2026-06-26T00:00:00.000Z");
});

test("validateEvidenceImportRows rejects invalid references and ownership columns", () => {
  const rows = parseEvidenceImportContent(
    "csv",
    [
      "file_name,scf_control_id,evidence_type,erl_global_id,user_id",
      "access-policy.pdf,NOPE,unsupported,ERL-IRO-001,attacker",
    ].join("\n")
  );

  const result = validateEvidenceImportRows(rows, REFERENCES);

  assert.equal(result.summary.invalidRows, 1);
  assert.equal(result.rows[0].status, "invalid");
  assert.match(result.rows[0].errors.join(" "), /user_id is not supported/);
  assert.match(result.rows[0].errors.join(" "), /does not match an SCF control/);
  assert.match(result.rows[0].errors.join(" "), /evidence_type "unsupported" is not supported/);
  assert.match(result.rows[0].errors.join(" "), /is not mapped to control "NOPE"/);
});

test("toEvidenceInsertRows derives ownership from the authenticated user", () => {
  const rows = parseEvidenceImportContent(
    "json",
    JSON.stringify([
      {
        file_name: "incident-response.pdf",
        scf_control_id: "IRO-05",
        evidence_type: "document",
      },
    ])
  );
  const validation = validateEvidenceImportRows(rows, REFERENCES);

  const inserts = toEvidenceInsertRows(validation, "user-123", "2026-06-26T12:00:00.000Z");

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].user_id, "user-123");
  assert.equal(inserts[0].submitted_by, "user-123");
  assert.equal(inserts[0].evidence_status, "submitted");
  assert.equal(inserts[0].file_path, null);
  assert.equal(inserts[0].file_type, "external/import");
  assert.deepEqual(inserts[0].metadata, {
    imported: true,
    import_source: "bulk_evidence_import",
    imported_at: "2026-06-26T12:00:00.000Z",
    original_row_number: 1,
    documentation_artifact: null,
  });
});

test("toEvidenceInsertRows refuses invalid validation results", () => {
  const rows = parseEvidenceImportContent(
    "json",
    JSON.stringify([{ file_name: "", scf_control_id: "IRO-05", evidence_type: "document" }])
  );
  const validation = validateEvidenceImportRows(rows, REFERENCES);

  assert.throws(
    () => toEvidenceInsertRows(validation, "user-123", "2026-06-26T12:00:00.000Z"),
    /Cannot create evidence rows/
  );
});
