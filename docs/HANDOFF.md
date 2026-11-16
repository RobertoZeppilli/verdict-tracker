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

**Da dove ripartire (quarantunesimo giro, 2026-11-16): la seconda fetta della #211 è finita nel
codice, in commit `WIP` sul branch `211-strato-sqlite` (solo locali, quattro).** Niente più
`@supabase/*` in `src/`, `tests/` e `scripts/`; lint, typecheck, `pnpm build`, Vitest (855) ed e2e
contro la build (268 verdi, 1 saltato) passano **senza Docker**. Il quarantesimo giro è nel diario
di novembre.

### Tre cose cambiate fuori dal codice, il 2026-11-15 (valgono ancora)

1. ⚠️ **Vercel non costruisce niente** (`"git": { "deploymentEnabled": false }` in `vercel.json`,
   PR #245). Il deploy unico, a conversione finita, è il commit che toglie quella riga. Un branch
   tagliato da un `main` più vecchio della #245 farebbe una preview: ribasarlo prima del push.
2. ⚠️ **`deploy-database.yml` è disattivato** a mano; si riattiva con `gh workflow enable`, la #211
   lo cancella.
3. **Cletus è fuori dal repository**; resta sul remote `cletus/scarica-le-istruzioni`, da cancellare.

### Cosa ha fatto il quarantunesimo giro

- Dashboard e campanella su SQLite; la campanella passa da `/api/notifications` (come `/api/follows`,
  solo JSON). Via `src/lib/supabase*.ts` e `supabase-rows.ts`.
- Test d'integrazione: un SQLite in memoria per file (`tests/integration/database.ts`). Cancellati
  `public-content` e `paged-reads`: provavano i grant RLS e il tetto di PostgREST.
- E2e: fixture su SQLite, app e test su `VERDICT_DATA_DIR=.e2e-data` (in `.gitignore`).
- CI: il job `integration` non avvia più Supabase. ⚠️ **Non ancora girato**: si vede al primo push.
- ⚠️ **Due trappole pagate**: Turbopack rifiuta `new URL("../migrations/", import.meta.url)`, quindi
  `MIGRATIONS_DIRECTORY` viene da `process.cwd()` (il launcher della #214 deve partire dalla radice);
  e una pagina che legge solo `getDatabase()` **diventa statica** alla build: `/technologies` vuole
  `await connection()`, che c'è. Una pagina nuova sul database deve fare lo stesso.

### Giro quarantadue (2026-11-16): #211 mergiata (PR #247), #212 in PR

- **#211 chiusa.** Il file esportato dalla produzione è in `~/verdict-export/verdict.db`, fuori dal
  repository: 37 Tecnologie, 2173 Release, 142 Sintesi `ready`, 44 `pending` mai generate. Serve
  alla #214 (file iniziale) e alla #222 (verifica prima di spegnere Supabase). **Non cancellarlo.**
- **#212 in PR** dal branch `212-messages-api`: Messages API, Sintesi nel giro del Rilevamento,
  stato "manca la chiave", migrazione `0002` che toglie `batch_id` (dal file esportato in poi lo
  schema non si modifica più al suo posto, si aggiunge un file).
- **Prova vera riuscita** (`pnpm summary:try nodejs 26.13.0`, su una copia del file esportato). Una
  prima prova con la chiave scaduta ha scoperto un bug, corretto: 401/403 rimettono in attesa invece
  di far fallire la coda.
- Il branch locale `212-sintesi-su-richiesta` è vuoto, da cancellare.

Dopo la #212: #213 → #217 → #214 → #218 → #221 → #222 → #216, con la **#222**
`ready-for-human` e una porta a senso unico.

### Gli e2e in locale, adesso

`VERDICT_DATA_DIR=.e2e-data` su **tutti e tre**: `pnpm catalog:sync` (con `set -a; . ./.env.local`
per il `GITHUB_TOKEN`, o GitHub risponde 403), `rm -rf .next && pnpm build` (la sitemap si prerenderizza
dal file), `pnpm start --port 3100`; poi `E2E_PORT=3100 pnpm test:e2e`. Il Supabase locale non serve più.

### Cosa resta a te

1. ⚠️ **La decisione sui cinque documenti**: la issue è la **#236**, il testo lo decidi tu.
2. ⚠️ **Quello che la migrazione della #210 ha aperto in produzione fino alla #222**: nel diario di
   novembre, sotto il trentaseiesimo giro.
3. **Due cose per la #214**: `package.json` dice ancora `"name": "release-tracker"` e non ha
   `engines` (Node 22 stampa `ExperimentalWarning` su `node:sqlite`). **La #185** resta valida.
4. **Gli accertamenti di sempre**, in `APERTE.md` e `AMBIENTE.md`. ⚠️ In produzione il Rilevamento è
   fermo dalla #215. ⚠️ **Credito basso: non spendere senza chiedere.**
