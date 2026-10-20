import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMonthlyPrice, listServers } from "../lib/hetzner";

// Shapes follow the live API (checked 2026-10-20): since 1 July 2026 servers
// expose `location` and no longer have a `datacenter` property.
function serverFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: "trading-01",
    status: "running",
    public_net: {
      ipv4: { ip: "203.0.113.10" },
      ipv6: { ip: "2001:db8::/64" },
    },
    server_type: { name: "cx23", cores: 2, memory: 4, disk: 40 },
    location: { name: "nbg1", city: "Nuremberg", country: "DE" },
    ...overrides,
  };
}

const PRICING_FIXTURE = {
  pricing: {
    currency: "EUR",
    vat_rate: "19.000000",
    server_types: [
      {
        id: 1,
        name: "cx23",
        prices: [
          {
            location: "fsn1",
            price_hourly: { net: "0.0056", gross: "0.0067" },
            price_monthly: { net: "3.4900", gross: "4.1531" },
            included_traffic: 21990232555520,
            price_per_tb_traffic: { net: "1.0000", gross: "1.1900" },
          },
          {
            location: "nbg1",
            price_hourly: { net: "0.0058", gross: "0.0069" },
            price_monthly: { net: "3.5900", gross: "4.2721" },
            included_traffic: 21990232555520,
            price_per_tb_traffic: { net: "1.0000", gross: "1.1900" },
          },
        ],
      },
    ],
  },
};

const fetchMock = vi.fn();

function respondWith(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("HETZNER_API_TOKEN", "test-token");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("listServers", () => {
  it("reads the location (no more datacenter) and maps the static specs", async () => {
    respondWith(200, { servers: [serverFixture()] });

    const [server] = await listServers();

    expect(server).toEqual({
      id: 42,
      name: "trading-01",
      publicIpv4: "203.0.113.10",
      publicIpv6: "2001:db8::/64",
      serverType: "cx23",
      vcpu: 2,
      ramGb: 4,
      diskGb: 40,
      locationName: "nbg1",
    });
  });

  it("handles servers without public IPs", async () => {
    respondWith(200, { servers: [serverFixture({ public_net: { ipv4: null, ipv6: null } })] });

    const [server] = await listServers();

    expect(server.publicIpv4).toBeNull();
    expect(server.publicIpv6).toBeNull();
  });

  it("fails with an explicit message when a server has no location", async () => {
    respondWith(200, { servers: [serverFixture({ location: undefined })] });

    await expect(listServers()).rejects.toThrow(/server 42 .*location/);
  });

  it("surfaces Hetzner's own error message", async () => {
    respondWith(401, { error: { code: "unauthorized", message: "unable to authenticate" } });

    await expect(listServers()).rejects.toThrow(
      "Hetzner API /servers failed: 401 unauthorized — unable to authenticate",
    );
  });

  it("fails clearly when the token is missing", async () => {
    vi.stubEnv("HETZNER_API_TOKEN", "");

    await expect(listServers()).rejects.toThrow("HETZNER_API_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getMonthlyPrice", () => {
  it("returns the gross monthly price for the server's location", async () => {
    respondWith(200, PRICING_FIXTURE);

    await expect(getMonthlyPrice("cx23", "nbg1")).resolves.toBe(4.2721);
  });

  it("falls back to the first listed location when the location has no price", async () => {
    respondWith(200, PRICING_FIXTURE);

    await expect(getMonthlyPrice("cx23", "ash")).resolves.toBe(4.1531);
  });

  it("returns null for an unknown server type", async () => {
    respondWith(200, PRICING_FIXTURE);

    await expect(getMonthlyPrice("cx99", "nbg1")).resolves.toBeNull();
  });
});
