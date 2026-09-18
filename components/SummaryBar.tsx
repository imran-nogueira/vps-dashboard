import type { ServersSummary } from "@/lib/types";

function formatGb(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export function SummaryBar({ summary }: { summary: ServersSummary }) {
  const items = [
    { label: "VPS", value: `${summary.count}` },
    { label: "RAM total", value: `${formatGb(summary.ramTotalGb)} GB` },
    { label: "RAM used", value: `${formatGb(summary.ramUsedGb)} GB` },
    { label: "Monthly", value: `€${summary.priceMonthlyTotal.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-xs text-fg-muted">{item.label}</div>
          <div className="mt-1 font-mono text-lg text-fg">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
