/* OCCASIONI — i colpi che il campo ha già rivelato e il prezzo non ha ancora recepito.
   ------------------------------------------------------------------------------------
   A settembre si rifà un'asta completa a mercato chiuso. La differenza fra quell'asta e
   quella di agosto è che stavolta qualche giornata si è giocata: non si compra più su
   probabili formazioni e amichevoli, si compra su chi è sceso in campo davvero.

   Un'occasione è uno SCARTO fra due cose che dovrebbero coincidere:
     - quello che dice il PREZZO   (la quota ufficiale del listone)
     - quello che dice il CAMPO    (chi ha preso voto, quante volte, con che resa)
   Quando il campo dice più del prezzo, quello è un colpo. Quando dice meno, è una trappola.

   Come si misura "il prezzo dovrebbe prevedere". Si rifà la stessa regressione del motore,
   fm = a + b*ln(quota) per ruolo, sui soli giocatori con fantamedia REALE. Lo scarto fra la
   fantamedia vera e quella che la quota lascia prevedere è quanto rende sopra il suo prezzo.
   Chi non ha storico in Serie A non ha scarto misurabile (la sua fm è stimata dalla quota,
   quindi lo scarto verrebbe zero per costruzione): entra in una famiglia a parte, giudicato
   solo sul campo, e il report lo dice.

   IL LIMITE, DETTO SUBITO. tools/scovatore.mjs ha misurato su tre stagioni che "era già
   titolare l'anno prima" predice le esplosioni da pochi crediti (53% contro il 19% medio).
   "Ha giocato le prime giornate" NON è stato misurato: i file storici hanno solo aggregati
   di stagione, non giornata per giornata, quindi quel backtest non è proprio possibile con
   i dati che abbiamo. Quello che segue è un indizio col campione dichiarato, non un peso
   calibrato. Con 1-2 giornate è un sussurro; con 4-5 comincia a essere una voce.

   Uso:  node tools/occasioni.mjs [quotaMax]        (default 12 crediti)
*/
import path from "path";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QMAX = +process.argv[2] || 12;

/* Si legge lo STESSO database che usa l'app: se il report e l'app dicessero cose diverse,
   il report avrebbe torto per definizione. */
globalThis.window = {};
await import(`file://${REPO}/data/kb.js`);
const { kb: KB, date: DATA } = globalThis.window.FANTAHQ_DATA;

const P = KB.map(r => ({
  r:r[0], n:r[1], t:r[2], q:r[3], fm:r[4], est:r[5], pres:r[6], rig:r[9], tit:r[10],
  up:r[11], inj:r[12], age:r[13], unc:r[14], newT:r[15], fvm:r[18],
  pv:r[21]||0, gol:r[22]||0, ass:r[23]||0, fmOra:r[24]||0, mvOra:r[25]||0
}));
const G = P.reduce((m,p) => Math.max(m, p.pv), 0);
if (!G) {
  console.log("Nessuna giornata giocata in data/statistiche-2026-27.json: senza campo non ci sono occasioni da scovare.");
  process.exit(0);
}

/* ---- quanto rende sopra quello che il prezzo lascia prevedere ----
   Stessa regressione del builder: fm = a + b*ln(q), una per ruolo, sui soli dati reali. */
const REG = {};
for (const ruolo of ["P","D","C","A"]) {
  const c = P.filter(p => p.r === ruolo && !p.est && p.pres >= 15);
  const n = c.length;
  const sx = c.reduce((s,p) => s + Math.log(p.q), 0), sy = c.reduce((s,p) => s + p.fm, 0);
  const sxx = c.reduce((s,p) => s + Math.log(p.q)**2, 0), sxy = c.reduce((s,p) => s + Math.log(p.q)*p.fm, 0);
  const b = (n*sxy - sx*sy) / (n*sxx - sx*sx);
  REG[ruolo] = { a:(sy - b*sx)/n, b, n };
}
const sopra = p => p.est ? null : +(p.fm - (REG[p.r].a + REG[p.r].b * Math.log(p.q))).toFixed(2);

/* XI_STATUS non è nel database, ma il builder lo ha già impresso dentro `tit`:
   T alza a 88+, B+ resta fra 74 e 84, B- scende sotto 60, R sotto 42. Si legge da lì. */
const TITOLARE  = p => p.tit >= 88;
const PANCHINA  = p => p.tit < 70;
const SEMPRE    = p => p.pv === G;          // ha preso voto in tutte le giornate finora
const SANO      = p => p.inj < 2;
const FERMO     = p => p.inj >= 3;          // 4+ giornate di stop: il posto si libera davvero

const RUOLO = { P:"Por", D:"Dif", C:"Cen", A:"Att" };
const GIOR = G === 1 ? "1ª giornata" : `${G} giornate`;
const TUTTE = G === 1 ? "nella 1ª giornata" : `in tutte e ${G} le giornate`;
const N_MAX = 12;                       // una rosa di nomi, non un elenco telefonico

/* Il builder accetta una fantamedia come "reale" già da 5 presenze. Sotto le 12 quel numero
   balla parecchio, e siccome lo scarto dal prezzo si calcola proprio su quello, i primi posti
   della classifica finiscono per riempirsi di gente con mezza stagione buona alle spalle.
   Non si nascondono: si marcano, perché un'occasione su 8 partite resta un'occasione, ma va
   comprata sapendo su cosa si sta scommettendo. */
const THIN = 12;
const fmt = p => {
  const s = sopra(p);
  const bonus = (p.gol || p.ass) ? ` ${p.gol}g${p.ass ? "/"+p.ass+"a" : ""}` : "";
  return `  ${RUOLO[p.r]} ${p.n.padEnd(18)} ${p.t.padEnd(11)} ` +
    `${String(p.q).padStart(3)}cr  tit ${String(p.tit).padStart(3)}%  ` +
    `${p.pv}/${G}${bonus.padEnd(7)} ` +
    (s === null ? "fm stimata: nessuno storico in A, si giudica solo dal campo"
                : `${s >= 0 ? "+" : ""}${s.toFixed(2)} di fm sopra quello che il prezzo prevede`) +
    (s !== null && p.pres < THIN ? `  ⚠ ma su sole ${p.pres} presenze nel 25-26` : "");
};
const sezione = (titolo, spiega, righe, scartati = 0) => {
  console.log(`\n${titolo}`);
  console.log(`  ${spiega}`);
  if (!righe.length) { console.log("  (nessuno questa settimana)"); return; }
  righe.forEach(r => console.log(r));
  /* Un taglio silenzioso si legge come "non c'era altro": va detto quanti restano fuori. */
  if (scartati > 0) console.log(`  … e altri ${scartati} rispondono ai requisiti ma restano fuori dai primi ${N_MAX}.`);
};
/* Chi ha uno storico in Serie A si ordina per scarto dal prezzo; chi non ce l'ha non ha
   scarto misurabile e si ordina per quello che ha fatto in campo. Mescolarli in una
   classifica sola darebbe un ordine finto. */
const perScarto = (lista, soglia = 0.05) => {
  const conStorico = lista.filter(p => sopra(p) !== null && sopra(p) >= soglia)
                          .sort((a,b) => sopra(b) - sopra(a));
  return { top: conStorico.slice(0, N_MAX), fuori: Math.max(0, conStorico.length - N_MAX) };
};
const senzaStorico = lista => lista.filter(p => sopra(p) === null)
  .sort((a,b) => (b.gol*3 + b.ass) - (a.gol*3 + a.ass) || b.tit - a.tit || a.q - b.q)
  .slice(0, 8);

console.log(`OCCASIONI — database del ${DATA}`);
console.log(`Giornate giocate: ${G}. Soglia prezzo: fino a ${QMAX} crediti.`);
console.log(`Regressione fm~ln(quota): ` + ["P","D","C","A"].map(r => `${r} n=${REG[r].n}`).join(" "));
console.log(`\n⚠️ Con ${G} ${G === 1 ? "giornata" : "giornate"} il campo è un indizio, non una prova.` +
  ` Il peso che il motore gli dà è ${(Math.min(0.80, G/12)*100).toFixed(0)}%.`);

/* ---- 1. titolari pagati come riserve ----
   È il profilo che scovatore.mjs ha già misurato come il più affidabile in assoluto fra i
   giocatori economici: conta quanto giocava già, non quanto era bravo quando giocava. */
const titolariCheap = P.filter(p => p.q <= QMAX && TITOLARE(p) && SEMPRE(p) && SANO(p) && p.unc < 2);
const t1 = perScarto(titolariCheap);
sezione(
  "① TITOLARI A DUE LIRE — costano poco, giocano sempre",
  `quota ≤ ${QMAX}, titolari nelle formazioni vere, a referto ${TUTTE}, sani e senza mercato aperto.`,
  t1.top.map(fmt), t1.fuori
);
sezione(
  "   ↳ …e gli stessi, ma senza storico in Serie A",
  `stesse condizioni, però la loro fantamedia è stimata dalla quota: qui c'è solo il campo, e sono ${G} ${G === 1 ? "giornata" : "giornate"}.`,
  senzaStorico(titolariCheap).map(fmt)
);

/* ---- 2. chi entra e porta a casa il voto ----
   Non è titolare, e le formazioni vere lo confermano. Ma prende voto lo stesso: per l'ultimo
   slot di una rosa vale più di un titolare di una squadra che non segna mai. */
const panchinari = P.filter(p => p.q <= QMAX && PANCHINA(p) && SEMPRE(p) && SANO(p));
/* Qui la soglia è più alta: partire dietro e prendere comunque voto è, con poche giornate,
   il segnale più esposto al caso. Se non rende molto più del suo prezzo, non è una notizia. */
const t2 = perScarto(panchinari, 0.30);
sezione(
  "② SUBENTRANTI CHE PRENDONO VOTO — l'ultimo slot che non resta vuoto",
  `quota ≤ ${QMAX}, dati dietro nelle gerarchie (tit < 70%) eppure a referto ${TUTTE}. Soglia alzata a +0.30: da dietro serve un margine vero.`,
  t2.top.map(fmt), t2.fuori
);
const conBonus = panchinari.filter(p => p.gol || p.ass).sort((a,b) => (b.gol*3+b.ass)-(a.gol*3+a.ass));
sezione(
  "   ↳ …e chi è entrato e ha fatto bonus",
  `stessa panchina, ma alla ${GIOR} ha messo il suo. Su ${G} ${G === 1 ? "giornata" : "giornate"} è un episodio: serve a sapere chi guardare, non chi comprare.`,
  conBonus.slice(0, 8).map(fmt)
);

/* ---- 3. il posto si è liberato ----
   Il caso Bowie: Pinamonti è rimasto al Sassuolo ma è infortunato, e il centravanti diventa
   un altro. È l'occasione che il listone recepisce sempre in ritardo, perché la quota si
   muove sui trasferimenti, non sulle infermerie. */
const fermiPerReparto = new Map();
for (const p of P.filter(FERMO)) {
  const k = p.t + "|" + p.r;
  if (!fermiPerReparto.has(k)) fermiPerReparto.set(k, []);
  fermiPerReparto.get(k).push(p);
}
const promossi = P.filter(p => p.q <= QMAX && SANO(p) && p.pv > 0)
  .map(p => ({ p, davanti: (fermiPerReparto.get(p.t + "|" + p.r) || []).filter(f => f.q > p.q) }))
  .filter(x => x.davanti.length)
  .sort((a,b) => Math.max(...b.davanti.map(f=>f.q)) - Math.max(...a.davanti.map(f=>f.q)));
sezione(
  "③ PROMOSSI DALL'INFERMERIA — davanti a loro si è liberato il posto",
  `quota ≤ ${QMAX}, già a referto, con un compagno di reparto più caro fermo per 4+ giornate.`,
  promossi.slice(0, N_MAX).map(({p, davanti}) =>
    fmt(p) + `\n      ↳ fermo davanti a lui: ${davanti.map(f => `${f.n} (${f.q}cr)`).join(", ")}`),
  Math.max(0, promossi.length - N_MAX)
);

/* ---- 4. le trappole ----
   Speculare alle occasioni, e altrettanto utile: a settembre si rischia di ricomprare a
   prezzo pieno chi ad agosto era dato titolare e da allora non si è ancora visto. */
sezione(
  "④ TRAPPOLE — dati titolari ad agosto, non ancora a referto",
  `nessun voto in ${GIOR}, titolarità attesa ≥ 70%, nessun infortunio a spiegarlo. Ordinati per quanto costano.`,
  P.filter(p => p.pv === 0 && p.tit >= 70 && SANO(p))
   .sort((a,b) => b.q - a.q)
   .slice(0, N_MAX)
   .map(fmt),
  Math.max(0, P.filter(p => p.pv === 0 && p.tit >= 70 && SANO(p)).length - N_MAX)
);

/* ---- riepilogo ---- */
const tot = P.filter(p => p.q <= QMAX && SEMPRE(p) && SANO(p)).length;
console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`${tot} giocatori sotto i ${QMAX} crediti hanno preso voto ${TUTTE}.`);
console.log(`Il campo pesa ${(Math.min(0.80, G/12)*100).toFixed(0)}% nella titolarità del motore; il resto è ancora la stima d'agosto.`);
console.log(`Rilancia dopo ogni giornata: node tools/occasioni.mjs [quotaMax]`);
