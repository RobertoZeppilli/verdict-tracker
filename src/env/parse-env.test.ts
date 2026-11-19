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
  it("accepts an empty environment, with Ollama on this computer as the model's address", () => {
    expect(parseServerEnv({})).toEqual({ VERDICT_MODEL_URL: "http://localhost:11434/v1" });
  });

  it("reads empty model variables as missing", () => {
    const env = parseServerEnv({ VERDICT_MODEL_URL: "", VERDICT_MODEL: "", VERDICT_MODEL_KEY: "", VERDICT_MODEL_CONTEXT: "" });
    expect(env).toEqual({ VERDICT_MODEL_URL: "http://localhost:11434/v1" });
  });

  it("reads the context as a whole number of tokens", () => {
    expect(parseServerEnv({ VERDICT_MODEL_CONTEXT: "32768" }).VERDICT_MODEL_CONTEXT).toBe(32_768);
    expect(() => parseServerEnv({ VERDICT_MODEL_CONTEXT: "a lot" })).toThrow(/VERDICT_MODEL_CONTEXT/);
  });

  it("rejects a model address that is not a URL", () => {
    expect(() => parseServerEnv({ VERDICT_MODEL_URL: "localhost" })).toThrow(/VERDICT_MODEL_URL/);
  });
});
