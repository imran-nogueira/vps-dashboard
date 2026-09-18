import type { AgentHealth } from "./types";

const AGENT_TIMEOUT_MS = 2500;

function isAgentHealth(value: unknown): value is AgentHealth {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.status === "online" &&
    typeof v.ram === "object" &&
    v.ram !== null &&
    typeof (v.ram as Record<string, unknown>).used === "number" &&
    typeof (v.ram as Record<string, unknown>).total === "number" &&
    typeof v.disk === "object" &&
    v.disk !== null &&
    typeof (v.disk as Record<string, unknown>).used === "number" &&
    typeof (v.disk as Record<string, unknown>).total === "number" &&
    typeof v.uptime === "number"
  );
}

// Never throws: returns null when the agent is unreachable, times out, or
// responds with anything unexpected. Callers treat null as "offline".
export async function fetchAgentHealth(
  agentUrl: string,
  agentToken: string,
): Promise<AgentHealth | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const res = await fetch(`${agentUrl.replace(/\/+$/, "")}/health`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data: unknown = await res.json();
    return isAgentHealth(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
