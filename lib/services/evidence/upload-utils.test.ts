import assert from "node:assert/strict";
import test from "node:test";
import { validateEvidenceUploadFile } from "./upload-utils";

function fileFromBytes(name: string, type: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

test("validateEvidenceUploadFile accepts supported file signatures", async () => {
  const cases = [
    fileFromBytes("evidence.pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]),
    fileFromBytes(
      "policy.doc",
      "application/msword",
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    ),
    fileFromBytes(
      "policy.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      [0x50, 0x4b, 0x03, 0x04]
    ),
    fileFromBytes(
      "control-matrix.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      [0x50, 0x4b, 0x05, 0x06]
    ),
    fileFromBytes("controls.csv", "text/csv", [0x63, 0x6f, 0x6e, 0x74, 0x72, 0x6f, 0x6c]),
    fileFromBytes("diagram.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    fileFromBytes("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]),
    fileFromBytes("scan.gif", "image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ];

  for (const file of cases) {
    assert.deepEqual(await validateEvidenceUploadFile(file), { isValid: true }, file.name);
  }
});

test("validateEvidenceUploadFile rejects MIME and signature mismatches", async () => {
  const result = await validateEvidenceUploadFile(
    fileFromBytes("spoofed.pdf", "application/pdf", [0x6e, 0x6f, 0x74, 0x20, 0x70, 0x64, 0x66])
  );

  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /contents do not match/i);
});

test("validateEvidenceUploadFile rejects MIME and extension mismatches", async () => {
  const result = await validateEvidenceUploadFile(
    fileFromBytes("policy.txt", "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d])
  );

  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /contents do not match/i);
});

test("validateEvidenceUploadFile rejects binary content disguised as text", async () => {
  const result = await validateEvidenceUploadFile(
    fileFromBytes("notes.txt", "text/plain", [0x68, 0x69, 0x00, 0xff])
  );

  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /contents do not match/i);
});
