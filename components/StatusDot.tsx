export type DisplayStatus = "online" | "offline" | "connecting";

const DOT_COLOR: Record<DisplayStatus, string> = {
  online: "bg-success",
  connecting: "bg-warning",
  offline: "bg-danger",
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  online: "Online",
  connecting: "Connecting",
  offline: "Offline",
};

export const STATUS_TEXT_COLOR: Record<DisplayStatus, string> = {
  online: "text-fg-muted",
  connecting: "text-warning",
  offline: "text-danger",
};

// Renders only the colored indicator. Compose with STATUS_LABEL /
// STATUS_TEXT_COLOR wherever the text needs to sit separately (e.g. under
// a server name rather than beside the dot).
export function StatusDot({ status, className = "" }: { status: DisplayStatus; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[status]} ${status === "connecting" ? "animate-pulse" : ""} ${className}`}
      aria-hidden
    />
  );
}
