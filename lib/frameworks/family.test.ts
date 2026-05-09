import assert from "node:assert/strict";
import test from "node:test";
import { frameworkFamily } from "@/lib/frameworks/family";

test("frameworkFamily classifies NIST 800-53 as NIST", () => {
  assert.equal(frameworkFamily("NIST 800-53"), "NIST");
});

test("frameworkFamily classifies NIST CSF as NIST", () => {
  assert.equal(frameworkFamily("NIST CSF"), "NIST");
});

test("frameworkFamily classifies ISO 27001 as ISO", () => {
  assert.equal(frameworkFamily("ISO 27001"), "ISO");
});

test("frameworkFamily classifies ISO 42001 as ISO", () => {
  assert.equal(frameworkFamily("ISO 42001"), "ISO");
});

test("frameworkFamily classifies PCI DSS as PCI", () => {
  assert.equal(frameworkFamily("PCI DSS"), "PCI");
});

test("frameworkFamily classifies PCI DSS SAQ D as PCI", () => {
  assert.equal(frameworkFamily("PCI DSS SAQ D"), "PCI");
});

test("frameworkFamily classifies US HIPAA Administrative as HIPAA", () => {
  assert.equal(frameworkFamily("US HIPAA Administrative"), "HIPAA");
});

test("frameworkFamily classifies SOC 2 as SOC", () => {
  assert.equal(frameworkFamily("SOC 2"), "SOC");
});

test("frameworkFamily classifies US SOX as SOX", () => {
  assert.equal(frameworkFamily("US SOX"), "SOX");
});

test("frameworkFamily classifies CSA CCM as CSA", () => {
  assert.equal(frameworkFamily("CSA CCM"), "CSA");
});

test("frameworkFamily classifies EU GDPR as EU", () => {
  assert.equal(frameworkFamily("EU GDPR"), "EU");
});

test("frameworkFamily returns Other for unknown names", () => {
  assert.equal(frameworkFamily("Something Unknown"), "Other");
});
