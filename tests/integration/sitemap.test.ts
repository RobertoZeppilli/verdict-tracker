import { describe, expect, it } from "vitest";
import { listSitemapPages } from "@/modules/releases/server";
import { retire, seedContent, testDatabase } from "./database";

const db = testDatabase();
const content = seedContent(db);
const retired = seedContent(db);
retire(db, retired.technologyId);

// `seedCatalog` names every Technology after its id.
const slugOf = (technologyId: string) => `tech-${technologyId}`;

// The route itself is prerendered and cannot be asserted on from an E2E against the build.
describe("listSitemapPages", () => {
  it("names the page of a Technology and of each of its Releases", async () => {
    const paths = (await listSitemapPages(db)).map((page) => page.path);
    const slug = slugOf(content.technologyId);

    expect(paths).toContain(`/technologies/${slug}`);
    expect(paths).toContain(`/technologies/${slug}/1.0.0`);
  });

  it("keeps a retired Technology, whose pages stay reachable", async () => {
    const paths = (await listSitemapPages(db)).map((page) => page.path);
    const slug = slugOf(retired.technologyId);

    expect(paths).toContain(`/technologies/${slug}`);
    expect(paths).toContain(`/technologies/${slug}/1.0.0`);
  });

  it("dates a Release page by the day its Summary last settled", async () => {
    const slug = slugOf(content.technologyId);
    const pages = await listSitemapPages(db);
    const release = pages.find((page) => page.path === `/technologies/${slug}/1.0.0`);

    expect(release?.lastModified.getTime()).toBeGreaterThan(0);
  });
});
