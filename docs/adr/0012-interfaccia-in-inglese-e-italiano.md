# Interfaccia in inglese e italiano

Deciso dall'utente il **2026-11-15**. L'interfaccia di Verdict si legge in **inglese e italiano**.
**Francese, spagnolo e tedesco escono** dal selettore, dal repository e dalla vetrina. Questo ADR
**supera l'ADR [0008](./0008-interfaccia-in-cinque-lingue.md)** nella sola parte che contava le
lingue: tutto il resto di quell'ADR resta in vigore, e qui sotto è elencato riga per riga perché
nessuno debba dedurlo.

Il motivo è il costo di ogni lingua, e si paga due volte. **Ogni lingua moltiplica le pagine della
vetrina**: `pnpm build:static` esporta un documento per pagina per lingua, e i ~2.100 indirizzi che
il sitemap dichiara sono già il risultato di un taglio misurato (ADR 0008, emendamento del
2026-10-28, e `docs/handoff/PESO.md`). E **ogni lingua moltiplica le stringhe**: una frase nuova si
scriveva cinque volte, perché il test dei dizionari pretende la parità e la pretende giustamente.
Due lingue sono il minimo che tiene in piedi la ragione per cui l'app è tradotta: l'inglese perché è
la lingua in cui le stringhe nascono e quella di chi la troverà su GitHub, l'italiano perché è la
lingua di chi la scrive e la sola, insieme all'inglese, che l'utente rivede.

⚠️ **Le tre lingue che escono non erano riviste da madrelingua.** L'ADR 0008 le aveva fatte entrare
con quella riserva scritta — "entrano non rivisti da madrelingua e vanno rivisti prima del lancio" —
e il lancio è il 20 gennaio 2027. La revisione non c'è stata e non ha più un motivo per esserci:
quello che esce non è lavoro verificato, è lavoro che aspettava una verifica che nessuno avrebbe
fatto. Le loro parole restano nella storia di `main` e nel diario, non in una tabella di
`GLOSSARY.md` che qualcuno riaprirebbe come se valesse ancora.

## Cosa dell'ADR 0008 resta vero

- Le **stringhe nascono in inglese** in `src/modules/i18n`, e ogni altra lingua è una traduzione di
  quella base, versionata nel repository e mai generata a runtime: niente chiamate AI, nessuna spesa.
- La lingua sta **nell'URL e l'inglese non ha prefisso**: `/technologies/vite` è l'inglese canonico e
  l'indirizzo già indicizzato, `/it/technologies/vite` l'italiano. Un cookie di lingua resta escluso
  per la ragione di allora.
- La **grammatica del prodotto** non si traduce in nessuna lingua: `featured`, `notable`, `digest`,
  `preview` e i prefissi `breaking[n]:`, `note:`, `help:`, `warning:`, `ok:` sono gli stessi segni
  che compaiono dentro le Sintesi.
- I **nomi del glossario si traducono dentro le frasi** con la parola di quella lingua (in italiano
  Tecnologia, non `Technology`) e restano inglesi solo come identificatori di codice e database: è la
  correzione del 2026-10-16, e vale uguale su due lingue.
- **Note di rilascio e Sintesi non si traducono**, quindi una pagina Release è mista e lo dichiara.
- Il **selettore sta nel piede e nella pagina Settings**, un albero di rotte solo sotto
  `src/app/[locale]`, il proxy che riscrive l'inglese senza cambiare l'indirizzo visto, il catch-all
  `[...rest]` che tiene una 404 dentro la lingua.
- L'**emendamento del 2026-10-28** resta parola per parola: la pagina Release è dichiarata solo nella
  lingua di default, senza `alternates.languages`, perché il suo corpo è lo stesso in ogni lingua. Da
  qui quel corpo è lo stesso in due lingue invece che in cinque, e l'argomento non cambia.

⚠️ **Niente negoziazione della lingua del browser**, e non è una cosa che questo ADR toglie: non c'è
mai stata. Chi arriva su un indirizzo senza prefisso legge l'inglese, qualunque lingua abbia il suo
browser, e l'italiano lo sceglie dal selettore. Era vero con cinque lingue ed è vero con due; la
conseguenza nuova è solo che un lettore francese adesso ricade sull'inglese invece di trovare il
francese, che è lo scambio che questo ADR accetta.

## Gli indirizzi che restano in giro

La vetrina pubblica è servita da Vercel come file (#215), e i suoi indirizzi sono stati dichiarati a
un motore di ricerca per settimane: `/fr`, `/es` e `/de` e tutto quello che ci sta sotto. Un
indirizzo pubblicato non si cancella, si **reindirizza**: `vercel.json` guadagna, accanto ai due che
già portano `/en` alla radice, **due redirect permanenti (308) per ciascuna delle tre lingue** —
il prefisso nudo e `:path*` — verso la stessa pagina senza prefisso, cioè l'inglese. Un 404 avrebbe
buttato l'autorità di quegli indirizzi e avrebbe accolto un lettore con una porta chiusa; un 308
dice a un crawler che quella pagina ora è questa.

⚠️ **Il proxy non cambia**, e la differenza fra i due casi è la ragione. `src/proxy.ts` sta davanti
all'app che si installa, e un'app installata non ha indirizzi vecchi da salvare: nasce il giorno in
cui qualcuno la scarica, con due lingue e nessuno che le abbia mai linkato un `/de`. Lì `/de/faq` è
un percorso che non combacia, e la risposta giusta è la 404 del guscio che il catch-all già dà.

## Cosa resta fuori

- **Riaprire il numero delle lingue** non è una cosa da fare due volte. Aggiungerne una è ancora
  possibile — `LOCALES`, un dizionario, il test della parità — ma chi la aggiunge paga le pagine
  della vetrina e si prende la revisione da madrelingua, che è il pezzo che è mancato alle tre che
  escono.
- Le **traduzioni delle Sintesi** restano fuori dall'MVP (`docs/DECISIONI.md`), per il motivo di
  prima: ogni lingua sarebbe una chiamata ad Anthropic in più per Release.
