import type { ServersSummary } from "@/lib/types";

function formatGb(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export function SummaryBar({ summary }: { summary: ServersSummary }) {
  const items = [
    { label: "VPS", value: `${summary.count}` },
    { label: "RAM", value: `${formatGb(summary.ramTotalGb)} GB` },
    { label: "Used", value: `${formatGb(summary.ramUsedGb)} GB` },
    { label: "Monthly", value: `€${summary.priceMonthlyTotal.toFixed(2)}` },
  ];

  return (
    // 1px gap on a bg-line background, with each cell painted bg-surface,
    // draws hairline dividers between every cell in both directions — a
    // single subtle surface rather than four separate bordered cards.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-fg-dim">{item.label}</div>
          <div className="mt-1.5 text-xl font-medium tabular-nums text-fg">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
