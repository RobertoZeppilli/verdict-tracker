# Contributing

Thanks for looking. Issues labelled
[`good first issue`](https://github.com/RobertoZeppilli/verdict-tracker/labels/good%20first%20issue)
are a good place to start, and adding a technology to the catalog needs no code at all.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).

## Add a technology to the catalog

Each technology is one file, `catalog/<slug>.json`. The slug is the file name: lowercase words joined
by `-`, such as `redux-toolkit`. Copy a file close to the one you want and change it.

```json
{
  "name": "Vite",
  "description": "Frontend build tool",
  "category": "build tool",
  "classificationStrategy": "semver",
  "sources": [
    { "role": "detection", "kind": "npm", "package": "vite" },
    { "role": "notes", "kind": "github-releases", "repo": "vitejs/vite", "tagFormat": "v{version}" }
  ]
}
```

- **`category`**: one of `language`, `runtime`, `framework`, `server framework`, `database`,
  `build tool`, `testing`, `lint and formatting`, `library`, `platform`. A category holds at most
  eight technologies; if yours would be the ninth, say so in the pull request.
- **`classificationStrategy`**: how a version becomes a significance.
  - `semver`: x.0.0 is `featured`, x.y.0 is `notable`, patches are `digest`.
  - `node`: even majors are `featured` (they become LTS), odd majors and x.y.0 are `notable`.
  - `typescript`: the first stable version of each x.y is `featured`, the rest `digest`.
  - `zerover`: for 0.x libraries, 0.y.0 is `featured`; from 1.0.0 it is `semver`.
  - `minor-major`: every x.y.0 is `featured`, for projects that ship their real changes in minors
    and have not changed major in years (Rust, Terraform, Vue).
- **`sources`**: where versions and release notes come from. One `detection` source is required,
  and a `notes` source is how summaries get written. At most one source of each role and kind.
  - Detection from npm: `{ "role": "detection", "kind": "npm", "package": "<name>" }`.
  - Detection from GitHub Releases, for anything not on npm:
    `{ "role": "detection", "kind": "github-releases", "repo": "<owner>/<name>", "tagFormat": "v{version}" }`.
    `tagFormat` is how the project writes a version in its tags: `v{version}`, `{version}`,
    `vite@{version}`.
  - Notes from GitHub Releases: the same shape with `"role": "notes"`. If previews are tagged
    differently from stable releases, add `prereleaseTagFormat`, for example
    `v{major}.{minor}-{prerelease}`.
  - Notes from a changelog file: `{ "role": "notes", "kind": "changelog", "repo": "<owner>/<name>", "path": "CHANGELOG.md" }`.

Then run:

```sh
pnpm icons:sync   # takes the logo from simple-icons, if there is one
pnpm test         # checks every catalog file and names the field that is wrong
```

If simple-icons uses a different slug, `pnpm icons:sync` says so: add the pair to `RENAMED` in
`scripts/sync-technology-marks.mts`. If it has no logo at all, add the slug with the reason to
`UNMARKED` in the same file and to `UNMARKED` in `src/modules/catalog/ui/technology-marks.test.ts`.
Run `pnpm icons:sync` again.

Deleting a catalog file retires the technology. It does not delete its releases.

## Run it locally

You need Node.js 24 and pnpm. Docker is not needed.

```sh
pnpm install
cp .env.example .env.local
pnpm catalog:sync    # fills the data file with the catalog and its releases
pnpm dev
```

The data file is `~/.verdict/verdict.db` (`%LOCALAPPDATA%\verdict` on Windows), or wherever
`VERDICT_DATA_DIR` points. Without `VERDICT_MODEL` in `.env.local` everything works, and new
releases show their summary as missing. With Ollama running and `VERDICT_MODEL` set to a model
you have pulled, summaries cost nothing.

Checks, the same ones CI runs:

```sh
pnpm lint
pnpm typecheck
pnpm test               # unit
pnpm test:integration   # SQLite in memory
pnpm test:e2e           # Playwright; E2E_PORT=3100 if port 3000 is taken
```

Two commands call the model in `VERDICT_MODEL`, and with a remote provider they cost money:
`pnpm summary:try <slug> <version>` writes one summary, and `pnpm summaries:pending` writes every
pending one, up to `SUMMARY_MAX_COUNT` (100 by default).

## How the code is laid out

- `src/modules/<module>/{domain,server,ui}`. `domain` is plain TypeScript with tests; modules import
  each other only through their `index.ts`.
- Types come from Zod schemas. No `any`.
- Interface strings are written in English in `src/modules/i18n` and translated to Italian. Words
  such as `featured`, `notable`, `digest`, `preview` and `note:` stay English in every language.
- Database changes are new numbered `.sql` files in `src/modules/db/migrations/`. Never edit an
  old one: people have real data files.
- GitHub, npm and the model are called from the server only, never from the browser.
- Accessibility target: WCAG 2.2 AA.

The domain documents (`GLOSSARY.md`, `docs/DECISIONI.md`, `docs/adr/`) are in Italian; the glossary
gives the English name used in code for each term. Ask in the issue if something is unclear.

## Open a pull request

1. Open or pick an issue first, unless the change is a catalog file or a typo.
2. Branch from `main`, one issue per branch.
3. Run the checks above.
4. In the description, say what changed and how you checked it. Write `Closes #N` only if the pull
   request fully closes the issue.

## Releases and the showcase

For the maintainer.

- `pnpm pack:cli` builds the `verdict-tracker` package in `dist/cli`. The `Release` workflow tests it
  on Linux, Windows and macOS on every pull request that touches it. Pushing a tag `vX.Y.Z` (after
  raising `version` in `package.json`) attaches the data file to the GitHub Release and only then
  publishes the same tarball to npm. Secret: `NPM_TOKEN`.
- The showcase on Vercel is static, built by `pnpm build:static`. The `Showcase` workflow rebuilds it
  once a day and on pushes to `main` that touch it: it downloads the data file from the latest
  Release, checks for new releases and deploys. It writes no summaries: the showcase shows the ones
  already in the data file, and each installation writes new ones with its own model. Secret:
  `VERCEL_TOKEN`.
