// The privacy notice, one namespace because it is one page. Since issue #236 there is no account and
// no table of rows held about a person: the data is two files on the reader's computer, and the
// page says so. The names of the providers (GitHub, npm, Vercel) are not here: they are
// names, and they stay in the component beside the prose that describes them.
export const privacy = {
  "privacy.lede":
    "What this product knows about you, and the answer is nothing: there is no server of ours to keep it on. The app runs on your computer and keeps its data there. What does leave your computer is release notes, never anything about you, and it is listed below.",

  "privacy.held.title": "what is held, and where",
  "privacy.held.intro":
    "Nothing about you is held by us. The app keeps two files on your computer: `verdict.json`, with the technologies you follow, the version you run of each and the folder of your Obsidian vault if you chose one, and `verdict.db`, with the catalog, the releases, the summaries and your notifications. The address and key of your model and your webhook address, if you give them, sit in a `.env` file next to them. We have no copy of any of it.",

  "privacy.prompt.title": "no personal data enters a prompt",
  "privacy.prompt.body":
    "The summaries are written by the language model you set up, called from your computer, and the model is never told who you are. The request carries one thing: the release notes a project published. It says nothing about which technologies you follow, and a summary is the same text for every reader.",
  "privacy.prompt.images":
    "The browser never talks to a third party either. The pages come from the app on your computer, and every call to GitHub, npm or your model is made by the app, not by the browser.",

  "privacy.who.title": "who else touches it",
  "privacy.who.github":
    "serves the public release notes and the data file the app downloads on first start. The app only reads from it, and a `GITHUB_TOKEN`, if you set one, only raises the hourly limit.",
  "privacy.who.npm":
    "serves the app itself through `npx`, and the version lists of the technologies published there.",
  "privacy.who.vercel":
    "hosts the showcase, so it serves every request to it, keeps the request logs that come with doing so, and counts page views through Vercel Analytics. The app on your computer does not go through Vercel.",
  "privacy.who.model":
    "The model you set up receives the public release notes to summarize, and nothing else, as above. With Ollama on your computer they never leave it; with a remote provider, that provider's own terms apply to them.",

  "privacy.cookies.title": "cookies, and what is in your browser",
  "privacy.cookies.body":
    "There is no consent banner on this site because there is nothing to consent to: no advertising, no profiling, and no third party setting anything in your browser.",
  "privacy.cookies.what":
    "There are no cookies. The theme you pick is kept in your browser’s local storage and never leaves the browser. On the showcase, Vercel Analytics counts page views without a cookie and without storing an identifier in your browser: what it produces is counts of pages, not a trail of a person.",

  "privacy.keep.title": "how long, and how to end it",
  "privacy.keep.body":
    "Everything above stays on your computer for as long as you keep the files. Deleting the data folder removes it: `~/.verdict/` on macOS and Linux, `%LOCALAPPDATA%\\verdict` on Windows, or wherever `VERDICT_DATA_DIR` points. There is no copy of ours to ask about.",
  "privacy.keep.notifications":
    "The notifications are the one row with a clock of its own: each is deleted 90 days after it was written, seen or not, and nothing of it is kept after that.",
  "privacy.keep.after":
    "The catalog, the releases and the summaries were never yours or about you, and the next start downloads them again. The providers above run their own backups and logs on their own schedules, which we neither control nor can delete from.",

  "privacy.reach.title": "how to reach us",
  "privacy.reach.body":
    "One address, answered by the person who runs this: {mail}. Ask what is held about you, ask for it to be deleted, or tell us something here is wrong.",
} as const;
