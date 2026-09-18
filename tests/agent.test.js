import { afterEach, describe, expect, it } from "vitest";
import { isAuthorized, parseDfOutput, parseMemInfo, timingSafeEqual } from "../agent/agent.js";

describe("parseMemInfo", () => {
  it("computes used as total - available, in GB", () => {
    const text = [
      "MemTotal:       16384000 kB",
      "MemFree:         1000000 kB",
      "MemAvailable:    8192000 kB",
      "Buffers:          500000 kB",
    ].join("\n");

    const result = parseMemInfo(text);
    expect(result.total).toBeCloseTo(16384000 / 1024 / 1024, 1);
    expect(result.used).toBeCloseTo((16384000 - 8192000) / 1024 / 1024, 1);
  });

  it("throws when MemTotal or MemAvailable is missing", () => {
    expect(() => parseMemInfo("garbage\nMemFree: 100 kB")).toThrow();
  });
});

describe("parseDfOutput", () => {
  it("parses the data line of `df -k /`", () => {
    const text = [
      "Filesystem     1K-blocks    Used Available Use% Mounted on",
      "/dev/sda1       41152808 18874368  20971520  48% /",
    ].join("\n");

    const result = parseDfOutput(text);
    expect(result.total).toBeCloseTo(41152808 / 1024 / 1024, 2);
    expect(result.used).toBeCloseTo(18874368 / 1024 / 1024, 2);
  });

  it("throws on unparseable output", () => {
    expect(() => parseDfOutput("not a df output")).toThrow();
  });
});

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false (not throw) for different lengths", () => {
    expect(timingSafeEqual("short", "much-longer-token")).toBe(false);
  });
});

describe("isAuthorized", () => {
  const originalToken = process.env.VPS_AGENT_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.VPS_AGENT_TOKEN;
    } else {
      process.env.VPS_AGENT_TOKEN = originalToken;
    }
  });

  it("accepts a valid bearer token", () => {
    process.env.VPS_AGENT_TOKEN = "secret-token";
    expect(isAuthorized({ headers: { authorization: "Bearer secret-token" } })).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    process.env.VPS_AGENT_TOKEN = "secret-token";
    expect(isAuthorized({ headers: {} })).toBe(false);
  });

  it("rejects an invalid token", () => {
    process.env.VPS_AGENT_TOKEN = "secret-token";
    expect(isAuthorized({ headers: { authorization: "Bearer wrong" } })).toBe(false);
  });

  it("rejects any request when VPS_AGENT_TOKEN is not configured", () => {
    delete process.env.VPS_AGENT_TOKEN;
    expect(isAuthorized({ headers: { authorization: "Bearer anything" } })).toBe(false);
  });
});
