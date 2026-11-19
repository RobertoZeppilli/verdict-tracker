import type { Metadata } from "next";
import { Filled } from "@/modules/i18n/ui";
import { DocumentPage, DocumentSection } from "@/components/document-page";
import { CONTACT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/metadata";
import { currentLocale, getTranslator } from "@/modules/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();

  return pageMetadata({
    title: t("page.privacy.title"),
    description: t("page.privacy.description"),
    path: "/privacy",
    type: "website",
    locale: await currentLocale(),
  });
}

// The table of rows held about a person left with the account (issue #236): the data is two files on
// the reader's computer, and `privacy.held.intro` names them. A file added next to them, or a new
// service the app calls, is a sentence to change here.
export default async function PrivacyPage() {
  const t = await getTranslator();

  return (
    <DocumentPage
      title={t("page.privacy.title")}
      updated="2026-11-19"
      lede={t("privacy.lede")}
      governing
    >
      <DocumentSection title={t("privacy.held.title")}>
        <p>{t("privacy.held.intro")}</p>
      </DocumentSection>

      <DocumentSection title={t("privacy.prompt.title")}>
        <p>{t("privacy.prompt.body")}</p>
        <p>{t("privacy.prompt.images")}</p>
      </DocumentSection>

      <DocumentSection title={t("privacy.who.title")}>
        <p>
          <strong className="font-semibold text-text">GitHub</strong> {t("privacy.who.github")}
        </p>
        <p>
          <strong className="font-semibold text-text">npm</strong> {t("privacy.who.npm")}
        </p>
        <p>
          <strong className="font-semibold text-text">Vercel</strong> {t("privacy.who.vercel")}
        </p>
        <p>
          <strong className="font-semibold text-text">Anthropic</strong> {t("privacy.who.anthropic")}
        </p>
      </DocumentSection>

      <DocumentSection title={t("privacy.cookies.title")}>
        <p>{t("privacy.cookies.body")}</p>
        <p>{t("privacy.cookies.what")}</p>
      </DocumentSection>

      <DocumentSection title={t("privacy.keep.title")}>
        <p>{t("privacy.keep.body")}</p>
        <p>{t("privacy.keep.notifications")}</p>
        <p>{t("privacy.keep.after")}</p>
      </DocumentSection>

      <DocumentSection title={t("privacy.reach.title")}>
        <p>
          <Filled
            text={t("privacy.reach.body")}
            nodes={{
              mail: (
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-link">
                  {CONTACT_EMAIL}
                </a>
              ),
            }}
          />
        </p>
      </DocumentSection>
    </DocumentPage>
  );
}
