import { describe, expect, it } from "vitest";
import { isTrustedRequest, type RequestFacts } from "./trusted-request";

const facts = (overrides: Partial<RequestFacts>): RequestFacts => ({
  method: "GET",
  host: "localhost:3000",
  origin: null,
  referer: null,
  port: "3000",
  ...overrides,
});

describe("isTrustedRequest", () => {
  it("accepts both localhost and 127.0.0.1 on the app's port", () => {
    expect(isTrustedRequest(facts({ host: "localhost:3000" }))).toBe(true);
    expect(isTrustedRequest(facts({ host: "127.0.0.1:3000" }))).toBe(true);
    expect(isTrustedRequest(facts({ method: "POST", host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }))).toBe(true);
  });

  it("refuses a foreign Host even when it resolves to the right IP (DNS rebinding)", () => {
    expect(isTrustedRequest(facts({ host: "evil.example:3000" }))).toBe(false);
    expect(isTrustedRequest(facts({ host: "evil.example:3000", method: "POST", origin: "http://evil.example:3000" }))).toBe(false);
    expect(isTrustedRequest(facts({ host: null }))).toBe(false);
  });

  it("refuses another port", () => {
    expect(isTrustedRequest(facts({ host: "localhost:3001" }))).toBe(false);
    expect(isTrustedRequest(facts({ host: "localhost" }))).toBe(false);
  });

  it("refuses a POST from a foreign Origin", () => {
    expect(isTrustedRequest(facts({ method: "POST", origin: "https://evil.example" }))).toBe(false);
    expect(isTrustedRequest(facts({ method: "POST", origin: "http://localhost:5173" }))).toBe(false);
    expect(isTrustedRequest(facts({ method: "POST", origin: "null" }))).toBe(false);
  });

  it("refuses a POST with neither Origin nor Referer", () => {
    expect(isTrustedRequest(facts({ method: "POST" }))).toBe(false);
    expect(isTrustedRequest(facts({ method: "DELETE" }))).toBe(false);
  });

  it("falls back to the Referer's origin when Origin is missing", () => {
    expect(isTrustedRequest(facts({ method: "PATCH", referer: "http://localhost:3000/settings?x=1" }))).toBe(true);
    expect(isTrustedRequest(facts({ method: "PATCH", referer: "https://evil.example/page" }))).toBe(false);
    expect(isTrustedRequest(facts({ method: "PATCH", referer: "not a url" }))).toBe(false);
  });

  it("serves a GET whatever its Origin, as long as the Host is the app", () => {
    expect(isTrustedRequest(facts({ origin: "https://evil.example" }))).toBe(true);
    expect(isTrustedRequest(facts({ method: "head", origin: "https://evil.example" }))).toBe(true);
  });
});
