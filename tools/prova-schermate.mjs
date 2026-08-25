/* Prova di fumo dell'app FUORI dal browser: carica index.html e data/kb.js in un DOM
   finto, costruisce uno stato realistico e disegna tutte e dieci le schermate.

   Serve perché due volte è successo di consegnare una cosa che "c'era nel codice" ma non
   funzionava. Qui non si controlla che il codice esista: si esegue.

   uso: node tools/prova-schermate.mjs            (rosa vuota)
        node tools/prova-schermate.mjs <csv-rose> (con le rose vere della lega)

   Il CSV è quello esportato dalla lega: squadra,IdGiocatore,prezzoPagato */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2];

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
const ascoltatori = {};
const document = {
  getElementById: () => finto, querySelector: () => finto, querySelectorAll: () => [],
  addEventListener: (tipo, fn) => { (ascoltatori[tipo] = ascoltatori[tipo] || []).push(fn); },
  createElement: () => finto, documentElement: { dataset:{}, style:{} }, body: finto
};
const localStorage = { _d:{}, getItem(k){return this._d[k] ?? null;},
  setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
const win = {}; new Function("window", kb)(win);

const ctx = { window: win, document, localStorage, console, setTimeout, clearTimeout, Math, JSON };
const api = new Function(...Object.keys(ctx), script + `
  ; return { freshState, mkPlayer, KB, ensureManagers, get ui(){return ui}, get state(){return state},
      viste: {vConsigli,vListone,vStrategia,vAsta,vRosa,vFormazione,vConfronto,vScambi,vGuida,vImpostazioni},
      setState(s){ store={v:2,current:"L",order:["L"],leagues:{L:{name:"prova",state:s}}}; state=s; } };`
)(...Object.values(ctx));

const st = api.freshState();
st.players = api.KB.map((r,i) => api.mkPlayer(i+1, r[1], r[2], r[0], r[3], +r[18]||0, i));
st.settings.nTeams = 10; st.settings.rules.modDef = "reparto"; st.lineup.module = "4-3-3";
api.setState(st); api.ensureManagers();

if (csvPath && fs.existsSync(csvPath)) {
  const perId = new Map(win.FANTAHQ_DATA.kb.map(r => [String(r[17]), r[1] + "|" + r[0]]));
  const righe = fs.readFileSync(csvPath, "utf8").split(/\r?\n/);
  const squadre = []; let mancanti = 0;
  for (const l of righe) { const p = l.split(","); if (p.length < 3 || p[0] === "$") continue;
    if (!squadre.includes(p[0])) squadre.push(p[0]); }
  const mia = squadre[0];
  const mappa = {}; squadre.slice(1).forEach((s,i) => { if (st.managers[i]) { st.managers[i].name = s; mappa[s] = st.managers[i].id; } });
  for (const l of righe) { const p = l.split(","); if (p.length < 3 || p[0] === "$") continue;
    const k = perId.get(p[1]); if (!k) { mancanti++; continue; }
    const [nome, ruolo] = k.split("|");
    const pl = st.players.find(x => x.name === nome && x.role === ruolo && x.status === "free");
    if (!pl) { mancanti++; continue; }
    pl.paid = +p[2];
    if (p[0] === mia) pl.status = "mine"; else { pl.status = "gone"; pl.owner = mappa[p[0]]; }
  }
  console.log(`rose caricate da CSV: ${st.players.filter(p=>p.status!=="free").length} assegnati, ${mancanti} non agganciati`);
}

let problemi = 0;
console.log("\n— schermate —");
for (const [nome, fn] of Object.entries(api.viste)) {
  try {
    const h = fn();
    if (typeof h !== "string" || h.length < 40) { console.log(`  ${nome.padEnd(14)} ❌ output sospetto`); problemi++; }
    else console.log(`  ${nome.padEnd(14)} ok  ${String(h.length).padStart(7)} car${h.includes("undefined") ? "   ⚠️ contiene 'undefined'" : ""}`);
  } catch (e) { console.log(`  ${nome.padEnd(14)} ❌ ${e.message}`); problemi++; }
}

/* e adesso i comportamenti, non solo il disegno: i click che devono fare qualcosa */
console.log("\n— comportamenti —");
/* closest() finto ma ONESTO: risponde solo se il selettore combacia davvero con
   l'elemento. Con un closest() che dice sempre sì, ogni ascoltatore intercetta ogni click
   e il test racconta bugie — è successo. */
function combacia(sel, el) {
  return sel.split(",").some(s => {
    s = s.trim();
    if (s.startsWith("[data-") && s.endsWith("]")) {
      const attr = s.slice(6, -1);                                  // "[data-openteam]" -> "openteam"
      const camel = attr.split("-").map((p,i) => i ? p[0].toUpperCase() + p.slice(1) : p).join("");
      return el.dataset[camel] !== undefined;
    }
    if (s.startsWith("#")) return el.id === s.slice(1);
    return false;
  });
}
function clicca(dataset, id) {
  const el = { dataset: dataset || {}, id: id || "", files: null, value: "" };
  const ev = { target: { closest: sel => combacia(sel, el) ? el : null } };
  for (const fn of (ascoltatori.click || [])) fn(ev);
}
function prova(nome, azione, verifica) {
  try { azione(); const ok = verifica();
    console.log(`  ${nome.padEnd(38)} ${ok ? "ok" : "❌ non fa quello che dovrebbe"}`); if (!ok) problemi++;
  } catch (e) { console.log(`  ${nome.padEnd(38)} ❌ ${e.message}`); problemi++; }
}
const unRivale = st.managers[0].id;
prova("apri la rosa di un avversario", () => clicca({ openteam: unRivale }), () => api.ui.openTeam === unRivale);
prova("richiudila", () => clicca({ openteam: unRivale }), () => api.ui.openTeam === "");
prova("calcola il piano di partenza", () => clicca(null, "calcSplit"),
      () => ["P","D","C","A"].reduce((s,r) => s + st.settings.split[r], 0) === 100);
prova("cambia scheda", () => clicca({ tab: "strategia" }), () => api.ui.tab === "strategia");

console.log(problemi ? `\n❌ ${problemi} problemi` : "\n✅ tutto a posto");
process.exit(problemi ? 1 : 0);
