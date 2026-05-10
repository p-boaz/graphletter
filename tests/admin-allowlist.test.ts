import assert from "node:assert/strict";
import test from "node:test";
import { isUserInAdminAllowlist } from "@/utils/auth";

test("isUserInAdminAllowlist only trusts server-controlled user ids and emails", () => {
  process.env.ADMIN_USER_IDS = "admin-user";
  process.env.ADMIN_EMAILS = "admin@example.com";

  assert.equal(
    isUserInAdminAllowlist({
      id: "admin-user",
      email: "user@example.com",
    }),
    true
  );

  assert.equal(
    isUserInAdminAllowlist({
      id: "ordinary-user",
      email: "admin@example.com",
    }),
    true
  );

  assert.equal(
    isUserInAdminAllowlist({
      id: "ordinary-user",
      email: "user@example.com",
    }),
    false
  );
});
