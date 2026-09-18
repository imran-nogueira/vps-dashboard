"use client";

import { useState, type FormEvent } from "react";
import type { ServerView } from "@/lib/types";

export interface ServerFormValues {
  name: string;
  ip: string;
  ipv6: string;
  ssh_user: string;
  agent_url: string;
  agent_token: string;
  price_monthly: string;
}

function toFormValues(server?: ServerView): ServerFormValues {
  return {
    name: server?.name ?? "",
    ip: server?.ip ?? "",
    ipv6: server?.ipv6 ?? "",
    ssh_user: server?.ssh_user ?? "root",
    agent_url: server?.agent_url ?? "",
    agent_token: "",
    price_monthly: server?.price_monthly?.toString() ?? "",
  };
}

const inputClass =
  "w-full rounded-md border border-line bg-background px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-dim focus:border-line-strong";
const labelClass = "text-xs text-fg-muted";

export function ServerForm({
  mode,
  server,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  server?: ServerView;
  onSubmit: (values: ServerFormValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ServerFormValues>(() => toFormValues(server));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ServerFormValues>(key: K, value: ServerFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(values);
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Name</span>
        <input
          className={inputClass}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="fashion-radar"
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Public IPv4</span>
        <input
          className={inputClass}
          value={values.ip}
          onChange={(e) => update("ip", e.target.value)}
          placeholder="188.245.10.20"
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>SSH user</span>
        <input
          className={inputClass}
          value={values.ssh_user}
          onChange={(e) => update("ssh_user", e.target.value)}
          placeholder="root"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Monthly price (€, optional)</span>
        <input
          className={inputClass}
          type="number"
          step="0.01"
          min="0"
          value={values.price_monthly}
          onChange={(e) => update("price_monthly", e.target.value)}
          placeholder="6.59"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Agent URL</span>
        <input
          className={inputClass}
          value={values.agent_url}
          onChange={(e) => update("agent_url", e.target.value)}
          placeholder="http://188.245.10.20:9090"
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>
          {mode === "edit" ? "Agent token (leave blank to keep current)" : "Agent token"}
        </span>
        <input
          className={inputClass}
          type="password"
          value={values.agent_token}
          onChange={(e) => update("agent_token", e.target.value)}
          placeholder={mode === "edit" ? "••••••••" : "Token from install-agent.sh"}
          required={mode === "create"}
        />
      </label>

      {error && <p className="text-xs text-danger sm:col-span-2">{error}</p>}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : mode === "create" ? "Add VPS" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
