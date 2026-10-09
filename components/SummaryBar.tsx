import type { ReactNode } from "react";
import type { ServerView, ServersSummary } from "@/lib/types";
import { formatGb, liveRamUsagePct } from "@/lib/format";

function Cell({
  label,
  value,
  unit,
  detail,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 bg-surface px-6 py-5">
      <div className="text-[11px] font-medium uppercase leading-[14px] tracking-[0.06em] text-fg-dim">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[30px] font-light leading-9 tracking-[-0.03em] tabular-nums text-fg">
          {value}
        </span>
        {unit && <span className="text-sm leading-5 text-fg-muted">{unit}</span>}
      </div>
      {children}
      <div className="font-mono text-[11px] leading-[14px] text-fg-dim">{detail}</div>
    </div>
  );
}

export function SummaryBar({
  summary,
  servers,
}: {
  summary: ServersSummary;
  servers: ServerView[];
}) {
  const onlineCount = servers.filter((s) => s.status === "online").length;
  const unreachableCount = servers.length - onlineCount;
  const livePct = liveRamUsagePct(servers);

  return (
    // 1px gap on a bg-line background, with each cell painted bg-surface,
    // draws hairline dividers between every cell in both directions — a
    // single subtle surface rather than four separate bordered cards.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      <Cell
        label="Servers"
        value={`${summary.count}`}
        detail={`${onlineCount} online · ${unreachableCount} unreachable`}
      />
      <Cell
        label="Memory"
        value={formatGb(summary.ramTotalGb)}
        unit="GB"
        detail={`total across ${summary.count} server${summary.count === 1 ? "" : "s"}`}
      />
      <Cell
        label="In use"
        value={formatGb(summary.ramUsedGb)}
        unit="GB"
        detail={livePct !== null ? `${livePct} % of live capacity` : "no live data"}
      >
        <div className="h-1 w-full overflow-hidden rounded-[2px] bg-surface-raised">
          <div
            className="h-full rounded-[2px] bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${livePct ?? 0}%` }}
          />
        </div>
      </Cell>
      <Cell
        label="Monthly"
        value={`€${summary.priceMonthlyTotal.toFixed(2)}`}
        detail={`€${(summary.priceMonthlyTotal * 12).toFixed(2)} per year`}
      />
    </div>
  );
}
