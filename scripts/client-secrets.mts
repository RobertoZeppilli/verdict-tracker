import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The Anthropic key never reaches the browser (issue #240). Everything under `.next/static` is
// served to whoever asks, so the build that emitted it is read back: a chunk that names the
// variable, or carries anything shaped like a key, means a client component reached the key.
// Runs in CI after `pnpm build`, as `pnpm i18n:client-keys --check` does.

const STATIC = join(process.cwd(), ".next", "static");
const FORBIDDEN = [/ANTHROPIC_API_KEY/, /sk-ant-[\w-]+/];

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

let served: string[];
try {
  served = files(STATIC);
} catch {
  throw new Error(`Nothing under ${STATIC}. Run \`pnpm build\` first.`);
}

const leaks = served.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  return FORBIDDEN.flatMap((pattern) => {
    const found = pattern.exec(text);
    // Only the pattern and a hint of the match: a real key must not end up in the CI log either.
    return found === null ? [] : [`${relative(process.cwd(), file)}: ${pattern.source} (…${found[0].slice(-4)})`];
  });
});

if (leaks.length > 0) {
  throw new Error(`The Anthropic key reaches the browser:\n${leaks.join("\n")}`);
}
console.log(`No trace of the Anthropic key in ${served.length} files under .next/static.`);
