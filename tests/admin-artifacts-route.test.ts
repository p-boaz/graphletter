import assert from "node:assert/strict";
import test from "node:test";
import {
  type AdminArtifactsDeps,
  type AdminArtifactsRepository,
  createAdminArtifactsHandlers,
} from "@/lib/admin/artifacts-route-handlers";

function createRepository() {
  const calls: string[] = [];
  const repository: AdminArtifactsRepository = {
    async list(search) {
      calls.push(`list:${search}`);
      return [
        {
          id: "artifact-1",
          documentation_artifact: "Access Control Policy",
          artifact_description: "Policy evidence",
          scf_control_mappings: ["AC-01"],
        },
      ];
    },
    async create(input) {
      calls.push(`create:${input.documentation_artifact}`);
      return {
        id: "artifact-2",
        documentation_artifact: input.documentation_artifact || "",
        artifact_description: input.artifact_description || null,
        scf_control_mappings: input.scf_control_mappings || [],
      };
    },
    async update(id, input) {
      calls.push(`update:${id}:${input.documentation_artifact}`);
      return {
        id,
        documentation_artifact: input.documentation_artifact || "Updated",
        artifact_description: input.artifact_description || null,
        scf_control_mappings: input.scf_control_mappings || [],
      };
    },
    async delete(id) {
      calls.push(`delete:${id}`);
    },
  };

  return { repository, calls };
}

function depsForUser(user: { id: string; email: string } | null, admin: boolean) {
  const { repository, calls } = createRepository();
  const deps: AdminArtifactsDeps = {
    async getUser() {
      return user;
    },
    async isAdmin() {
      return admin;
    },
    repository,
  };

  return { deps, calls };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("admin artifacts API rejects signed-out and non-admin users before repository access", async () => {
  const signedOut = depsForUser(null, false);
  const signedOutHandlers = createAdminArtifactsHandlers(signedOut.deps);

  const signedOutResponse = await signedOutHandlers.GET(
    new Request("https://graphletter.test/api/admin/artifacts")
  );
  assert.equal(signedOutResponse.status, 401);
  assert.deepEqual(await json(signedOutResponse), { error: "Unauthorized" });
  assert.deepEqual(signedOut.calls, []);

  const forbidden = depsForUser({ id: "user-1", email: "user@example.com" }, false);
  const forbiddenHandlers = createAdminArtifactsHandlers(forbidden.deps);

  const forbiddenResponse = await forbiddenHandlers.POST(
    new Request("https://graphletter.test/api/admin/artifacts", {
      method: "POST",
      body: JSON.stringify({ documentation_artifact: "Policy" }),
    })
  );
  assert.equal(forbiddenResponse.status, 403);
  assert.deepEqual(await json(forbiddenResponse), { error: "Forbidden" });
  assert.deepEqual(forbidden.calls, []);
});

test("admin artifacts API dispatches authorized list, create, update, and delete operations", async () => {
  const { deps, calls } = depsForUser({ id: "admin-1", email: "admin@example.com" }, true);
  const handlers = createAdminArtifactsHandlers(deps);

  const listResponse = await handlers.GET(
    new Request("https://graphletter.test/api/admin/artifacts?search=Access")
  );
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await json(listResponse)).artifacts, [
    {
      id: "artifact-1",
      documentation_artifact: "Access Control Policy",
      artifact_description: "Policy evidence",
      scf_control_mappings: ["AC-01"],
    },
  ]);

  const createResponse = await handlers.POST(
    new Request("https://graphletter.test/api/admin/artifacts", {
      method: "POST",
      body: JSON.stringify({
        documentation_artifact: "New Policy",
        artifact_description: "Description",
        scf_control_mappings: [" AC-01 ", " "],
      }),
    })
  );
  assert.equal(createResponse.status, 201);
  assert.deepEqual((await json(createResponse)).artifact, {
    id: "artifact-2",
    documentation_artifact: "New Policy",
    artifact_description: "Description",
    scf_control_mappings: ["AC-01"],
  });

  const updateResponse = await handlers.PATCH(
    new Request("https://graphletter.test/api/admin/artifacts?id=artifact-1", {
      method: "PATCH",
      body: JSON.stringify({ documentation_artifact: "Updated Policy" }),
    })
  );
  assert.equal(updateResponse.status, 200);

  const deleteResponse = await handlers.DELETE(
    new Request("https://graphletter.test/api/admin/artifacts?id=artifact-1", {
      method: "DELETE",
    })
  );
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await json(deleteResponse), { success: true });

  assert.deepEqual(calls, [
    "list:Access",
    "create:New Policy",
    "update:artifact-1:Updated Policy",
    "delete:artifact-1",
  ]);
});
