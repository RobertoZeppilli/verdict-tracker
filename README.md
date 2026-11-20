# verdict-tracker

Verdict follows the releases of the technologies in your stack and gives each one a single verdict:
whether it asks something of you, what breaks, and how to migrate. Every claim points at the line of
the release notes it was read from, so you can check it in one click instead of trusting it.

It runs on your computer. There is no account, and no server of ours in between. The interface is in
English and Italian.

The showcase, with a demo dashboard: <https://verdict-tracker.vercel.app>. It shows the summaries
already in the data file and writes no new ones: those are written by each installation, with its
own model.

## Run it

You need Node.js 24 or later.

```sh
npx verdict-tracker
```

The app starts on `http://localhost:7357` (or another free port) and opens the dashboard in your
browser. It answers only on this computer, never on the network. Stop it with Ctrl+C.

On first start it downloads the data file, `verdict.db`, from the latest GitHub Release: the catalog,
its releases and the summaries already written. After that it uses what it has.

## Before you install

- **Your model.** The summary of each new release is written by the model you set up: one that runs
  on your computer with [Ollama](https://ollama.com), at no cost, or any provider with an
  OpenAI-compatible API and your key. The summaries already written come with the data file. Without
  a model, new releases still arrive and their summaries wait. Put the settings in a `.env` file next
  to `verdict.db`, or set them in your shell, which wins over the file:

  ```sh
  VERDICT_MODEL=<the model name, as your server knows it>
  # Only for a remote provider; the default is Ollama on this computer.
  VERDICT_MODEL_URL=https://<provider>/v1
  VERDICT_MODEL_KEY=<your key>
  ```

  No model is recommended here: pick one and check a few summaries against the notes they cite.
  Ollama runs a model with a short context unless told otherwise, and through its OpenAI-compatible
  API it cannot be raised per request: long release notes would be cut without a warning. Start
  Ollama with a larger `OLLAMA_CONTEXT_LENGTH` (for example `32768`) and set
  `VERDICT_MODEL_CONTEXT` to the same number. Verdict then refuses the notes that would not fit
  instead of summarizing half of them.

  A `GITHUB_TOKEN` in the same file raises GitHub's limit of 60 requests an hour.
- **Your disk.** The data is one SQLite file in `~/.verdict/` on macOS and Linux, in
  `%LOCALAPPDATA%\verdict` on Windows, or wherever `VERDICT_DATA_DIR` points. Release notes go to
  your model to be summarized, and nothing about you goes with them.
- **`verdict.json`.** The technologies you follow, and the version you run of each, are kept in
  `verdict.json` next to the data. Copy that one file to another computer and they come with you.
  `verdict.db` does not need copying: it downloads again.
- **With the app closed.** A GitHub workflow in a repository of yours runs Verdict once a day and
  posts what is new to Slack or Discord. See below.

### `verdict.json`

```json
{
  "follows": {
    "next": { "currentVersion": "16.0.0", "declaredAt": "2026-11-01T10:00:00.000Z" },
    "vite": {}
  }
}
```

- The keys are catalog slugs, the file names in [`catalog/`](catalog).
- `currentVersion` is optional. `declaredAt` says since when you run it; written by hand without a
  date, it counts from the day the app reads it.
- The file is in charge: on start the app follows what it lists and stops following the rest.
  Following or unfollowing in the interface rewrites the file.
- An unknown slug, a retired technology or an invalid version is reported in the terminal and
  skipped. An unknown slug stays in the file.
- If the file is not valid JSON the app leaves it alone, says so, and uses what the database has.

You can delete `verdict.db` at any time: the next start downloads it again and your follows come back
from `verdict.json`.

## Notifications with the app closed: Slack or Discord

While the app is open, the bell tells you what changed since you last looked. To hear about new
releases without opening it, run Verdict once a day on GitHub Actions, in a repository of yours,
with your key and your webhook. Runners are free on public repositories, and a private one fits in
the free minutes.

1. Create a repository (private is fine) and put your `verdict.json` at its root.
2. Copy [`examples/verdict-notify.yml`](examples/verdict-notify.yml) to
   `.github/workflows/verdict.yml`. Nothing in it needs changing.
3. Add the repository secrets (Settings, Secrets and variables, Actions): `VERDICT_WEBHOOK_URL`, a
   Slack or Discord incoming webhook, and `VERDICT_MODEL_URL`, `VERDICT_MODEL` and
   `VERDICT_MODEL_KEY` if you want the summaries. The runner has no Ollama, so this takes a remote
   provider.
4. Run it once by hand from the Actions tab (Run workflow) and watch the message arrive.

The workflow runs `npx verdict-tracker sync --notify`. It checks for new releases with no browser
and posts one message with the technology, the version, its significance, what it asks of you and a
link to the release page. Without a key the new releases still arrive, with the summary missing.
`verdict.db` stays in the Actions cache, so each summary is paid for once. Every day the workflow
commits `verdict-sync.json` with what it has sent: if the cache expires, nothing arrives twice. The
commit also keeps the schedule alive, which GitHub pauses after 60 days without activity.

On your own computer the same command, with `VERDICT_WEBHOOK_URL` in the `.env` next to the data,
sends the message right away.

## Releases that need action, in your Obsidian vault

Set `VERDICT_VAULT_DIR` to the folder of your vault. When a release of a technology you follow gets
a summary that asks for action, Verdict writes a note to `<vault>/Verdict/<Technology>/<Version>.md`.
Releases that ask for nothing are left out. It writes plain files, so there is no plugin to install
and Obsidian can be closed. Notes are written after every summary the app generates, and at startup
for any that are missing.

A note is written once and never overwritten: what you add to it stays. Delete it and the next start
writes it again. Without `VERDICT_VAULT_DIR` nothing is written. A folder that is missing or read-only
is reported in the terminal and the app starts anyway.

To keep the vault up to date with the app closed, schedule `npx verdict-tracker sync` on your
computer, with `VERDICT_VAULT_DIR` in the `.env` next to the data. Each run checks for new releases,
writes their summaries, then the notes that are missing. Running it twice writes nothing new. On
Windows, create a basic task in Task Scheduler that starts `npx` with the argument
`verdict-tracker sync` once a day. On macOS or Linux, a crontab line does the same:

```sh
17 7 * * * npx verdict-tracker sync >> ~/.verdict/sync.log 2>&1
```

The command exits with an error when the vault cannot be written. The GitHub workflow above runs on
a machine that cannot see your vault, so there `VERDICT_VAULT_DIR` is ignored.

```markdown
---
technology: "Next.js"
version: "16.0.0"
significance: featured
actionRequired: true
publishedAt: "2026-10-21T17:00:00.000Z"
url: "https://verdict-tracker.vercel.app/technologies/next/16.0.0"
notesUrl: "https://github.com/vercel/next.js/releases/tag/v16.0.0"
generatedBy: verdict
---

# Middleware becomes proxy

## Breaking changes

- `middleware.ts` is renamed
  Migration: Rename it to `proxy.ts`
  > the quote from the release notes, when there is one

## Key points

- Turbopack by default
```

The frontmatter keys are the same in every language, so Dataview queries keep working (for example
`TABLE version, significance FROM "Verdict" WHERE generatedBy = "verdict"`). The headings follow the
language chosen in `/settings`. `notesUrl` is `null` when the release has no notes page.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): running it locally, opening a pull request, and adding a
technology to the catalog with one JSON file.

## License

[MIT](LICENSE)
