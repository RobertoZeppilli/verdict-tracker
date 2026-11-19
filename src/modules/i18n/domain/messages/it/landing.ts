// La landing, in italiano. È l'unica pagina scritta in prosa e non in etichette, quindi è anche la
// sola dove la traduzione è una riscrittura: le frasi sono tenute alla stessa misura dell'inglese,
// perché la pagina è una colonna di testo e una frase che cresce di una riga sposta tutto il resto.
// `breaking changes` resta inglese, come fa la prosa italiana di GLOSSARY.md e come decide ADR 0008.
// Le due affermazioni della nota sulle note non giudicabili sono parola per parola quelle di
// GLOSSARY.md: sono la regola del prodotto, non una frase di questa pagina.
export const landing = {
  // L'infinito e non l'imperativo: un titolo italiano che dà un ordine al lettore suona come una
  // pubblicità, e la frase inglese è una promessa, non un comando.
  "landing.claim": "Capire prima di aggiornare.",
  "landing.lede":
    "{name} {version} ha portato {breaking} in {lines} righe di note di rilascio. Una di queste fa sì che {propTypes} non faccia più niente, in silenzio, ed è alla riga {line}.",
  "landing.promise":
    "Verdict segue le release delle tecnologie del tuo stack e dà a ognuna un verdetto solo: se ti chiede qualcosa, cosa si rompe e come migrare. Ogni affermazione punta alla riga delle note di rilascio da cui è stata letta, così la controlli in un clic invece di fidarti.",
  // The Dashboard the showcase prerenders (issue #221).
  "landing.seeDemo": "apri la Dashboard dimostrativa",
  "landing.seeVerdict": "vedi il verdetto di {name} {version}",
  "landing.breakingChanges": {
    one: "{count} breaking change",
    many: "{count} breaking changes",
    other: "{count} breaking changes",
  },

  "landing.panel.window": "righe da {first} a {last} di {total}",
  "landing.panel.linesRead": "righe lette",

  "landing.bench.title": "Una release, quattro stadi",
  "landing.bench.sub":
    "La stessa release che cita la prima schermata, letta come la legge l'app: cosa ha pubblicato il progetto, la riga su cui si appoggia il verdetto, il verdetto stesso, e dove si va dopo.",
  "landing.bench.notesFrom": "note da {source}, {lines} righe",
  "landing.bench.window": "le righe da {first} a {last}",
  "landing.bench.source":
    "{lines} righe, tenute esattamente come sono state pubblicate e numerate perché un'affermazione possa nominarne una. I {breaking} stanno in una sezione sola, e la prima schermata mostra {window}.",
  "landing.bench.cite":
    "Niente è parafrasato. Il verdetto cita questa riga, le punta indietro, e sarebbe sbagliato in un modo che potresti vedere se la riga dicesse altro.",
  "landing.bench.verdictTitle": "propTypes non vengono più controllati",
  "landing.bench.verdictBody":
    "Un componente che dichiara {propTypes} continua a compilare e continua a girare. Niente avverte, e niente viene più controllato.",
  "landing.bench.help": "migra alle props di TypeScript, o a un'altra soluzione di type checking.",
  "landing.bench.helpAll":
    "Tutti i {breaking} sono elencati allo stesso modo sulla pagina della release, ognuno con la sua riga citata e la sua riga di aiuto.",

  "landing.thin.title": "E quando le note non sono di quel tipo",
  "landing.thin.sub":
    "La maggior parte delle release non pubblica {lines} righe. Quello che Verdict fa con quelle magre è la stessa disciplina, ed è il motivo per cui sta su questa pagina e non in una FAQ.",
  "landing.thin.vite":
    "un changelog di {lines} righe, dove le due breaking sono segnate da un solo {bang} e stanno tra un {chore} e un {perf}. {link}",
  "landing.thin.viteLink": "leggile separate",
  "landing.thin.typescript":
    "una release il cui corpo è {blog}. Qui non c'è niente da giudicare, quindi Verdict dice esattamente questo e punta a dove stanno le note vere. {link}",
  "landing.thin.typescriptBlog": "un link a un post di blog",
  "landing.thin.typescriptLink": "vedi quello stato",
  "landing.thin.note":
    "È la frase che Verdict stampa invece di un verdetto quando le note rimandano soltanto altrove. «Non ho trovato breaking changes» e «non ci sono breaking changes» sono affermazioni diverse, e la seconda non viene mai stampata al posto della prima.",

  // Le quattro definizioni sono le frasi di GLOSSARY.md (Rilevanza) dette in italiano. I quattro
  // nomi, `featured` e gli altri, non si traducono: sono quelli che l'app stampa su ogni release.
  "landing.words.title": "Quattro parole su ogni release",
  "landing.words.sub":
    "La Rilevanza è una forma accanto alla versione, mai una tinta: il colore su questo prodotto vuol dire gravità e nient'altro. Una release non è urgente perché è rossa, è urgente perché lo dicono le sue note, su una riga che puoi leggere.",
  "landing.words.featured":
    "La release dove una tecnologia cambia direzione: una major nuova dove SemVer tiene, una minor nuova per i progetti che portano lì i loro cambiamenti veri. Sono quelle che aprono la tua Dashboard, e quelle che il verdetto della pagina conta.",
  "landing.words.notable":
    "Lavoro nuovo, nessun cambio di direzione: una minor nuova sotto SemVer, una major dispari di Node. Vale leggerle, raramente urgenti.",
  "landing.words.digest":
    "Quello che la regola tratta come ordinario, le patch per prime. Non interrompono mai: le leggi raggruppate per settimana ISO, in un passaggio solo.",
  "landing.words.preview":
    "Una beta o una release candidate. Solo la prima preview di una major nuova viene sintetizzata, e canary, nightly e alpha qui non sono release per niente.",

  "landing.close.claim": "Segui le tecnologie che decidono la tua settimana.",
  "landing.close.catalog":
    "Un catalogo curato di {size} tecnologie. Le pagine delle release sono pubbliche, e per leggerle non serve installare niente.",
  "landing.close.browse": {
    one: "sfoglia l'unica tecnologia",
    many: "sfoglia tutte le {count} tecnologie",
    other: "sfoglia tutte le {count} tecnologie",
  },
  "landing.close.note.claim": "non apre pull request",
  "landing.close.note.body":
    "Dependabot e Renovate lo fanno bene, e ti dicono che una versione si è mossa. Una newsletter ti dice che una release era interessante. Verdict risponde alla domanda che quelli lasciano aperta: questa release mi chiede qualcosa, e dove lo dice. Legge solo le note di rilascio, non indovina mai, e quando le note non dicono niente non dice niente.",

  "landing.install.copy": "copia",
  "landing.install.copied": "copiato",
  "landing.install.title": "Prima di installare",
  "landing.install.sub":
    "Verdict gira sul tuo computer. Non c'è un account, e in mezzo non c'è nessun nostro server.",
  "landing.install.key.term": "la tua chiave Anthropic",
  "landing.install.key.body":
    "Claude scrive la sintesi di ogni release nuova con la tua chiave, a tue spese: qualche centesimo a release. Le sintesi già scritte arrivano col file dei dati. Senza chiave le release nuove arrivano lo stesso, e le loro sintesi aspettano.",
  "landing.install.data.term": "il tuo disco",
  "landing.install.data.body":
    "I dati sono un file SQLite, in {home} su macOS e Linux, in {windows} su Windows, oppure dove punta {env}. Ad Anthropic vanno le note di rilascio da sintetizzare, e niente che riguardi te.",
  "landing.install.follows.term": "verdict.json",
  "landing.install.follows.body":
    "Le tecnologie che segui, e la versione che usi di ognuna, stanno in {file} accanto ai dati. Copi quel file su un altro computer e vengono con te.",
  "landing.install.notify.term": "ad app chiusa",
  "landing.install.notify.body":
    "Un workflow di GitHub in un tuo repository fa girare Verdict una volta al giorno e manda le novità su Slack o Discord. Nel README è pronto da copiare.",
  "landing.install.source": "codice e README su {repository}, licenza MIT",

  "landing.foot.read": "contenuto letto dalle note di rilascio pubbliche",
  "landing.foot.notes": "note di {name} {version}",

  // L'ingresso dalla landing alla Dashboard. `Dashboard` resta Dashboard.
  "landing.entry.developer": "Vai alla tua Dashboard",
} as const;
