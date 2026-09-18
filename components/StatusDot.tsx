export type DisplayStatus = "online" | "offline" | "connecting";

const STATUS_STYLES: Record<DisplayStatus, { dot: string; label: string }> = {
  online: { dot: "bg-success", label: "Online" },
  connecting: { dot: "bg-warning", label: "Connecting" },
  offline: { dot: "bg-danger", label: "Offline" },
};

export function StatusDot({ status }: { status: DisplayStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${style.dot} ${status === "connecting" ? "animate-pulse" : ""}`}
        aria-hidden
      />
      <span className="text-xs text-fg-muted">{style.label}</span>
    </span>
  );
}
