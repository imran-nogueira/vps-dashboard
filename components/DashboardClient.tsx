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

  const lastUpdatedLabel = secondsAgo <= 1 ? "just now" : `${secondsAgo}s ago`;
  const offlineCount = servers.filter((s) => s.status === "offline").length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <Header
        currentPage="dashboard"
        status={{ totalCount: servers.length, offlineCount }}
        lastUpdatedLabel={lastUpdatedLabel}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      <SummaryBar summary={summary} />

      {servers.length === 0 ? (
        <EmptyState />
      ) : servers.length === 1 ? (
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line py-20 text-center">
      <p className="text-sm text-fg-muted">No VPS configured yet.</p>
      <Link
        href="/settings"
        className="rounded-md border border-line px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-line-strong"
      >
        Add your first VPS
      </Link>
    </div>
  );
}
