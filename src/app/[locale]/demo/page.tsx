import type { Metadata } from "next";
import { HelpPointer } from "@/components/help-pointer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/metadata";
import { STATIC_SITE } from "@/lib/static-site";
import { getDatabase } from "@/modules/db/server";
import { buildDashboard } from "@/modules/dashboard";
import { readDemoDashboard } from "@/modules/dashboard/server";
import { StandingColumn, Stream, windowLine } from "@/modules/dashboard/ui";
import { currentLocale, getTranslator } from "@/modules/i18n/server";

// The stack the showcase follows: technologies most readers know, from the Catalog directory.
const DEMO_STACK = ["react", "next", "typescript", "vite", "nodejs", "tailwindcss", "vitest", "zod"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return pageMetadata({
    title: t("page.demo.title"),
    description: t("page.demo.description"),
    path: "/demo",
    type: "website",
    locale: await currentLocale(),
  });
}

// The Dashboard without installing anything (issue #221): the app's own components over a fixed
// stack, prerendered at build, so the showcase serves it as a file. No Detection status and no week
// in the URL: both need a server, and the weeks still open in the browser.
export default async function DemoPage() {
  const t = await getTranslator();
  const locale = await currentLocale();
  const { followed, releases } = await readDemoDashboard(getDatabase(), DEMO_STACK);
  // Loud at the showcase build: a slug that left the Catalog would quietly shrink the demo. Only
  // there: the installed app is built over an empty file and links no demo.
  if (STATIC_SITE && followed.length !== DEMO_STACK.length) {
    throw new Error("A technology of DEMO_STACK is not in the data file.");
  }
  const dashboard = buildDashboard(followed, releases, new Date());

  return (
    <>
      <SiteHeader />
      <main
        id="content"
        className="mx-auto grid max-w-content items-start gap-7 px-4 pt-5 pb-8 sm:px-5 sm:pt-6 min-[1041px]:grid-cols-[minmax(0,360px)_minmax(0,1fr)] min-[1041px]:gap-8"
      >
        <h1 className="sr-only">{t("page.demo.title")}</h1>
        <p className="col-span-full flex max-w-column flex-wrap items-baseline gap-x-4 gap-y-2 font-sans text-body text-text-muted">
          {t("dashboard.demo.lede", { count: DEMO_STACK.length })}
          <HelpPointer href="/">{t("dashboard.demo.install")}</HelpPointer>
        </p>
        <StandingColumn verdict={dashboard.verdict} standing={dashboard.standing} t={t} />
        <Stream stream={dashboard.stream} openWeeks={[]} t={t} locale={locale} />
        <p className="col-span-full mt-7 font-mono text-meta leading-[normal] text-text-faint">
          {windowLine(dashboard.window.start, dashboard.window.end, t)}
        </p>
      </main>
    </>
  );
}
