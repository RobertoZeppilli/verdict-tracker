"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export const COMMAND = "npx verdict-tracker";

// The showcase's one action (issue #221): the command, copied with one press. The command stays
// selectable text too, for a browser that refuses the clipboard.
// ⚠️ The labels arrive as props and not from `useTranslator`: the keys the browser gets are read
// from the app's build (`i18n:client-keys`), where this component does not exist.
export function InstallCommand({ copy: copyLabel, copied: copiedLabel }: { copy: string; copied: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="inline-flex h-[34px] items-center rounded-md border border-rule-strong font-mono text-[14px]">
      <code className="px-3 select-all">
        <span aria-hidden className="mr-[1ch] text-text-faint">$</span>
        {COMMAND}
      </code>
      <button
        type="button"
        onClick={copy}
        onBlur={() => setCopied(false)}
        className="inline-flex h-full items-center gap-2 border-l border-rule-strong px-3 font-sans font-medium text-text hover:bg-raised"
      >
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </button>
    </div>
  );
}
