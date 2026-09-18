import { NextResponse } from "next/server";
import { getMonthlyPrice, listServers } from "@/lib/hetzner";
import { upsertServerFromHetzner } from "@/lib/servers";

export const dynamic = "force-dynamic";

export async function POST() {
  let hetznerServers;
  try {
    hetznerServers = await listServers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hetzner API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Cache pricing lookups per (server type, location) so we don't refetch
  // /v1/pricing once per server.
  const priceCache = new Map<string, number | null>();

  for (const server of hetznerServers) {
    const priceCacheKey = `${server.serverType}:${server.locationName}`;
    if (!priceCache.has(priceCacheKey)) {
      const price = await getMonthlyPrice(server.serverType, server.locationName).catch(
        () => null,
      );
      priceCache.set(priceCacheKey, price);
    }

    upsertServerFromHetzner({
      hetznerServerId: server.id,
      name: server.name,
      ip: server.publicIpv4 ?? "",
      ipv6: server.publicIpv6,
      serverType: server.serverType,
      vcpu: server.vcpu,
      ramTotalGb: server.ramGb,
      diskTotalGb: server.diskGb,
      datacenter: server.datacenter,
      hetznerPriceMonthly: priceCache.get(priceCacheKey) ?? null,
    });
  }

  return NextResponse.json({ synced: hetznerServers.length });
}
