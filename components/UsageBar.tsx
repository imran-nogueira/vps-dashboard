function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
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
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono text-fg-dim">
          {hasData ? `${formatNum(used)} / ${formatNum(total)} ${unit}` : "—"}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-fg-muted transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
