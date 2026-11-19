import type { Metadata } from "next";
import { Filled, LocaleLink as Link } from "@/modules/i18n/ui";
import { DocumentPage, DocumentSection } from "@/components/document-page";
import { CONTACT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/metadata";
import { currentLocale, getTranslator } from "@/modules/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();

  return pageMetadata({
    title: t("page.terms.title"),
    description: t("page.terms.description"),
    path: "/terms",
    type: "website",
    locale: await currentLocale(),
  });
}

// Issue #131: every claim on this page is one the code makes true, and the page says nothing the
// app does not do. The follow limit was the clause that cost the most care here, because it was a
// number: it left with the Plan (issue #209, ADR 0011), so there is no figure left to keep true.
// ⚠️ `governing`: the two translations are not two contracts. The English one holds, and the page
// says so at the foot of itself rather than leaving a reader to wonder.
export default async function TermsPage() {
  const t = await getTranslator();

  return (
    <DocumentPage
      title={t("page.terms.title")}
      updated="2026-11-19"
      lede={t("terms.lede")}
      governing
    >
      <DocumentSection title={t("terms.service.title")}>
        <p>{t("terms.service.body")}</p>
      </DocumentSection>

      <DocumentSection title={t("terms.catalog.title")}>
        <p>{t("terms.catalog.body")}</p>
      </DocumentSection>

      <DocumentSection title={t("terms.summaries.title")}>
        <p>{t("terms.summaries.body")}</p>
        <p>{t("terms.summaries.check")}</p>
      </DocumentSection>

      <DocumentSection title={t("terms.data.title")}>
        <p>
          <Filled
            text={t("terms.data.body")}
            nodes={{
              privacy: (
                <Link href="/privacy" className="text-link">
                  {t("doc.link.privacy")}
                </Link>
              ),
            }}
          />
        </p>
      </DocumentSection>

      <DocumentSection title={t("terms.conduct.title")}>
        <p>{t("terms.conduct.body")}</p>
      </DocumentSection>

      <DocumentSection title={t("terms.warranty.title")}>
        <p>{t("terms.warranty.body")}</p>
      </DocumentSection>

      <DocumentSection title={t("terms.changes.title")}>
        <p>
          <Filled
            text={t("terms.changes.body")}
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
