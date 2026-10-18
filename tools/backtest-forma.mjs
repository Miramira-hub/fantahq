/* BACKTEST-FORMA — la forma recente predice il futuro meglio di quello che usa già il motore?
   ------------------------------------------------------------------------------------
   Fino alla raccolta SofaScore avevamo solo totali di stagione: "chi parte forte continua"
   non si poteva misurare (vedi scovatore.mjs). Con i dati partita per partita sì.

   Per ogni stagione S con la S-1 disponibile, a ogni punto di controllo (dopo la 5ª, 10ª,
   ... giornata) si guarda chi ha giocato e si prova a prevedere le 5 giornate DOPO:
     · produzione: (gol + assist) ogni 90', fra chi gioca almeno 180' nelle 5 successive
     · minuti: quanti ne gioca nelle 5 successive (la titolarità)
   con predittori diversi, e si misura chi ci va più vicino (correlazione di Pearson pesata
   per i minuti, e errore medio). Il motore cambia solo se un predittore nuovo batte con
   margine quello che usa già: la stagione prima.

   L'identità è l'id SofaScore, stabile fra le stagioni: per il backtest non serve l'aggancio
   agli Id ufficiali. Portieri esclusi dalla produzione (non fanno gol e assist).

   uso:  node tools/backtest-forma.mjs
*/
import fs from "fs";
import path from "path";
import { REPO } from "./app.mjs";

const DIR = path.join(REPO, "data", "sofascore");
const STAGIONI = ["2023-24", "2024-25", "2025-26", "2026-27"].filter(s => fs.existsSync(path.join(DIR, `${s}.json`)));
const CONTROLLI = [5, 10, 15, 20, 25, 30];
const FINESTRA = 5;

/* per stagione: id → { pos, giornate: Map(g → {min,ga,xga,tiri,voto}) } */
function carica(st) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, `${st}.json`), "utf8"));
  const gioc = new Map();
  for (const g of raw.giornate) for (const p of g.partite) for (const x of p.giocatori) {
    const s = x.st, min = s.minutesPlayed || 0;
    const v = gioc.get(x.id) || { pos: x.pos, giornate: new Map() };
    const o = v.giornate.get(g.giornata) || { min: 0, ga: 0, xga: 0, tiri: 0, voto: null };
    o.min += min; o.ga += (s.goals || 0) + (s.goalAssist || 0);
    o.xga += (s.expectedGoals || 0) + (s.expectedAssists || 0); o.tiri += s.totalShots || 0;
    if (s.rating) o.voto = s.rating;
    v.giornate.set(g.giornata, o); gioc.set(x.id, v);
  }
  return gioc;
}
const somma = (v, da, a, k) => { let t = 0; for (let g = da; g <= a; g++) t += v.giornate.get(g)?.[k] || 0; return t; };
const per90 = (x, min) => min > 0 ? 90 * x / min : NaN;

function pearsonPesata(xs, ys, ws) {
  let W = 0, mx = 0, my = 0;
  for (let i = 0; i < xs.length; i++) { W += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= W; my /= W;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += ws[i] * dx * dy; sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}
/* errore medio dopo aver riportato il predittore sulla scala del bersaglio (regressione
   lineare pesata): confronta la capacità di ordinare E di stimare il livello */
function errore(xs, ys, ws) {
  let W = 0, mx = 0, my = 0;
  for (let i = 0; i < xs.length; i++) { W += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= W; my /= W;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); sxx += ws[i] * (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0, a = my - b * mx;
  let e = 0; for (let i = 0; i < xs.length; i++) e += ws[i] * Math.abs(a + b * xs[i] - ys[i]);
  return e / W;
}

const dati = Object.fromEntries(STAGIONI.map(s => [s, carica(s)]));
const prod = {}, minuti = {};
const aggiungi = (tab, nome, x, y, w) => { if (!Number.isFinite(x) || !Number.isFinite(y)) return; (tab[nome] ??= { xs: [], ys: [], ws: [] }); tab[nome].xs.push(x); tab[nome].ys.push(y); tab[nome].ws.push(w); };

for (let i = 1; i < STAGIONI.length; i++) {
  const ora = dati[STAGIONI[i]], prima = dati[STAGIONI[i - 1]];
  const ultima = Math.max(...[...ora.values()].flatMap(v => [...v.giornate.keys()]));
  /* medie di ruolo della stagione prima: base per chi non ha storico */
  const mediaRuolo = {};
  for (const v of prima.values()) { const m = somma(v, 1, 38, "min"); if (m < 900) continue;
    (mediaRuolo[v.pos] ??= [0, 0]); mediaRuolo[v.pos][0] += somma(v, 1, 38, "ga"); mediaRuolo[v.pos][1] += m; }
  for (const g0 of CONTROLLI) {
    if (g0 + FINESTRA > ultima) continue;
    for (const [id, v] of ora) {
      const minFin = somma(v, 1, g0, "min");
      const minDopo = somma(v, g0 + 1, g0 + FINESTRA, "min");
      const p = prima.get(id);
      const minPrima = p ? somma(p, 1, 38, "min") : 0;
      /* --- minuti: tra chi ha giocato almeno una volta finora --- */
      if (minFin > 0) {
        aggiungi(minuti, "stagione prima (minuti/38)", p ? minPrima / 38 : 0, minDopo / FINESTRA, 1);
        aggiungi(minuti, "finora (minuti/giornata)", minFin / g0, minDopo / FINESTRA, 1);
        aggiungi(minuti, "ultime 3 (minuti/giornata)", somma(v, g0 - 2, g0, "min") / 3, minDopo / FINESTRA, 1);
        aggiungi(minuti, "mix: 1/2 finora + 1/2 ultime 3", (minFin / g0 + somma(v, g0 - 2, g0, "min") / 3) / 2, minDopo / FINESTRA, 1);
      }
      /* --- produzione: movimento, almeno 180' finora e 180' dopo --- */
      if (v.pos === "G" || minFin < 180 || minDopo < 180) continue;
      const y = per90(somma(v, g0 + 1, g0 + FINESTRA, "ga"), minDopo);
      const base = mediaRuolo[v.pos] ? 90 * mediaRuolo[v.pos][0] / mediaRuolo[v.pos][1] : 0.2;
      const pPrima = minPrima >= 900 ? per90(somma(p, 1, 38, "ga"), minPrima) : base;
      const pPrimaX = minPrima >= 900 ? per90(somma(p, 1, 38, "xga"), minPrima) : base;
      const gaFin = per90(somma(v, 1, g0, "ga"), minFin), xgaFin = per90(somma(v, 1, g0, "xga"), minFin);
      const min5 = somma(v, g0 - 4, g0, "min");
      const xga5 = min5 >= 90 ? per90(somma(v, g0 - 4, g0, "xga"), min5) : xgaFin;
      const peso = minFin / (minFin + 900);           // quanto credere a quest'anno: 900' = metà
      aggiungi(prod, "A · stagione prima, G+A/90 (il motore oggi)", pPrima, y, minDopo);
      aggiungi(prod, "B · stagione prima, xG+xA/90", pPrimaX, y, minDopo);
      aggiungi(prod, "C · finora, G+A/90", gaFin, y, minDopo);
      aggiungi(prod, "D · finora, xG+xA/90", xgaFin, y, minDopo);
      aggiungi(prod, "E · ultime 5, xG+xA/90", xga5, y, minDopo);
      aggiungi(prod, "F · mix stagione prima + finora G+A", (1 - peso) * pPrima + peso * gaFin, y, minDopo);
      aggiungi(prod, "G · mix stagione prima xG+xA + finora xG+xA", (1 - peso) * pPrimaX + peso * xgaFin, y, minDopo);
      aggiungi(prod, "H · mix G: stagione prima G+A + finora xG+xA", (1 - peso) * pPrima + peso * xgaFin, y, minDopo);
    }
  }
}

const stampa = (titolo, tab) => {
  console.log(`\n${titolo}`);
  const righe = Object.entries(tab).map(([n, t]) => [n, pearsonPesata(t.xs, t.ys, t.ws), errore(t.xs, t.ys, t.ws), t.xs.length]);
  righe.sort((a, b) => b[1] - a[1]);
  for (const [n, r, e, k] of righe) console.log(`  ${n.padEnd(50)} r = ${r.toFixed(3)}   errore medio ${e.toFixed(3)}   (n=${k})`);
};
console.log(`stagioni: ${STAGIONI.join(", ")} · punti di controllo ${CONTROLLI.join(", ")} · finestra ${FINESTRA} giornate`);
stampa("PRODUZIONE — gol+assist ogni 90' nelle 5 giornate successive (più r è alto, meglio predice)", prod);
stampa("MINUTI — minuti a giornata nelle 5 successive", minuti);
