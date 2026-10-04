/* La formazione esclude davvero infortunati e squalificati? */
import { caricaApp } from "../tools/app.mjs";
const app = caricaApp();
const { KBI, GIORNATE_GIOCATE: G } = app;
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
ok("Zaniolo 6 giornate → out",               dispAuto(k("Zaniolo"), G2) === "out");
ok("Leao ceduto all'estero → fuori dal db",  k("Leao") === undefined);
ok("Berardi tornato (gol alla 2ª) → ok",      dispAuto(k("Berardi"), G2) === "ok");
ok("Buongiorno rientro 30/9 → out alla 3ª",   dispAuto(k("Buongiorno"), G+2) === "out");
/* bollettino del 4/10: Venturino (operato, stop 4) salta 6ª-9ª, alla 10ª rientra da dubbio */
ok("Venturino alla 10ª → dubbio, non ok: rientra da un'operazione", dispAuto(k("Venturino"), G+5) === "dubbio");
ok("Buongiorno fine dicembre → out alla 6ª",  dispAuto(k("Buongiorno"), G2) === "out");
ok("McTominay rientro 11/10 → out alla 6ª",    dispAuto(k("McTominay"), G2) === "out");
/* un'assenza BREVE (stop 1) non lascia strascichi: passata, si torna ok. Il "dubbio da
   rientro" e riservato agli stop seri (inj>=2, vedi Buongiorno alla 6ª). */
ok("McTominay → ok alla 7ª: assenza breve, nessuno strascico", dispAuto(k("McTominay"), G+2) === "ok");
ok("Malen sano → ok",                        dispAuto(k("Malen"), G2) === "ok");
ok("Conceicao sano → ok",                    dispAuto(k("Conceicao"), G2) === "ok");
/* chi salta solo la prossima torna disponibile se guardi più avanti */
ok("Kabasele alla 3ª → di nuovo ok",         dispAuto(k("Kabasele"), G + 2) === "ok");
ok("Yildiz alla 5ª → ancora out",            dispAuto(k("Yildiz"), G + 4) === "out");

let ko = 0;
for (const [n,c] of casi) { console.log(`  ${c?"ok  ":"KO  "}${n}`); if(!c) ko++; }
console.log(ko ? `\n❌ ${ko} prove fallite` : "\n✅ la formazione legge il bollettino");
process.exit(ko?1:0);
