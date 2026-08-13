/* Costruisce data/calendario-2026-27.json dal file grezzo del sorteggio e lo VALIDA.
   Un calendario sbagliato è peggio di nessun calendario: se la difficoltà del turno
   la calcoli sull'avversario sbagliato, sbagli tutte le formazioni della stagione.
   Perciò qui si controlla tutto quello che deve essere vero per costruzione.

   uso: node tools/build-calendario.mjs <file-grezzo>
   formato del grezzo, una riga per giornata:  numero|Casa-Trasferta,Casa-Trasferta,... */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sorgente = process.argv[2];
if (!sorgente) { console.error("uso: node tools/build-calendario.mjs <file-grezzo>"); process.exit(1); }

const SQUADRE = ["Inter","Napoli","Roma","Milan","Juventus","Como","Atalanta","Bologna","Lazio","Fiorentina",
                 "Udinese","Torino","Cagliari","Genoa","Parma","Sassuolo","Lecce","Monza","Venezia","Frosinone"];

const giornate = fs.readFileSync(sorgente, "utf8").trim().split(/\r?\n/).map(riga => {
  const [n, resto] = riga.split("|");
  return { g: +n, gare: resto.split(",").map(x => {
    const [c, t] = x.split("-");
    return { c: c.trim(), t: t.trim() };
  })};
});

const problemi = [];
const err = m => problemi.push(m);

/* 1) struttura di ogni giornata: 10 gare, 20 squadre, nessuna che gioca due volte */
for (const { g, gare } of giornate) {
  if (gare.length !== 10) err(`giornata ${g}: ${gare.length} gare invece di 10`);
  const viste = new Set();
  for (const x of gare) for (const s of [x.c, x.t]) {
    if (!SQUADRE.includes(s)) err(`giornata ${g}: squadra sconosciuta "${s}"`);
    if (viste.has(s)) err(`giornata ${g}: ${s} compare due volte`);
    viste.add(s);
  }
  if (viste.size !== 20) err(`giornata ${g}: ${viste.size} squadre invece di 20`);
}
/* 2) numerazione: da 1 a 38 senza buchi né doppioni */
const numeri = giornate.map(x => x.g).sort((a, b) => a - b);
if (numeri.length !== 38) err(`${numeri.length} giornate invece di 38`);
numeri.forEach((n, i) => { if (n !== i + 1) err(`numerazione rotta: attesa ${i+1}, trovata ${n}`); });

/* 3) ogni squadra: 19 in casa e 19 fuori */
const casa = {}, fuori = {};
for (const { gare } of giornate) for (const x of gare) {
  casa[x.c] = (casa[x.c] || 0) + 1; fuori[x.t] = (fuori[x.t] || 0) + 1;
}
for (const s of SQUADRE) {
  if (casa[s] !== 19)  err(`${s}: ${casa[s] || 0} gare in casa invece di 19`);
  if (fuori[s] !== 19) err(`${s}: ${fuori[s] || 0} gare in trasferta invece di 19`);
}
/* 4) ogni accoppiamento due volte, una per parte (andata e ritorno) */
const coppie = {};
for (const { gare } of giornate) for (const x of gare) {
  const k = [x.c, x.t].sort().join(" / ");
  (coppie[k] = coppie[k] || []).push(x.c);
}
for (const [k, v] of Object.entries(coppie)) {
  if (v.length !== 2) err(`${k}: si incontrano ${v.length} volte invece di 2`);
  else if (v[0] === v[1]) err(`${k}: entrambe le gare in casa di ${v[0]}`);
}
if (Object.keys(coppie).length !== 190) err(`${Object.keys(coppie).length} accoppiamenti invece di 190`);

if (problemi.length) {
  console.error("❌ CALENDARIO NON VALIDO:\n  " + problemi.join("\n  "));
  process.exit(1);
}

/* indice per squadra: per ogni giornata, avversario e se gioca in casa.
   È la forma che serve al motore, che ragiona per giocatore e quindi per squadra. */
const perSquadra = {};
for (const s of SQUADRE) perSquadra[s] = new Array(39).fill(null);
for (const { g, gare } of giornate) for (const x of gare) {
  perSquadra[x.c][g] = { avv: x.t, casa: true };
  perSquadra[x.t][g] = { avv: x.c, casa: false };
}

const out = { stagione: "2026-27", inizio: "2026-08-22", giornate, perSquadra };
fs.writeFileSync(`${REPO}/data/calendario-2026-27.json`, JSON.stringify(out));
console.log(`✅ calendario valido: 38 giornate · 380 partite · 190 accoppiamenti · 19 casa e 19 trasferta per squadra`);
console.log(`   scritto data/calendario-2026-27.json`);
