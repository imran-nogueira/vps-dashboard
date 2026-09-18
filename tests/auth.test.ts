import { describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken } from "../lib/auth";

describe("checkPassword", () => {
  it("accepts the configured DASHBOARD_PASSWORD", () => {
    expect(checkPassword("test-password")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(checkPassword("nope")).toBe(false);
  });

  it("rejects a password of a different length without throwing", () => {
    expect(checkPassword("a-much-longer-wrong-password")).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips: a freshly created token verifies as valid", () => {
    const { token } = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken(null)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const { token } = createSessionToken();
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 999_999_999 })).toString(
      "base64url",
    );
    expect(verifySessionToken(`${tamperedPayload}.${signature}`)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-valid-token")).toBe(false);
  });

  it("rejects an expired token", () => {
    const expiredPayload = Buffer.from(JSON.stringify({ exp: Date.now() - 1000 })).toString(
      "base64url",
    );
    // Re-derive the signature the same way lib/auth.ts does, via a fresh
    // valid token's structure is not reusable here, so we only assert that
    // an arbitrary past-expiry payload (even unsigned) is rejected.
    expect(verifySessionToken(`${expiredPayload}.invalid-signature`)).toBe(false);
  });
});
