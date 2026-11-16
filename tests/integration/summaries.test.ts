import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { publicPagesFor } from "@/modules/releases";
import {
  MAX_NOTES_LENGTH,
  PROMPT_VERSION,
  SUMMARY_MODEL,
  type SummaryRequest,
  type SummaryResult,
  type SummaryWriter,
} from "@/modules/summaries";
import { generatePendingSummaries } from "@/modules/summaries/server";
import { sqliteJson } from "@/modules/db";
import { testDatabase } from "./database";

const content = {
  title: "Node 18 is dropped and the build gets faster.",
  keyPoints: [
    { text: "Node 18 is no longer supported.", quote: "drop Node 18" },
    { text: "Builds are faster." },
    { text: "Preload is smarter." },
  ],
  breakingChanges: [
    { change: "Node 18 is no longer supported", migration: "Upgrade to Node 20 or later.", quote: "drop Node 18" },
  ],
  actionRequired: true,
};

const SummaryRowSchema = z.object({
  status: z.string(),
  content: sqliteJson(z.unknown()).nullable(),
  model: z.string().nullable(),
  prompt_version: z.string().nullable(),
  failure_reason: z.string().nullable(),
});

const db = testDatabase();
let technologyId: string;
let slug: string;

// The run reaches every Summary in the database, and a developer's database holds the whole Catalog:
// unfenced, these tests would hand every real pending Summary to a fake (issue #55). Each call here
// stays inside the Technology the test seeded.
function generate(writer: SummaryWriter, options: { maxCount?: number } = {}) {
  return generatePendingSummaries(db, writer, { ...options, technologyIds: [technologyId] });
}

// The Messages API as the tests see it: it answers from `respond` and remembers whom it was asked for.
function fakeWriter(respond: (request: SummaryRequest) => SummaryResult): SummaryWriter & { sent: string[] } {
  const sent: string[] = [];
  const writer = async (request: SummaryRequest) => {
    sent.push(request.releaseId);
    return respond(request);
  };
  return Object.assign(writer, { sent });
}

function succeeded(answer: unknown): SummaryResult {
  return { type: "succeeded", text: JSON.stringify(answer) };
}

function seedTechnology(technologySlug: string): string {
  const id = randomUUID();
  db.prepare(
    "insert into technologies (id, slug, name, category, classification_strategy) values (?, ?, 'Summary test', 'library', 'semver')",
  ).run(id, technologySlug);
  return id;
}

beforeEach(() => {
  slug = `summaries-${randomUUID()}`;
  technologyId = seedTechnology(slug);
});

// A featured Release with notes and a pending Summary.
async function seedPending(
  version: string,
  notes = "### Breaking Changes\n\n* drop Node 18",
  technology = technologyId,
): Promise<string> {
  const releaseId = randomUUID();
  db.prepare(
    "insert into releases (id, technology_id, version, significance, origin, published_at) values (?, ?, ?, 'featured', 'detected', ?)",
  ).run(releaseId, technology, version, new Date().toISOString());
  db.prepare("insert into release_notes (release_id, body) values (?, ?)").run(releaseId, notes);
  db.prepare("insert into summaries (release_id, status) values (?, 'pending')").run(releaseId);
  return releaseId;
}

// A Summary another run is writing, or was writing when it died, since `updatedAt`.
function setProcessing(releaseId: string, updatedAt: string): void {
  db.prepare("update summaries set status = 'processing', updated_at = ? where release_id = ?").run(updatedAt, releaseId);
}

async function readSummary(releaseId: string) {
  return SummaryRowSchema.parse(
    db
      .prepare("select status, content, model, prompt_version, failure_reason from summaries where release_id = ?")
      .get(releaseId),
  );
}

describe("summaries pipeline", () => {
  it("takes each pending Release only once across concurrent runs", async () => {
    const seeded = await Promise.all(Array.from({ length: 20 }, (_, index) => seedPending(`1.${index}.0`)));
    const writer = fakeWriter(() => succeeded(content));

    await Promise.all([1, 2, 3].map(() => generate(writer)));

    expect(writer.sent.filter((id) => seeded.includes(id)).toSorted()).toEqual(seeded.toSorted());
  });

  it("writes a ready Summary with model and prompt version in the same run", async () => {
    const releaseId = await seedPending("2.0.0");

    expect((await generate(fakeWriter(() => succeeded(content)))).ready).toEqual([releaseId]);
    expect(await readSummary(releaseId)).toMatchObject({
      status: "ready",
      content,
      model: SUMMARY_MODEL,
      prompt_version: PROMPT_VERSION,
      failure_reason: null,
    });
  });

  it("fails an invalid output with its reason", async () => {
    const releaseId = await seedPending("3.0.0");

    await generate(fakeWriter(() => succeeded({ ...content, title: "x".repeat(141) })));

    const summary = await readSummary(releaseId);
    expect(summary).toMatchObject({ status: "failed", content: null });
    expect(summary.failure_reason).toMatch(/invalid output[\s\S]*title/);
  });

  // A request the API refused for its own sake is not retried (ADR 0007).
  it("fails a refused request with its reason", async () => {
    const releaseId = await seedPending("3.1.0");

    await generate(fakeWriter(() => ({ type: "errored", message: "invalid_request_error" })));

    expect(await readSummary(releaseId)).toMatchObject({ status: "failed", failure_reason: "invalid_request_error" });
  });

  it("fails notes over the threshold without sending them", async () => {
    const releaseId = await seedPending("4.0.0", "x".repeat(MAX_NOTES_LENGTH + 1));
    const writer = fakeWriter(() => succeeded(content));

    const report = await generate(writer);

    expect(report.failed).toContain(releaseId);
    expect(writer.sent).not.toContain(releaseId);
    expect((await readSummary(releaseId)).failure_reason).toMatch(/over the \d+ limit/);
  });

  it.each(["credit_exhausted", "unreachable"] as const)(
    "on %s, puts the rest back to wait and stops sending",
    async (type) => {
      const first = await seedPending("6.0.0");
      const second = await seedPending("6.1.0");
      const writer = fakeWriter(() => ({ type, message: "later" }));

      const report = await generate(writer);

      expect(writer.sent).toHaveLength(1);
      expect(report.pending.toSorted()).toEqual([first, second].toSorted());
      for (const id of [first, second]) {
        expect(await readSummary(id)).toMatchObject({ status: "pending", model: null, failure_reason: null });
      }
    },
  );

  it("summarises the waiting Releases on the first run after the credit is topped up", async () => {
    const releaseId = await seedPending("6.2.0");

    await generate(fakeWriter(() => ({ type: "credit_exhausted", message: "low" })));
    expect((await generate(fakeWriter(() => succeeded(content)))).ready).toContain(releaseId);
  });

  it("names the pages of every settled Release, so the caller can revalidate them", async () => {
    await seedPending("7.0.0");

    const report = await generate(fakeWriter(() => succeeded(content)));

    expect(report.changed).toEqual([{ slug, version: "7.0.0" }]);
    expect(publicPagesFor(report.changed)).toEqual(
      expect.arrayContaining([`/technologies/${slug}`, `/technologies/${slug}/7.0.0`]),
    );
  });

  it("takes back a Summary a dead run left in progress, and only once it is stale", async () => {
    const stale = await seedPending("7.1.0");
    const fresh = await seedPending("7.2.0");
    setProcessing(stale, new Date(Date.now() - 60 * 60 * 1000).toISOString());
    setProcessing(fresh, new Date().toISOString());

    expect((await generate(fakeWriter(() => succeeded(content)))).ready).toEqual([stale]);
    expect((await readSummary(fresh)).status).toBe("processing");
  });

  // The fence of issue #55: unfenced, the run would reach the Summaries of the whole Catalog.
  it("leaves the Summaries of another Technology alone", async () => {
    const outsider = seedTechnology(`summaries-outsider-${randomUUID()}`);
    const queued = await seedPending("8.0.0", undefined, outsider);
    const mine = await seedPending("8.2.0");

    expect((await generate(fakeWriter(() => succeeded(content)))).ready).toEqual([mine]);
    expect(await readSummary(queued)).toMatchObject({ status: "pending", model: null });
  });
});

// Issue #88: a Summary that renders as a real one must say where it came from. The pipeline above is
// the only writer that reaches `ready`, so these tests go straight at the table, the way a hand
// written row would.
describe("the provenance of a ready Summary", () => {
  // The error, or null: the way a hand written row meets the check constraint.
  async function setSummary(releaseId: string, row: Record<string, string | null | object>) {
    const columns = Object.keys(row);
    try {
      db.prepare(`update summaries set ${columns.map((column) => `${column} = ?`).join(", ")} where release_id = ?`).run(
        ...columns.map((column) => {
          const value = row[column];
          return typeof value === "object" && value !== null ? JSON.stringify(value) : value;
        }),
        releaseId,
      );
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  it.each([
    ["model", { status: "ready", content, prompt_version: PROMPT_VERSION }],
    ["prompt version", { status: "ready", content, model: SUMMARY_MODEL }],
    ["content", { status: "ready", model: SUMMARY_MODEL, prompt_version: PROMPT_VERSION }],
  ])("is refused by the database without the %s", async (_what, row) => {
    const releaseId = await seedPending("9.0.0");

    const { error } = await setSummary(releaseId, row);

    expect(error?.message).toMatch(/summaries_ready_provenance/);
    expect((await readSummary(releaseId)).status).toBe("pending");
  });

  // Every status before `ready` stands for a Summary nobody is shown: provenance it has not got yet.
  it.each(["pending", "processing", "failed", "unavailable", "skipped"] as const)(
    "leaves a %s Summary without provenance alone",
    async (status) => {
      const releaseId = await seedPending(`9.1.0-${status}`);

      const { error } = await setSummary(releaseId, { status, model: null, prompt_version: null });

      expect(error).toBeNull();
      expect(await readSummary(releaseId)).toMatchObject({ status, model: null, prompt_version: null });
    },
  );
});
