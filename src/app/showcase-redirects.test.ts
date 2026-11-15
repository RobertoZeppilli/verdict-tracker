import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isLocale } from "@/modules/i18n";

// The prefixes the public site published and does not serve any more. `/en` was never a page of its
// own -- English carries no prefix (ADR 0008) -- and `/fr`, `/es` and `/de` were real pages until
// ADR 0012 took the three languages out. Either way the addresses were crawled, so they are
// redirected and not 404ed: a 404 throws away whatever authority they had and meets a reader with a
// closed door, while a 308 says this page is now that one.
//
// ⚠️ The list is written here and nowhere in the product, and that is the point: nothing at runtime
// has a use for the names of languages that left. `vercel.json` is not TypeScript and no type
// reaches it, so this test is the only thing that can hold the two halves together -- the languages
// `LOCALES` no longer has, and the redirects the showcase has to declare for them.
const RETIRED_PREFIXES = ["en", "fr", "es", "de"] as const;

const redirectSchema = z.object({
  source: z.string(),
  destination: z.string(),
  permanent: z.boolean(),
});

const vercelSchema = z.object({ redirects: z.array(redirectSchema) });

const { redirects } = vercelSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8")),
);

describe("the redirects of the showcase", () => {
  it.each(RETIRED_PREFIXES)("sends /%s to the page without a prefix, permanently", (prefix) => {
    // Two per prefix, because one does not cover the other: Vercel matches `source` against the
    // whole path, so `/fr/:path*` never sees the bare `/fr` and `/fr` never sees `/fr/faq`.
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: `/${prefix}`, destination: "/", permanent: true },
        { source: `/${prefix}/:path*`, destination: "/:path*", permanent: true },
      ]),
    );
  });

  it("keeps Italian out of the list, because it is a language the site publishes", () => {
    // The guard against a redirect written for a language still in the product, which would take
    // every Italian page to its English one and leave the translation unreachable.
    const sources = redirects.map(({ source }) => source);
    expect(sources).not.toContain("/it");
    expect(sources).not.toContain("/it/:path*");
  });

  it("redirects no prefix that is still a language, English apart", () => {
    // English is the exception and has to be: it is a language of the product and `/en` is still not
    // an address, because the English page is the one without a prefix.
    const retired = RETIRED_PREFIXES.filter((prefix) => prefix !== "en");
    expect(retired.filter(isLocale)).toEqual([]);
  });
});
