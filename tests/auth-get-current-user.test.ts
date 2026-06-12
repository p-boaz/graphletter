import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { getCurrentUser } from "@/utils/auth";

type SupabaseClientArg = NonNullable<Parameters<typeof getCurrentUser>[0]>;

function clientReturning(user: unknown, error: unknown): SupabaseClientArg {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error }),
    },
  } as unknown as SupabaseClientArg;
}

test("getCurrentUser returns the user when auth succeeds", async () => {
  const user = { id: "user-1", email: "user@example.com" };
  assert.equal(await getCurrentUser(clientReturning(user, null)), user);
});

test("getCurrentUser returns null when no session exists (signed-out request)", async () => {
  const client = clientReturning(null, new AuthSessionMissingError());
  assert.equal(await getCurrentUser(client), null);
});

test("getCurrentUser returns null when the token is rejected (4xx auth error)", async () => {
  const client = clientReturning(null, new AuthApiError("invalid JWT", 401, "bad_jwt"));
  assert.equal(await getCurrentUser(client), null);
});

test("getCurrentUser throws on auth infrastructure failures", async () => {
  const client = clientReturning(null, new AuthRetryableFetchError("fetch failed", 0));
  await assert.rejects(() => getCurrentUser(client), /Authentication error: fetch failed/);
});

test("getCurrentUser throws when the auth server itself fails (5xx)", async () => {
  const client = clientReturning(null, new AuthApiError("internal error", 500, "unexpected"));
  await assert.rejects(() => getCurrentUser(client), /Authentication error: internal error/);
});
