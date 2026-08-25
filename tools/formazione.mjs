/* FORMAZIONE — la stessa che mostra il tab Formazione, ma da riga di comando.
   ------------------------------------------------------------------------------------
   Serve perché la rosa vive nel localStorage del browser: da qui non si vede. Le si dà in
   pasto il CSV che l'app esporta (Rosa → Esporta CSV, formato Leghe Fantacalcio) e si
   ottiene lo stesso XI, con gli stessi numeri.

   Non ricalcola niente per conto suo: chiama `scoreFormazione`, `dispDi` e `diffDi` di
   index.html attraverso app.mjs. Se un giorno il tab e questo comando dicessero cose
   diverse, sarebbe un bug — non una differenza di opinione.

   uso:  node tools/formazione.mjs <rose.csv> [giornata] [modulo]
         node tools/formazione.mjs rose.csv 2 3-4-3
*/
import fs from "fs";
import { caricaApp } from "./app.mjs";

const [csvPath, gArg, modArg] = process.argv.slice(2);
if (!csvPath) {
  console.log("uso: node tools/formazione.mjs <rose.csv> [giornata] [modulo]");
  console.log("il CSV lo esporta l'app: tab Rosa → Esporta CSV (formato Leghe Fantacalcio)");
  process.exit(1);
}

const app = caricaApp();
const G = +gArg || Math.min(38, app.GIORNATE_GIOCATE + 1);
const state = app.setGiornata(G);
const modulo = modArg || "3-4-3";
if (!app.MODULES[modulo]) {
  console.log(`modulo sconosciuto: ${modulo} — disponibili ${Object.keys(app.MODULES).join(", ")}`);
  process.exit(1);
}
state.lineup.module = modulo;

/* Il CSV ha blocchi separati da "$,$,$" e righe "Fantasquadra,Id,Costo". La PRIMA squadra
   è la tua: è così che l'app lo scrive quando esporti. */
const righe = fs.readFileSync(csvPath, "utf8").split(/\r?\n/);
let miaSquadra = null;
const miei = [];
for (const r of righe) {
  if (!r.trim() || r.startsWith("$")) { if (r.startsWith("$") && miaSquadra) break; continue; }
  const [sq, id, costo] = r.split(",");
  if (!miaSquadra) miaSquadra = sq;
  if (sq !== miaSquadra) break;
  miei.push({ id: (id||"").trim(), costo: +costo || 0 });
}
if (!miei.length) { console.log("nessun giocatore letto dal CSV: controlla il formato"); process.exit(1); }

/* Si aggancia per Id ufficiale, che è l'unico modo senza rischio di omonimia. */
const perId = new Map(app.KBI.map(k => [k.extId, k]));
const rosa = [], persi = [];
for (const m of miei) {
  const k = perId.get(m.id);
  if (!k) { persi.push(m.id); continue; }
  rosa.push({ id: k.i, name: k.n, team: k.t, role: k.r, qta: k.qta, paid: m.costo, rating: 0, status: "mine" });
}
state.players = state.players.map(p => {
  const r = rosa.find(x => x.name === p.name && x.role === p.role);
  return r ? { ...p, status: "mine", paid: r.paid } : p;
});
const mine = state.players.filter(p => p.status === "mine");

const need = { P: 1, ...app.MODULES[modulo] };
const RUOLO = { P: "Por", D: "Dif", C: "Cen", A: "Att" };
const SIMBOLO = { ok: "✓", dubbio: "?", out: "✗" };

console.log(`FORMAZIONE ${G}ª giornata · modulo ${modulo} · ${miaSquadra}`);
console.log(`Punteggio = FM attesa corretta per difficoltà del turno e disponibilità. Stesso motore del tab Formazione.\n`);

let titolari = 0;
for (const r of app.ROLES) {
  const lista = mine.filter(p => p.role === r)
    .map(p => ({ p, sc: app.scoreFormazione(p), av: app.dispDi(p), d: app.diffDi(p) }))
    .sort((a, b) => b.sc - a.sc);
  console.log(`${app.ROLE_NAMES[r]} — servono ${need[r]}`);
  if (!lista.length) { console.log("  (nessuno in rosa)\n"); continue; }
  lista.forEach((x, i) => {
    const tit = i < need[r] && x.sc > -50;
    if (tit) titolari++;
    const avv = x.d.avv ? `${x.d.casa ? "in casa con" : "a"} ${x.d.avv}` : "avversario n/d";
    const k = app.kbFor(x.p);
    /* Il motivo dell'esclusione va scritto: un nome che sparisce senza spiegazione sembra
       un errore del programma, non una decisione. */
    const perche = x.av !== "ok" && k && (k.note || "").startsWith("⚕️")
      ? "  ⚕️ " + k.note.replace(/^⚕️\s*/, "").split(/(?<=\.)\s/)[0] : "";
    console.log(`  ${tit ? "★" : " "} ${SIMBOLO[x.av]} ${RUOLO[r]} ${x.p.name.padEnd(18)} ${x.p.team.padEnd(11)} ` +
      `${x.sc <= -50 ? "  —  " : x.sc.toFixed(2).padStart(5)}  ${avv.padEnd(24)} ${app.DIFF_LABEL(x.d.val)}${perche}`);
  });
  console.log();
}

console.log(`★ = titolare · ✓ gioca · ? dubbio (−1.2 al punteggio) · ✗ out (escluso)`);
console.log(`${titolari} titolari su ${Object.values(need).reduce((a, b) => a + b, 0)}.`);
if (persi.length) console.log(`⚠️ ${persi.length} Id del CSV non sono nel database (${persi.slice(0,5).join(", ")}): reimporta il listone.`);
console.log(`\nI dubbi vanno sciolti con le probabili della vigilia: nel tab Formazione la tendina li corregge, e la tua scelta vince sul bollettino.`);
