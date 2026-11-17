import { describe, expect, it } from "vitest";
import { readDashboard, readDemoDashboard } from "@/modules/dashboard/server";
import { seedContent, seedTechnology, testDatabase } from "./database";

// The showcase's Dashboard reads a fixed stack and not the follows table (issue #221).
describe("Demo Dashboard", () => {
  const db = testDatabase();
  const { technologyId } = seedContent(db);
  const slug = `tech-${technologyId}`;
  seedTechnology(db, { slug: "other", name: "Other" });

  it("reads the stack it is given, with its Releases, and nothing from the follows", async () => {
    const demo = await readDemoDashboard(db, [slug]);
    expect(demo.followed).toEqual([{ slug, name: slug, currentVersion: null }]);
    expect(demo.releases.map((release) => release.version)).toEqual(["1.0.0"]);
    expect((await readDashboard(db)).followed).toEqual([]);
  });
});
