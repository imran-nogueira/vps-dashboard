import { listServersWithLiveData, summarize } from "@/lib/servers";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const servers = await listServersWithLiveData();
  const summary = summarize(servers);

  return <DashboardClient initialServers={servers} initialSummary={summary} />;
}
