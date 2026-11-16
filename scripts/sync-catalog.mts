import { z } from "zod";
import { readCatalogDirectory, syncCatalog } from "@/modules/catalog/server";
import { defaultStateFile, getDatabase } from "@/modules/db/server";
import { alignFollows } from "@/modules/follows/server";
import { createSourceAdapters, importTechnology, technologiesAwaitingImport } from "@/modules/detection/server";

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

// One failing Technology does not stop the others; the next deploy retries it.
const adapters = createSourceAdapters({ githubToken: env.GITHUB_TOKEN });
let failed = 0;
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
