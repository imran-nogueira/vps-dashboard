"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function Header({
  lastUpdatedLabel,
  onRefresh,
  refreshing,
}: {
  lastUpdatedLabel: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">VPS Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">Infrastructure overview</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-fg-dim">Last updated: {lastUpdatedLabel}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <Link href="/settings" className="text-xs text-fg-muted transition-colors hover:text-fg">
          Settings
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-fg-muted transition-colors hover:text-fg"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
