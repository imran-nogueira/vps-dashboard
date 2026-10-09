import Link from "next/link";
import type { ServerView } from "@/lib/types";
import { formatGb, formatUptime } from "@/lib/format";
import { StatusDot, STATUS_LABEL, STATUS_TEXT_COLOR, type DisplayStatus } from "./StatusDot";
import { UsageBar } from "./UsageBar";
import { CopySshButton } from "./CopySshButton";

const LABEL = "text-[11px] font-medium uppercase leading-[14px] tracking-[0.06em] text-fg-dim";

export function ServerCard({
  server,
  isRefreshing,
}: {
  server: ServerView;
  isRefreshing: boolean;
}) {
  const sshTarget = `${server.ssh_user}@${server.ip || "?"}`;
  const status: DisplayStatus = isRefreshing ? "connecting" : server.status;
  const isOffline = status === "offline";
  const hetznerUrl = server.hetzner_server_id
    ? `https://console.hetzner.cloud/projects/servers/${server.hetzner_server_id}`
    : null;

  const specs = [
    server.vcpu !== null ? `${server.vcpu} vCPU` : null,
    server.ram.total !== null ? `${formatGb(server.ram.total)} GB` : null,
    server.disk.total !== null ? `${formatGb(server.disk.total)} GB` : null,
    server.datacenter,
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col justify-between gap-6 rounded-[14px] border border-line bg-surface px-6 py-[22px] transition-colors hover:border-line-strong">
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StatusDot status={status} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate text-base font-medium leading-5 tracking-[-0.01em] text-fg">
                {server.name}
              </h2>
              <p className={`text-[13px] leading-[18px] ${STATUS_TEXT_COLOR[status]}`}>
                {STATUS_LABEL[status]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {server.server_type && (
              <span className="rounded-md border border-line-strong px-2 py-[3px] font-mono text-[11px] leading-[14px] text-fg-muted">
                {server.server_type.toUpperCase()}
              </span>
            )}
            <Link
              href={`/settings#server-${server.id}`}
              className="text-lg leading-5 text-fg-dim transition-colors duration-150 hover:text-fg"
              aria-label={`Edit ${server.name}`}
            >
              ⋯
            </Link>
          </div>
        </div>

        {specs.length > 0 && (
          <p className="font-mono text-[11px] leading-[14px] text-fg-dim">{specs.join(" · ")}</p>
        )}

        {isOffline && (
          <p className="rounded-lg bg-danger/10 px-3 py-[9px] text-[13px] leading-[18px] text-danger">
            Agent unreachable — showing cached specs
          </p>
        )}

        <CopySshButton sshCommand={`ssh ${sshTarget}`} />

        <div className={`flex flex-col gap-4 ${isOffline ? "opacity-70" : ""}`}>
          <UsageBar label="RAM" used={server.ram.used} total={server.ram.total} />
          <UsageBar label="Disk" used={server.disk.used} total={server.disk.total} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
        <div className="flex gap-8">
          <div className="flex flex-col gap-1">
            <span className={LABEL}>Uptime</span>
            <span
              className={`font-mono text-xs leading-4 ${server.uptime !== null ? "text-fg" : "text-fg-dim"}`}
            >
              {server.uptime !== null ? formatUptime(server.uptime) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL}>Price</span>
            <span
              className={`font-mono text-xs leading-4 ${server.price_monthly !== null ? "text-fg" : "text-fg-dim"}`}
            >
              {server.price_monthly !== null ? `€${server.price_monthly.toFixed(2)} /mo` : "—"}
            </span>
          </div>
        </div>
        {hetznerUrl && (
          <a
            href={hetznerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] leading-[18px] text-fg-muted transition-colors duration-150 hover:text-fg"
          >
            Hetzner&nbsp;&nbsp;↗
          </a>
        )}
      </div>
    </div>
  );
}
