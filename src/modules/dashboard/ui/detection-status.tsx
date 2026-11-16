"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslator } from "@/modules/i18n/ui";

type Props = {
  /** The data is older than the threshold, or a run is already going: the page starts or joins one. */
  stale: boolean;
  /** When the last Detection ended, already in words (`detectionLine`). */
  checked: string;
};

// Issue #213: the Detection runs in the background once the page is on screen, so opening the
// Dashboard never waits for GitHub. The server runs one at a time, so a second tab joins the first.
export function DetectionStatus({ stale, checked }: Props) {
  const t = useTranslator();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "failed">(stale ? "running" : "idle");
  const started = useRef(false);

  async function detect(force: boolean) {
    const response = await fetch("/api/detection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force }),
    }).catch(() => null);
    if (response?.ok !== true) return setState("failed");
    setState("idle");
    // The new Releases and the new age arrive from the server, like everything else on the page.
    router.refresh();
  }

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    void detect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page, whatever re-renders.
  }, [stale]);

  const running = state === "running";
  const line = running ? t("dashboard.detection.running") : state === "failed" ? t("dashboard.detection.failed") : checked;

  return (
    <div className="col-span-full flex flex-wrap items-center gap-3 font-mono text-meta leading-[normal] text-text-faint">
      <p role="status">{line}</p>
      {/* `aria-disabled` and not `disabled`: a disabled button drops the focus of whoever pressed it. */}
      <button
        type="button"
        aria-disabled={running}
        onClick={() => {
          if (running) return;
          setState("running");
          void detect(true);
        }}
        className="rounded-md border border-rule-strong px-3 py-[6px] font-mono text-label text-text hover:border-text-faint aria-disabled:cursor-progress aria-disabled:text-text-faint"
      >
        {t("dashboard.detection.refresh")}
      </button>
    </div>
  );
}
