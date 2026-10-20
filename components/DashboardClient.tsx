"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ServerView, ServersSummary } from "@/lib/types";
import { Header } from "./Header";
import { SummaryBar } from "./SummaryBar";
import { ServerCard } from "./ServerCard";

const POLL_INTERVAL_MS = 15_000;

export function DashboardClient({
  initialServers,
  initialSummary,
}: {
  initialServers: ServerView[];
  initialSummary: ServersSummary;
}) {
  const [servers, setServers] = useState(initialServers);
  const [summary, setSummary] = useState(initialSummary);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastUpdatedRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/servers", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { servers: ServerView[]; summary: ServersSummary };
        setServers(data.servers);
        setSummary(data.summary);
        lastUpdatedRef.current = Date.now();
        setSecondsAgo(0);
      }
    } catch {
      // Network hiccup: keep showing the last known good state.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    lastUpdatedRef.current = Date.now();
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Ticks every second so "Last updated: Ns ago" stays accurate without
  // triggering a new fetch. Date.now() is read inside the effect, not
  // during render, so the component itself stays pure.
  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdatedRef.current === null) return;
      setSecondsAgo(Math.max(0, Math.round((Date.now() - lastUpdatedRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const lastUpdatedLabel = secondsAgo <= 1 ? "just now" : `${secondsAgo} s ago`;
  const offlineCount = servers.filter((s) => s.status === "offline").length;

  return (
    <>
      <Header
        currentPage="dashboard"
        status={{ totalCount: servers.length, offlineCount }}
        lastUpdatedLabel={lastUpdatedLabel}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-6 pb-16 pt-11 sm:px-12">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-fg">
              Overview
            </h1>
            <p className="text-[13px] leading-[18px] text-fg-dim">
              {servers.length} server{servers.length === 1 ? "" : "s"} · Hetzner Cloud
            </p>
          </div>
          {servers.length > 0 && (
            <Link
              href="/settings"
              className="text-[13px] leading-[18px] text-fg-muted transition-colors duration-150 hover:text-fg"
            >
              Manage servers&nbsp;&nbsp;→
            </Link>
          )}
        </div>

        {servers.length === 0 ? (
          <EmptyState onSynced={refresh} />
        ) : (
          <>
            <SummaryBar summary={summary} servers={servers} />

            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-medium leading-5 tracking-[-0.01em] text-fg">
                Servers
              </h2>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] leading-[14px] text-fg-dim">
                <span className="size-[5px] rounded-full bg-accent" aria-hidden />
                live · polled every {POLL_INTERVAL_MS / 1000} s
              </span>
            </div>

            {servers.length === 1 ? (
              // A 3-column grid would squeeze a single card into one third of the
              // row. Give it a comfortable fixed width instead of stretching it
              // to the full page or leaving it grid-cell-sized.
              <div className="w-full max-w-xl">
                <ServerCard server={servers[0]} isRefreshing={refreshing} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {servers.map((server) => (
                  <ServerCard key={server.id} server={server} isRefreshing={refreshing} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

const INSTALL_COMMANDS = [
  "scp agent/install-agent.sh root@<ip>:/root/",
  "ssh root@<ip> 'bash install-agent.sh'",
];

function EmptyState({ onSynced }: { onSynced: () => Promise<void> }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/servers/sync", { method: "POST" });
      if (!res.ok) {
        // La route renvoie la vraie cause (statut + message Hetzner) dans `error`.
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(
          typeof body?.error === "string" ? `Hetzner sync failed: ${body.error}` : "Hetzner sync failed.",
        );
        return;
      }
      const { synced } = (await res.json()) as { synced: number };
      if (synced === 0) {
        setError("No servers found in the Hetzner project.");
        return;
      }
      await onSynced();
    } catch {
      setError("Could not reach Hetzner API.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-7 rounded-[14px] border border-dashed border-line-strong px-6 py-[72px] text-center sm:px-12">
      <div
        className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-surface"
        aria-hidden
      >
        <div className="flex flex-col gap-[3px]">
          <span className="h-[3px] w-[18px] rounded-[1.5px] bg-accent" />
          <span className="h-[3px] w-[18px] rounded-[1.5px] bg-line-strong" />
          <span className="h-[3px] w-[18px] rounded-[1.5px] bg-line-strong" />
        </div>
      </div>

      <div className="flex max-w-[440px] flex-col items-center gap-2">
        <h2 className="text-lg font-medium leading-6 tracking-[-0.01em] text-fg">No servers yet</h2>
        <p className="text-sm leading-5 text-fg-muted">
          Sync your Hetzner project or add a server manually. Each server needs the agent
          installed to report live RAM and disk usage.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-fg px-4 py-[9px] text-[13px] font-medium leading-[18px] text-background transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync with Hetzner"}
          </button>
          <Link
            href="/settings"
            className="rounded-lg border border-line-strong px-4 py-[9px] text-[13px] leading-[18px] text-fg-muted transition-colors duration-150 hover:text-fg"
          >
            Add manually
          </Link>
        </div>
        {error && <p className="text-[13px] leading-[18px] text-danger">{error}</p>}
      </div>

      <div className="h-px w-full max-w-[440px] bg-line" />

      <div className="flex w-full max-w-[440px] flex-col gap-2.5 text-left">
        <p className="text-[11px] font-medium uppercase leading-[14px] tracking-[0.06em] text-fg-dim">
          Install the agent on a new VPS
        </p>
        <div className="flex flex-col gap-1.5 overflow-x-auto rounded-lg border border-line bg-surface px-4 py-3.5 font-mono text-xs leading-4">
          {INSTALL_COMMANDS.map((cmd) => (
            <div key={cmd} className="flex gap-2 whitespace-nowrap">
              <span className="text-fg-dim" aria-hidden>
                $
              </span>
              <span className="text-fg">{cmd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
