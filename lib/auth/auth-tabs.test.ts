import assert from "node:assert/strict";
import test from "node:test";
import { authUrl, parseAuthTab } from "@/lib/auth/auth-tabs";

test("authUrl defaults to signin tab when called with no tab", () => {
  assert.equal(authUrl(), "/auth");
});

test("authUrl emits ?tab=signup for the signup tab", () => {
  assert.equal(authUrl("signup"), "/auth?tab=signup");
});

test("authUrl passes through a next= redirect target", () => {
  assert.equal(authUrl("signup", "/dashboard"), "/auth?tab=signup&next=%2Fdashboard");
});

test("parseAuthTab defaults to signin for undefined", () => {
  assert.equal(parseAuthTab(undefined), "signin");
});

test("parseAuthTab accepts signup", () => {
  assert.equal(parseAuthTab("signup"), "signup");
});

test("parseAuthTab rejects unknown values (defaults to signin)", () => {
  assert.equal(parseAuthTab("admin"), "signin");
});
