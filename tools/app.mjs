/* Carica l'app FUORI dal browser e restituisce le sue funzioni vere.
   ------------------------------------------------------------------------------------
   Serve a una regola sola: esiste UN motore, quello di index.html. Ogni strumento che
   giudica un giocatore deve chiamare quello, non una sua imitazione — altrimenti il
   report e l'app finiscono per consigliare cose diverse, ed è successo davvero
   (tools/occasioni.mjs classificava con una regressione fm~quota tutta sua e metteva in
   cima N'Dri, che il motore giudica "filler" perché è 0.39 sotto la media del suo ruolo).

   Non è un finto DOM per fare scena: è il minimo che serve perché lo script di index.html
   giri fino in fondo senza un browser. Chi ha bisogno di un pezzo diverso — un <a> che
   registra i download, un window.claude finto — lo passa in `opzioni`.

   uso:  import { caricaApp } from "./app.mjs";
         const app = caricaApp();          // { KBI, expFM, advice, affOf, ... }
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Tutto quello che l'app espone e che gli strumenti possono usare. Aggiungere qui una
   funzione è il modo giusto per renderla disponibile: copiarla altrove non lo è. */
const ESPOSTE = ["DATA", "KBI", "KB", "expFM", "advice", "affOf", "chipsOf", "ROLE_MEAN", "ROLES",
                 "TEAMS", "GIORNATE_GIOCATE", "downloadFile", "freshState", "mkPlayer"];

export function caricaApp(opzioni = {}) {
  const html = fs.readFileSync(`${REPO}/index.html`, "utf8");
  let script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
  script = script.replace(/\ntry\{ const th = localStorage[\s\S]*$/, "\n");   // via il bootstrap
  const kb = fs.readFileSync(`${REPO}/data/kb.js`, "utf8");

  const noop = () => {};
  const finto = new Proxy(function(){}, {
    get: (t, p) => p === "style" || p === "dataset" || p === "classList"
        ? new Proxy({}, { get: () => noop, set: () => true })
        : p === "value" || p === "textContent" || p === "innerHTML" ? "" : finto,
    set: () => true, apply: () => finto
  });
  const document = {
    getElementById: () => finto, querySelector: () => finto, querySelectorAll: () => [],
    addEventListener: opzioni.addEventListener || noop,
    createElement: opzioni.createElement || (() => finto),
    documentElement: { dataset:{}, style:{} }, body: finto
  };
  const localStorage = { _d:{}, getItem(k){return this._d[k] ?? null;},
    setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
  const win = {}; new Function("window", kb)(win);
  if (opzioni.claude) win.claude = opzioni.claude;

  const ctx = {
    window: win, document, localStorage, console, setTimeout, clearTimeout, Math, JSON,
    Blob: opzioni.Blob || function(p,o){ this.p=p; this.o=o; },
    URL:  opzioni.URL  || { createObjectURL: () => "blob:x", revokeObjectURL: noop }
  };
  /* `toast` mostra un avviso in fondo allo schermo: fuori dal browser non ha dove andare,
     e a chi prova serve leggerlo. Si dirotta su una funzione passata da fuori. */
  let coda = "";
  if (opzioni.toast) { ctx.__toast = opzioni.toast; coda += "; toast = __toast;"; }
  const nomi = Object.keys(ctx);
  return new Function(...nomi, script + coda + `; return { ${ESPOSTE.join(", ")} };`)(...Object.values(ctx));
}
