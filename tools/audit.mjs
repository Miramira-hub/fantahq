/* AUDIT — le contraddizioni da guardare a ogni giro (deve dare zero, o una nota per ognuno).
   ------------------------------------------------------------------------------------
   Chi il motore dà titolare (titolarità ≥ 74) ma non ha mai preso voto, e non è nel
   bollettino: o c'è una spiegazione scritta in nota (spezzoni senza voto, condizione, mai
   convocato) e allora la gerarchia va abbassata in XI_STATUS, o è un dato sbagliato.
   Così sono venuti fuori Kaiki, Ahanor, Hutchinson, Nzola.

   uso:  node tools/audit.mjs
*/
import { caricaApp } from "./app.mjs";
const { KBI } = caricaApp();

/* chi è nel bollettino (nota ⚕️) è già spiegato: le sue assenze sono l’infortunio */
const spiegato = k => k.inj || (k.note || "").startsWith("⚕️");
const sospetti = KBI.filter(k => k.tit >= 74 && !k.pvOra && !spiegato(k));
console.log(`AUDIT — titolarità ≥ 74, zero voti, fuori dal bollettino: ${sospetti.length}`);
for (const k of sospetti) console.log(`  ${k.r} ${k.n} (${k.t}) tit ${k.tit} q${k.qta} | ${k.note.slice(0, 120)}`);

const pochi = KBI.filter(k => k.tit >= 80 && k.pvOra > 0 && k.pvOra <= 2 && !spiegato(k));
console.log(`\nTitolarità ≥ 80 ma al massimo 2 voti: ${pochi.length}`);
for (const k of pochi) console.log(`  ${k.r} ${k.n} (${k.t}) ${k.pvOra} voti, tit ${k.tit}`);
process.exit(sospetti.length ? 1 : 0);
