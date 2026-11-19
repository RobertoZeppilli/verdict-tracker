import { z } from "zod";
import { readCatalogDirectory, syncCatalog } from "@/modules/catalog/server";
import { defaultStateFile, getDatabase } from "@/modules/db/server";
import { alignFollows } from "@/modules/follows/server";
import {
  createSourceAdapters,
  detectReleases,
  importTechnology,
  recordDetection,
  technologiesAwaitingImport,
} from "@/modules/detection/server";

// Writes the Catalog into the data file of this install (issue #211), which `getDatabase` opens and
// migrates first.
const SyncEnvSchema = z.object({
  // Optional: without it GitHub allows 60 requests an hour.
  GITHUB_TOKEN: z.string().min(1).optional(),
});

const env = SyncEnvSchema.parse(process.env);
const db = getDatabase();

const operations = await syncCatalog(db, await readCatalogDirectory());
for (const operation of operations) {
  const target = operation.type === "retire" ? operation.technologyId : operation.entry.slug;
  console.log(`${operation.type} ${target}`);
}
console.log(`Catalog synced: ${operations.length} operation(s).`);

// A database rebuilt from scratch knows its Technologies only now: this is when `verdict.json` can
// bring back the follows (issue #217).
for (const warning of await alignFollows(db, defaultStateFile())) console.warn(`verdict.json: ${warning}`);

const adapters = createSourceAdapters({ githubToken: env.GITHUB_TOKEN });

// The new versions of the Technologies already in the file, before the import: a file carried over
// from an earlier run (the initial one of a Release, the showcase's) is otherwise frozen (#221).
// No Summaries here: they cost, and the showcase writes them in a step of its own (#269).
const detection = await detectReleases(db, adapters);
console.log(`Detection: ${detection.asked} asked, ${detection.detected.length} new release(s).`);
for (const { slug, error } of detection.failed) console.error(`detection ${slug} failed: ${error}`);
recordDetection(db, new Date());

// One failing Technology does not stop the others; the next deploy retries it.
let failed = detection.failed.length;
for (const technology of await technologiesAwaitingImport(db)) {
  try {
    const versions = await importTechnology(db, technology, adapters, new Date());
    console.log(`import ${technology.slug}: ${versions.length} release(s)`);
  } catch (error) {
    failed++;
    console.error(`import ${technology.slug} failed:`, error);
  }
}
if (failed > 0) process.exitCode = 1;
