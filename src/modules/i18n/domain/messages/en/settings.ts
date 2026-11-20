// The strings of the Settings page: the one place a signed-in reader changes how the app behaves for
// them. Today it holds the language and nothing else, and it exists as a page rather than as a row of
// the account panel because the next preference will land beside the language instead of making that
// panel taller (decided with the user on 2026-10-16).
export const settings = {
  "settings.title": "Settings",
  "settings.intro": "Here you choose the language, which releases reach you and where, and the Obsidian vault Verdict writes into. All of it stays on your computer.",
  // The language is chosen by following a link, not by saving a form: the language is in the address
  // (ADR 0008), so the choice is the page it leads to.
  // The two zone titles of the page (#194) carry a capital: at 18px in sans a lowercase word reads
  // as a mistake rather than as the product's grammar, which is the mono 13px labels under them.
  // `shell.language` stays lowercase and is not reused here: it also titles the picker in the foot.
  "settings.language.title": "Language",
  "settings.language.interface": "Interface language",
  "settings.language.note":
    "The language is part of the address, so a page can be shared in the language it was read in. Release notes and summaries stay in their original language.",
  // The Notifications section (issue #171). `featured`, `notable`, `slack` and the
  // bell's own words are the product's grammar and stay English in both languages; the names of
  // the glossary are translated inside the sentences, as everywhere else (ADR 0008).
  "settings.notifications.title": "Notifications",
  "settings.notifications.intro": "Which releases reach you, and where: the bell inside the app, and Slack or Discord outside it.",
  "settings.notifications.bell.title": "The bell",
  "settings.notifications.featured.label": "featured releases",
  "settings.notifications.featured.off":
    "Switched off, a featured release of a technology you follow writes no notification at all: nothing on the bell, and nothing on a channel added later.",
  "settings.notifications.notable.label": "notable releases",
  "settings.notifications.notable.off":
    "Switched off, a notable release writes no notification. The featured ones are a switch of their own, so the releases worth interrupting you for can stay on while these go quiet.",
  // The accessible name of a switch: what it controls, since the state is `aria-checked` and saying
  // it in the name too would have a screen reader read it twice.
  "settings.notifications.switch": "{name} on the bell",
  "settings.notifications.error":
    "Not saved. The switch is back the way the database holds it, so what you see is what you have: press it again.",
  "settings.notifications.digest":
    "The weekly digest brings its own switch, on the day the digest itself arrives.",
  "settings.notifications.switch.slack": "{name} on Slack or Discord",
  "settings.notifications.slack.title": "Slack or Discord",
  "settings.notifications.slack.guide.open": "how to make a webhook",
  "settings.notifications.slack.guide.title": "A webhook, step by step",
  "settings.notifications.slack.guide.intro": "Verdict posts through an incoming webhook that you make in your own Slack workspace or Discord server. It takes a few minutes, once.",
  "settings.notifications.slack.guide.stepCreate": "Open Slack's app page and choose Create New App, then From scratch. Give it any name and pick your workspace.",
  "settings.notifications.slack.guide.stepActivate": "In the app's menu open Incoming Webhooks and switch Activate Incoming Webhooks on.",
  "settings.notifications.slack.guide.stepChannel": "Press Add New Webhook, choose the channel the messages go to, and allow it.",
  "settings.notifications.slack.guide.stepPaste": "Copy the webhook URL, paste it in the field on this page, save, and send a test message.",
  "settings.notifications.slack.guide.link": "open Slack's app page",
  "settings.notifications.slack.guide.close": "close",
  "settings.notifications.slack.manualNote":
    "The URL is a secret: once it is saved you read back only where it points, never the URL itself.",
  "settings.notifications.slack.label": "webhook URL",
  "settings.notifications.slack.save": "save",
  "settings.notifications.slack.remove": "remove",
  "settings.notifications.slack.current": "Sending to {hint}. Leave the field empty and save to remove it.",
  "settings.notifications.slack.none": "No webhook yet, so the two switches below send nothing.",
  "settings.notifications.slack.invalid": "Not saved. A webhook URL starts with https://hooks.slack.com/services/ or https://discord.com/api/webhooks/.",
  "settings.notifications.slack.featured.off": "Switched off, featured releases still reach the bell and stop reaching the webhook.",
  "settings.notifications.slack.notable.off": "Switched off, notable releases stop reaching the webhook. The featured ones are a switch of their own, so they can keep arriving.",
  "settings.notifications.slack.grouping":
    "One message per run, with a line per release: ten releases in a run arrive as one message, not ten.",
  "settings.notifications.slack.test": "send a test message",
  "settings.notifications.slack.testOk": "The test message went out. The channel works.",
  "settings.notifications.slack.testFailed": "The webhook did not take it: {error}",
  "settings.notifications.slack.testEmpty": "Nothing to test yet: save a webhook first.",
  "settings.notifications.locale.title": "Language of the messages",
  "settings.notifications.locale.note": "Slack and Discord have no address to read a language from, so the messages are written in this one. It does not change the language of the site, which stays the one in the address, and release notes and summaries stay in their original language.",
  "settings.notifications.locale.choose": "Write the messages in {name}",
  "settings.notifications.locale.error":
    "Not saved. The language is still the one marked here, which is the one the database holds: press it again.",
  "settings.language.intro": "The language of these pages, and the one the messages to Slack or Discord are written in.",
  "settings.notifications.slack.guide.slack": "Slack",
  "settings.notifications.slack.guide.discord": "Discord",
  "settings.notifications.slack.guide.discordSettings": "Open the settings of the channel the messages go to, then Integrations, then Webhooks.",
  "settings.notifications.slack.guide.discordCreate": "Press New Webhook, then Copy Webhook URL.",
  "settings.notifications.slack.guide.discordPaste": "Paste it in the field on this page, save, and send a test message.",
  "settings.notifications.closed": "These work while the app is open. With the app closed, the workflow in examples/verdict-notify.yml runs verdict-tracker sync --notify on GitHub every day and sends the same message to Slack or Discord, taking the webhook from the VERDICT_WEBHOOK_URL secret.",
  "settings.vault.title": "Obsidian",
  "settings.vault.intro": "The releases that ask for action become notes in your vault, one per release, under Verdict/. A note that is already there is never overwritten, so deleting one is how to have it written again.",
  "settings.vault.label": "vault folder",
  "settings.vault.saveName": "save the vault folder",
  "settings.vault.none": "No vault yet, so no notes are written.",
  "settings.vault.current": "Writing into {path}. Leave the field empty and save to stop.",
  "settings.vault.env": "Set by VERDICT_VAULT_DIR, which wins over this field. To change it, change the variable and restart the app.",
  "settings.vault.invalid": "Not saved: {error}",
  "settings.vault.unchanged": "Not saved.",
  "settings.vault.last": "Last written on {when}. Notes: {written} new, {skipped} already there, {failed} failed.",
  "settings.vault.closed": "With the app closed, verdict-tracker sync writes the notes that are missing too.",
} as const;
