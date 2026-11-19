import type { MessageDictionary } from "../index";

// Le FAQ, in italiano. Le domande sono quelle che un lettore si fa, quindi sono scritte con il `tu`
// come il resto dell'app, e la risposta comincia con il `No.` o il `Sì.` dove l'inglese lo fa: è la
// parola che il lettore cerca per prima, e in fondo a una frase non la troverebbe.
export const faq = {
  "faq.lede":
    "Le domande che a questo prodotto vengono fatte davvero, con la risposta che gli viene da quello che fa, non da quello che vorrebbe fare.",

  "faq.section.product": "il prodotto",
  "faq.does.q": "Cosa fa Verdict?",
  "faq.does.a":
    "Segue le release delle tecnologie del suo catalogo e dà a ognuna un verdetto solo: se ti chiede qualcosa, cosa si rompe e come migrare. Ogni affermazione punta alla riga delle note di rilascio da cui è stata letta.",
  "faq.add.q": "Posso chiedere che venga aggiunta una tecnologia?",
  "faq.add.a":
    "No. Il catalogo è curato: una tecnologia ci entra quando le sue release si possono seguire come si deve, ed è una decisione, non una coda. Puoi scrivere e dire cosa ti manca, ma non c'è una richiesta da presentare né niente da tracciare.",
  "faq.when.q": "Quanto ci mette a comparire una release nuova?",
  "faq.when.a":
    "Il job che cerca le release nuove gira una volta al giorno. La pagina di una release mostra le note appena la release è registrata; il verdetto compare quando la sintesi è stata scritta, che è un job a parte e può restare indietro.",
  "faq.read.q": "Serve un account?",
  "faq.read.a":
    "No. Non c'è un account. L'app gira sul tuo computer, e le tecnologie che segui, con la versione che usi di ognuna, stanno in `verdict.json` accanto ai suoi dati. La vetrina online è pubblica e in sola lettura.",

  "faq.section.summaries": "le sintesi",
  "faq.who.q": "Chi scrive le sintesi?",
  "faq.who.a":
    "Un modello linguistico, a partire dalle note di rilascio che il progetto ha pubblicato e da niente altro. Non riceve altre fonti, altre pagine, né dati su chi legge.",
  "faq.wrong.q": "Una sintesi può sbagliare?",
  "faq.wrong.a":
    "Sì, e la pagina è costruita dando per scontato che possa. È per questo che sotto un'affermazione c'è la riga citata, ed è per questo che ogni pagina linka le note alla fonte: la sintesi è lì per risparmiarti la lettura, non per essere creduta da sola. Quando sbagliare costa caro, controlla la riga citata.",
  "faq.prompt.q": "Finisce qualcosa di mio dentro un prompt?",
  "faq.prompt.a":
    "No. Una sintesi è scritta a partire dalle sole note di rilascio, e la richiesta che la chiede non porta niente su chi sei o su cosa segui. Una sintesi è lo stesso testo per chiunque legga. Il resto sta nell'{privacy}.",

  "faq.section.notifications": "le notifiche",
  "faq.notify.q": "Quando qualcosa mi avvisa?",
  "faq.notify.a":
    "Quando una release featured o notable di una tecnologia che segui ha la sua sintesi pronta. La campanella nella barra in alto è l'unico canale costruito finora.",

  "faq.section.data": "i tuoi dati",
  "faq.scope.q": "Verdict ha bisogno del mio account GitHub?",
  "faq.scope.a":
    "No. L'app legge le note di rilascio pubbliche da GitHub senza accedere. Un `GITHUB_TOKEN` è facoltativo: alza il limite di GitHub di 60 richieste all'ora e serve solo a leggere.",
  "faq.delete.q": "Come cancello i miei dati?",
  "faq.delete.a":
    "Cancella la cartella dei dati: `~/.verdict/` su macOS e Linux, `%LOCALAPPDATA%\\verdict` su Windows, o dove punta `VERDICT_DATA_DIR`. Niente di te è tenuto da un'altra parte.",
  "faq.cookies.q": "C'è un banner dei cookie?",
  "faq.cookies.a":
    "No, perché non c'è niente da chiedere: nessuna pubblicità, nessuna profilazione, nessun cookie, e nessun terzo che metta qualcosa nel tuo browser. Il tema che scegli resta nel tuo browser.",
} as const satisfies Partial<MessageDictionary>;
