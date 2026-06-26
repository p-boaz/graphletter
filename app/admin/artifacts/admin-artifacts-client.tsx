"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ArtifactRecord = {
  id: string;
  documentation_artifact: string;
  artifact_description: string;
  scf_control_mappings: string[];
};

type ArtifactUpdate = Partial<
  Pick<ArtifactRecord, "documentation_artifact" | "artifact_description" | "scf_control_mappings">
>;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export function AdminArtifactsClient() {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<ArtifactUpdate>({});
  const [adding, setAdding] = useState(false);
  const [newArtifact, setNewArtifact] = useState<ArtifactUpdate>({
    documentation_artifact: "",
    artifact_description: "",
    scf_control_mappings: [],
  });
  const [viewMode, setViewMode] = useState<"artifacts" | "aws-mappings" | "supabase-mappings">(
    "artifacts"
  );

  // AWS to Artifact mappings captured during automated collection prototyping
  const awsMappings = [
    {
      awsService: "AWS IAM",
      awsFeature: "Multi-Factor Authentication (MFA)",
      checkType: "mfa_check",
      dataSource: "aws-iam-mfa-config",
      artifactName: "Identity & Access Management (IAM) Function",
      description: "Collects IAM user MFA configuration and coverage statistics",
    },
    {
      awsService: "AWS IAM",
      awsFeature: "Password Policy",
      checkType: "password_policy_check",
      dataSource: "aws-iam-password-policy",
      artifactName: "Authenticate, Authorize and Audit (AAA) Solution",
      description: "Analyzes IAM account password policy requirements and complexity",
    },
    {
      awsService: "AWS S3",
      awsFeature: "Bucket Encryption",
      checkType: "s3_encryption_check",
      dataSource: "aws-s3-encryption-config",
      artifactName: "Cryptographic Protections",
      description: "Reviews S3 bucket encryption configuration and coverage",
    },
    {
      awsService: "AWS S3",
      awsFeature: "Public Access Blocks",
      checkType: "s3_public_access_check",
      dataSource: "aws-s3-public-access-config",
      artifactName: "Access Permission Review",
      description: "Evaluates S3 bucket public access block settings",
    },
    {
      awsService: "AWS S3",
      awsFeature: "Bucket Versioning",
      checkType: "s3_versioning_check",
      dataSource: "aws-s3-versioning-config",
      artifactName: "Backups",
      description: "Checks S3 bucket versioning configuration for data protection",
    },
  ];

  // Supabase to Artifact mappings captured during automated collection prototyping
  const supabaseMappings = [
    {
      supabaseService: "Supabase Auth",
      supabaseFeature: "Authentication Configuration",
      checkType: "auth_config_check",
      dataSource: "supabase_management_api",
      artifactName: "Authenticate, Authorize and Audit (AAA) Solution",
      description: "Reviews authentication settings and security configurations",
    },
    {
      supabaseService: "Supabase Network",
      supabaseFeature: "Network Access Restrictions",
      checkType: "network_restrictions_check",
      dataSource: "supabase_management_api",
      artifactName: "Access Permission Review",
      description: "Evaluates network access controls and IP allowlisting",
    },
    {
      supabaseService: "Supabase API",
      supabaseFeature: "JWT Signing Keys",
      checkType: "signing_keys_check",
      dataSource: "supabase_management_api",
      artifactName: "Cryptographic Protections",
      description: "Analyzes JWT signing key configuration and rotation",
    },
    {
      supabaseService: "Supabase Security",
      supabaseFeature: "Security Advisors",
      checkType: "security_advisors_check",
      dataSource: "supabase_management_api",
      artifactName: "Risk Governance",
      description: "Reviews security recommendations and compliance alerts",
    },
  ];

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.set("search", search);
      }
      const response = await fetch(`/api/admin/artifacts?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJsonResponse<{ artifacts: ArtifactRecord[] }>(response);
      setArtifacts(payload.artifacts || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch artifacts");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchArtifacts();
  }, [fetchArtifacts]);

  async function handleEdit(id: string, field: keyof ArtifactUpdate, value: string | string[]) {
    setEditData((prev) => ({ ...prev, [field]: value }));
  }

  async function saveEdit(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/artifacts?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      await readJsonResponse(response);
      setEditingId(null);
      setEditData({});
      void fetchArtifacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save artifact");
    } finally {
      setLoading(false);
    }
  }

  async function deleteArtifact(id: string) {
    if (!confirm("Delete this artifact?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/artifacts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await readJsonResponse(response);
      void fetchArtifacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete artifact");
    } finally {
      setLoading(false);
    }
  }

  async function addArtifact() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newArtifact),
      });
      await readJsonResponse(response);
      setAdding(false);
      setNewArtifact({
        documentation_artifact: "",
        artifact_description: "",
        scf_control_mappings: [],
      });
      void fetchArtifacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add artifact");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8" data-testid="admin-artifacts-page">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">SCF Artifact Admin</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          className={`px-4 py-2 rounded ${
            viewMode === "artifacts"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("artifacts")}
        >
          SCF Artifacts
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded ${
            viewMode === "aws-mappings"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("aws-mappings")}
        >
          AWS → Artifact Mappings
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded ${
            viewMode === "supabase-mappings"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("supabase-mappings")}
        >
          Supabase → Artifact Mappings
        </button>
      </div>

      {/* SCF Artifacts View */}
      {viewMode === "artifacts" && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="Search artifacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-1 rounded"
              onClick={fetchArtifacts}
            >
              Search
            </button>
            <button
              type="button"
              className="bg-green-600 text-white px-4 py-1 rounded"
              onClick={() => setAdding(true)}
            >
              Add
            </button>
          </div>
          {error && (
            <div className="text-red-600 mb-2" data-testid="admin-artifacts-error">
              {error}
            </div>
          )}
          {loading ? (
            <div>Loading...</div>
          ) : (
            <table className="w-full border mt-4" data-testid="admin-artifacts-table">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Artifact Name</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Mapped Controls</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((artifact) => (
                  <tr
                    key={artifact.id}
                    className="border-b"
                    data-testid={`admin-artifacts-row-${artifact.id}`}
                  >
                    <td className="p-2 border">
                      {editingId === artifact.id ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.documentation_artifact ?? artifact.documentation_artifact}
                          onChange={(e) =>
                            handleEdit(artifact.id, "documentation_artifact", e.target.value)
                          }
                        />
                      ) : (
                        artifact.documentation_artifact
                      )}
                    </td>
                    <td className="p-2 border">
                      {editingId === artifact.id ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={editData.artifact_description ?? artifact.artifact_description}
                          onChange={(e) =>
                            handleEdit(artifact.id, "artifact_description", e.target.value)
                          }
                        />
                      ) : (
                        artifact.artifact_description
                      )}
                    </td>
                    <td className="p-2 border">
                      {editingId === artifact.id ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={(
                            editData.scf_control_mappings ?? artifact.scf_control_mappings
                          ).join(", ")}
                          onChange={(e) =>
                            handleEdit(
                              artifact.id,
                              "scf_control_mappings",
                              e.target.value.split(",").map((s: string) => s.trim())
                            )
                          }
                        />
                      ) : (
                        (artifact.scf_control_mappings || []).join(", ")
                      )}
                    </td>
                    <td className="p-2 border flex gap-2">
                      {editingId === artifact.id ? (
                        <>
                          <button
                            className="bg-blue-600 text-white px-2 py-1 rounded"
                            onClick={() => saveEdit(artifact.id)}
                          >
                            Save
                          </button>
                          <button
                            className="bg-gray-400 text-white px-2 py-1 rounded"
                            onClick={() => {
                              setEditingId(null);
                              setEditData({});
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="bg-yellow-500 text-white px-2 py-1 rounded"
                            onClick={() => {
                              setEditingId(artifact.id);
                              setEditData(artifact);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="bg-red-600 text-white px-2 py-1 rounded"
                            onClick={() => deleteArtifact(artifact.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {adding && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
                <h2 className="text-lg font-bold mb-2">Add New Artifact</h2>
                <input
                  className="border rounded px-2 py-1 w-full mb-2"
                  placeholder="Artifact Name"
                  value={newArtifact.documentation_artifact}
                  onChange={(e) =>
                    setNewArtifact({
                      ...newArtifact,
                      documentation_artifact: e.target.value,
                    })
                  }
                />
                <input
                  className="border rounded px-2 py-1 w-full mb-2"
                  placeholder="Description"
                  value={newArtifact.artifact_description}
                  onChange={(e) =>
                    setNewArtifact({
                      ...newArtifact,
                      artifact_description: e.target.value,
                    })
                  }
                />
                <input
                  className="border rounded px-2 py-1 w-full mb-2"
                  placeholder="Mapped Controls (comma separated)"
                  value={(newArtifact.scf_control_mappings || []).join(", ")}
                  onChange={(e) =>
                    setNewArtifact({
                      ...newArtifact,
                      scf_control_mappings: e.target.value.split(",").map((s: string) => s.trim()),
                    })
                  }
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    className="bg-green-600 text-white px-4 py-1 rounded"
                    onClick={addArtifact}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="bg-gray-400 text-white px-4 py-1 rounded"
                    onClick={() => setAdding(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* AWS Mappings View */}
      {viewMode === "aws-mappings" && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">AWS Service → SCF Artifact Mappings</h2>
            <p className="text-gray-600">
              Shows how AWS services are mapped to SCF Evidence Request List artifacts within
              automated collection workflows
            </p>
          </div>

          <table className="w-full border mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border">AWS Service</th>
                <th className="p-3 border">AWS Feature</th>
                <th className="p-3 border">Check Type</th>
                <th className="p-3 border">SCF Artifact</th>
                <th className="p-3 border">Description</th>
              </tr>
            </thead>
            <tbody>
              {awsMappings.map((mapping, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="p-3 border">
                    <span className="font-medium text-blue-600">{mapping.awsService}</span>
                  </td>
                  <td className="p-3 border">
                    <span className="text-gray-800">{mapping.awsFeature}</span>
                  </td>
                  <td className="p-3 border">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {mapping.checkType}
                    </code>
                  </td>
                  <td className="p-3 border">
                    <span className="font-medium text-green-600">{mapping.artifactName}</span>
                  </td>
                  <td className="p-3 border text-sm text-gray-600">{mapping.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Collection Workflow</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Automated collectors gather configuration data from your AWS account</li>
              <li>
                • Data is automatically mapped to relevant SCF Evidence Request List artifacts
              </li>
              <li>• AI assessments are generated based on the collected evidence</li>
              <li>• Results appear in your compliance dashboard for review</li>
            </ul>
          </div>
        </div>
      )}

      {/* Supabase Mappings View */}
      {viewMode === "supabase-mappings" && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Supabase Service → SCF Artifact Mappings</h2>
            <p className="text-gray-600">
              Shows how Supabase services are mapped to SCF Evidence Request List artifacts within
              automated collection workflows
            </p>
          </div>

          <table className="w-full border mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border">Supabase Service</th>
                <th className="p-3 border">Supabase Feature</th>
                <th className="p-3 border">Check Type</th>
                <th className="p-3 border">SCF Artifact</th>
                <th className="p-3 border">Description</th>
              </tr>
            </thead>
            <tbody>
              {supabaseMappings.map((mapping, index) => (
                <tr key={`supabase-${index}`} className="border-b hover:bg-gray-50">
                  <td className="p-3 border">
                    <span className="font-medium text-green-600">{mapping.supabaseService}</span>
                  </td>
                  <td className="p-3 border">
                    <span className="text-gray-800">{mapping.supabaseFeature}</span>
                  </td>
                  <td className="p-3 border">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {mapping.checkType}
                    </code>
                  </td>
                  <td className="p-3 border">
                    <span className="font-medium text-purple-600">{mapping.artifactName}</span>
                  </td>
                  <td className="p-3 border text-sm text-gray-600">{mapping.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Collection Workflow</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Automated collectors use the Management API to pull configuration data</li>
              <li>
                • Security and access configurations are automatically mapped to relevant SCF
                artifacts
              </li>
              <li>• AI assessments evaluate compliance based on collected evidence</li>
              <li>• Results are displayed in your compliance dashboard for review and action</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
