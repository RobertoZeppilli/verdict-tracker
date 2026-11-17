import type { MessageDictionary } from "../index";

export const settings = {
  "settings.title": "Impostazioni",
  "settings.intro":
    "Come l'app si legge per te. Niente di qui è condiviso con nessuno, e niente nelle pagine pubbliche delle release e delle tecnologie dipende da questo.",
  "settings.language.title": "Lingua",
  "settings.language.interface": "lingua dell'interfaccia",
  "settings.language.note":
    "La lingua è parte dell'indirizzo, così una pagina si può condividere nella lingua in cui è stata letta. Le note di rilascio e le sintesi restano nella loro lingua originale.",
  // La sezione delle Notifiche (issue #171). `featured`, `notable` e `digest` sono
  // la grammatica del prodotto e restano in inglese; i nomi del glossario si traducono dentro le
  // frasi (ADR 0008).
  "settings.notifications.title": "Notifiche",
  "settings.notifications.intro":
    "Quali Release ti raggiungono, e dove.",
  "settings.notifications.bell.title": "la campanella",
  "settings.notifications.featured.label": "Release featured",
  "settings.notifications.featured.off":
    "Spento, una Release featured di una Tecnologia che segui non scrive nessuna Notifica: niente sulla campanella, e niente su un canale aggiunto dopo.",
  "settings.notifications.notable.label": "Release notable",
  "settings.notifications.notable.off":
    "Spento, una Release notable non scrive nessuna Notifica. Le featured hanno un interruttore loro, così le Release per cui vale la pena interromperti restano accese mentre queste tacciono.",
  "settings.notifications.switch": "{name} sulla campanella",
  "settings.notifications.error":
    "Non salvato. L'interruttore è tornato come lo tiene il database, quindi quello che vedi è quello che hai: premilo di nuovo.",
  "settings.notifications.digest":
    "Il Digest settimanale porta il suo interruttore, il giorno in cui arriva il Digest stesso.",
  "settings.notifications.switch.slack": "{name} su Slack",
  "settings.notifications.slack.title": "slack",
  "settings.notifications.slack.guide.open": "come si crea un webhook",
  "settings.notifications.slack.guide.title": "Un webhook Slack, passo per passo",
  "settings.notifications.slack.guide.intro": "Verdict scrive su Slack con un incoming webhook che crei nel tuo workspace. Bastano pochi minuti, una volta sola.",
  "settings.notifications.slack.guide.stepCreate": "Apri la pagina delle app di Slack e scegli Create New App, poi From scratch. Il nome è libero; scegli il tuo workspace.",
  "settings.notifications.slack.guide.stepActivate": "Nel menu dell'app apri Incoming Webhooks e attiva Activate Incoming Webhooks.",
  "settings.notifications.slack.guide.stepChannel": "Premi Add New Webhook, scegli il canale dove arrivano i messaggi e autorizza.",
  "settings.notifications.slack.guide.stepPaste": "Copia l'URL del webhook, incollalo nel campo di questa pagina, salva e manda un messaggio di prova.",
  "settings.notifications.slack.guide.link": "apri la pagina delle app di Slack",
  "settings.notifications.slack.guide.close": "chiudi",
  "settings.notifications.slack.manualNote":
    "L'URL è un segreto: una volta salvato rileggi solo dove punta, mai l'URL intero.",
  "settings.notifications.slack.label": "URL dell'incoming webhook",
  "settings.notifications.slack.save": "salva",
  "settings.notifications.slack.remove": "rimuovi",
  "settings.notifications.slack.current": "Manda a {hint}. Lascia il campo vuoto e salva per rimuoverlo.",
  "settings.notifications.slack.none": "Ancora nessun webhook, quindi i due interruttori qui sotto non mandano niente.",
  "settings.notifications.slack.invalid":
    "Non salvato. L'URL di un webhook comincia con https://hooks.slack.com/services/ e viene dal tuo workspace.",
  "settings.notifications.slack.featured.off":
    "Spento, le Release featured arrivano ancora sulla campanella e smettono di arrivare su Slack.",
  "settings.notifications.slack.notable.off":
    "Spento, le Release notable smettono di arrivare su Slack. Le featured hanno un interruttore proprio, quindi possono continuare ad arrivare.",
  "settings.notifications.slack.grouping":
    "Un messaggio per giro, con una riga per Release: dieci Release in un giro arrivano come un messaggio solo, non dieci.",
  "settings.notifications.slack.test": "manda un messaggio di prova",
  "settings.notifications.slack.testOk": "Il messaggio di prova è partito. Il canale funziona.",
  "settings.notifications.slack.testFailed": "Slack non l'ha accettato: {error}",
  "settings.notifications.slack.testEmpty": "Non c'è ancora niente da provare: salva prima un webhook.",
  "settings.notifications.locale.title": "lingua di slack",
  "settings.notifications.locale.note":
    "Slack non ha un indirizzo da cui leggere una lingua, quindi viene scritto in questa. Non cambia la lingua del sito, che resta quella nell'indirizzo, e le Note di rilascio e le Sintesi restano nella loro lingua originale.",
  "settings.notifications.locale.choose": "Scrivi Slack in {name}",
  "settings.notifications.locale.error":
    "Non salvato. La lingua è ancora quella segnata qui, che è quella che tiene il database: premila di nuovo.",
} as const satisfies Partial<MessageDictionary>;
