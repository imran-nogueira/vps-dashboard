import { describe, expect, it } from "vitest";
import { formatUptime, liveRamUsagePct } from "../lib/format";
import type { ServerView } from "../lib/types";

describe("formatUptime", () => {
  it("affiche jours et heures au-delà d'une journée", () => {
    expect(formatUptime(41 * 86_400 + 6 * 3_600 + 59 * 60)).toBe("41 d 6 h");
  });

  it("affiche heures et minutes sous une journée", () => {
    expect(formatUptime(3 * 3_600 + 12 * 60 + 30)).toBe("3 h 12 m");
  });

  it("affiche les minutes sous une heure, 0 m au démarrage", () => {
    expect(formatUptime(5 * 60 + 59)).toBe("5 m");
    expect(formatUptime(0)).toBe("0 m");
  });

  it("borne les valeurs négatives à zéro", () => {
    expect(formatUptime(-10)).toBe("0 m");
  });
});

function makeView(overrides: Partial<ServerView> = {}): ServerView {
  return {
    id: 1,
    hetzner_server_id: null,
    name: "vps",
    ssh_user: "root",
    ip: "1.2.3.4",
    ipv6: null,
    agent_url: "http://1.2.3.4:9090",
    server_type: "cx22",
    vcpu: 2,
    datacenter: "fsn1",
    price_monthly: null,
    status: "online",
    specs: { ramGb: 4, diskGb: 40 },
    ram: { used: 2, total: 4 },
    disk: { used: 10, total: 40 },
    uptime: 100,
    ...overrides,
  };
}

describe("liveRamUsagePct", () => {
  it("ignore les serveurs offline dans le dénominateur", () => {
    const servers = [
      makeView({ ram: { used: 1.9, total: 4 } }),
      makeView({ ram: { used: 5.4, total: 8 } }),
      makeView({ status: "offline", ram: { used: null, total: 4 } }),
    ];
    expect(liveRamUsagePct(servers)).toBe(61);
  });

  it("renvoie null sans aucune donnée live", () => {
    expect(liveRamUsagePct([])).toBeNull();
    expect(liveRamUsagePct([makeView({ status: "offline", ram: { used: null, total: 4 } })])).toBeNull();
  });
});
