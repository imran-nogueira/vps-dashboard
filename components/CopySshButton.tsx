"use client";

import { useState } from "react";

export function CopySshButton({ sshCommand }: { sshCommand: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sshCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context, permissions) — ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-150 hover:bg-surface-hover ${
        copied ? "border-success/40 text-success" : "border-line-strong text-fg"
      }`}
    >
      {copied ? "Copied ✓" : "Copy SSH"}
    </button>
  );
}
