/* ROSA-CONSIGLI — chi prendere tra gli SVINCOLATI VERI delle tue leghe.
   ------------------------------------------------------------------------------------
   occasioni.mjs ragiona sul listone intero: utile all'asta, cieco in stagione, quando i
   colpi buoni sono quasi tutti già in mano a qualcuno. Questo legge il BACKUP dell'app
   (Impostazioni → Esporta backup) e ragiona per lega: chi è libero DAVVERO, dove la tua
   rosa perde punti, e quali scambi svincolato-per-tuo convengono.

   Valore e verdetti vengono dal motore vero (expFM/advice via app.mjs): un solo motore.
   L'aggancio è per extId (Id ufficiale). Un giocatore del listone nuovo che nella lega
   non esiste ancora è FREE con l'etichetta [dopo sync]: entra quando la lega fa
   "Aggiorna al database".

   uso:  node tools/rosa-consigli.mjs <backup.json> [nomeLega]
*/
import fs from "fs";
import { caricaApp } from "./app.mjs";

const [backupPath, filtroLega] = process.argv.slice(2);
if (!backupPath) { console.log("uso: node tools/rosa-consigli.mjs <backup.json> [nomeLega]"); process.exit(1); }

const grezzo = fs.readFileSync(backupPath, "utf8");
/* il backup entra nell'app come se fosse il suo localStorage: gli scambi li calcola
   tradeIdeas() di index.html, la stessa funzione del tab Scambi, non una copia */
const app = caricaApp({ storage: { fantahq_v3: grezzo } });
app.load();
const { KBI, expFM, advice, ROLE_MEAN, ROLES, ROLE_NAMES } = app;
const perExt = new Map(KBI.filter(k => k.extId).map(k => [String(k.extId), k]));
const valore = k => +(expFM(k) - ROLE_MEAN[k.r]).toFixed(2);
const campo = k => k.pvOra ? `fm ${k.fmOra} su ${k.pvOra}` : "mai a voto";
const TIER = { must:"DA PRENDERE", target:"obiettivo", bet:"scommessa", safe:"usato sicuro",
               watch:"da monitorare", avoid:"da evitare", filler:"riempitivo", nd:"—" };
const RUOLO = { P:"Por", D:"Dif", C:"Cen", A:"Att" };

const b = JSON.parse(grezzo);
for (const id of b.order) {
  const { name, state: st } = b.leagues[id];
  if (filtroLega && !name.toLowerCase().includes(filtroLega.toLowerCase())) continue;

  const presi = new Set(st.players.filter(p => p.status !== "free").map(p => String(p.extId)));
  const miei = st.players.filter(p => p.status === "mine");
  const speso = miei.reduce((s, p) => s + (p.paid || 0), 0);
  console.log(`\n${"═".repeat(64)}\nLEGA ${name} — budget ${st.settings.budget}, spesi ${speso}, disponibili ${st.settings.budget - speso}`);

  /* la mia rosa, giudicata dal motore */
  console.log(`\nLA TUA ROSA (▼ = anello debole del reparto)`);
  const deboli = {};
  for (const r of ROLES) {
    const gruppo = miei.filter(p => p.role === r)
      .map(p => ({ p, k: perExt.get(String(p.extId)) }))
      .map(x => ({ ...x, v: x.k ? valore(x.k) : -9, tier: x.k ? advice(x.k).tier : "nd" }))
      .sort((a, b) => b.v - a.v);
    if (gruppo.length) deboli[r] = gruppo[gruppo.length - 1];
    for (const [i, x] of gruppo.entries()) {
      const peggiore = i === gruppo.length - 1 && gruppo.length > 1 ? "▼" : " ";
      const extra = x.k ? `${x.v >= 0 ? "+" : ""}${x.v.toFixed(2)}  tit ${String(x.k.tit).padStart(3)}%  ${TIER[x.tier]}` : "non nel db (venduto/uscito?)";
      console.log(`  ${peggiore} ${RUOLO[r]} ${x.p.name.padEnd(18)} pagato ${String(x.p.paid || 0).padStart(3)}  ${extra}`);
    }
  }

  /* svincolati veri, per ruolo: liberi in QUESTA lega e vivi nel db */
  console.log(`\nSVINCOLATI MIGLIORI (liberi in questa lega, motore alla mano)`);
  for (const r of ROLES) {
    const liberi = KBI.filter(k => k.r === r && k.extId && !presi.has(String(k.extId))
        && k.inj < 3 && k.unc < 3)
      .map(k => ({ k, v: valore(k), inLega: st.players.some(p => String(p.extId) === String(k.extId)) }))
      .filter(x => x.v > -0.2)
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
    console.log(`  — ${ROLE_NAMES[r]} —`);
    for (const x of liberi)
      console.log(`    ${x.k.n.padEnd(18)} ${x.k.t.padEnd(11)} q${String(x.k.qta).padStart(3)}  ` +
        `${x.v >= 0 ? "+" : ""}${x.v.toFixed(2)}  tit ${String(x.k.tit).padStart(3)}%  ${TIER[advice(x.k).tier]}` +
        (x.inLega ? "" : "  [dopo sync]") + (x.k.pvOra === 0 ? "  ⚠ 0 presenze" : ` (${x.k.pvOra}/${app.GIORNATE_GIOCATE})`));
  }

  /* svincolo-e-prendi: nelle leghe dell'utente gli svincolati si prendono solo a GENNAIO,
     quindi questa sezione è una lista d'attesa, non un'azione */
  console.log(`\nDA GENNAIO — svincolato ≥ +0.15 sul tuo anello debole (fino ad allora non si può)`);
  let trovato = false;
  for (const r of ROLES) {
    const d = deboli[r]; if (!d || !d.k) continue;
    const migliori = KBI.filter(k => k.r === r && k.extId && !presi.has(String(k.extId))
        && k.inj < 3 && k.unc < 3 && k.tit >= 70 && valore(k) >= d.v + 0.15)
      .sort((a, b) => valore(b) - valore(a)).slice(0, 3);
    for (const m of migliori) {
      trovato = true;
      console.log(`  ${RUOLO[r]}: dentro ${m.n} (${m.t}, ${valore(m) >= 0 ? "+" : ""}${valore(m).toFixed(2)}, tit ${m.tit}%) — fuori ${d.p.name} (${d.v >= 0 ? "+" : ""}${d.v.toFixed(2)})`);
    }
  }
  if (!trovato) console.log("  (nessuno svincolato nettamente migliore)");

  /* ---- SCAMBI CON I RIVALI: li decide tradeIdeas() dell'app (regole e filtri sono lì) ---- */
  app.selectLeague(id);
  app.setGiornata(app.GIORNATE_GIOCATE + 1);
  const idee = app.tradeIdeas();
  console.log(`
SCAMBI CON I RIVALI per la ${app.GIORNATE_GIOCATE + 1}ª — 1 per 1, stesso ruolo, quota alla pari, campo e bollettino controllati`);
  if (!idee.length) console.log("  (nessuno scambio che convenga davvero)");
  for (const { m, x, fermo, guadagno } of idee)
    console.log(`  ${RUOLO[m.k.r]}: cedi ${m.p.name} (q${m.k.qta}, ${campo(m.k)})  →  prendi ${x.k.n} (${x.k.t}, q${x.k.qta}, ${campo(x.k)}, tit ${x.k.tit}%) da ${app.managerName(x.p.owner)}  ·  ` +
      (fermo ? "il tuo è fermo: un titolare sano vale di più" : `guadagno +${guadagno.toFixed(2)}`));

}
console.log(`\nNB: i nomi [dopo sync] esistono nel listone nuovo ma non ancora nella lega — entrano con "Aggiorna al database".`);
