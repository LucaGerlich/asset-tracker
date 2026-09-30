"use client";

import { useState } from "react";
import { copyText, type CopyResult } from "./copy-command";

const LABEL: Record<CopyResult | "idle", string> = {
  idle: "copy",
  copied: "copied",
  unsupported: "select & copy",
  failed: "select & copy",
};

export function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<CopyResult | "idle">("idle");

  return (
    <div className="border-mkt-line bg-mkt-surface font-mkt-mono inline-flex max-w-full items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-3 text-[13px]">
      <code className="truncate select-all">
        <span className="text-mkt-accent" aria-hidden="true">
          ${" "}
        </span>
        {command}
      </code>
      <button
        type="button"
        onClick={async () =>
          setState(await copyText(command, navigator.clipboard))
        }
        className="border-mkt-line text-mkt-muted hover:text-mkt-text shrink-0 rounded border px-2 py-0.5 text-[11px]"
        aria-live="polite"
      >
        {LABEL[state]}
      </button>
    </div>
  );
}
