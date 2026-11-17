// Which of the two builds this is (issue #215). The repository builds two things from one source:
// the app that gets installed, with its server, its login and its jobs, and the public showcase,
// which is `output: "export"` and is only files. `scripts/build-static.mts` sets the variable.
//
// ⚠️ It reads `process.env` by its full name and does **not** go through `@/env`: the switch is
// read by Client Components as well, and that is what lets Next inline the value and drop the
// branch it does not take, instead of shipping the schema parser to the browser to learn a boolean.
// The variable is declared in `src/env/parse-env.ts` all the same, where every variable is declared.
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

// Where the showcase is served. The links of a Slack or Discord message point here and not at the
// installed copy, whose `localhost` does not answer while the app is closed (issue #218).
export const SHOWCASE_URL = "https://verdict-tracker.vercel.app";

// The address the showcase's catch-all route exports its one document at, before
// `scripts/build-static.mts` moves it to `404.html`, which is what a static host serves for every
// address it has no file for. Here and not in the route, so the script can read it without loading
// a page module and everything a page imports with it.
export const STATIC_NOT_FOUND_SEGMENT = "_404";

// The source, which the landing links (issue #221). The same repository `cli/launch.mjs` downloads
// the initial data file from.
export const REPOSITORY_URL = "https://github.com/RobertoZeppilli/verdict-tracker";
