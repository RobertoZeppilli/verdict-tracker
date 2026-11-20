import type { MessageDictionary } from "../index";

// L'informativa sulla privacy, in italiano. Dalla issue #236 non c'è un account né una tabella di
// righe tenute su una persona: i dati sono due file sul computer di chi legge.
export const privacy = {
  "privacy.lede":
    "Cosa sa di te questo prodotto, e la risposta è niente: non c'è un nostro server su cui tenerlo. L'app gira sul tuo computer e tiene lì i suoi dati. Quello che dal tuo computer esce sono note di rilascio, mai qualcosa su di te, e qui sotto c'è l'elenco.",

  "privacy.held.title": "cosa viene tenuto, e dove",
  "privacy.held.intro":
    "Di te non teniamo niente. L'app tiene due file sul tuo computer: `verdict.json`, con le tecnologie che segui, la versione che usi di ognuna e la cartella del tuo vault di Obsidian se ne hai scelta una, e `verdict.db`, con il catalogo, le release, le sintesi e le tue notifiche. L'indirizzo e la chiave del tuo modello e l'indirizzo del webhook, se li dai, stanno in un file `.env` accanto a loro. Non ne abbiamo nessuna copia.",

  "privacy.prompt.title": "nessun dato personale entra in un prompt",
  "privacy.prompt.body":
    "Le sintesi le scrive il modello linguistico che imposti, chiamato dal tuo computer, e al modello non viene mai detto chi sei. La richiesta porta una cosa sola: le note di rilascio che un progetto ha pubblicato. Non dice niente di quali tecnologie segui, e una sintesi è lo stesso testo per chiunque legga.",
  "privacy.prompt.images":
    "Nemmeno il browser parla con un terzo. Le pagine arrivano dall'app sul tuo computer, e ogni chiamata a GitHub, npm o al tuo modello la fa l'app, non il browser.",

  "privacy.who.title": "chi altro ci mette le mani",
  "privacy.who.github":
    "serve le note di rilascio pubbliche e il file dati che l'app scarica al primo avvio. L'app da GitHub legge soltanto, e un `GITHUB_TOKEN`, se lo imposti, alza solo il limite orario.",
  "privacy.who.npm":
    "serve l'app stessa attraverso `npx`, e gli elenchi delle versioni delle tecnologie pubblicate lì.",
  "privacy.who.vercel":
    "ospita la vetrina, quindi serve ogni richiesta che le arriva, tiene i log delle richieste che ne vengono, e conta le visualizzazioni delle pagine con Vercel Analytics. L'app sul tuo computer da Vercel non passa.",
  "privacy.who.model":
    "Il modello che imposti riceve le note di rilascio pubbliche da sintetizzare, e nient'altro, come sopra. Con Ollama sul tuo computer non ne escono mai; con un provider remoto valgono per loro i termini di quel provider.",

  "privacy.cookies.title": "i cookie, e cosa c'è nel tuo browser",
  "privacy.cookies.body":
    "Su questo sito non c'è un banner di consenso perché non c'è niente a cui acconsentire: nessuna pubblicità, nessuna profilazione, e nessun terzo che metta qualcosa nel tuo browser.",
  "privacy.cookies.what":
    "Non ci sono cookie. Il tema che scegli è tenuto nel local storage del tuo browser e dal browser non esce mai. Sulla vetrina, Vercel Analytics conta le visualizzazioni senza un cookie e senza salvare un identificatore nel tuo browser: quello che produce sono conteggi di pagine, non la traccia di una persona.",

  "privacy.keep.title": "per quanto, e come farla finire",
  "privacy.keep.body":
    "Tutto quello che c'è qui sopra resta sul tuo computer finché tieni i file. Cancellare la cartella dei dati lo toglie: `~/.verdict/` su macOS e Linux, `%LOCALAPPDATA%\\verdict` su Windows, o dove punta `VERDICT_DATA_DIR`. Non c'è una nostra copia da chiedere.",
  "privacy.keep.notifications":
    "Le notifiche sono l'unica riga con un orologio suo: ognuna è cancellata 90 giorni dopo che è stata scritta, vista o no, e dopo non ne resta niente.",
  "privacy.keep.after":
    "Il catalogo, le release e le sintesi non sono mai stati tuoi né su di te, e il prossimo avvio li scarica di nuovo. I fornitori qui sopra fanno i loro backup e i loro log su pianificazioni loro, che non controlliamo e da cui non possiamo cancellare.",

  "privacy.reach.title": "come scriverci",
  "privacy.reach.body":
    "Un indirizzo solo, a cui risponde la persona che manda avanti tutto questo: {mail}. Chiedi cosa viene tenuto di te, chiedi che venga cancellato, o dicci che qui c'è qualcosa di sbagliato.",
} as const satisfies Partial<MessageDictionary>;
