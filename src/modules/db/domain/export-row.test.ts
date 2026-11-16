import { describe, expect, it } from "vitest";
import { exportRow } from "./export-row";

describe("exportRow", () => {
  it("turns Postgres values into what the SQLite schema holds", () => {
    expect(
      exportRow("technologies", {
        slug: "react",
        retired: false,
        config: { owner: "facebook" },
        created_at: "2026-10-01T12:34:56.123456+00:00",
        description: null,
      }),
    ).toEqual({
      slug: "react",
      retired: 0,
      config: '{"owner":"facebook"}',
      created_at: "2026-10-01T12:34:56.123Z",
      description: null,
    });
  });

  it("sends a Summary production was still writing back to waiting", () => {
    expect(exportRow("summaries", { status: "processing" })).toEqual({ status: "pending" });
    expect(exportRow("summaries", { status: "ready" })).toEqual({ status: "ready" });
  });

  it("refuses a timestamp it cannot read", () => {
    expect(() => exportRow("releases", { published_at: "yesterday" })).toThrow(/published_at/);
  });
});
