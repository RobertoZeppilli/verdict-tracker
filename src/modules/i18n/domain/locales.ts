import { z } from "zod";

// English first because it is the base: the strings are written in it and every other locale is a
// translation of it (ADR 0008). The order is the one the picker reads in.
// ⚠️ Two and not five since ADR 0012: French, Spanish and German are out. Nothing reads a list of
// what left -- the retired prefixes are answered by the 308 in `vercel.json` on the showcase and by
// the app's own 404 in the installed copy, neither of which needs to know their names.
export const LOCALES = ["en", "it"] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

// `as const satisfies` and not `: Locale`: annotated as the union it widens to it, and then
// `Exclude<Locale, typeof DEFAULT_LOCALE>` -- the set of languages that are translations, which the
// dictionary registry is typed by -- excludes the whole union and comes out `never`.
export const DEFAULT_LOCALE = "en" as const satisfies Locale;

// The name of each language in itself, which is the only name a reader of that language can be
// expected to recognise: an Italian speaker looking for Italian looks for `Italiano`.
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  it: "Italiano",
};

export function isLocale(value: string): value is Locale {
  return localeSchema.safeParse(value).success;
}

// A language read back **out of storage**, which is not the same question as a language in an
// address. A row written while the product published five of them can hold one it does not publish
// any more (ADR 0012), and a preference that cannot be honoured is no reason for the page that
// shows it to fail to open: it reads as the default instead. It is the same answer the readers
// already give a row that is missing altogether.
// ⚠️ `localeSchema` stays strict and is what every **write** goes through, so this widens nothing on
// the way in: it only keeps a value that is already in the database from taking a page down.
export const storedLocaleSchema = z
  .string()
  .transform((value): Locale => (isLocale(value) ? value : DEFAULT_LOCALE));

// The default locale carries no prefix: `/technologies/vite` is the English page and the address
// that was already indexed (ADR 0008). The others are prefixed.
export function localePath(locale: Locale, path: string): string {
  const rest = path === "/" ? "" : path;
  return locale === DEFAULT_LOCALE ? rest || "/" : `/${locale}${rest}`;
}

// The path without its locale prefix, which is what the picker needs to send the reader to the same
// page in another language, and what the canonical of a page is built from.
export function stripLocale(path: string): { locale: Locale; path: string } {
  const [, first = "", ...rest] = path.split("/");
  if (!isLocale(first) || first === DEFAULT_LOCALE) return { locale: DEFAULT_LOCALE, path };
  const remainder = rest.length > 0 ? `/${rest.join("/")}` : "/";
  return { locale: first, path: remainder };
}

// The path with **any** language prefix taken off, `/en` included. `stripLocale` is the other
// question and deliberately leaves an explicit `/en` where it is, because the proxy has to see it to
// redirect it away; this one asks what page this is, whatever language it is written in.
// ⚠️ It exists because `usePathname` in the browser returns the path the proxy **rewrote to**: on an
// English page it reads `/en/faq`, not `/faq`. The picker built its entries from it and sent a
// reader of `/faq` to `/it/en/faq`, which is a 404. Found by an E2E, invisible to the typecheck.
export function barePath(path: string): string {
  const [, first = "", ...rest] = path.split("/");
  if (!isLocale(first)) return path;
  return rest.length > 0 ? `/${rest.join("/")}` : "/";
}

// Every address of one page, for `hreflang`. `x-default` points at the English one: it is what a
// crawler serves to a reader whose language we do not publish -- which since ADR 0012 is every
// reader who does not read English or Italian.
export function localeAlternates(path: string): Record<string, string> {
  const { path: bare } = stripLocale(path);
  return {
    ...Object.fromEntries(LOCALES.map((locale) => [locale, localePath(locale, bare)])),
    "x-default": localePath(DEFAULT_LOCALE, bare),
  };
}
