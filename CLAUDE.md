@AGENTS.md

# release-tracker

App **open source** che traccia le Release delle Tecnologie di un Catalogo curato e ne genera
Sintesi con l'AI. Gira sul computer di chi la usa (`npx verdict-tracker`), con la sua chiave
Anthropic e i dati in un file SQLite. Non si vende, non ha account, lo Sviluppatore è uno solo
(**ADR 0011**). Parla con l'utente **in italiano**.

⚠️ **Conversione in corso**, issue in quest'ordine: #212 → #213 → #217 → #214 → #218 → #221 → #222 → #216.
La produzione è una **vetrina statica** (#215): `pnpm build` è l'app che si installa,
`pnpm build:static` il sito che Vercel serve. Vercel non fa deploy (`deploymentEnabled: false`)
fino alla fine della conversione. Il database di produzione non esiste più (#222): i dati iniziali
sono il `verdict.db` allegato alla Release di GitHub.

## Da dove partire

- **Dalla issue** (`gh issue view N`; PRD nella #1). `ready-for-agent` = in autonomia,
  `ready-for-human` = fermati e chiedi. Rispetta i blocchi (solo dipendenze native di GitHub, mai righe "Blocked by"
  nel corpo) e i criteri di accettazione.
- Quando servono: `GLOSSARY.md`, `docs/DECISIONI.md`, `docs/adr/`, `DESIGN.md` e i mock in
  `design/mocks/`. Prima di dare qualcosa per non deciso: `gh search issues "<parola>" --repo
  RobertoZeppilli/verdict-tracker` (issue e commenti sono la storia del lavoro).
- `docs/` è in `.gitignore`: un documento nuovo lì resta in locale. Per versionarlo (un ADR nuovo)
  serve `git add -f`.

## Regole

- **Lingua**: documenti e dominio in italiano; codice e database in inglese, con i soli nomi della
  tabella in `GLOSSARY.md` (Rilevanza = `Significance`, mai `priority`).
- **Interfaccia in inglese e italiano** (ADR 0012): le stringhe nascono in inglese in
  `src/modules/i18n`; la grammatica del prodotto (`featured`, `notable`, `digest`, `preview`,
  `note:` e gli altri prefissi) resta inglese in ogni lingua; i nomi del glossario nelle frasi si
  traducono (Tecnologia, non `Technology`); Note di rilascio e Sintesi non si traducono.
- **Moduli** (ADR 0006): `src/modules/<modulo>/{domain,server,ui}`, import tra moduli solo
  dall'indice; `domain` è TypeScript puro e testato.
- **Tipi** dagli schemi Zod; niente `any` né cast non validati; file sotto ~200 righe.
- **shadcn/ui**: solo primitivi, ristilizzati sui token di `DESIGN.md`; mai card, badge, ombre o
  raggi di default.
- **Nessuna chiamata esterna dal client**: GitHub, npm e Anthropic solo dal server.
- **Accessibilità** WCAG 2.2 AA; dark mode di default.
- Rispetta "Fuori dall'MVP" in `docs/DECISIONI.md`. Una regola di dominio nuova va fissata in
  `GLOSSARY.md` o in un ADR prima di codificarla.
- **Schema**: le migrazioni sono `.sql` numerati in `src/modules/db/migrations/`, applicati
  all'apertura. Esiste un file dati vero, quindi una modifica è sempre un file nuovo, mai un edit
  di uno vecchio.

## Flusso

- Un branch per issue; nella PR `Closes #N` **in inglese**, il resto in italiano.
- Commit, push, PR e creazione di issue **solo dopo conferma dell'utente**. Eccezione: dentro tai
  (worktree su un branch `tai/<n>`) committi senza chiedere; push e PR li fa tai.
- Dai consigli con una raccomandazione motivata.

## Comandi

- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` (unitari) ·
  `pnpm test:integration` (SQLite in memoria) · `pnpm test:e2e` (Playwright). Docker non serve.
- `pnpm build:static`: la vetrina in `out/` (~10 min).
- Dati: `~/.verdict/verdict.db` (`%LOCALAPPDATA%\verdict` su Windows), spostabile con
  `VERDICT_DATA_DIR`. `pnpm catalog:sync` lo riempie con Catalogo e Release.
- `pnpm summary:try <slug> <version>`: una Sintesi vera, costa qualche centesimo. Chiedi prima.
- `pnpm summaries:pending`: tutte le Sintesi `pending` del file (al massimo `SUMMARY_MAX_COUNT`, 100).
  Solo per sviluppo: la vetrina non scrive Sintesi (#283). Costa, chiedi prima.
- Ambiente: `.env.example` → `.env.local`, schema Zod in `src/env/`.
- Next.js 16: leggi `AGENTS.md` e `node_modules/next/dist/docs/` prima di usare API di Next.
