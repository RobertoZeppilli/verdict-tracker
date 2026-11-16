import { describe, expect, it } from "vitest";
import { InvalidEnvError, parseEnv, parseServerEnv } from "./parse-env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("returns the validated variables", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("names a missing variable in the error", () => {
    expect(() => parseEnv({})).toThrow(InvalidEnvError);
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects an invalid value", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("parseServerEnv", () => {
  it("accepts an empty environment", () => {
    expect(parseServerEnv({})).toEqual({});
  });

  it("accepts a missing or empty Anthropic key", () => {
    expect(
      parseServerEnv({ ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });

  it("rejects an Anthropic key that is not an API key", () => {
    expect(() =>
      parseServerEnv({ ANTHROPIC_API_KEY: "not-a-key" }),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });
});
