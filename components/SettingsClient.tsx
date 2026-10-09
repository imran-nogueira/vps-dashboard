"use client";

import { useState } from "react";
import type { ServerView } from "@/lib/types";
import { Header } from "./Header";
import { ServerForm, type ServerFormValues } from "./ServerForm";

function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "fieldErrors" in err) {
      const fieldErrors = (err as { fieldErrors: Record<string, string[]> }).fieldErrors;
      const first = Object.values(fieldErrors).flat()[0];
      if (first) return first;
    }
  }
  return "Something went wrong.";
}

function toPayload(values: ServerFormValues, mode: "create" | "edit") {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    ip: values.ip.trim(),
    ipv6: values.ipv6.trim() === "" ? null : values.ipv6.trim(),
    ssh_user: values.ssh_user.trim() || "root",
    agent_url: values.agent_url.trim(),
    price_monthly: values.price_monthly.trim() === "" ? null : Number(values.price_monthly),
  };
  if (mode === "create" || values.agent_token.trim() !== "") {
    payload.agent_token = values.agent_token.trim();
  }
  return payload;
}

export function SettingsClient({ initialServers }: { initialServers: ServerView[] }) {
  const [servers, setServers] = useState(initialServers);
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function refreshList() {
    const res = await fetch("/api/servers", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { servers: ServerView[] };
      setServers(data.servers);
    }
  }

  async function handleCreate(values: ServerFormValues) {
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values, "create")),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      return errorMessage(body);
    }
    setAddingNew(false);
    await refreshList();
    return null;
  }

  async function handleUpdate(id: number, values: ServerFormValues) {
    const res = await fetch(`/api/servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values, "edit")),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      return errorMessage(body);
    }
    setEditingId(null);
    await refreshList();
    return null;
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/servers/${id}`, { method: "DELETE" });
      await refreshList();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/servers/sync", { method: "POST" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setSyncMessage(errorMessage(body));
      } else {
        const synced = (body as { synced: number }).synced;
        setSyncMessage(`Synced ${synced} server${synced === 1 ? "" : "s"} from Hetzner.`);
        await refreshList();
      }
    } catch {
      setSyncMessage("Could not reach Hetzner API.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <Header currentPage="settings" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 pb-16 pt-11 sm:px-10">
        <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-fg">
          Settings
        </h1>

      <section className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync with Hetzner"}
        </button>
        {syncMessage && <span className="text-xs text-fg-dim">{syncMessage}</span>}
      </section>

      <section className="flex flex-col gap-4">
        {servers.map((server) => (
          <div
            key={server.id}
            id={`server-${server.id}`}
            className="rounded-xl border border-line bg-surface p-5"
          >
            {editingId === server.id ? (
              <ServerForm
                mode="edit"
                server={server}
                onSubmit={(values) => handleUpdate(server.id, values)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-fg">{server.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-fg-muted">{server.ip}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(server.id)}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${server.name} from the dashboard?`)) {
                        void handleDelete(server.id);
                      }
                    }}
                    disabled={deletingId === server.id}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:border-danger disabled:opacity-50"
                  >
                    {deletingId === server.id ? "Removing…" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {servers.length === 0 && !addingNew && (
          <p className="text-sm text-fg-muted">No VPS configured yet.</p>
        )}
      </section>

      <section>
        {addingNew ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <ServerForm
              mode="create"
              onSubmit={handleCreate}
              onCancel={() => setAddingNew(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="rounded-md border border-dashed border-line px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            + Add VPS
          </button>
        )}
      </section>
      </main>
    </>
  );
}
