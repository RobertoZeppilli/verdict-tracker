# Handoff, verdict-tracker: implementazione delle issue

Parla con l'utente **in italiano**. Progetto in `C:\Users\rober\progetti\release-tracker`, repository
git con remote **pubblico** su **https://github.com/RobertoZeppilli/verdict-tracker** (branch `main`, `gh`
autenticato). Next.js 16 + Tailwind 4 + Vitest; comandi in `CLAUDE.md`.
Produzione: **https://verdict-tracker.vercel.app**, una **vetrina statica** senza server (#215).
⚠️ **Dal 2026-11-10 il prodotto non si vende**: open source e self-hosted, ADR 0011.

## Questo file sta sotto le 100 righe, per scelta dell'utente (2026-10-10)

Qui c'è **solo lo stato vivo**. Il resto è stato spostato parola per parola, non riassunto, in quattro
file che si aprono **solo quando servono**: `docs/handoff/INDICE.md` (l'indice delle sessioni, col
diario in `docs/handoff/<anno>-<mese>.md`, **da non leggere per intero**), `docs/handoff/APERTE.md`
(strade aperte, lo stage non deciso, code e debiti, contesto della #14) e `docs/handoff/AMBIENTE.md`
(Docker e il PATH, il dev server unico sulla 3000, le due shell, i token, preferenze e skill).
Il peso delle pagine misurato prima del codice, con la procedura per il "dopo", sta in
`docs/handoff/PESO.md`.
Altrove: **PRD issue #1**, `PRODUCT.md`, `GLOSSARY.md`, `docs/DECISIONI.md`, `docs/adr/0001…0012`,
`DESIGN.md` e i mock in `design/mocks/`, **ADR 0012** per le due lingue (supera la 0008, che vale
per tutto il resto dell'interfaccia tradotta) e **ADR 0011** per la svolta open source, che supera
0004, 0009 e 0010 e cambia il canale dell'0007.

⚠️ **Prima di dare qualcosa per non deciso, cercalo là**: `grep -rn "<parola>" docs/handoff/`.
⚠️ **Le issue erano sospese e l'utente le ha rilanciate il 2026-10-15** chiedendo la #131: la
sospensione è finita, ma vale sempre la regola di chiedere prima di passare a una issue nuova.

**Come si tiene.** Lo stato nuovo si scrive qui sotto; quando quello di prima diventa storia, **si
sposta parola per parola** in cima al file del suo mese, con un titolo `##` proprio, e si aggiunge la
riga in `INDICE.md`. Niente riassunti: un riassunto è dove si perde la ragione per cui una cosa era
stata decisa. Se questo file supera le 100 righe, **si sposta, non si taglia**.

## Stato

**Da dove ripartire (trentanovesimo giro, 2026-11-15): la #238 è finita e verde, e la PR è pronta da
guardare.** Branch `238-inglese-e-italiano`. L'interfaccia parla **inglese e italiano**: francese,
spagnolo e tedesco sono fuori dal selettore, dai dizionari e dalla vetrina, con l'**ADR 0012** che
supera la 0008 nella sola parte che conta le lingue e sei **308** in `vercel.json` che tengono in
piedi `/fr`, `/es` e `/de`. Il modulo `i18n` scende a due, `GLOSSARY.md` perde la tabella fr/es/de,
e il `check` su `preferred_locale` dello schema SQLite scende con loro, perché `localeSchema` è lo
schema con cui quella colonna viene riletta.

Suite girate **sul runner**, con Supabase locale: `lint` e `typecheck` puliti, `test` 776/776,
`test:integration` 93/93, `build` e `i18n:client-keys --check` verdi, `build:static` verde (2.078
indirizzi nel sitemap, 4.048 documenti), `test:e2e` 266 al primo colpo, **2 flaky** (i due del menu,
che vengono dalla #210) e 1 saltato (`slack-dialog`, che si salta da sé senza le credenziali Slack).

### Le quattro cose che il giro ha scoperto, e che nel codice non si vedono

1. ⚠️ **Due prove dell'`integration` sono flaky anche su `main`**, e non solo "nell'ordine
   sbagliato" come diceva `AMBIENTE.md`: cinque corse `db:reset` + `test:integration` su `main`,
   ciascuna da sola, hanno dato due verdi, due rossi da uno e un rosso da due. Sempre
   `paged-reads.test.ts:113`, `expected 1201 to be 1200`, perché quella prova conta **tutto** il
   database e l'ordine dei file che Vitest sceglie cambia fra una corsa e l'altra. La seconda corsa
   di seguito passa sempre. Misurato e scritto in `AMBIENTE.md`: **chi lo vede lo rifaccia girare
   prima di dare la colpa al proprio diff.**
2. ⚠️ **L'enum Postgres `public.locale` nomina ancora cinque lingue, e nessuno ha riscritto le
   righe.** `readNotificationSettings` e il job di Slack facevano `.parse` su quella colonna, quindi
   una riga con `es` — e la suite di integrazione ne lasciava una — chiudeva `/settings`. Adesso le
   due letture passano da `storedLocaleSchema`, che legge una lingua uscita come il default. **Lo
   scrittore della #211 tenga la stessa distinzione**: severo in scrittura, tollerante in lettura.
3. ⚠️ **Il risparmio di una lingua in meno sta nell'export, non nel sitemap.** La #238 lo motiva con
   "ogni lingua moltiplica le pagine di `pnpm build:static`", e per i **documenti** è vero: ogni
   pagina esce una volta per lingua. Per gli **indirizzi dichiarati** quasi no: 2.078 adesso, contro
   i ~2.100 di prima, perché la pagina Release era già dichiarata solo in inglese dall'emendamento
   del 2026-10-28. Chi misurerà il peso dopo la #214 deve guardare l'export, non il sitemap.
4. ⚠️ **`Intl.PluralRules("it")` ha una forma `many` e l'inglese no**, e `select(1_000_000)` ci cade
   dentro: è l'unica differenza di plurale che resta fra le due lingue, e il test di `translate` ci
   sta sopra adesso (prima provava col francese, che conta lo zero come uno). Di conseguenza **i
   dizionari italiani portano già le forme `many`** dove l'inglese ha un contato, perché
   `dictionaries.test.ts` le pretende: un messaggio nuovo con `{count}` va scritto con tutte e tre.

### La prossima mossa

**La seconda fetta della #211**: lo strato di lettura e scrittura che sostituisce `supabase-js`,
tabella per tabella, con dentro la regola della Versione in uso che `enforce_current_version` ha
lasciato senza casa. È il pezzo grosso, e sblocca i tre criteri di accettazione ancora aperti —
niente import di `@supabase/*`, `test:integration` senza servizi esterni, i comandi verdi senza
Docker. Poi lo script che esporta la produzione nel file iniziale (**le Sintesi sono già pagate e
non si ricomprano**), e infine via la cartella `supabase/` e `deploy-database.yml`. Dopo la #211:
#212 → #213 → #217 → #214 → #218 → #221 → #222 → #216, con la **#222** `ready-for-human` e una
porta a senso unico. ⚠️ La #238 era "Blocked by #211" e l'ha scavalcata su indicazione dell'utente:
non toccava il database, e nessuna PR era in volo.

### Cosa resta a te

1. ⚠️ **La decisione sui cinque documenti, ancora da prendere**, e adesso costa meno: `terms` nomina
   l'accesso con GitHub, `privacy` e `faq` spiegano come si cancella l'account, `contact` dice che è
   un bottone. Prosa legale due volte su cinque, ma in **due lingue**, e **nessuna issue aperta la
   copre** (#221 è la landing, #216 i contributi): serve una issue sua.
2. ⚠️ **Quello che la migrazione della #210 ha aperto in produzione fino alla #222**: il dettaglio è
   nel diario di novembre, sotto il trentaseiesimo giro, e vale parola per parola.
3. ⚠️ **Le suite in locale vogliono un ordine preciso** — `integration` prima del `catalog:sync`,
   `rm -rf .next` dopo — e i rossi che dà l'ordine sbagliato sono elencati in `AMBIENTE.md`.
4. **Due cose per la #214**, che è quella che pubblica: ⚠️ `package.json` dice ancora
   `"name": "release-tracker"`, e ⚠️ **non ha nessun `engines`**. La CI si salva da sé perché
   `ci.yml` fissa `node-version: 24`, ma `node:sqlite` su Node 22 gira stampando
   `ExperimentalWarning`, e chi installa l'app non legge `ci.yml`. **La #185** resta valida, col suo
   testo ancora da correggere.
5. ⚠️ **`MIGRATIONS_DIRECTORY` non è ancora provata dopo il bundle** (trentottesimo giro): nessuna
   rotta apre ancora il database, e la prima che lo farà deve verificarlo per prima cosa.
6. **Gli accertamenti di sempre**, in `APERTE.md` e `AMBIENTE.md`. ⚠️ In produzione il Rilevamento è
   fermo dalla #215. ⚠️ **Credito basso: non spendere senza chiedere.**
