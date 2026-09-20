function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function fillColor(hasData: boolean, pct: number): string {
  if (!hasData) return "bg-fg-dim/40";
  if (pct >= 90) return "bg-danger";
  if (pct >= 75) return "bg-warning";
  return "bg-fg-muted";
}

export function UsageBar({
  label,
  used,
  total,
  unit = "GB",
}: {
  label: string;
  used: number | null;
  total: number | null;
  unit?: string;
}) {
  const hasData = used !== null && total !== null && total > 0;
  const pct = hasData ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-fg-dim">{label}</span>
        <span className="font-mono text-sm text-fg-muted">
          {hasData ? `${formatNum(used)} / ${formatNum(total)} ${unit}` : "—"}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${fillColor(hasData, pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
