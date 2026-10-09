"use client";

import { useState } from "react";

// Bloc « $ ssh user@ip » avec un bouton Copy aligné à droite.
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
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-background px-3 py-2.5 font-mono">
      <div className="flex min-w-0 gap-2 text-xs leading-4">
        <span className="text-fg-dim" aria-hidden>
          $
        </span>
        <span className="truncate text-fg">{sshCommand}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 text-[11px] leading-[14px] transition-colors duration-150 ${
          copied ? "text-success" : "text-fg-muted hover:text-fg"
        }`}
        aria-label={copied ? "Copied" : `Copy ${sshCommand}`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
