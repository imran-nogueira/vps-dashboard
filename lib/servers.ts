import { z } from "zod";
import { getDb } from "./db";
import { fetchAgentHealth } from "./agent-client";
import type { AgentHealth, ServerRow, ServerView, ServersSummary } from "./types";

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export const createServerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  ip: z.string().trim().regex(ipv4Regex, "Must be a valid IPv4 address"),
  ipv6: z.string().trim().min(1).max(100).nullable().optional(),
  ssh_user: z.string().trim().min(1).max(64).default("root"),
  agent_url: z.string().trim().url("Must be a valid URL, e.g. http://1.2.3.4:9090"),
  agent_token: z.string().trim().min(8, "Token must be at least 8 characters").max(256),
  price_monthly: z.number().nonnegative().nullable().optional(),
});

export const updateServerSchema = createServerSchema.partial();

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;

export function effectivePrice(
  row: Pick<ServerRow, "price_monthly" | "hetzner_price_monthly">,
): number | null {
  return row.price_monthly ?? row.hetzner_price_monthly ?? null;
}

export function rowToView(row: ServerRow, health: AgentHealth | null): ServerView {
  return {
    id: row.id,
    hetzner_server_id: row.hetzner_server_id,
    name: row.name,
    ssh_user: row.ssh_user,
    ip: row.ip,
    ipv6: row.ipv6,
    agent_url: row.agent_url,
    server_type: row.server_type,
    vcpu: row.vcpu,
    datacenter: row.datacenter,
    price_monthly: effectivePrice(row),
    status: health ? "online" : "offline",
    ram: {
      used: health?.ram.used ?? null,
      total: health?.ram.total ?? row.ram_total_gb,
    },
    disk: {
      used: health?.disk.used ?? null,
      total: health?.disk.total ?? row.disk_total_gb,
    },
    uptime: health?.uptime ?? null,
  };
}

export function getAllRows(): ServerRow[] {
  return getDb().prepare("SELECT * FROM servers ORDER BY name COLLATE NOCASE").all() as ServerRow[];
}

export function getRowById(id: number): ServerRow | undefined {
  return getDb().prepare("SELECT * FROM servers WHERE id = ?").get(id) as ServerRow | undefined;
}

// Fetches every server's live metrics in parallel. A single unreachable
// agent never fails the whole list: Promise.allSettled always resolves.
export async function listServersWithLiveData(): Promise<ServerView[]> {
  const rows = getAllRows();
  const results = await Promise.allSettled(
    rows.map((row) => fetchAgentHealth(row.agent_url, row.agent_token)),
  );
  return rows.map((row, i) => {
    const result = results[i];
    const health = result.status === "fulfilled" ? result.value : null;
    return rowToView(row, health);
  });
}

export async function getServerWithLiveData(id: number): Promise<ServerView | null> {
  const row = getRowById(id);
  if (!row) return null;
  const health = await fetchAgentHealth(row.agent_url, row.agent_token);
  return rowToView(row, health);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(views: ServerView[]): ServersSummary {
  const ramTotalGb = views.reduce((acc, v) => acc + (v.ram.total ?? 0), 0);
  const ramUsedGb = views.reduce((acc, v) => acc + (v.ram.used ?? 0), 0);
  const priceMonthlyTotal = views.reduce((acc, v) => acc + (v.price_monthly ?? 0), 0);
  return {
    count: views.length,
    ramTotalGb: round2(ramTotalGb),
    ramUsedGb: round2(ramUsedGb),
    priceMonthlyTotal: round2(priceMonthlyTotal),
  };
}

export function createServer(input: CreateServerInput): number {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO servers (
        name, ssh_user, ip, ipv6, agent_url, agent_token, price_monthly,
        created_at, updated_at
      ) VALUES (@name, @ssh_user, @ip, @ipv6, @agent_url, @agent_token, @price_monthly, @now, @now)`,
    )
    .run({
      name: input.name,
      ssh_user: input.ssh_user ?? "root",
      ip: input.ip,
      ipv6: input.ipv6 ?? null,
      agent_url: input.agent_url,
      agent_token: input.agent_token,
      price_monthly: input.price_monthly ?? null,
      now,
    });
  return Number(result.lastInsertRowid);
}

const UPDATABLE_COLUMNS: Array<keyof UpdateServerInput> = [
  "name",
  "ssh_user",
  "ip",
  "ipv6",
  "agent_url",
  "agent_token",
  "price_monthly",
];

export function updateServer(id: number, input: UpdateServerInput): boolean {
  const fields = UPDATABLE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getRowById(id) !== undefined;

  const setClause = fields.map((key) => `${key} = @${key}`).join(", ");
  const params: Record<string, unknown> = { id };
  for (const key of fields) params[key] = input[key] ?? null;

  const result = getDb()
    .prepare(`UPDATE servers SET ${setClause}, updated_at = @updated_at WHERE id = @id`)
    .run({ ...params, updated_at: new Date().toISOString() });

  return result.changes > 0;
}

export function deleteServer(id: number): boolean {
  const result = getDb().prepare("DELETE FROM servers WHERE id = ?").run(id);
  return result.changes > 0;
}

export interface HetznerSyncInput {
  hetznerServerId: number;
  name: string;
  ip: string;
  ipv6: string | null;
  serverType: string;
  vcpu: number;
  ramTotalGb: number;
  diskTotalGb: number;
  datacenter: string;
  hetznerPriceMonthly: number | null;
}

// Upserts static Hetzner data by hetzner_server_id. Never touches
// agent_url/agent_token/ssh_user/price_monthly (user-owned fields).
export function upsertServerFromHetzner(input: HetznerSyncInput): void {
  const existing = getDb()
    .prepare("SELECT id FROM servers WHERE hetzner_server_id = ?")
    .get(input.hetznerServerId) as { id: number } | undefined;

  const now = new Date().toISOString();

  if (existing) {
    getDb().prepare(
      `UPDATE servers SET
        name = @name, ip = @ip, ipv6 = @ipv6, server_type = @serverType,
        vcpu = @vcpu, ram_total_gb = @ramTotalGb, disk_total_gb = @diskTotalGb,
        datacenter = @datacenter, hetzner_price_monthly = @hetznerPriceMonthly,
        updated_at = @now
       WHERE id = @id`,
    ).run({ ...input, id: existing.id, now });
  } else {
    getDb().prepare(
      `INSERT INTO servers (
        hetzner_server_id, name, ssh_user, ip, ipv6, agent_url, agent_token,
        server_type, vcpu, ram_total_gb, disk_total_gb, datacenter,
        hetzner_price_monthly, created_at, updated_at
      ) VALUES (
        @hetznerServerId, @name, 'root', @ip, @ipv6, '', '',
        @serverType, @vcpu, @ramTotalGb, @diskTotalGb, @datacenter,
        @hetznerPriceMonthly, @now, @now
      )`,
    ).run({ ...input, now });
  }
}
