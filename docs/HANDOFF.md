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

Suite girate **sul runner**, con Supabase locale: `lint` e `typecheck` puliti, `test` 773/773,
`test:integration` 92/92, `build` e `i18n:client-keys --check` verdi, `build:static` verde (2.078
indirizzi nel sitemap, 4.048 documenti), `test:e2e` **268 passati e 1 saltato** (`slack-dialog`, che
si salta da sé senza le credenziali Slack). I due e2e flaky del menu sono passati al primo colpo
questo giro.

### Le tre cose che il giro ha scoperto, e che nel codice non si vedono

1. ⚠️ **Il risparmio di una lingua in meno sta nell'export, non nel sitemap.** La #238 lo motiva con
   "ogni lingua moltiplica le pagine di `pnpm build:static`", e per i **documenti** è vero: ogni
   pagina esce una volta per lingua. Per gli **indirizzi dichiarati** quasi no: 2.078 adesso, contro
   i ~2.100 di prima, perché la pagina Release era già dichiarata solo in inglese dall'emendamento
   del 2026-10-28. Chi misurerà il peso dopo la #214 deve guardare l'export e non il sitemap.
2. ⚠️ **`Intl.PluralRules("it")` ha una forma `many` e l'inglese no**, e `select(1_000_000)` ci cade
   dentro. È l'unica differenza di plurale che resta fra le due lingue, e il test di `translate` che
   provava "i plurali sono quelli della lingua data" ci sta sopra adesso: prima lo provava col
   francese, che conta lo zero come uno. ⚠️ Di conseguenza **i dizionari italiani portano già le
   forme `many`** dove l'inglese ha un contato, perché `dictionaries.test.ts` le pretende lingua per
   lingua: una Sintesi o un messaggio nuovo con `{count}` va scritto con tutte e tre.
3. ⚠️ **La trappola delle tre e2e del sitemap si è ripresentata, e `AMBIENTE.md` aveva ragione**:
   dopo un `catalog:sync` va buttato `.next`, o `seo.spec.ts:79` e le due di `locales.spec.ts` sul
   sitemap leggono la cache ISR presa quando il Catalogo era vuoto. Con `rm -rf .next` e una build
   nuova passano tutte e tre. Non è una regressione, è l'ordine.

### La prossima mossa

**La seconda fetta della #211**: lo strato di lettura e scrittura che sostituisce `supabase-js`,
tabella per tabella, con dentro la regola della Versione in uso che `enforce_current_version` ha
lasciato senza casa. È il pezzo grosso, ed è quello che sblocca i tre criteri di accettazione ancora
aperti — niente import di `@supabase/*`, `test:integration` senza servizi esterni, i comandi verdi
senza Docker. Poi lo script che esporta la produzione nel file iniziale (**le Sintesi sono già
pagate e non si ricomprano**), e infine via la cartella `supabase/` e `deploy-database.yml`. Dopo la
#211: #212 → #213 → #217 → #214 → #218 → #221 → #222 → #216, con la **#222** `ready-for-human` e
una porta a senso unico. ⚠️ La #238 era "Blocked by #211" e l'ha scavalcata su indicazione
dell'utente: non toccava il database, e nessuna PR era in volo.

### Cosa resta a te

1. ⚠️ **La decisione sui cinque documenti, ancora da prendere**, e adesso costa meno: `terms` nomina
   l'accesso con GitHub, `privacy` e `faq` spiegano come si cancella l'account, `contact` dice che è
   un bottone. È prosa legale due volte su cinque, ma in **due lingue** e non in cinque, e **nessuna
   issue aperta la copre**: la #221 è la landing, la #216 i contributi. Serve una issue sua.
2. ⚠️ **Quello che la migrazione della #210 ha aperto in produzione fino alla #222**: il dettaglio è
   nel diario di novembre, sotto il trentaseiesimo giro, e vale parola per parola.
3. ⚠️ **Le suite in locale vogliono un ordine preciso**, e girarle nell'altro verso dà rossi che non
   sono regressioni: l'`integration` **prima** del `catalog:sync`, e `rm -rf .next` dopo. L'ordine
   giusto sta in `AMBIENTE.md`, ed è quello che la CI usa in due lavori separati.
4. **Due cose per la #214**, che è quella che pubblica: ⚠️ `package.json` dice ancora
   `"name": "release-tracker"`, e ⚠️ **non ha nessun `engines`**. La CI si salva da sé perché
   `ci.yml` fissa `node-version: 24`, ma `node:sqlite` su Node 22 gira stampando
   `ExperimentalWarning`, e chi installa l'app non legge `ci.yml`. **La #185** resta valida, col suo
   testo ancora da correggere.
5. ⚠️ **`MIGRATIONS_DIRECTORY` non è ancora provata dopo il bundle** (trentottesimo giro): nessuna
   rotta apre ancora il database, e la prima che lo farà deve verificarlo per prima cosa.
6. **Gli accertamenti di sempre**, in `APERTE.md` e `AMBIENTE.md`. ⚠️ In produzione il Rilevamento è
   fermo dalla #215. ⚠️ **Credito basso: non spendere senza chiedere.**
