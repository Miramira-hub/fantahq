/* OCCASIONI — i colpi che il campo ha già rivelato e il prezzo non ha ancora recepito.
   ------------------------------------------------------------------------------------
   A settembre si rifà un'asta completa a mercato chiuso. La differenza fra quell'asta e
   quella di agosto è che stavolta qualche giornata si è giocata: non si compra più su
   probabili formazioni e amichevoli, si compra su chi è sceso in campo davvero.

   COSA VUOL DIRE "OCCASIONE", e perché la prima versione sbagliava.
   La prima versione di questo strumento si era costruita una metrica sua — quanto la
   fantamedia dell'anno scorso stava sopra la retta fm = a + b*ln(quota) — e ordinava per
   quella. È sbagliato, e si vede subito su un caso: N'Dri, attaccante del Lecce da 3
   crediti, risultava secondo in classifica perché rendeva +0.45 sopra quello che il suo
   prezzo lasciava prevedere. Ma la sua fantamedia attesa è 6.21 contro una media di ruolo
   di 6.60: è 0.39 SOTTO il livello di un attaccante qualunque. Non è un colpo, è un
   riempitivo che costa poco. Il motore dell'app infatti lo classifica "filler".

   Quindi il valore si misura come lo misura il motore: FM ATTESA MENO LA MEDIA DEL RUOLO.
   È quanto quel giocatore rende in più rispetto a un titolare qualsiasi del suo reparto —
   la stessa idea del VORP che l'app usa per i prezzi. Sotto zero non c'è occasione che
   tenga: qualunque sia il prezzo, stai comprando meno della media.

   E la FM attesa la calcola `expFM` di index.html, non una sua imitazione: tiene dentro i
   minuti giocati, la forza della squadra, il profilo dell'allenatore, i rigori, l'età, gli
   infortuni, la regressione xG e la base pluriennale 65/35. Riscriverne una copia qui
   significherebbe avere due motori che si contraddicono — che è esattamente l'errore che
   questo commento documenta.

   IL LIMITE, DETTO SUBITO. tools/scovatore.mjs ha misurato su tre stagioni che "era già
   titolare l'anno prima" predice le esplosioni da pochi crediti (53% contro il 19% medio).
   "Ha giocato le prime giornate" NON è stato misurato: i file storici hanno solo aggregati
   di stagione, non giornata per giornata, quindi quel backtest non è proprio possibile con
   i dati che abbiamo. Quello che segue è un indizio col campione dichiarato, non un peso
   calibrato. Con 1-2 giornate è un sussurro; con 4-5 comincia a essere una voce.

   Uso:  node tools/occasioni.mjs [quotaMax] [--tutti]
         quotaMax: soglia di prezzo (default 12 crediti)
         --tutti:  stampa ogni nome, non solo i primi 10 per famiglia
*/
import { caricaApp } from "./app.mjs";

const ARGS = process.argv.slice(2);
const TUTTI = ARGS.includes("--tutti");
const QMAX = +ARGS.find(a => /^\d+$/.test(a)) || 12;
const app = caricaApp();
const { KBI: P, expFM, advice, ROLE_MEAN, GIORNATE_GIOCATE: G, giornateDi } = app;

if (!G) {
  console.log("Nessuna giornata giocata in data/statistiche-2026-27.json: senza campo non ci sono occasioni da scovare.");
  process.exit(0);
}

/* ---- valore: quanto rende sopra un titolare qualunque del suo ruolo ---- */
const valore = k => +(expFM(k) - ROLE_MEAN[k.r]).toFixed(2);
const tier = k => { const a = advice(k); return (a && a.tier) || String(a); };
const TIER_IT = { must:"DA PRENDERE", target:"obiettivo", bet:"scommessa", safe:"usato sicuro",
                  watch:"da monitorare", avoid:"da evitare", filler:"riempitivo", nd:"senza dati" };

/* XI_STATUS non è nel database, ma il builder lo ha già impresso dentro `tit`:
   T alza a 88+, B+ resta fra 74 e 84, B- scende sotto 60, R sotto 42. Si legge da lì. */
const TITOLARE = k => k.tit >= 88;
const PANCHINA = k => k.tit < 70;
const SEMPRE   = k => k.pvOra === giornateDi(k.t);   // tutte le giornate DELLA SUA squadra: coi posticipi i conteggi divergono
const SANO     = k => k.inj < 2;
const FERMO    = k => k.inj >= 3;         // 4+ giornate di stop: il posto si libera davvero

const RUOLO = { P:"Por", D:"Dif", C:"Cen", A:"Att" };
const TUTTE = G === 1 ? "nella 1ª giornata" : `in tutte e ${G} le giornate`;
const N_MAX = TUTTI ? Infinity : 10;
/* Il builder accetta una fantamedia come "reale" già da 5 presenze; sotto le 12 quel numero
   balla, e siccome entra nella FM attesa va detto su cosa si sta scommettendo. */
const THIN = 12;

const fmt = k => {
  const v = valore(k), bonus = (k.golOra || k.assOra) ? ` ${k.golOra}g${k.assOra ? "/"+k.assOra+"a" : ""}` : "";
  return `  ${RUOLO[k.r]} ${k.n.padEnd(18)} ${k.t.padEnd(11)} ${String(k.qta).padStart(3)}cr  ` +
    `tit ${String(k.tit).padStart(3)}%  ${k.pvOra}/${G}${bonus.padEnd(7)} ` +
    /* "-0.45 sopra la media" non si legge: sotto zero cambia la parola, non solo il segno. */
    `${v >= 0 ? "+" : ""}${v.toFixed(2)} ${v >= 0 ? "sopra" : "SOTTO"} la media ${RUOLO[k.r]}  · ${TIER_IT[tier(k)] || tier(k)}` +
    (k.est ? "  ⚠ fm stimata dalla quota" : k.pres < THIN ? `  ⚠ fm su sole ${k.pres} presenze` : "");
};
const sezione = (titolo, spiega, lista) => {
  console.log(`\n${titolo}\n  ${spiega}`);
  if (!lista.length) { console.log("  (nessuno questa settimana)"); return; }
  lista.slice(0, N_MAX).forEach(k => console.log(fmt(k)));
  if (lista.length > N_MAX) console.log(`  … e altri ${lista.length - N_MAX} oltre i primi ${N_MAX} — rilancia con --tutti per vederli.`);
};
/* Sotto la media del ruolo non è un'occasione, per quanto costi poco. */
const utili = l => l.filter(k => valore(k) > 0).sort((a,b) => valore(b) - valore(a));

console.log(`OCCASIONI — database del ${app.DATA.date}`);
console.log(`Giornate giocate: ${G}. Soglia prezzo: fino a ${QMAX} crediti.`);
console.log(`Valore = FM attesa (motore dell'app) meno la media del ruolo: ` +
  ["P","D","C","A"].map(r => `${r} ${ROLE_MEAN[r].toFixed(2)}`).join("  "));
console.log(`\n⚠️ Con ${G} ${G === 1 ? "giornata" : "giornate"} il campo è un indizio, non una prova.` +
  ` Il peso che il motore gli dà è ${(Math.min(0.80, G/12)*100).toFixed(0)}%.`);

/* ---- 1. titolari pagati come riserve ----
   Il profilo che scovatore.mjs ha già misurato come il più affidabile fra gli economici:
   conta quanto giocava già, non quanto era bravo quando giocava. */
sezione(
  "① TITOLARI A DUE LIRE — costano poco, giocano, e rendono sopra il loro reparto",
  `quota ≤ ${QMAX}, titolari nelle formazioni vere, a referto ${TUTTE}, sani e senza mercato aperto.`,
  utili(P.filter(k => k.qta <= QMAX && TITOLARE(k) && SEMPRE(k) && SANO(k) && k.unc < 2))
);

/* ---- 2. chi entra e porta a casa il voto ----
   Non è titolare, e le formazioni vere lo confermano. Ma prende voto lo stesso: per
   l'ultimo slot vale più di un titolare che non fa mai bonus. */
sezione(
  "② SUBENTRANTI CHE PRENDONO VOTO — l'ultimo slot che non resta vuoto",
  `quota ≤ ${QMAX}, dati dietro nelle gerarchie (tit < 70%), eppure a referto ${TUTTE}.`,
  utili(P.filter(k => k.qta <= QMAX && PANCHINA(k) && SEMPRE(k) && SANO(k)))
);

/* ---- 3. il posto si è liberato ----
   Il caso Bowie: Pinamonti è rimasto al Sassuolo ma è infortunato, e il centravanti
   diventa un altro. È l'occasione che il listone recepisce sempre in ritardo, perché la
   quota si muove sui trasferimenti, non sulle infermerie. */
const fermiPerReparto = new Map();
for (const k of P.filter(FERMO)) {
  const key = k.t + "|" + k.r;
  if (!fermiPerReparto.has(key)) fermiPerReparto.set(key, []);
  fermiPerReparto.get(key).push(k);
}
const promossi = utili(P.filter(k => k.qta <= QMAX && SANO(k) && k.pvOra > 0))
  .map(k => ({ k, davanti: (fermiPerReparto.get(k.t + "|" + k.r) || []).filter(f => f.qta > k.qta) }))
  .filter(x => x.davanti.length);
console.log(`\n③ PROMOSSI DALL'INFERMERIA — davanti a loro si è liberato il posto`);
console.log(`  quota ≤ ${QMAX}, già a referto, sopra la media del ruolo, con un compagno di reparto più caro fermo per 4+ giornate.`);
if (!promossi.length) console.log("  (nessuno questa settimana)");
promossi.slice(0, N_MAX).forEach(({k, davanti}) =>
  console.log(fmt(k) + `\n      ↳ fermo davanti a lui: ${davanti.map(f => `${f.n} (${f.qta}cr)`).join(", ")}`));
if (promossi.length > N_MAX) console.log(`  … e altri ${promossi.length - N_MAX} oltre i primi ${N_MAX} — rilancia con --tutti per vederli.`);

/* ---- 4. le trappole ----
   Speculare alle occasioni: a settembre si rischia di ricomprare a prezzo pieno chi ad
   agosto era dato titolare e da allora non si è ancora visto. Qui NON si filtra per
   valore: il punto è proprio che valgono e non giocano. */
/* Chi è nel bollettino di OGGI non è una trappola: la sua assenza è spiegata, e vale anche
   per le squalifiche, che stanno in INJURY come tutto il resto. Il dato c'è già senza
   aggiungere colonne — il builder mette ⚕️ in testa alla nota solo a chi ha una voce viva.
   Senza questo controllo il report accusava Kabasele, che è semplicemente squalificato per
   la 2ª, e Berardi, fermo alla caviglia. Il campo `inj` da solo non basta: vale 1 sia per un
   dubbio di oggi sia per la fragilità ereditata dallo storico. */
const inBollettino = k => (k.note || "").startsWith("⚕️");
/* Un nuovo arrivo non può essere una trappola: non era qui quando le giornate si giocavano.
   Per lui il prezzo compra una GERARCHIA dichiarata, non un campo verificato — che è un
   rischio diverso, e merita una sezione sua invece di un'accusa sbagliata. */
const trappole = P.filter(k => !k.newT && k.pvOra === 0 && k.tit >= 70 && SANO(k) && !inBollettino(k)).sort((a,b) => b.qta - a.qta);
const nuoviSenzaCampo = P.filter(k => k.newT && k.pvOra === 0 && k.tit >= 74 && SANO(k)).sort((a,b) => b.qta - a.qta);
sezione(
  "④ TRAPPOLE — dati titolari ad agosto, non ancora a referto",
  `nessun voto in ${G} ${G === 1 ? "giornata" : "giornate"}, titolarità attesa ≥ 70%, e nessuna voce nel bollettino di oggi a spiegarlo (infortuni e squalifiche comprese). Ordinate per quanto costano.`,
  trappole
);

sezione(
  "⑤ NUOVI ARRIVI SENZA CAMPO — il prezzo compra la gerarchia, non una certezza",
  `mai a referto in Serie A quest'anno perché appena arrivati: qui decide quanto ti fidi delle probabili, non dei numeri.`,
  nuoviSenzaCampo
);

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`Valore e verdetto vengono da expFM/advice di index.html: report e app non possono divergere.`);
console.log(`Rilancia dopo ogni giornata: node tools/occasioni.mjs [quotaMax] [--tutti]`);
