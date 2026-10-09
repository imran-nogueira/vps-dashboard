import { afterEach, describe, expect, it } from "vitest";
import { getDb } from "../lib/db";
import { effectivePrice, rowToView, summarize } from "../lib/servers";
import type { AgentHealth, ServerRow } from "../lib/types";

afterEach(() => {
  getDb().exec("DELETE FROM servers");
});

function makeRow(overrides: Partial<ServerRow> = {}): ServerRow {
  return {
    id: 1,
    hetzner_server_id: null,
    name: "test-vps",
    ssh_user: "root",
    ip: "1.2.3.4",
    ipv6: null,
    agent_url: "http://1.2.3.4:9090",
    agent_token: "token",
    server_type: "cx22",
    vcpu: 2,
    ram_total_gb: 4,
    disk_total_gb: 40,
    datacenter: "fsn1-dc14",
    price_monthly: null,
    hetzner_price_monthly: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("effectivePrice", () => {
  it("prefers the manual override over the Hetzner price", () => {
    expect(effectivePrice({ price_monthly: 9.99, hetzner_price_monthly: 6.59 })).toBe(9.99);
  });

  it("falls back to the Hetzner price when no override is set", () => {
    expect(effectivePrice({ price_monthly: null, hetzner_price_monthly: 6.59 })).toBe(6.59);
  });

  it("returns null when neither price is known", () => {
    expect(effectivePrice({ price_monthly: null, hetzner_price_monthly: null })).toBeNull();
  });
});

describe("rowToView (merge live/cache)", () => {
  const health: AgentHealth = {
    status: "online",
    ram: { used: 1.8, total: 4 },
    disk: { used: 18, total: 40 },
    uptime: 123456,
  };

  it("marks the server online and uses live metrics when the agent responds", () => {
    const view = rowToView(makeRow(), health);
    expect(view.status).toBe("online");
    expect(view.ram).toEqual({ used: 1.8, total: 4 });
    expect(view.disk).toEqual({ used: 18, total: 40 });
    expect(view.uptime).toBe(123456);
  });

  it("marks the server offline and falls back to cached statics when the agent is unreachable", () => {
    const view = rowToView(makeRow({ ram_total_gb: 4, disk_total_gb: 40 }), null);
    expect(view.status).toBe("offline");
    expect(view.ram).toEqual({ used: null, total: 4 });
    expect(view.disk).toEqual({ used: null, total: 40 });
    expect(view.uptime).toBeNull();
  });

  it("keeps the plan specs from the DB even when the agent reports a different total", () => {
    const view = rowToView(makeRow({ ram_total_gb: 4, disk_total_gb: 40 }), {
      ...health,
      ram: { used: 1.8, total: 3.7 },
      disk: { used: 18, total: 38.2 },
    });
    expect(view.specs).toEqual({ ramGb: 4, diskGb: 40 });
    expect(view.ram).toEqual({ used: 1.8, total: 3.7 });
    expect(view.disk).toEqual({ used: 18, total: 38.2 });
  });

  it("falls back to the agent totals for specs when the DB has none", () => {
    const view = rowToView(makeRow({ ram_total_gb: null, disk_total_gb: null }), health);
    expect(view.specs).toEqual({ ramGb: 4, diskGb: 40 });
  });

  it("never throws or drops other fields when a row has no cached totals yet", () => {
    const view = rowToView(makeRow({ ram_total_gb: null, disk_total_gb: null }), null);
    expect(view.ram).toEqual({ used: null, total: null });
    expect(view.disk).toEqual({ used: null, total: null });
    expect(view.specs).toEqual({ ramGb: null, diskGb: null });
  });
});

describe("summarize", () => {
  it("sums count, RAM and price across servers, ignoring unknown values", () => {
    const views = [
      rowToView(makeRow({ id: 1, price_monthly: 6.59 }), {
        status: "online",
        ram: { used: 1.8, total: 4 },
        disk: { used: 18, total: 40 },
        uptime: 100,
      }),
      // Offline: no live "used" value, but its cached total RAM still counts
      // towards the fleet total (it's real capacity you're paying for).
      rowToView(
        makeRow({ id: 2, ram_total_gb: 8, price_monthly: null, hetzner_price_monthly: null }),
        null,
      ),
    ];

    const summary = summarize(views);
    expect(summary.count).toBe(2);
    expect(summary.ramTotalGb).toBe(12);
    expect(summary.ramUsedGb).toBe(1.8);
    expect(summary.priceMonthlyTotal).toBe(6.59);
  });

  it("sums the plan RAM from the DB, not the slightly lower total the agent reports", () => {
    const views = [
      rowToView(makeRow({ id: 1, ram_total_gb: 4 }), {
        status: "online",
        ram: { used: 1.9, total: 3.7 },
        disk: { used: 14, total: 40 },
        uptime: 100,
      }),
      // No plan size in the DB yet: falls back to the agent's total.
      rowToView(makeRow({ id: 2, ram_total_gb: null }), {
        status: "online",
        ram: { used: 5.4, total: 7.6 },
        disk: { used: 66, total: 80 },
        uptime: 100,
      }),
    ];

    const summary = summarize(views);
    expect(summary.ramTotalGb).toBe(11.6);
    expect(summary.ramUsedGb).toBe(7.3);
  });
});
