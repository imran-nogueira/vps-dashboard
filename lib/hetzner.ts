const HETZNER_API_BASE = "https://api.hetzner.cloud/v1";

export interface HetznerServer {
  id: number;
  name: string;
  publicIpv4: string | null;
  publicIpv6: string | null;
  serverType: string;
  vcpu: number;
  ramGb: number;
  diskGb: number;
  datacenter: string;
  locationName: string;
}

interface HetznerServerTypePrice {
  location: string;
  price_monthly: { gross: string };
}

interface HetznerPricingServerType {
  name: string;
  prices: HetznerServerTypePrice[];
}

function getToken(): string {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error("HETZNER_API_TOKEN environment variable is not set");
  }
  return token;
}

async function hetznerFetch(pathname: string): Promise<unknown> {
  const res = await fetch(`${HETZNER_API_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hetzner API ${pathname} failed: ${res.status} ${body}`);
  }

  return res.json();
}

export async function listServers(): Promise<HetznerServer[]> {
  const data = (await hetznerFetch("/servers")) as {
    servers: Array<{
      id: number;
      name: string;
      public_net: {
        ipv4: { ip: string } | null;
        ipv6: { ip: string } | null;
      };
      server_type: { name: string; cores: number; memory: number; disk: number };
      datacenter: { name: string; location: { name: string } };
    }>;
  };

  return data.servers.map((s) => ({
    id: s.id,
    name: s.name,
    publicIpv4: s.public_net.ipv4?.ip ?? null,
    publicIpv6: s.public_net.ipv6?.ip ?? null,
    serverType: s.server_type.name,
    vcpu: s.server_type.cores,
    ramGb: s.server_type.memory,
    diskGb: s.server_type.disk,
    datacenter: s.datacenter.name,
    locationName: s.datacenter.location.name,
  }));
}

// Returns the monthly gross price (in the account's billing currency) for a
// given server type + location, or null if it can't be resolved.
export async function getMonthlyPrice(
  serverType: string,
  locationName: string,
): Promise<number | null> {
  const data = (await hetznerFetch("/pricing")) as {
    pricing: { server_types: HetznerPricingServerType[] };
  };

  const entry = data.pricing.server_types.find((t) => t.name === serverType);
  if (!entry) return null;

  const priceForLocation =
    entry.prices.find((p) => p.location === locationName) ?? entry.prices[0];
  if (!priceForLocation) return null;

  const value = Number.parseFloat(priceForLocation.price_monthly.gross);
  return Number.isFinite(value) ? value : null;
}
