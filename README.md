# release-tracker

Traccia le Release delle Tecnologie di un Catalogo curato e ne genera Sintesi con l'AI.
Prodotto e dominio: `PRODUCT.md`, `GLOSSARY.md`; decisioni: `docs/DECISIONI.md`, `docs/adr/`.

## Usarlo

Serve Node.js 24 o successivo. Nient'altro: niente git, niente build, niente Docker.

```sh
npx verdict-tracker
```

Il comando avvia l'app su `http://localhost:7357` (o su un'altra porta libera, se quella è
occupata) e apre il browser sulla Dashboard. Risponde solo da questo computer, mai dalla rete.
Si ferma con Ctrl+C.

- **I dati** stanno in `~/.verdict/` su Mac e Linux, in `%LOCALAPPDATA%\verdict` su Windows; con
  `VERDICT_DATA_DIR` li metti dove vuoi. Al primo avvio il comando scarica da GitHub il file
  iniziale, `verdict.db`, con il Catalogo, le Release e le Sintesi già scritte. Dal secondo avvio
  usa quello che c'è e non scarica più niente.
- **La chiave Anthropic** serve per le Sintesi delle Release nuove. Mettila in un file `.env` nella
  cartella dei dati, accanto a `verdict.db`:

  ```sh
  ANTHROPIC_API_KEY=sk-ant-...
  ```

  Oppure impostala nella shell prima del comando: la variabile della shell vale più del file. Un
  `GITHUB_TOKEN` nello stesso file alza il limite di GitHub da 60 richieste l'ora.
- **Su un altro computer** ti basta copiare `verdict.json` (sotto) nella cartella dei dati di là,
  prima o dopo il primo avvio: le Tecnologie che segui tornano al riavvio. `verdict.db` non serve
  copiarlo, si riscarica.

### Gli avvisi ad app chiusa: Slack o Discord

Mentre l'app è aperta, la campanella ti dice cosa è cambiato da quando hai guardato l'ultima volta.
Per sapere delle Release nuove senza aprirla, fai girare Verdict una volta al giorno su GitHub
Actions, in un repository tuo, con la tua chiave e il tuo webhook. Sui repository pubblici i runner
sono gratis.

1. Crea un repository (anche privato) e mettici alla radice il tuo `verdict.json`.
2. Copia [`examples/verdict-notify.yml`](examples/verdict-notify.yml) in
   `.github/workflows/verdict.yml`. Non va cambiato niente.
3. Nei segreti del repository (Settings, Secrets and variables, Actions) aggiungi
   `VERDICT_WEBHOOK_URL`, l'indirizzo di un incoming webhook di Slack o di Discord, e se vuoi le
   Sintesi `ANTHROPIC_API_KEY`.
4. Lancialo a mano la prima volta dalla scheda Actions (Run workflow) per vedere arrivare il messaggio.

Il workflow lancia `npx verdict-tracker sync --notify`, che fa il giro del Refresh senza browser e
manda al webhook un messaggio con Tecnologia, Versione, Rilevanza, Intervento richiesto e il link
alla pagina della Release. Senza chiave le Release nuove arrivano lo stesso, con la Sintesi in
attesa. `verdict.db` resta nella cache di Actions, così ogni Sintesi si paga una volta. Ogni giorno
il workflow committa `verdict-sync.json`, con quello che ha già mandato: se la cache scade, niente
arriva due volte. Il commit tiene anche acceso il cron, che GitHub ferma dopo 60 giorni senza
attività.

Sul tuo computer lo stesso comando, con `VERDICT_WEBHOOK_URL` nel `.env` della cartella dei dati,
manda il messaggio subito.

## Sviluppo locale

Servono Node 24 e pnpm. I dati stanno in un file SQLite, `~/.verdict/verdict.db`
(`%LOCALAPPDATA%\verdict` su Windows, spostabile con `VERDICT_DATA_DIR`), creato al primo avvio.

```sh
pnpm install
cp .env.example .env.local
pnpm catalog:sync              # il Catalogo e le sue Release nel file dei dati
pnpm dev
```

Controlli: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`.
Nuova migrazione: un file `.sql` numerato in `src/modules/db/migrations/`, applicato al prossimo avvio.

### Le Tecnologie che segui: `verdict.json`

Accanto a `verdict.db` c'è `verdict.json`, con le Tecnologie che segui e la Versione in uso di
ognuna. Il database si può cancellare: `pnpm catalog:sync` lo ricrea e le Tecnologie seguite tornano
da questo file. Il file si può tenere nei dotfiles, in un repository o in una cartella sincronizzata.

```json
{
  "follows": {
    "next": { "currentVersion": "16.0.0", "declaredAt": "2026-11-01T10:00:00.000Z" },
    "vite": {}
  }
}
```

- Le chiavi sono gli slug del Catalogo, i nomi dei file in `catalog/`.
- `currentVersion` è facoltativa. `declaredAt` dice da quando la dichiari; se la scrivi a mano senza
  data, vale il giorno in cui l'app la legge.
- Il file comanda: all'avvio l'app segue quello che c'è scritto e smette di seguire il resto. Seguire
  o smettere dall'interfaccia riscrive il file.
- Uno slug che non è nel Catalogo, una Tecnologia ritirata o una Versione in uso non valida vengono
  segnalati nel terminale e saltati, senza fermare l'avvio. Uno slug sconosciuto resta nel file.
- Se il file non è JSON valido l'app non lo tocca, lo segnala e usa quello che ha nel database.

## Pubblicare una versione

`pnpm pack:cli` costruisce in `dist/cli` il pacchetto `verdict-tracker`: la build standalone di
Next, il comando in `cli/` e un `package.json` senza dipendenze. Il workflow `Release` lo prova su
Linux, Windows e macOS a ogni PR che lo tocca, e al tag lo pubblica:

```sh
# alza "version" in package.json, poi
git tag v0.2.0 && git push origin v0.2.0
```

Al tag il workflow prende `verdict.db` dalla Release precedente, ci aggiunge le Release nuove del
Catalogo, lo allega alla Release del tag e solo dopo pubblica su npm. Serve il segreto `NPM_TOKEN`.

**La prima volta** non c'è una Release precedente: si crea a mano, col file esportato dalla
produzione, prima di spingere il tag (che `gh release create` crea da sé):

```sh
node -e "new (require('node:sqlite').DatabaseSync)(process.argv[1]).exec('pragma wal_checkpoint(truncate); pragma journal_mode = delete')" ~/verdict-export/verdict.db
gh release create v0.1.0 ~/verdict-export/verdict.db --target main --title v0.1.0 --notes "Prima versione."
```

## Deploy

Su **Vercel** (Hobby) gira solo la **vetrina statica**, `pnpm build:static`. Vercel non costruisce dai
push: la pubblica il workflow `Showcase` (`.github/workflows/showcase.yml`).

- **Vetrina**: una volta al giorno, a ogni push su `main` che la tocca o a mano (Actions → Showcase →
  "Run workflow"), il workflow scarica il file dati dell'ultima Release di GitHub, ci fa sopra
  `pnpm catalog:sync` (Rilevamento e Tecnologie nuove, senza Sintesi), costruisce e pubblica in
  produzione. Una PR che tocca la vetrina riceve un'anteprima. Segreti: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`.
- **Catalogo**: un file `catalog/<slug>.json` per Tecnologia, validato da `pnpm test`. Togliere un file
  ritira la Tecnologia, non la cancella. Il sync non gira mai nella build di Vercel: le anteprime
  condividono il database di produzione. In locale: `pnpm catalog:sync` con le variabili di `.env.local`.

### Configurazione manuale (una volta)

1. **Supabase**: progetto in regione Frankfurt con Data API attiva, "Automatically expose new tables" e
   "Enable automatic RLS" disattivati (permessi e RLS li definiscono le migrazioni).
2. **Vercel**: progetto importato da GitHub, senza l'integrazione Supabase del Marketplace. Variabili
   d'ambiente per Production e Preview:

   | Variabile | Valore |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | URL di produzione, senza `/` finale |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (`sb_publishable_…`) |
   | `SUPABASE_SECRET_KEY` | Stessa pagina (`sb_secret_…`), marcata **Sensitive**; solo lato server |

3. **GitHub** → Settings → Secrets and variables → Actions:

   | Segreto | Valore |
   |---|---|
   | `SUPABASE_DB_PASSWORD` | Password del database (reimpostabile da Project Settings → Database); le migrazioni si collegano con questa, non con un access token |
   | `SUPABASE_PROJECT_ID` | Project ref, l'ID nell'URL della dashboard |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys (`sb_secret_…`), per il sync del Catalogo |

Nessun segreto sta nel repository: `.env.local` è ignorato da git e la CI usa valori segnaposto.
