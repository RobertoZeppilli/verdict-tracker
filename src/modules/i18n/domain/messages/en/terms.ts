// The terms, one namespace because it is one page. Every claim here is one the code makes true
// (issue #132), so a translation that softens one of them makes the page say something the app does
// not do: the sentences are deliberately flat, and a language should keep them flat.
export const terms = {
  "terms.lede":
    "What the service is, what it holds you to, and what it does not promise. It is short because the product is small, and nothing below describes something the app does not do.",

  "terms.service.title": "the service",
  "terms.service.body":
    "Verdict follows the releases of the technologies in its catalog and gives each one a verdict: whether it asks something of you, what breaks, and how to migrate. It is open source software under the MIT license and runs on your computer, with the model you choose and your data in files of your own. The showcase online is a public, read-only copy of the same pages.",

  "terms.catalog.title": "the catalog is curated",
  "terms.catalog.body":
    "The catalog is chosen and maintained by us. There is no form to add a technology to it and no queue behind one: a technology enters when we can follow its releases properly, and it can be retired when we no longer can. A retired technology stays readable, and it stays yours if you were following it.",


  "terms.summaries.title": "the summaries are generated, and can be wrong",
  "terms.summaries.body":
    "Every summary is written by a language model that reads one thing: the release notes the project itself published for that release. It is given no other source, and no data about you.",
  "terms.summaries.check":
    "A model can misread. That is why a summary is not the last word on the page: its claims carry the line of the release notes they were read from, and the page links the notes at their source. The quote is there so you can check instead of trust. When a change is expensive to get wrong, read the cited line before you act on the verdict.",

  "terms.data.title": "your data and your model",
  "terms.data.body":
    "There is no account. The technologies you follow, the versions you declared and the folder of your Obsidian vault are in `verdict.json`, and everything else in `verdict.db`, both on your computer: deleting them deletes all of it. The summaries of new releases are written by the model you set up; a remote provider bills you for them under its own terms. What leaves your computer, and where it goes, is in the {privacy}.",

  "terms.conduct.title": "what we ask of you",
  "terms.conduct.body":
    "On the showcase, read and leave the rest alone: no automated traffic beyond what a reader generates, and no attempt to break it or the services behind it. The app on your computer is yours to run as the license allows.",

  "terms.warranty.title": "no warranty",
  "terms.warranty.body":
    "The service is provided as it is. It can change, it can be unavailable, and it can stop. The summaries can be wrong, the release notes they read can themselves be wrong or incomplete, and an upgrade is still your decision and your responsibility. Nothing here is advice, and no liability is accepted for what follows from an upgrade.",

  "terms.changes.title": "changes, and how to reach us",
  "terms.changes.body":
    "These terms can change. The date at the top of this page is the day its text last changed, and it is the only record of that there is. Questions, mistakes you spot, anything else: {mail}.",
} as const;
