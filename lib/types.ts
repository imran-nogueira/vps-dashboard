// Row exactly as stored in SQLite. agent_token never leaves the server.
export interface ServerRow {
  id: number;
  hetzner_server_id: number | null;
  name: string;
  ssh_user: string;
  ip: string;
  ipv6: string | null;
  agent_url: string;
  agent_token: string;
  server_type: string | null;
  vcpu: number | null;
  ram_total_gb: number | null;
  disk_total_gb: number | null;
  datacenter: string | null;
  price_monthly: number | null;
  hetzner_price_monthly: number | null;
  created_at: string;
  updated_at: string;
}

export type ServerStatus = "online" | "offline";

// What agent GET /health returns.
export interface AgentHealth {
  status: "online";
  ram: { used: number; total: number };
  disk: { used: number; total: number };
  uptime: number;
}

// What the dashboard API returns for one server: static config + DB cache,
// merged with live agent data when reachable. Never includes agent_token.
export interface ServerView {
  id: number;
  hetzner_server_id: number | null;
  name: string;
  ssh_user: string;
  ip: string;
  ipv6: string | null;
  agent_url: string;
  server_type: string | null;
  vcpu: number | null;
  datacenter: string | null;
  price_monthly: number | null;
  status: ServerStatus;
  ram: { used: number | null; total: number | null };
  disk: { used: number | null; total: number | null };
  uptime: number | null;
}

export interface ServersSummary {
  count: number;
  ramTotalGb: number;
  ramUsedGb: number;
  priceMonthlyTotal: number;
}
