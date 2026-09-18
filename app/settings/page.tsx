import { listServersWithLiveData } from "@/lib/servers";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const servers = await listServersWithLiveData();
  return <SettingsClient initialServers={servers} />;
}
