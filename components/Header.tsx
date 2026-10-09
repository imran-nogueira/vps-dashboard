"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface HeaderStatus {
  totalCount: number;
  offlineCount: number;
}

const NAV_ITEMS = [
  { page: "dashboard", href: "/", label: "Overview" },
  { page: "settings", href: "/settings", label: "Settings" },
] as const;

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

  const statusDotColor = !status
    ? ""
    : status.totalCount === 0
      ? "bg-fg-dim"
      : status.offlineCount > 0
        ? "bg-danger"
        : "bg-success";

  return (
    <header className="w-full border-b border-line">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-7 gap-y-3 px-6 py-[18px] sm:px-12">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5">
            <RackLogo />
            <span className="text-[15px] font-medium leading-5 tracking-[-0.01em] text-fg">
              VPS Dashboard
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.page}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-[13px] leading-[18px] transition-colors duration-150 ${
                  currentPage === item.page
                    ? "bg-surface-raised text-fg"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {statusLabel && (
            <span className="inline-flex items-center gap-2 text-[13px] leading-[18px]">
              <span className={`size-1.5 rounded-full ${statusDotColor}`} aria-hidden />
              <span className="text-fg-muted">{statusLabel}</span>
            </span>
          )}
          {lastUpdatedLabel && (
            <span className="hidden font-mono text-[11px] leading-[14px] text-fg-dim sm:inline">
              updated {lastUpdatedLabel}
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] leading-[18px] text-fg-muted transition-colors duration-150 hover:border-line-strong hover:text-fg disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-[13px] leading-[18px] text-fg-dim transition-colors duration-150 hover:text-fg"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

// Même dessin que app/icon.svg (le favicon) : 3 unités serveur, LED « en ligne ».
// Inline plutôt qu'en <img> pour suivre les tokens (fg, success) du thème.
function RackLogo() {
  // useId() contient des caractères (« : » ou « « » ») fragiles dans url(#…).
  const maskId = `rack-led-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className="size-[26px] text-fg" aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="#fff" />
          <circle cx="23" cy="8" r="1.7" fill="#000" />
          <circle cx="23" cy="16" r="1.7" fill="#000" />
          <circle cx="23" cy="24" r="1.7" fill="#000" />
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <rect x="4" y="5" width="24" height="6" rx="2" />
        <rect x="4" y="13" width="24" height="6" rx="2" />
        <rect x="4" y="21" width="24" height="6" rx="2" />
      </g>
      <circle cx="23" cy="8" r="1.7" className="fill-success" />
    </svg>
  );
}
