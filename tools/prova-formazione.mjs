/* La formazione esclude davvero infortunati e squalificati? */
import { caricaApp } from "../tools/app.mjs";
const app = caricaApp();
/* G = l’ultima giornata prima di quella da cui conta il bollettino: le statistiche possono
   essere indietro (il 26/10 erano alla 7ª col bollettino della 9ª) */
const { KBI, BOLLETTINO_DA } = app;
const G = BOLLETTINO_DA - 1;
const k = n => KBI.find(x => x.n === n);

/* Si chiama il dispAuto VERO dell'app, non una copia: era proprio il difetto che questa
   prova doveva sorvegliare. La giornata si imposta sullo stato, che e quello che legge. */
function dispAuto(x, giornata){ app.setGiornata(giornata); return app.dispAuto(x); }

const casi = [];
const ok = (n,c) => casi.push([n,c]);
const G2 = G + 1;   // la prossima da giocare

/* il bollettino evolve e la prova evolve con lui: queste asserzioni fotografano il 31/8 */
ok("Kabasele, squalifica scontata → ok",      dispAuto(k("Kabasele"), G2) === "ok");
ok("Yildiz 9 giornate → out",                dispAuto(k("Yildiz"), G2) === "out");
ok("Rodriguez Je. 8 giornate → out",        dispAuto(k("Rodriguez Je."), G2) === "out");
ok("Leao ceduto all'estero → fuori dal db",  k("Leao") === undefined);
ok("Berardi tornato (gol alla 2ª) → ok",      dispAuto(k("Berardi"), G2) === "ok");
ok("Buongiorno rientro 30/9 → out alla 3ª",   dispAuto(k("Buongiorno"), G+2) === "out");
/* bollettino del 4/10: Venturino (operato, stop 4) salta 6ª-9ª, alla 10ª rientra da dubbio */
ok("Piccoli dopo lo stop di 2 → dubbio, non ok: rientra da un infortunio vero", dispAuto(k("Piccoli"), G+3) === "dubbio");
ok("Buongiorno fine dicembre → out alla 6ª",  dispAuto(k("Buongiorno"), G2) === "out");
ok("Gila stop 1 → out alla prossima",          dispAuto(k("Gila"), G2) === "out");
/* un'assenza BREVE (stop 1) non lascia strascichi: passata, si torna ok. Il "dubbio da
   rientro" e riservato agli stop seri (inj>=2, vedi Buongiorno alla 6ª). */
ok("Gila → ok due giornate dopo: assenza breve, nessuno strascico", dispAuto(k("Gila"), G+2) === "ok");
ok("Malen sano → ok",                        dispAuto(k("Malen"), G2) === "ok");
ok("Krstovic sano → ok",                     dispAuto(k("Krstovic"), G2) === "ok");
/* chi salta solo la prossima torna disponibile se guardi più avanti */
ok("Kabasele alla 3ª → di nuovo ok",         dispAuto(k("Kabasele"), G + 2) === "ok");
ok("Yildiz alla 5ª → ancora out",            dispAuto(k("Yildiz"), G + 4) === "out");

let ko = 0;
for (const [n,c] of casi) { console.log(`  ${c?"ok  ":"KO  "}${n}`); if(!c) ko++; }
console.log(ko ? `\n❌ ${ko} prove fallite` : "\n✅ la formazione legge il bollettino");
process.exit(ko?1:0);
