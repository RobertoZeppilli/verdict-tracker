import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { serverEnv } from "@/env/server";
import { vaultDir } from "@/lib/run-detection";
import { saveVault } from "@/lib/save-vault";
import { sendWebhookTest } from "@/lib/send-webhook-test";
import { getDatabase } from "@/modules/db/server";
import { getTranslator } from "@/modules/i18n/server";
import { LocalePicker } from "@/modules/i18n/ui";
import { readLastVaultWrite, readNotificationSettings } from "@/modules/notifications/server";
import { NotificationSettings, PreferredLocaleSection, VaultSettings } from "@/modules/notifications/ui";

// Never indexed, so the whole of its metadata is the title in the page's own
// language (ADR 0008). It reads `settings.title`, the key the heading below reads, and not a key of
// its own in `page`: the tab and the heading of this page are one word, and two keys holding it
// would be two places to translate it.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("settings.title"), robots: { index: false } };
}

// What the reader changes about the app. It is a page and not a row of the top bar's menu because
// every preference after the language lands beside it here, while in a panel each one would make
// the panel taller; and that panel's height is the reason the foot had to be rebuilt in two columns
// (`LocalePicker`, the foot variant). The account page it used to sit beside is gone with the login
// (issue #210, ADR 0011), and this is the one page left that belongs to the reader.
// ⚠️ `connection()`: the data file is no request API, and without it the build prerenders this page
// and serves the settings of the build (it was dynamic only by reading `?slack=`, until #218).
export default async function SettingsPage() {
  await connection();
  const t = await getTranslator();
  // Read here and handed down, so the section stays a component that is given what it draws.
  const db = getDatabase();
  const settings = await readNotificationSettings(db, serverEnv.VERDICT_WEBHOOK_URL);

  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto max-w-content px-4 pt-5 pb-8 sm:px-5 sm:pt-6">
        <h1 className="font-mono text-band text-text">{t("settings.title")}</h1>
        <p className="mt-3 max-w-prose font-sans text-body text-text-muted">{t("settings.intro")}</p>
        {/* The three zones of the page (#194, #244): Language, Notifications and Obsidian, each an
            `h2` at Headline scale over its own rule with a sentence of what it is for, `h3` at Title
            scale inside and nothing below that. The `h1` takes Band title scale to stay above them. The two language choices live in
            the same zone because they are the same matter -- one is the language of the page, which
            is an address to follow (ADR 0008), the other the language the channels with no address
            are written in (ADR 0009) -- and their two notes are what keeps them apart. The second
            one stays a component of the Notifications module, which owns the action that saves it. */}
        <section aria-labelledby="language" className="mt-6 max-w-measure border-t border-rule pt-4">
          <h2 id="language" className="font-sans text-headline font-semibold text-text">
            {t("settings.language.title")}
          </h2>
          <p className="mt-2 max-w-prose font-sans text-body text-text-muted">{t("settings.language.intro")}</p>
          <h3 className="mt-6 font-sans text-title font-medium text-text">{t("settings.language.interface")}</h3>
          <p className="mt-2 max-w-prose font-sans text-meta text-text-muted">
            {t("settings.language.note")}
          </p>
          <LocalePicker variant="page" />
          <PreferredLocaleSection
            saved={settings.preferredLocale}
            connected={settings.slackHint !== null}
            t={t}
          />
        </section>
        <NotificationSettings
          preferences={settings.preferences}
          slackHint={settings.slackHint}
          slackFromEnv={settings.slackFromEnv}
          test={sendWebhookTest}
          t={t}
        />
        <VaultSettings
          path={vaultDir() ?? null}
          fromEnv={serverEnv.VERDICT_VAULT_DIR !== undefined}
          last={readLastVaultWrite(db)}
          save={saveVault}
          t={t}
        />
      </main>
    </>
  );
}
