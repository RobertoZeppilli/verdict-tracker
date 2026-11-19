import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readDashboard, readDemoDashboard } from "@/modules/dashboard/server";
import { seedCatalog, seedContent, seedTechnology, testDatabase } from "./database";

const DAY = 24 * 60 * 60 * 1000;

// The showcase's Dashboard reads a fixed stack and not the follows table (issue #221).
describe("Demo Dashboard", () => {
  const db = testDatabase();
  const now = new Date();
  const { technologyId } = seedContent(db);
  const slug = `tech-${technologyId}`;
  seedTechnology(db, { slug: "other", name: "Other" });

  const release = (technology: string, version: string, daysAgo: number) =>
    db
      .prepare(
        `insert into releases (id, technology_id, version, significance, origin, published_at)
         values (?, ?, ?, 'notable', 'imported', ?)`,
      )
      .run(randomUUID(), technology, version, new Date(now.getTime() - daysAgo * DAY).toISOString());

  it("reads the stack it is given, with its Releases, and nothing from the follows", async () => {
    const demo = await readDemoDashboard(db, [slug], now);
    expect(demo.followed).toEqual([{ slug, name: slug, currentVersion: null }]);
    expect(demo.releases.map((r) => r.version)).toEqual(["1.0.0"]);
    expect((await readDashboard(db)).followed).toEqual([]);
  });

  it("declares the highest stable Release before the window, on the day it came out", async () => {
    const [id] = seedCatalog(db, 1);
    release(id!, "2.0.0", 90);
    release(id!, "2.1.0", 40);
    release(id!, "3.0.0-beta.1", 35);
    release(id!, "3.0.0", 5);
    const demo = await readDemoDashboard(db, [`tech-${id}`], now);
    expect(demo.followed[0]?.currentVersion).toEqual({
      version: "2.1.0",
      declaredAt: new Date(now.getTime() - 40 * DAY),
    });
  });

  it("declares nothing for a Technology with no Release before the window", async () => {
    const [id] = seedCatalog(db, 1);
    release(id!, "1.0.0", 5);
    expect((await readDemoDashboard(db, [`tech-${id}`], now)).followed[0]?.currentVersion).toBeNull();
  });
});
