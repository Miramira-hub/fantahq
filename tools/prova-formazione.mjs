/* La formazione esclude davvero infortunati e squalificati? */
import { caricaApp } from "../tools/app.mjs";
const app = caricaApp();
const { KBI, GIORNATE_GIOCATE: G } = app;
const k = n => KBI.find(x => x.n === n);

function dispAuto(x, giornata){
  if(!x) return "ok";
  const via = Math.max(1, giornata - G);
  if(x.stop >= via) return "out";
  if(x.stop === 0 && (x.note||"").startsWith("⚕️")) return "dubbio";
  return x.inj>=3 ? "out" : x.inj===2 ? "dubbio" : "ok";
}
const casi = [];
const ok = (n,c) => casi.push([n,c]);
const G2 = G + 1;   // la prossima da giocare

ok("Kabasele squalificato per la 2ª → out",  dispAuto(k("Kabasele"), G2) === "out");
ok("Yildiz 9 giornate → out",                dispAuto(k("Yildiz"), G2) === "out");
ok("Zaniolo 6 giornate → out",               dispAuto(k("Zaniolo"), G2) === "out");
ok("Leao in dubbio per la 2ª → dubbio, non out", dispAuto(k("Leao"), G2) === "dubbio");
ok("Berardi caviglia, da valutare → dubbio",  dispAuto(k("Berardi"), G2) === "dubbio");
ok("Kristensen acciacco senza stop → dubbio",dispAuto(k("Kristensen T."), G2) === "dubbio");
ok("Malen sano → ok",                        dispAuto(k("Malen"), G2) === "ok");
ok("Conceicao sano → ok",                    dispAuto(k("Conceicao"), G2) === "ok");
/* chi salta solo la prossima torna disponibile se guardi più avanti */
ok("Kabasele alla 3ª → di nuovo ok",         dispAuto(k("Kabasele"), G + 2) === "ok");
ok("Yildiz alla 5ª → ancora out",            dispAuto(k("Yildiz"), G + 4) === "out");

let ko = 0;
for (const [n,c] of casi) { console.log(`  ${c?"ok  ":"KO  "}${n}`); if(!c) ko++; }
console.log(ko ? `\n❌ ${ko} prove fallite` : "\n✅ la formazione legge il bollettino");
process.exit(ko?1:0);
