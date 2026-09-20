import Link from "next/link";
import type { ServerView } from "@/lib/types";
import { StatusDot, STATUS_LABEL, STATUS_TEXT_COLOR, type DisplayStatus } from "./StatusDot";
import { UsageBar } from "./UsageBar";
import { CopySshButton } from "./CopySshButton";

export function ServerCard({
  server,
  isRefreshing,
}: {
  server: ServerView;
  isRefreshing: boolean;
}) {
  const sshTarget = `${server.ssh_user}@${server.ip || "?"}`;
  const status: DisplayStatus = isRefreshing ? "connecting" : server.status;
  const hetznerUrl = server.hetzner_server_id
    ? `https://console.hetzner.cloud/projects/servers/${server.hetzner_server_id}`
    : null;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusDot status={status} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-fg">{server.name}</h2>
            <p className={`text-xs ${STATUS_TEXT_COLOR[status]}`}>{STATUS_LABEL[status]}</p>
          </div>
        </div>
        <Link
          href={`/settings#server-${server.id}`}
          className="shrink-0 text-fg-dim transition-colors duration-150 hover:text-fg"
          aria-label={`Edit ${server.name}`}
        >
          ⋯
        </Link>
      </div>

      <p className="-mt-3 font-mono text-sm text-fg-dim">{sshTarget}</p>

      {status === "offline" && <p className="-mt-3 text-xs text-danger">Unable to reach VPS</p>}

      <div className="space-y-4">
        <UsageBar label="RAM" used={server.ram.used} total={server.ram.total} />
        <UsageBar label="DISK" used={server.disk.used} total={server.disk.total} />
      </div>

      <div className="border-t border-line pt-4">
        {server.price_monthly !== null ? (
          <span className="text-base font-medium text-fg">
            €{server.price_monthly.toFixed(2)} / month
          </span>
        ) : (
          <span className="text-sm text-fg-dim">Price not set</span>
        )}
      </div>

      <div className="flex gap-2">
        <CopySshButton sshCommand={`ssh ${sshTarget}`} />
        {hetznerUrl && (
          <a
            href={hetznerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-xs font-medium text-fg-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover hover:text-fg"
          >
            Open Hetzner ↗
          </a>
        )}
      </div>
    </div>
  );
}
