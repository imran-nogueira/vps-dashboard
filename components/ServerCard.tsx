import Link from "next/link";
import type { ServerView } from "@/lib/types";
import { StatusDot, type DisplayStatus } from "./StatusDot";
import { UsageBar } from "./UsageBar";
import { CopySshButton } from "./CopySshButton";

export function ServerCard({
  server,
  isRefreshing,
}: {
  server: ServerView;
  isRefreshing: boolean;
}) {
  const sshCommand = `ssh ${server.ssh_user}@${server.ip}`;
  const status: DisplayStatus = isRefreshing ? "connecting" : server.status;
  const hetznerUrl = server.hetzner_server_id
    ? `https://console.hetzner.cloud/projects/servers/${server.hetzner_server_id}`
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <StatusDot status={status} />
        <Link
          href={`/settings#server-${server.id}`}
          className="text-fg-dim transition-colors hover:text-fg"
          aria-label={`Edit ${server.name}`}
        >
          ⋮
        </Link>
      </div>

      <div>
        <h2 className="truncate text-base font-medium text-fg">{server.name}</h2>
        <p className="mt-0.5 font-mono text-sm text-fg-muted">{server.ip || "No IP set"}</p>
      </div>

      {status === "offline" && <p className="text-xs text-danger">Unable to reach VPS</p>}

      <div className="space-y-3">
        <UsageBar label="RAM" used={server.ram.used} total={server.ram.total} />
        <UsageBar label="DISK" used={server.disk.used} total={server.disk.total} />
      </div>

      <div className="border-t border-line pt-4 text-sm text-fg">
        {server.price_monthly !== null ? (
          <>€{server.price_monthly.toFixed(2)} / month</>
        ) : (
          <span className="text-fg-dim">Price not set</span>
        )}
      </div>

      <div className="flex gap-2">
        <CopySshButton sshCommand={sshCommand} />
        {hetznerUrl && (
          <a
            href={hetznerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md border border-line px-3 py-2 text-center text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            Open Hetzner
          </a>
        )}
      </div>
    </div>
  );
}
