// The FAQ, one namespace because it is one page. A question is a key ending in `.q` and its answer
// the matching `.a`, so a question translated without its answer is visible by reading down the
// file. The order here is the order on the page, which is the order a reader scans.
export const faq = {
  "faq.lede":
    "The questions this product is actually asked, answered by what it does rather than by what it would like to do.",

  "faq.section.product": "the product",
  "faq.does.q": "What does Verdict do?",
  "faq.does.a":
    "It follows the releases of the technologies in its catalog and gives each release a single verdict: whether it asks something of you, what breaks, and how to migrate. Every claim points at the line of the release notes it was read from.",
  "faq.add.q": "Can I ask for a technology to be added?",
  "faq.add.a":
    "No. The catalog is curated: a technology enters it when its releases can be followed properly, and that is a decision rather than a queue. You can write and say what you are missing, but there is no request to file and nothing to track.",
  "faq.when.q": "How soon does a new release appear?",
  "faq.when.a":
    "The job that looks for new releases runs once a day. A release page shows the notes as soon as the release is recorded; its verdict appears once the summary has been written, which is a separate job and can lag behind.",
  "faq.read.q": "Do I need an account?",
  "faq.read.a":
    "No. There is no account. The app runs on your computer, and the technologies you follow, with the version you run of each, are kept in `verdict.json` next to its data. The showcase online is public and read-only.",

  "faq.section.summaries": "the summaries",
  "faq.who.q": "Who writes the summaries?",
  "faq.who.a":
    "A language model, from the release notes the project published and from nothing else. It is given no other source, no other page and no data about any reader.",
  "faq.wrong.q": "Can a summary be wrong?",
  "faq.wrong.a":
    "Yes, and the page is built on the assumption that it can be. That is what the quoted line under a claim is for, and why every page links the notes at their source: the summary is there to save you the reading, not to be believed on its own. When a change is expensive to get wrong, check the cited line.",
  "faq.prompt.q": "Does anything about me go into a prompt?",
  // `{privacy}` is the link to the privacy notice, named in `document`.
  "faq.prompt.a":
    "No. A summary is written from the release notes alone, and the request for it carries nothing about who you are or what you follow. A summary is the same text for every reader. The rest of it is in the {privacy}.",

  "faq.section.notifications": "notifications",
  "faq.notify.q": "When does something notify me?",
  "faq.notify.a":
    "When a featured or notable release of a technology you follow has its summary in. The bell in the top bar is the only channel built so far.",

  "faq.section.data": "your data",
  "faq.scope.q": "Does Verdict need my GitHub account?",
  "faq.scope.a":
    "No. The app reads public release notes from GitHub without signing in. A `GITHUB_TOKEN` is optional: it raises GitHub's limit of 60 requests an hour and is only used to read.",
  "faq.delete.q": "How do I delete my data?",
  "faq.delete.a":
    "Delete the data folder: `~/.verdict/` on macOS and Linux, `%LOCALAPPDATA%\\verdict` on Windows, or wherever `VERDICT_DATA_DIR` points. Nothing about you is kept anywhere else.",
  "faq.cookies.q": "Is there a cookie banner?",
  "faq.cookies.a":
    "No, because there is nothing to ask about: no advertising, no profiling, no cookies, and no third party setting anything in your browser. The theme you pick stays in your own browser.",
} as const;
