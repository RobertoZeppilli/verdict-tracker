import { describe, expect, it } from "vitest";
import { barePath, DEFAULT_LOCALE, isLocale, localeAlternates, localePath, LOCALES, stripLocale } from "./locales";

describe("isLocale", () => {
  it("accepts the two published languages", () => {
    expect(LOCALES.every(isLocale)).toBe(true);
  });

  it("rejects anything else, so an unknown prefix stays a path and not a language", () => {
    expect(isLocale("technologies")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("en-US")).toBe(false);
  });

  it("rejects the three languages that were published and are not any more (ADR 0012)", () => {
    // What a retired prefix buys by being rejected here: the proxy stops reading `/de/faq` as a
    // language it has no dictionary for and treats it as the path it now is, which the catch-all
    // answers with the app's own 404. On the showcase the 308 in `vercel.json` gets there first.
    for (const retired of ["fr", "es", "de"]) expect(isLocale(retired)).toBe(false);
  });
});

describe("localePath", () => {
  it("leaves English unprefixed, which is the address that was already indexed", () => {
    expect(localePath("en", "/technologies/vite")).toBe("/technologies/vite");
    expect(localePath("en", "/")).toBe("/");
  });

  it("prefixes every other language", () => {
    expect(localePath("it", "/technologies/vite")).toBe("/it/technologies/vite");
    expect(localePath("it", "/")).toBe("/it");
  });
});

describe("stripLocale", () => {
  it("reads the language off a prefixed path", () => {
    expect(stripLocale("/it/technologies/vite")).toEqual({ locale: "it", path: "/technologies/vite" });
    expect(stripLocale("/it")).toEqual({ locale: "it", path: "/" });
  });

  it("reads an unprefixed path as English", () => {
    expect(stripLocale("/technologies/vite")).toEqual({ locale: "en", path: "/technologies/vite" });
    expect(stripLocale("/")).toEqual({ locale: "en", path: "/" });
  });

  it("does not mistake a page for a language", () => {
    expect(stripLocale("/dashboard")).toEqual({ locale: "en", path: "/dashboard" });
  });

  it("reads a retired language as a path, because that is what it is now", () => {
    expect(stripLocale("/fr/faq")).toEqual({ locale: "en", path: "/fr/faq" });
  });

  it("leaves an explicit /en where it is instead of inventing a redirect", () => {
    expect(stripLocale("/en/faq")).toEqual({ locale: "en", path: "/en/faq" });
  });
});

describe("barePath", () => {
  it("takes any language prefix off, English included", () => {
    // The English one is the whole reason it exists: `usePathname` returns the path the proxy
    // rewrote to, so an English page reads `/en/faq` in the browser.
    expect(barePath("/en/faq")).toBe("/faq");
    expect(barePath("/it/technologies/vite")).toBe("/technologies/vite");
    expect(barePath("/it")).toBe("/");
  });

  it("leaves a path that carries no language where it is", () => {
    expect(barePath("/technologies/vite")).toBe("/technologies/vite");
    expect(barePath("/dashboard")).toBe("/dashboard");
    expect(barePath("/")).toBe("/");
    expect(barePath("/de/faq")).toBe("/de/faq");
  });
});

describe("localeAlternates", () => {
  it("names one address per language plus x-default, from any of them", () => {
    const fromEnglish = localeAlternates("/faq");
    expect(fromEnglish).toEqual({
      en: "/faq",
      it: "/it/faq",
      "x-default": "/faq",
    });
    expect(localeAlternates("/it/faq")).toEqual(fromEnglish);
  });

  it("covers every published language, so adding one cannot be forgotten here", () => {
    const alternates = localeAlternates("/");
    for (const locale of LOCALES) expect(alternates[locale]).toBe(localePath(locale, "/"));
    expect(alternates["x-default"]).toBe(localePath(DEFAULT_LOCALE, "/"));
  });
});
