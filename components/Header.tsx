"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export interface HeaderStatus {
  totalCount: number;
  offlineCount: number;
}

export function Header({
  currentPage,
  status,
  lastUpdatedLabel,
  onRefresh,
  refreshing,
}: {
  currentPage: "dashboard" | "settings";
  status?: HeaderStatus;
  lastUpdatedLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const statusLabel = !status
    ? null
    : status.totalCount === 0
      ? "No VPS yet"
      : `${status.totalCount - status.offlineCount} / ${status.totalCount} online`;

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">VPS Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">Infrastructure overview</p>
        <nav className="mt-4 flex items-center gap-4 text-xs">
          <Link
            href="/"
            className={
              currentPage === "dashboard"
                ? "font-medium text-fg"
                : "text-fg-muted transition-colors duration-150 hover:text-fg"
            }
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={
              currentPage === "settings"
                ? "font-medium text-fg"
                : "text-fg-muted transition-colors duration-150 hover:text-fg"
            }
          >
            Settings
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:pt-1">
        {statusLabel && (
          <span className="inline-flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status && status.offlineCount > 0 ? "bg-danger" : "bg-success"
              }`}
              aria-hidden
            />
            <span className="text-fg-muted">{statusLabel}</span>
          </span>
        )}
        {lastUpdatedLabel && (
          <span className="text-xs text-fg-dim">Last updated {lastUpdatedLabel}</span>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors duration-150 hover:border-line-strong hover:text-fg disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-fg-muted transition-colors duration-150 hover:text-fg"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
