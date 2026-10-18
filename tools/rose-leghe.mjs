/* ROSE-LEGHE — aggiorna un backup dell'app con le rose esportate da Leghe Fantacalcio.
   ------------------------------------------------------------------------------------
   Leghe Fantacalcio esporta le rose come xlsx (una colonna "squadra, costo" per ogni
   squadra, i giocatori scritti come nel listone). Gli strumenti (rosa-consigli, formazione)
   lavorano sul backup dell'app: questo prende l'ultimo backup e ci riversa le rose vere, così
   gli scambi fatti dagli altri arrivano senza dover rifare l'importazione a mano.

   - giocatore: nome del listone → Id ufficiale (l'asterisco "Paleari *" di Leghe segna chi
     non è più nel listone: si cerca senza);
   - squadra: si riconosce dal nome, oppure (se il presidente l'ha rinominata) dalla squadra
     del backup con cui ha più giocatori in comune; quella dell'utente resta "mine";
   - chi non compare in nessuna rosa torna libero.

   uso:  node tools/rose-leghe.mjs <backup.json> <rose.json convertito> "<NomeLega>" "<MiaSquadra>" <uscita.json>
         (l'xlsx si converte prima con tools/xlsx-to-json.mjs, come le statistiche)
*/
import fs from "fs";
import path from "path";
import { REPO } from "./app.mjs";

const [bkPath, rosePath, nomeLega, miaSquadra, uscita] = process.argv.slice(2);
if (!uscita) { console.log('uso: node tools/rose-leghe.mjs <backup.json> <rose.json> "<NomeLega>" "<MiaSquadra>" <uscita.json>'); process.exit(1); }

const decod = s => String(s ?? "").replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s*\*\s*$/, "").trim();
const norm = s => decod(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const listone = JSON.parse(fs.readFileSync(path.join(REPO, "data", "listone-2026-27.json"), "utf8")).slice(2);
const perNome = new Map();
for (const r of listone) { const k = norm(r[3]); perNome.set(k, perNome.has(k) ? null : r); }   // null = omonimo

/* le colonne: intestazione "Squadra","costo",vuoto, ripetuta */
const righe = JSON.parse(fs.readFileSync(rosePath, "utf8"));
const squadre = [];
for (let c = 0; c < righe[0].length; c += 3) {
  const nome = decod(righe[0][c]); if (!nome) continue;
  const gioc = [];
  for (const r of righe.slice(1)) {
    const n = r[c], costo = r[c + 1];
    if (!n || /^totale$/i.test(decod(n))) continue;
    gioc.push({ nome: decod(n), costo: +costo || 0 });
  }
  if (gioc.length) squadre.push({ nome, gioc });
}

const bk = JSON.parse(fs.readFileSync(bkPath, "utf8"));
const idLega = bk.order.find(i => bk.leagues[i].name.toLowerCase() === nomeLega.toLowerCase());
if (!idLega) { console.log(`lega "${nomeLega}" non trovata nel backup`); process.exit(1); }
const st = bk.leagues[idLega].state;
const perExt = new Map(st.players.map(p => [String(p.extId), p]));
const dove = p => p.status === "mine" ? "ME" : p.status === "gone" ? p.owner : null;

const problemi = [];
const assegnate = new Map();                 // extId → { squadra, costo }
const extDi = new Map();                     // squadra → [extId]
for (const s of squadre) {
  const lista = [];
  for (const g of s.gioc) {
    const r = perNome.get(norm(g.nome));
    if (!r) { problemi.push(`${s.nome}: "${g.nome}" ${r === null ? "omonimo nel listone" : "non è nel listone"}`); continue; }
    assegnate.set(r[0], { squadra: s.nome, costo: g.costo }); lista.push(r[0]);
  }
  extDi.set(s.nome, lista);
}

/* squadra di Leghe → presidente del backup */
const presidente = new Map();
const liberi = new Set((st.managers || []).map(m => m.id));
for (const s of squadre) {
  if (s.nome.toLowerCase() === miaSquadra.toLowerCase()) { presidente.set(s.nome, "ME"); continue; }
  let m = (st.managers || []).find(x => x.name.toLowerCase() === s.nome.toLowerCase() && liberi.has(x.id));
  if (!m) {
    const conti = {};
    for (const e of extDi.get(s.nome)) { const p = perExt.get(String(e)); const d = p && dove(p); if (d && d !== "ME" && liberi.has(d)) conti[d] = (conti[d] || 0) + 1; }
    const best = Object.entries(conti).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 5) m = st.managers.find(x => x.id === best[0]);
  }
  if (!m) { m = { id: "m_" + Math.random().toString(36).slice(2, 8), name: s.nome }; (st.managers ||= []).push(m); console.log(`  nuova squadra nel backup: ${s.nome}`); }
  else if (m.name !== s.nome) { console.log(`  ${m.name} → ora si chiama ${s.nome}`); m.name = s.nome; }
  liberi.delete(m.id); presidente.set(s.nome, m.id);
}

/* riversa: prima tutti liberi, poi le rose vere */
let cambi = 0;
const prima = new Map(st.players.map(p => [p, dove(p)]));
for (const p of st.players) if (p.status !== "free") { p.status = "free"; p.owner = null; p.paid = 0; }
let nextId = Math.max(0, ...st.players.map(p => p.id || 0)) + 1;
for (const [ext, a] of assegnate) {
  let p = perExt.get(String(ext));
  if (!p) {                                   // nel listone nuovo ma non ancora nella lega
    const r = listone.find(x => x[0] === ext);
    p = { id: nextId++, name: r[3], team: r[4], role: r[1], qta: +r[5], fvm: +r[11] || 0, kbi: -1, extId: String(ext),
          rating: 0, target: false, maxBid: 0, status: "free", paid: 0, owner: null, note: "", seq: 0 };
    st.players.push(p); perExt.set(String(ext), p);
  }
  const chi = presidente.get(a.squadra);
  if (chi === "ME") { p.status = "mine"; p.owner = null; } else { p.status = "gone"; p.owner = chi; }
  p.paid = a.costo;
}
const descr = id => id === "ME" ? "te" : ((st.managers || []).find(m => m.id === id) || {}).name || "libero";
const movimenti = [];
for (const [p, d0] of prima) { const d1 = dove(p); if (d0 !== d1 && (d0 || d1)) { cambi++; movimenti.push(`${p.name}: ${descr(d0)} → ${descr(d1)}`); } }

fs.writeFileSync(uscita, JSON.stringify(bk));
console.log(`${nomeLega}: ${squadre.length} squadre, ${assegnate.size} giocatori assegnati, ${cambi} movimenti rispetto al backup`);
if (movimenti.length) console.log("  " + movimenti.join("\n  "));
if (problemi.length) console.log(`⚠️ da guardare:\n  ` + problemi.join("\n  "));
