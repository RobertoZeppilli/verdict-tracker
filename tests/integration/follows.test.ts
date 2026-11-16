import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFollows, writeCurrentVersion, writeFollows } from "@/modules/follows/server";
import { clearFollows, type Content, retire, seedCatalog, seedContent, testDatabase } from "./database";

// What `/api/follows` calls (issue #211): the rules the database held in Postgres now live in these
// functions and in the triggers of the SQLite schema. One installed copy, one person, one table
// (ADR 0011), so there is no client to bound and no grant to prove.
const db = testDatabase();
let content: Content;

beforeAll(() => {
  content = seedContent(db);
});

async function followed() {
  return (await readFollows(db)).map((follow) => follow.technologyId);
}

describe("follows", () => {
  afterEach(() => clearFollows(db));

  it("are read, added and let go", async () => {
    expect(writeFollows(db, [content.technologyId], true)).toBeNull();
    expect(await followed()).toEqual([content.technologyId]);

    expect(writeFollows(db, [content.technologyId], false)).toBeNull();
    expect(await followed()).toEqual([]);
  });

  // The primary key is the Technology: following the same one twice is not a second row, and not a
  // refusal either, since a group may hold rows the page already had.
  it("hold one row per Technology", async () => {
    expect(writeFollows(db, [content.technologyId], true)).toBeNull();
    expect(writeFollows(db, [content.technologyId], true)).toBeNull();
    expect(await followed()).toEqual([content.technologyId]);
  });
});

// Following several Technologies at once is one transaction (issue #126): what the page can
// promise about the group is what SQLite does with a trigger that raises halfway through it.
describe("a group of follows in one transaction", () => {
  const catalog = seedCatalog(db, 5);

  afterEach(() => clearFollows(db));

  it("writes the whole group", async () => {
    expect(writeFollows(db, catalog.slice(0, 3), true)).toBeNull();
    expect(await followed()).toHaveLength(3);
  });

  // The whole reason the page can say `none followed` instead of counting which ones made it
  // (DESIGN.md, Selection Bar).
  it("refuses a group holding a retired Technology, and follows none of it", async () => {
    const [, , , fourth, fifth] = catalog;
    retire(db, fifth);
    expect(writeFollows(db, [fourth, fifth], true)).toBe("retired");
    expect(await followed()).toEqual([]);
  });
});

// One level of service, so nothing counts how many Technologies are followed (issue #209, ADR
// 0011). Eleven is the proof, because ten was the wall of the Free Plan.
describe("more than ten follows", () => {
  const catalog = seedCatalog(db, 11);

  afterEach(() => clearFollows(db));

  it("are written one at a time, with the eleventh like the first", async () => {
    for (const technologyId of catalog) expect(writeFollows(db, [technologyId], true)).toBeNull();
    expect(await followed()).toHaveLength(11);
  });

  it("are written as one group", async () => {
    expect(writeFollows(db, catalog, true)).toBeNull();
    expect(await followed()).toHaveLength(11);
  });
});

describe("the follow rules the database imposes", () => {
  const catalog = seedCatalog(db, 2);

  afterEach(() => clearFollows(db));

  it("refuse a Technology let go after it was retired, which is all a retired follow can do", () => {
    const [retired] = catalog;
    expect(writeFollows(db, [retired], true)).toBeNull();

    // It leaves the Catalog while it is followed: the only way a retired follow can exist.
    retire(db, retired);
    expect(writeFollows(db, [retired], false)).toBeNull();

    expect(writeFollows(db, [retired], true)).toBe("retired");
  });

  it("refuse a retired Technology that was never followed", () => {
    const [, second] = catalog;
    retire(db, second);
    expect(writeFollows(db, [second], true)).toBe("retired");
  });
});

// The Version in use (issue #68): well formed, and not newer than the latest stable Release. The day
// of the declaration is written by the database, because a client that could set it could make a
// stale declaration look fresh.
describe("the Version in use", () => {
  const [bare] = seedCatalog(db, 1);

  beforeAll(() => {
    writeFollows(db, [content.technologyId], true);
  });

  function declare(version: string | null, technologyId = content.technologyId) {
    return writeCurrentVersion(db, technologyId, version);
  }

  it("starts undeclared", async () => {
    expect(await declare(null)).toEqual({ ok: true, currentVersion: null });
  });

  it("is saved with the day the database wrote it, and keeps it when nothing moved", async () => {
    const first = await declare("1.0.0");
    if (!first.ok || first.currentVersion === null) throw new Error("not declared");
    expect(first.currentVersion.version).toBe("1.0.0");

    const again = await declare("1.0.0");
    expect(again).toEqual(first);

    // A different Version is a new declaration, so it stands from now on. The pause is what keeps
    // two writes from landing on the same millisecond.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const moved = await declare("0.9.0");
    if (!moved.ok || moved.currentVersion === null) throw new Error("not declared");
    expect(moved.currentVersion.version).toBe("0.9.0");
    expect(moved.currentVersion.declaredAt).not.toEqual(first.currentVersion.declaredAt);
  });

  it("is written without the `v` it accepts", async () => {
    const declared = await declare("v1.0.0");
    expect(declared.ok && declared.currentVersion?.version).toBe("1.0.0");
  });

  it("can be taken away, and takes its day with it", async () => {
    expect((await declare("1.0.0")).ok).toBe(true);
    expect(await declare(null)).toEqual({ ok: true, currentVersion: null });
  });

  it("refuses a Version newer than the latest stable Release", async () => {
    expect(await declare("2.0.0")).toEqual({ ok: false, decline: "notOlder" });
  });

  it("refuses a Version that is not a Version", async () => {
    expect(await declare("1.x")).toEqual({ ok: false, decline: "malformed" });
  });

  it("refuses a Technology with no stable Release to measure from", async () => {
    expect(writeFollows(db, [bare], true)).toBeNull();
    expect(await declare("1.0.0", bare)).toEqual({ ok: false, decline: "noStable" });
  });

  it("refuses a Technology that is not followed", async () => {
    writeFollows(db, [bare], false);
    expect(await declare(null, bare)).toEqual({ ok: false, decline: "denied" });
  });
});
