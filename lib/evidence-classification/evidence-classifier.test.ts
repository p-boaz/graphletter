import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceClassifier } from "./evidence-classifier";

test("classifyAzureEvidence: classifies storage encryption evidence", () => {
  const result = EvidenceClassifier.classifyAzureEvidence(
    {
      encryption_details: [
        {
          storage_account: "prodsa",
          key_source: "Microsoft.Storage",
        },
      ],
    },
    "storage_encryption"
  );

  assert.equal(result.artifact_type, "Cloud storage default encryption configuration");
  assert.equal(result.data_source, "azure-storage-encryption-config");
  assert.equal(result.evidence_category, "configuration");
  assert.equal(result.scope, "per_resource");
  assert.ok(result.capabilities.some((capability) => capability.includes("encryption at rest")));
});

test("classifyAzureEvidence: classifies conditional access MFA evidence", () => {
  const result = EvidenceClassifier.classifyAzureEvidence(
    {
      conditional_access_policies: [
        {
          display_name: "Require MFA for admins",
          state: "enabled",
        },
      ],
    },
    "conditional_access_mfa"
  );

  assert.equal(result.artifact_type, "Multi-factor authentication enforcement configuration");
  assert.equal(result.data_source, "azure-entra-mfa-config");
  assert.equal(result.scope, "organization_wide");
  assert.ok(result.limitations.some((limitation) => limitation.includes("sign-in telemetry")));
});

test("classifyGCPEvidence: classifies storage public access evidence", () => {
  const result = EvidenceClassifier.classifyGCPEvidence(
    {
      public_access_details: [
        {
          bucket: "customer-data",
          public_access_prevention: "enforced",
        },
      ],
    },
    "bucket_public_access"
  );

  assert.equal(result.artifact_type, "Cloud storage access control configuration");
  assert.equal(result.data_source, "gcp-storage-public-access-config");
  assert.equal(result.evidence_category, "configuration");
  assert.equal(result.scope, "per_resource");
  assert.ok(result.capabilities.some((capability) => capability.includes("public access")));
});

test("classifyGCPEvidence: classifies Cloud Identity password policy evidence", () => {
  const result = EvidenceClassifier.classifyGCPEvidence(
    {
      password_policy: {
        minimum_length: 14,
        password_reuse_window: 5,
      },
    },
    "password_policy"
  );

  assert.equal(result.artifact_type, "Password policy configuration");
  assert.equal(result.data_source, "gcp-cloud-identity-password-policy");
  assert.equal(result.evidence_category, "policy");
  assert.equal(result.scope, "organization_wide");
  assert.ok(result.capabilities.some((capability) => capability.includes("complexity")));
});

test("classifyAzureEvidence and classifyGCPEvidence: unknown check types return provider fallbacks", () => {
  const azure = EvidenceClassifier.classifyAzureEvidence({}, "network_firewall");
  const gcp = EvidenceClassifier.classifyGCPEvidence({}, "asset_inventory");

  assert.equal(azure.data_source, "azure-network_firewall");
  assert.equal(gcp.data_source, "gcp-asset_inventory");
  assert.equal(azure.artifact_type, "Azure evidence type requiring manual classification");
  assert.equal(gcp.artifact_type, "GCP evidence type requiring manual classification");
  assert.deepEqual(azure.capabilities, []);
  assert.deepEqual(gcp.capabilities, []);
  assert.ok(
    azure.limitations.some((limitation) => limitation.includes("not explicitly classified"))
  );
  assert.ok(gcp.limitations.some((limitation) => limitation.includes("not explicitly classified")));
});
