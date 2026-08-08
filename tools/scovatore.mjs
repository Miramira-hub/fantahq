/* SCOVATORE — cosa distingue i giocatori da pochi crediti che ESPLODONO.
   ------------------------------------------------------------------------------------
   Per un giocatore da 1-10 crediti la vera incognita NON è "quanto rende quando gioca"
   (le fantamedie sono tutte schiacciate: tra un difensore da 1 e uno da 10 ballano pochi
   centesimi), ma "GIOCA O NO". Il valore di un'occasione d'asta sta quasi tutto lì:
   35 partite a 6.1 valgono una stagione, 12 partite a 6.1 non valgono niente.

   Quindi si misurano due cose separate, con i soli dati NOTI PRIMA dell'asta:
     A) chi conquista il posto  → probabilità di arrivare a 28+ presenze
     B) quanto vale in totale   → (Fm - 6.0) x presenze, cioè il contributo sopra un
        ipotetico sostituto da 6 politico: premia insieme resa E continuità

   Verifica su DUE coppie di stagioni indipendenti:
     23-24 (storia) → 24-25 (esito)   e   24-25 (storia) → 25-26 (esito)
   Un segnale è credibile solo se regge in entrambe. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = `${REPO}/data`;

const rows = f => JSON.parse(fs.readFileSync(`${D}/${f}`, "utf8")).slice(2);
const stat = y => new Map(rows(`statistiche-${y}.json`).map(r => [r[0], {
  id:r[0], r:r[1], n:r[3], t:r[4], pv:+r[5]||0, mv:+r[6]||0, fm:+r[7]||0,
  gf:+r[8]||0, rp:+r[10]||0, ass:+r[14]||0, amm:+r[15]||0, esp:+r[16]||0
}]));
const S = { "2023-24":stat("2023-24"), "2024-25":stat("2024-25"), "2025-26":stat("2025-26") };
const QUO = new Map(rows("listone-2025-26.json").map(r => [r[0], +r[5]||1]));

const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
const f2 = v => Number.isFinite(v) ? (v>=0?"+":"")+v.toFixed(2) : "n/d";
const pct = (k,n) => n ? `${k}/${n} (${Math.round(100*k/n)}%)` : "0/0";

/* costruisce le coppie storia→esito di una stagione */
function coppie(annoStoria, annoEsito, annoStoria2){
  const H = S[annoStoria], E = S[annoEsito], H2 = annoStoria2 ? S[annoStoria2] : null;
  const out = [];
  for (const [id, e] of E) {
    const h = H.get(id), h2 = H2 ? H2.get(id) : null;
    out.push({
      id, n:e.n, r:e.r, t:e.t,
      pv:e.pv, fm:e.fm, mv:e.mv,
      valore: (e.fm - 6.0) * e.pv,          // contributo sopra un sostituto da 6 politico
      titolare: e.pv >= 28,
      /* --- segnali noti PRIMA --- */
      prevPv:  h ? h.pv : 0,
      prevMv:  h && h.pv >= 5 ? h.mv : null,
      prevFm:  h && h.pv >= 5 ? h.fm : null,
      prevBon: h && h.pv >= 5 ? (3*h.gf + h.ass) / h.pv : null,
      prev2Pv: h2 ? h2.pv : 0,
      crescita: h && h2 ? h.pv - h2.pv : null,   // stava già guadagnando spazio?
      quota: QUO.get(id) || null                  // disponibile solo per l'esito 25-26
    });
  }
  return out;
}
const A = coppie("2024-25","2025-26","2023-24");   // esito 25-26, con prezzo noto
const B = coppie("2023-24","2024-25");             // esito 24-25, senza prezzo (controprova)

/* ================= 1. QUANTO È RARO CHE UN ECONOMICO DIVENTI TITOLARE ================= */
const econ = A.filter(x => x.quota != null && x.quota <= 10);
const cari = A.filter(x => x.quota != null && x.quota >= 15);
console.log("=== 1. LA BASE DI PARTENZA (stagione 25-26, prezzo noto) ===");
console.log(`  economici (quota ≤ 10): ${econ.length} giocatori → diventati titolari (28+ presenze): ${pct(econ.filter(x=>x.titolare).length, econ.length)}`);
console.log(`  costosi   (quota ≥ 15): ${cari.length} giocatori → titolari: ${pct(cari.filter(x=>x.titolare).length, cari.length)}`);
console.log(`  valore medio di un economico: ${f2(mean(econ.map(x=>x.valore)))} · di un costoso: ${f2(mean(cari.map(x=>x.valore)))}`);
console.log(`  → comprare a caso tra gli economici è quasi sempre una perdita: il punto è scegliere QUALI.`);

/* ================= 2. IL SEGNALE CHE CONTA: LE PRESENZE PRECEDENTI ================= */
const fascia = x => x.prevPv >= 28 ? "28+ (era titolare)"
               : x.prevPv >= 18 ? "18-27 (mezzo titolare)"
               : x.prevPv >= 8  ? "8-17 (rotazione)"
               : x.prevPv >= 1  ? "1-7 (comparsa)"
               :                  "0 (mai visto in A)";
const ORDINE = ["28+ (era titolare)","18-27 (mezzo titolare)","8-17 (rotazione)","1-7 (comparsa)","0 (mai visto in A)"];
const tabella = (titolo, set, filtro=()=>true) => {
  console.log(`\n${titolo}`);
  console.log(`  ${"presenze l'anno prima".padEnd(24)} ${"n".padStart(4)}  ${"→ titolare".padStart(14)}  valore medio`);
  for (const f of ORDINE) {
    const s = set.filter(x => filtro(x) && fascia(x) === f);
    if (!s.length) continue;
    console.log(`  ${f.padEnd(24)} ${String(s.length).padStart(4)}  ${pct(s.filter(x=>x.titolare).length, s.length).padStart(14)}  ${f2(mean(s.map(x=>x.valore)))}`);
  }
};
console.log("\n=== 2. IL PREDITTORE PIÙ FORTE: quanto giocava già ===");
tabella("A) tra gli ECONOMICI della stagione 25-26 (quota ≤ 10):", econ);
tabella("B) CONTROPROVA su tutta la stagione 24-25 (prezzo non disponibile):", B);

/* ================= 3. IL VOTO CONTA, A PARITÀ DI SPAZIO? ================= */
console.log("\n=== 3. A parità di spazio, la media voto aggiunge informazione? ===");
const conf = (label, set, filtro) => {
  const s = set.filter(filtro);
  if (s.length < 10) { console.log(`  ${label.padEnd(52)} campione piccolo (n=${s.length})`); return; }
  console.log(`  ${label.padEnd(52)} n=${String(s.length).padStart(3)}  titolari ${pct(s.filter(x=>x.titolare).length,s.length).padStart(12)}  valore ${f2(mean(s.map(x=>x.valore)))}`);
};
for (const [nome, set] of [["25-26 economici", econ], ["24-25 tutti", B]]) {
  console.log(`  — ${nome} —`);
  conf("aveva 18+ presenze e Mv ≥ 6.10", set, x=>x.prevPv>=18 && x.prevMv!=null && x.prevMv>=6.10);
  conf("aveva 18+ presenze e Mv < 6.10", set, x=>x.prevPv>=18 && x.prevMv!=null && x.prevMv<6.10);
  conf("aveva 8-17 presenze e Mv ≥ 6.10", set, x=>x.prevPv>=8&&x.prevPv<18 && x.prevMv!=null && x.prevMv>=6.10);
  conf("aveva 8-17 presenze e Mv < 6.10", set, x=>x.prevPv>=8&&x.prevPv<18 && x.prevMv!=null && x.prevMv<6.10);
}

/* ================= 4. STAVA GIÀ CRESCENDO? ================= */
console.log("\n=== 4. La traiettoria: stava già guadagnando spazio? (economici 25-26) ===");
conf("presenze in aumento di 8+ rispetto a 2 anni prima", econ, x=>x.crescita!=null && x.crescita>=8);
conf("presenze stabili (±7)",                             econ, x=>x.crescita!=null && Math.abs(x.crescita)<8);
conf("presenze in calo di 8+",                            econ, x=>x.crescita!=null && x.crescita<=-8);

/* ================= 5. PRODUZIONE OFFENSIVA GIÀ MOSTRATA ================= */
console.log("\n=== 5. Aveva già prodotto bonus? (economici 25-26, solo chi giocava) ===");
conf("bonus/presenza ≥ 0.30 con 15+ presenze", econ, x=>x.prevBon!=null&&x.prevBon>=0.30&&x.prevPv>=15);
conf("bonus/presenza 0.10-0.29 con 15+ pres.", econ, x=>x.prevBon!=null&&x.prevBon>=0.10&&x.prevBon<0.30&&x.prevPv>=15);
conf("bonus/presenza < 0.10 con 15+ presenze",  econ, x=>x.prevBon!=null&&x.prevBon<0.10&&x.prevPv>=15);

/* ================= 6. I CASI CONCRETI ================= */
console.log("\n=== 6. I 12 economici che hanno reso di più nel 25-26 (cosa si sapeva prima) ===");
[...econ].sort((a,b)=>b.valore-a.valore).slice(0,12).forEach(x=>
  console.log(`  ${x.r} ${x.n.padEnd(20)} q${String(x.quota).padStart(2)} → ${String(x.pv).padStart(2)} pres, Fm ${x.fm.toFixed(2)}, valore ${f2(x.valore).padStart(7)}  |  anno prima: ${x.prevPv} pres${x.prevMv!=null?`, Mv ${x.prevMv.toFixed(2)}`:""}`));
console.log("\n=== 7. I 10 economici che NON hanno mai giocato (soldi buttati) ===");
[...econ].filter(x=>x.pv<=5).sort((a,b)=>b.quota-a.quota).slice(0,10).forEach(x=>
  console.log(`  ${x.r} ${x.n.padEnd(20)} q${String(x.quota).padStart(2)} → ${x.pv} presenze  |  anno prima: ${x.prevPv} pres${x.prevMv!=null?`, Mv ${x.prevMv.toFixed(2)}`:""}`));
