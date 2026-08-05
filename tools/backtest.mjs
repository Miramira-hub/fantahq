/* Backtest dei pesi del motore sul 2025-26.
   Idea: la parte di fantamedia che il motore prova a prevedere con i suoi bump
   (rigorista, squadra forte, età) è il TASSO BONUS = (3*gol + 1*assist) / presenze.
   Qui lo misuriamo sul 2025-26 reale (Understat) e verifichiamo quanto ogni fattore
   sposta il tasso bonus OLTRE quello che la quota pre-stagione già prezzava.

   Metodo: baseline bonusRate ~ a + b*ln(quota 25-26) per ruolo (la quota è l'unica
   informazione pre-stagione), poi media dei residui per gruppo (rigoristi, squadre
   per gol totali, fasce d'età). Il residuo medio del gruppo È il peso in punti FM.

   Limiti dichiarati: niente portieri (Understat non ha clean sheet), rigoristi/età
   presi dallo snapshot di fine stagione (lievemente ottimisti), una sola stagione. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const norm = s => String(s).toLowerCase()
  .replace(/[øØ]/g,"o").replace(/[đĐ]/g,"d").replace(/ł/g,"l").replace(/þ/g,"th").replace(/ß/g,"ss").replace(/æ/g,"ae")
  .replace(/['’ʼ]/g,"")
  .normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
const toks = n => norm(n).split(" ").filter(w => w.length >= 3);

/* snapshot 25-26: quota pre-stagione, ruolo, rigorista, età */
const snap = [...fs.readFileSync(`${REPO}/data/kb-2025-26-snapshot.js`, "utf8")
  .matchAll(/^\["([PDCA])","([^"]+)","([^"]+)",(\d+),([\d.]+),(\d),(\d+),(\d+),(\d+),(\d),(\d+),(\d),(\d),(\d+),(\d),(\d),"([^"]*)"\]/gm)]
  .map(m => ({ r:m[1], n:m[2], t:m[3], q:+m[4], rig:+m[10], age:+m[14] }));

/* produzione reale 25-26 */
const US = JSON.parse(fs.readFileSync(`${REPO}/data/understat-2025-26.json`, "utf8"))
  .map(r => ({ n:r[0], t:r[1], min:r[2], gp:r[3], gol:r[4], xg:r[5], ass:r[6], xa:r[7], npxg:r[8] }));
const USBY = new Map();
for (const u of US) for (const t of toks(u.n)) { if (!USBY.has(t)) USBY.set(t, []); if (!USBY.get(t).includes(u)) USBY.get(t).push(u); }
const findUS = p => {
  const c = USBY.get(toks(p.n).at(-1)) || [];
  if (c.length === 1) return c[0];
  const byTeam = c.filter(u => norm(u.t) === norm(p.t));
  return byTeam.length === 1 ? byTeam[0] : null;
};

/* gol di squadra 25-26 (proxy della forza d'attacco) */
const teamGoals = {};
for (const u of US) teamGoals[u.t] = (teamGoals[u.t] || 0) + u.gol;
const teams = Object.entries(teamGoals).sort((a,b)=>b[1]-a[1]);
const atkOf = t => { const i = teams.findIndex(x=>x[0]===t); return i < 4 ? 5 : i < 10 ? 4 : i < 16 ? 3 : 2; };

/* campione: movimento con >=15 presenze e quota nota */
const sample = [];
for (const p of snap) {
  if (p.r === "P") continue;
  const u = findUS(p);
  if (!u || u.gp < 15) continue;
  sample.push({ ...p, gp:u.gp, bonus:(3*u.gol + u.ass)/u.gp, atk:atkOf(u.t), dG:u.gol-u.xg, xgPres:(3*u.xg + u.xa)/u.gp });
}

/* baseline per ruolo: bonus ~ a + b*ln(q) */
const REGR = {};
for (const r of ["D","C","A"]) {
  const s = sample.filter(x=>x.r===r);
  const n=s.length, sx=s.reduce((a,k)=>a+Math.log(k.q),0), sy=s.reduce((a,k)=>a+k.bonus,0);
  const sxy=s.reduce((a,k)=>a+Math.log(k.q)*k.bonus,0), sxx=s.reduce((a,k)=>a+Math.log(k.q)**2,0);
  const b=(n*sxy-sx*sy)/(n*sxx-sx*sx||1), a=(sy-b*sx)/n;
  REGR[r]={a,b,n};
}
const pred = x => REGR[x.r].a + REGR[x.r].b*Math.log(x.q);
for (const x of sample) x.res = x.bonus - pred(x);

const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
const grp = (label, f) => {
  const g = sample.filter(f);
  console.log(`  ${label}: residuo medio ${g.length?mean(g.map(x=>x.res)).toFixed(3):"n/d"} FM (n=${g.length})`);
};

console.log(`campione: ${sample.length} giocatori di movimento (>=15 presenze)\n`);
console.log("baseline bonus~ln(quota):", Object.entries(REGR).map(([r,v])=>`${r}: ${v.a.toFixed(2)}+${v.b.toFixed(3)}*ln(q) n=${v.n}`).join(" | "));

console.log("\n== RIGORISTI (peso attuale nel motore: +0.15 primo, +0.05 alternativa) ==");
grp("primo rigorista (rig=2)", x=>x.rig===2);
grp("alternativa (rig=1)",     x=>x.rig===1);
grp("non rigorista",           x=>x.rig===0);

console.log("\n== FORZA ATTACCO SQUADRA (peso attuale: +0.10 per punto sopra 3, solo C/A) ==");
for (const a of [5,4,3,2]) grp(`squadre atk=${a} (C/A)`, x=>x.atk===a && (x.r==="C"||x.r==="A"));
for (const a of [5,4,3,2]) grp(`squadre atk=${a} (D)`,   x=>x.atk===a && x.r==="D");

console.log("\n== ETÀ (pesi attuali: -0.15 a 35+, -0.25 a 38+, +0.05 U21) ==");
grp("38+ anni", x=>x.age>=38);
grp("35-37",    x=>x.age>=35&&x.age<38);
grp("22-34",    x=>x.age>21&&x.age<35);
grp("U21",      x=>x.age<=21);

console.log("\n== SOVRA/SOTTO-PERFORMANCE xG (per calibrare il fattore di regressione) ==");
/* quanto del tasso bonus REALE è spiegato dal tasso bonus ATTESO (xG-based)?
   la correlazione bonus-vs-xgBonus dice quanto pesare l'xG nella proiezione */
const cor = (xs,ys) => { const mx=mean(xs), my=mean(ys);
  const num=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
  const den=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
  return num/(den||1); };
console.log("  correlazione tasso bonus reale vs atteso(xG):", cor(sample.map(x=>x.bonus), sample.map(x=>x.xgPres)).toFixed(3));
grp("chi ha segnato 3+ gol SOPRA l'xG", x=>x.dG>=3);
grp("chi ha segnato 3+ gol SOTTO l'xG", x=>x.dG<=-3);
console.log("  (residuo positivo dei sopra-xG = quota già alta non basta a spiegare i gol extra:");
console.log("   la parte NON sostenibile va scontata nella proiezione 26-27 → giustifica il malus xgd)");
