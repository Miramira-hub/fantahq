/* Prova dei rami di salvataggio file, FUORI dal browser.
   ------------------------------------------------------------------------------------
   L'app gira su tre superfici e il salvataggio non funziona allo stesso modo dappertutto:

     sito e file locale → <a download> con un blob:, il modo classico
     Artifact           → quel link è INERTE (il visualizzatore non concede mai a una
                          pagina il permesso di scaricare) e serve la capacità `downloads`,
                          che mostra una conferma all'utente e può essere rifiutata

   `prova-schermate.mjs` verifica che le schermate si disegnino, non che un file venga
   consegnato: un clic su "esporta" lì non prova niente. Qui si esegue davvero
   `downloadFile` su entrambe le meccaniche, compresi i casi storti — estensione non
   abilitata, utente che rifiuta, capacità assente, `use()` che esplode.

   uso: node tools/prova-download.mjs
*/
import { caricaApp } from "./app.mjs";

/* Costruisce l'app con un window.claude a scelta e registra dove finiscono i file.
   Il finto <a> annota il download invece di eseguirlo, cosi si distingue quale delle due
   strade e stata presa — che e esattamente la cosa che si vuole misurare.
   L'armatura (DOM finto, kb, contesto) sta in app.mjs: una sola, condivisa. */
function costruisci(claudeFinto, salvataggi, toasts) {
  return caricaApp({
    claude: claudeFinto,
    toast: m => toasts.push(m),
    createElement: () => ({
      set href(v){}, get href(){ return "blob:x"; },
      set download(v){ this._n = v; },
      click(){ salvataggi.push({ via:"link", filename:this._n }); }
    })
  });
}

const casi = [];
const ok = (n, c) => casi.push([n, c]);
const err = code => { const e = new Error(code); e.code = code; return e; };

/* 1) sito e file locale: nessun window.claude, si usa il link */
{
  const salv = [], toasts = [];
  const api = costruisci(null, salv, toasts);
  await api.downloadFile("rose.csv", "a,b", "text/csv", "CSV salvato: 2 giocatori");
  ok("sito: usa il link <a download>", salv.length === 1 && salv[0].via === "link" && salv[0].filename === "rose.csv");
  ok("sito: annuncia la riuscita", toasts[0] === "CSV salvato: 2 giocatori");
}
/* 2) Artifact: la capacità c'è e l'utente accetta */
{
  const salv = [], toasts = [];
  const cap = { save: async r => { salv.push({ via:"capacita", ...r }); return { status:"saved" }; } };
  const api = costruisci({ use: async n => n === "downloads" ? cap : null }, salv, toasts);
  await api.downloadFile("backup.json", "{}", "application/json", "Backup salvato");
  ok("artifact: passa dalla capacità", salv.length === 1 && salv[0].via === "capacita" && salv[0].filename === "backup.json");
  ok("artifact: non tocca il link inerte", !salv.some(s => s.via === "link"));
  ok("artifact: annuncia la riuscita", toasts[0] === "Backup salvato");
}
/* 3) .csv sta nell'elenco esteso: se non è abilitato si ripiega su .txt */
{
  const salv = [], toasts = [];
  const cap = { save: async r => {
    if (r.filename.endsWith(".csv")) throw err("extension_not_enabled");
    salv.push(r); return { status:"saved" };
  } };
  const api = costruisci({ use: async () => cap }, salv, toasts);
  await api.downloadFile("rose.csv", "a,b", "text/csv", "CSV salvato");
  ok("csv non abilitato: ripiega su .txt", salv.length === 1 && salv[0].filename === "rose.txt");
  ok("ripiego: contenuto invariato", salv[0].data === "a,b");
  /* Il messaggio DEVE dire che il nome è cambiato: chi legge "CSV salvato" cerca un .csv,
     non lo trova, e non sa che basta rinominarlo. */
  ok("ripiego: dice che il nome è cambiato", /rose\.txt/.test(toasts[0]) && /rinomina/i.test(toasts[0]));
  ok("ripiego: non annuncia un CSV che non c'è", toasts[0] !== "CSV salvato");
}
/* 4) l'utente rifiuta: non si insiste e non si annuncia una riuscita che non c'è stata */
{
  const salv = [], toasts = [];
  let chiamate = 0;
  const cap = { save: async () => { chiamate++; throw err("declined"); } };
  const api = costruisci({ use: async () => cap }, salv, toasts);
  await api.downloadFile("rose.csv", "a,b", "text/csv", "CSV salvato");
  ok("rifiuto: non insiste", chiamate === 1);
  ok("rifiuto: niente riuscita falsa", toasts[0] === "Salvataggio annullato");
}
/* 5) capacità non servita da questa vista: use() dà null, si ripiega sul link */
{
  const salv = [], toasts = [];
  const api = costruisci({ use: async () => null }, salv, toasts);
  await api.downloadFile("rose.csv", "a,b", "text/csv", "CSV salvato");
  ok("capacità assente: ripiega sul link", salv.length === 1 && salv[0].via === "link");
}
/* 6) use() che esplode non deve portarsi giù l'esportazione */
{
  const salv = [], toasts = [];
  const api = costruisci({ use: () => Promise.reject(new Error("boom")) }, salv, toasts);
  await api.downloadFile("rose.csv", "a,b", "text/csv", "CSV salvato");
  ok("use() in errore: ripiega sul link", salv.length === 1 && salv[0].via === "link");
}

let ko = 0;
for (const [n, c] of casi) { console.log(`  ${c ? "ok  " : "KO  "}${n}`); if (!c) ko++; }
console.log(ko ? `\n❌ ${ko} prove fallite` : "\n✅ tutti i rami del salvataggio a posto");
process.exit(ko ? 1 : 0);
