import { execSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_PORT } from "../cli/launch.mjs";

// Builds the npm package `verdict-tracker` in `dist/cli` (issue #214): the standalone build of Next,
// the launcher in `cli/`, and a package.json with no dependencies, since the build carries its own.
// Usage: pnpm pack:cli   (then `npm publish dist/cli`, which the release workflow does)

const ROOT = process.cwd();
const OUT = join(ROOT, "dist", "cli");
const STANDALONE = join(ROOT, ".next", "standalone");

const Manifest = z.object({ version: z.string(), repository: z.object({ type: z.string(), url: z.string() }) });
const { version, repository } = Manifest.parse(JSON.parse(readFileSync("package.json", "utf8")));

execSync("pnpm next build", {
  stdio: "inherit",
  env: {
    ...process.env,
    VERDICT_STANDALONE: "1",
    // Baked into the client: the address of the links Slack receives. A copy that falls back to
    // another port because this one is taken gets links to the wrong one.
    NEXT_PUBLIC_SITE_URL: `http://localhost:${DEFAULT_PORT}`,
    // The build opens the data file (the sitemap is prerendered from it): an empty one of its own,
    // never the Developer's.
    VERDICT_DATA_DIR: mkdtempSync(join(tmpdir(), "verdict-pack-")),
  },
});

// pnpm leaves symlinks in the standalone `node_modules`, which `npm pack` drops. On Linux they point
// inside the standalone directory; on Windows (measured) at the project's own `node_modules`, where
// following them ships whole packages (270 MB instead of 43). The traced copy of every target is
// inside the standalone directory, at the same path below the root, so each link is copied from
// there. `sharp` is left out: the image optimizer, off in this build, with a binary per platform.
const SKIPPED = new Set(["sharp", "@img"]);

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (SKIPPED.has(entry)) continue;
    let source = join(from, entry);
    if (lstatSync(source).isSymbolicLink()) {
      const target = resolve(from, readlinkSync(source));
      const inStandalone = relative(STANDALONE, target);
      const inProject = relative(ROOT, target);
      if (!inStandalone.startsWith("..")) source = target;
      else if (!inProject.startsWith("..")) source = join(STANDALONE, inProject);
      else throw new Error(`${source} points outside the project: ${target}`);
    }
    if (lstatSync(source).isDirectory()) copyTree(source, join(to, entry));
    else copyFileSync(source, join(to, entry));
  }
}

rmSync(OUT, { recursive: true, force: true });
const APP = join(OUT, "app");
copyTree(STANDALONE, APP);

// Copied out of its `.pnpm` folder, `next` no longer sees the packages that sat beside it there
// (`@swc/helpers` first). pnpm keeps every one of them in `.pnpm/node_modules` too: moved up into
// `app/node_modules`, Node's ordinary lookup finds them from anywhere in the app.
function hoist(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (entry.startsWith("@")) hoist(join(from, entry), join(to, entry));
    else if (!existsSync(join(to, entry))) renameSync(join(from, entry), join(to, entry));
  }
}
hoist(join(APP, "node_modules", ".pnpm", "node_modules"), join(APP, "node_modules"));
// The standalone server does not serve these by itself (Next's docs on `output: "standalone"`). The
// project has no `public/` directory.
cpSync(join(ROOT, ".next", "static"), join(APP, ".next", "static"), { recursive: true });
cpSync(join(ROOT, "cli"), join(OUT, "cli"), { recursive: true, filter: (path) => !path.endsWith(".test.ts") });
copyFileSync(join(ROOT, "README.md"), join(OUT, "README.md"));

// Everything in the package is public: no `.env` file, and nothing shaped like an Anthropic key.
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
for (const file of files(OUT)) {
  const name = relative(OUT, file);
  if (/(^|[\\/])\.env/.test(name)) throw new Error(`${name} must not be published.`);
  if (/sk-ant-[a-z]+\d*-[\w-]{20,}/.test(readFileSync(file, "latin1"))) {
    throw new Error(`${name} contains something shaped like an Anthropic key.`);
  }
}

writeFileSync(
  join(OUT, "package.json"),
  `${JSON.stringify(
    {
      name: "verdict-tracker",
      version,
      description: "Track the releases of the technologies you use, with AI summaries. Runs on your machine.",
      repository,
      type: "module",
      bin: { "verdict-tracker": "cli/verdict-tracker.mjs" },
      // `node:sqlite` without a flag, and the version the CI tests.
      engines: { node: ">=24" },
    },
    null,
    2,
  )}\n`,
);

execSync("npm pack --dry-run", { cwd: OUT, stdio: "inherit" });
