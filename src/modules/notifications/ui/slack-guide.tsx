"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTranslator } from "@/modules/i18n/ui";
import { VERSION_BUTTON_CLASS } from "@/modules/releases/ui";

// The dialog of #199, which since #218 explains how to make a webhook instead of leaving for "Add to
// Slack": that round needed `SLACK_CLIENT_SECRET`, which inside an npm package would be public.
// The link to Slack is a plain `href` the reader follows, not a call of the client's.
const SLACK_APPS = "https://api.slack.com/apps";

// ⚠️ Open state held here and not with Radix's `Trigger`, as before #218: one `useState`, and the
// press stays a plain button.
export function SlackGuide() {
  const t = useTranslator();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <p className="mt-4">
        <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer ${VERSION_BUTTON_CLASS}`}>
          {t("settings.notifications.slack.guide.open")}
        </button>
      </p>
      <DialogContent>
        <DialogTitle>{t("settings.notifications.slack.guide.title")}</DialogTitle>
        <DialogDescription>{t("settings.notifications.slack.guide.intro")}</DialogDescription>
        {/* Slack, then Discord (#244): the field takes either. */}
        <p className="mt-4 font-mono text-label text-text-muted">{t("settings.notifications.slack.guide.slack")}</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 font-sans text-meta text-text">
          <li>{t("settings.notifications.slack.guide.stepCreate")}</li>
          <li>{t("settings.notifications.slack.guide.stepActivate")}</li>
          <li>{t("settings.notifications.slack.guide.stepChannel")}</li>
          <li>{t("settings.notifications.slack.guide.stepPaste")}</li>
        </ol>
        <p className="mt-4 font-mono text-label text-text-muted">{t("settings.notifications.slack.guide.discord")}</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 font-sans text-meta text-text">
          <li>{t("settings.notifications.slack.guide.discordSettings")}</li>
          <li>{t("settings.notifications.slack.guide.discordCreate")}</li>
          <li>{t("settings.notifications.slack.guide.discordPaste")}</li>
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href={SLACK_APPS} target="_blank" rel="noreferrer" className={VERSION_BUTTON_CLASS}>
            {t("settings.notifications.slack.guide.link")}
          </a>
          <DialogClose className="cursor-pointer border-0 bg-transparent p-0 font-mono text-label text-text-muted underline decoration-dashed hover:text-text">
            {t("settings.notifications.slack.guide.close")}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
