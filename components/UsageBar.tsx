import { formatGb } from "@/lib/format";

type Level = "normal" | "warning" | "danger";

function levelFor(pct: number): Level {
  if (pct >= 90) return "danger";
  if (pct >= 75) return "warning";
  return "normal";
}

const FILL_COLOR: Record<Level, string> = {
  normal: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
};

const PCT_COLOR: Record<Level, string> = {
  normal: "text-fg",
  warning: "text-warning",
  danger: "text-danger",
};

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
  const level = levelFor(pct);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] leading-[14px]">
        <span className="font-medium uppercase tracking-[0.06em] text-fg-dim">{label}</span>
        {hasData ? (
          <span className="flex gap-2.5 font-mono">
            <span className="text-fg-muted">
              {formatGb(used)} / {formatGb(total)} {unit}
            </span>
            <span className={PCT_COLOR[level]}>{pct} %</span>
          </span>
        ) : (
          // Agent injoignable : on garde la capacité connue (specs en cache)
          // et on remplace seulement la mesure live par un tiret.
          <span className="font-mono text-fg-dim">
            — / {total !== null ? `${formatGb(total)} ${unit}` : "—"}
          </span>
        )}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-[2px] bg-surface-raised">
        {hasData && (
          <div
            className={`h-full rounded-[2px] transition-[width] duration-500 ease-out ${FILL_COLOR[level]}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
