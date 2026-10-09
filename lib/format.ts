import type { ServerView } from "./types";

// Uptime agent (secondes) → « 41 d 6 h », « 3 h 12 m » ou « 5 m ».
// On garde les deux unités les plus grosses : la précision à la minute
// n'a plus de sens au-delà d'une journée.
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} m`;
  return `${minutes} m`;
}

export function formatGb(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

// Part de RAM utilisée sur la capacité réellement joignable : seuls les
// serveurs online avec des mesures live comptent, sinon un serveur hors
// ligne gonflerait le dénominateur sans rien ajouter au numérateur.
// Renvoie null quand aucun serveur ne remonte de données.
export function liveRamUsagePct(servers: ServerView[]): number | null {
  let used = 0;
  let total = 0;
  for (const s of servers) {
    if (s.status !== "online" || s.ram.used === null || s.ram.total === null) continue;
    used += s.ram.used;
    total += s.ram.total;
  }
  if (total <= 0) return null;
  return Math.min(100, Math.round((used / total) * 100));
}
