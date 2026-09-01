/* Costruisce data/kb.js 2026-27 dal listone ufficiale + dati raccolti.
   Copertura: TUTTI i giocatori del listone (494), non solo i noti. */
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rows = JSON.parse(fs.readFileSync(`${REPO}/data/listone-2026-27.json`, "utf8")).slice(2);
const L = rows.map(x => ({ id:x[0], r:x[1], rm:x[2], n:x[3], t:x[4], q:+x[5], fvm:+x[11] }));

/* ---- KB 2025-26 (fantamedie reali e attributi già raccolti).
   Letto da uno SNAPSHOT immutabile, non dal file di destinazione: altrimenti a ogni
   riesecuzione lo script si ri-alimenterebbe con i propri output (feedback loop). ---- */
const old = [...fs.readFileSync(`${REPO}/data/kb-2025-26-snapshot.js`, "utf8")
  .matchAll(/^\["([PDCA])","([^"]+)","([^"]+)",(\d+),([\d.]+),(\d),(\d+),(\d+),(\d+),(\d),(\d+),(\d),(\d),(\d+),(\d),(\d),"([^"]*)"\]/gm)]
  .map(m => ({ r:m[1], n:m[2], t:m[3], q:+m[4], fm:+m[5], est:+m[6], pres:+m[7], gol:+m[8], ass:+m[9],
               rig:+m[10], tit:+m[11], up:+m[12], inj:+m[13], age:+m[14], unc:+m[15], newT:+m[16], note:m[17] }));

/* Normalizzazione nomi: oltre ai diacritici gestisce le lettere non decomponibili in NFD
   (\u00d8 \u00f8 \u0110 \u0111 \u0142 \u00fe \u00df \u00e6) e toglie gli apostrofi \u2014 altrimenti "\u00d8stig\u00e5rd" e "N'Dicka" perdono il
   cognome e non si agganciano ai dati statistici. */
const norm = s => String(s).toLowerCase()
  .replace(/[\u00f8\u00d8]/g,"o").replace(/[\u0111\u0110]/g,"d").replace(/\u0142/g,"l").replace(/\u00fe/g,"th").replace(/\u00df/g,"ss").replace(/\u00e6/g,"ae")
  .replace(/['\u2019\u02bc]/g,"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
const toks = n => norm(n).split(" ").filter(w => w.length >= 3);

/* ---- LISTONE 2025-26: chi c'era davvero l'anno scorso e in quale squadra ----
   Serve SOLO a decidere il flag "nuovo acquisto". Prima si usava lo snapshot del KB, che
   però contiene appena 169 giocatori: chiunque non fosse in quell'elenco parziale (McKennie,
   Pisilli…) veniva marcato "nuovo" per sbaglio, prendendosi anche il malus da nuovo arrivo.
   Il listone ufficiale della stagione precedente è invece completo. */
const PREV = new Map();
try {
  for (const r of JSON.parse(fs.readFileSync(`${REPO}/data/listone-2025-26.json`, "utf8")).slice(2)) {
    const k = norm(r[3]);
    if (!PREV.has(k)) PREV.set(k, []);
    PREV.get(k).push({ n:r[3], r:r[1], t:r[4] });
  }
} catch (e) { console.warn("⚠️ listone 2025-26 non leggibile: il flag 'nuovo acquisto' sarà meno preciso"); }
/* match per nome; se il nome è ambiguo disambigua per squadra e poi per ruolo */
function findPrev(p){
  let c = PREV.get(norm(p.n)) || [];
  if (c.length > 1) { const s = c.filter(x => norm(x.t) === norm(p.t)); if (s.length) c = s; }
  if (c.length > 1) { const s = c.filter(x => x.r === p.r); if (s.length) c = s; }
  return c[0] || null;
}

/* Cambi di ruolo verificati sul listone 2026-27 (nome nel listone -> ruolo che aveva nel 25-26).
   Servono perché il match è vincolato al ruolo: senza questa mappa un giocatore che cambia
   ruolo perderebbe il proprio storico. */
const ROLE_CHANGE = { "Orsolini":"A", "Gudmundsson A.":"A", "Pierotti":"A", "Soulé":"C", "Soule":"C", "Soulè":"C", "Pellegrini Lo.":"C" };

/* match vecchio->nuovo: cognome condiviso E STESSO RUOLO (vincolo assoluto: un portiere non
   può ereditare i dati di un attaccante omonimo, es. "Martinez Jo." vs "Lautaro Martinez").
   A parità, disambigua per squadra; se restano più candidati, nessun match. */
function findOld(p){
  const pt = toks(p.n);
  const wantRole = ROLE_CHANGE[p.n] || p.r;
  let c = old.filter(o => o.r === wantRole && toks(o.n).some(w => pt.includes(w)));
  if (c.length > 1) { const s = c.filter(o => norm(o.t) === norm(p.t)); if (s.length) c = s; }
  if (c.length > 1) { const s = c.filter(o => norm(o.n) === norm(p.n)); if (s.length) c = s; }
  return c.length === 1 ? c[0] : null;
}

/* ================= STATISTICHE UFFICIALI (Fantacalcio.it) =================
   Id,R,Rm,Nome,Squadra,Pv,Mv,Fm,Gf,Gs,Rp,Rc,R+,R-,Ass,Amm,Esp,Au
   Fonte autorevole e, soprattutto, agganciabile per ID ufficiale: niente match sui nomi.
   Copre 385 dei 493 giocatori del listone (prima le fantamedie verificate erano 19).
   ATTENZIONE alla scala: questa Fm segue il regolamento standard (gol +3, assist +1,
   ammonizione -0.5, espulsione -1, gol subito -1 per i portieri, rigore parato +3), quindi
   è più bassa di quella usata prima — mediane reali con 20+ presenze: P 5.02, D 5.95,
   C 6.21, A 6.60. Le soglie del motore sono state ricalibrate di conseguenza. */
const statRows = y => JSON.parse(fs.readFileSync(`${REPO}/data/statistiche-${y}.json`, "utf8")).slice(2);
const mkStat = y => new Map(statRows(y).map(r => [r[0], {
  sq:String(r[4]||""),
  pv:+r[5]||0, mv:+r[6]||0, fm:+r[7]||0, gf:+r[8]||0, gs:+r[9]||0,
  rp:+r[10]||0, rc:+r[11]||0, rplus:+r[12]||0, rminus:+r[13]||0,
  ass:+r[14]||0, amm:+r[15]||0, esp:+r[16]||0
}]));
const ST26 = mkStat("2025-26");   // stagione appena conclusa: la fonte primaria
const ST25 = mkStat("2024-25");   // serve solo per la traiettoria (stava crescendo?)
const ST24 = mkStat("2023-24");   // terza stagione: serve per la traiettoria della media voto

/* ================= STAGIONE IN CORSO 2026-27 =================
   Il dato che conta davvero, e che cresce ogni settimana. Serve a due cose:
     1. mostrare gol, assist e media DI QUEST'ANNO invece di quelli dell'anno scorso;
     2. correggere la titolarità con quello che succede sul campo — la stima di agosto
        pesa sempre meno man mano che le giornate si accumulano.
   Si rigenera scaricando le Statistiche da fantacalcio.it dopo ogni giornata. */
let ST_ORA = new Map(), GIORNATE = 0;
try {
  ST_ORA = mkStat("2026-27");
  for (const v of ST_ORA.values()) if (v.pv > GIORNATE) GIORNATE = v.pv;
} catch (e) { console.warn("ℹ️ data/statistiche-2026-27.json assente: nessun dato di stagione in corso"); }
if (GIORNATE) {
  const attivi = [...ST_ORA.values()].filter(v => v.pv > 0).length;
  console.log(`stagione in corso: ${GIORNATE} giornate giocate, ${attivi} giocatori con almeno una presenza`);
}
/* Quanto pesa il campo rispetto alla stima di agosto. Con una giornata sola il campo
   dice pochissimo (una squalifica, un turnover, un raffreddore); con dieci dice quasi
   tutto. Cresce piano e si ferma all'80%: un po' di stima serve sempre, perché le
   gerarchie cambiano anche dopo venti giornate. */
const PESO_CAMPO = GIORNATE ? Math.min(0.80, GIORNATE / 12) : 0;

/* ---- giornate giocate PER SQUADRA ----
   A metà giornata (i posticipi del lunedì, i rinvii per maltempo o coppe) le squadre non
   hanno giocato lo stesso numero di partite. Il conteggio globale punirebbe chi ha una gara
   in meno: un titolare della squadra col posticipo risulterebbe 1 presenza su 2, cioè in
   rotazione, per il solo fatto che la sua partita non s'è ancora giocata.
   Il massimo delle presenze dentro la ROSA di ciascuna squadra dice quante gare ha davvero
   giocato quella squadra: è il denominatore giusto, e si mantiene da solo tutto l'anno. */
const GIOR_SQUADRA = new Map();
for (const v of ST_ORA.values()) {
  const g = GIOR_SQUADRA.get(v.sq) || 0;
  if (v.pv > g) GIOR_SQUADRA.set(v.sq, v.pv);
}
const giornateDi = t => GIOR_SQUADRA.get(t) ?? GIORNATE;

/* Calendario ufficiale 2026-27: entra nel KB così l'app (e la versione single-file
   dell'Artifact) sa chi incontra chi in ogni giornata. Generato e VALIDATO da
   tools/build-calendario.mjs — qui si legge e basta. */
let CALENDARIO = null;
try { CALENDARIO = JSON.parse(fs.readFileSync(`${REPO}/data/calendario-2026-27.json`, "utf8")); }
catch (e) { console.warn("⚠️ data/calendario-2026-27.json assente: niente difficoltà del turno"); }

/* ---- ETÀ VERIFICATE (ricognizione agosto 2026, fonte transfermarkt) ----
   Prima dell'audit quasi tutti avevano l'età di default (26): i correttivi del motore
   per gli over 35 e i giovani non scattavano mai. nome listone → età al 1/9/2026. */
let ETA = {};
try { ETA = JSON.parse(fs.readFileSync(`${REPO}/data/eta-2026-27.json`, "utf8")); }
catch (e) { console.warn("⚠️ data/eta-2026-27.json assente: età di ripiego dal vecchio KB"); }

/* ---- regressione FM ~ log(quota) per ruolo ----
   Serve solo a stimare la Fm di chi NON ha statistiche ufficiali 25-26 (nuovi arrivi
   dall'estero o dalla B). Calibrata sui giocatori con dato ufficiale VERO e almeno 10
   presenze: prima si usava il vecchio KB (poche decine di righe, in parte già stimate),
   ora la retta poggia su ~280 osservazioni reali.
   Limiti per ruolo: presi dai percentili osservati, così una stima non può uscire dal
   campo di valori che quel ruolo produce davvero. */
const known = [];
for (const p of L) {
  const s = ST26.get(p.id);
  if (s && s.pv >= 10) known.push({ r:p.r, x:Math.log(p.q||1), y:s.fm });
}
const CLAMP = { P:[4.3,5.7], D:[5.4,7.7], C:[5.4,7.7], A:[5.5,8.3] };
const REG = {};
for (const role of ["P","D","C","A"]) {
  const s = known.filter(k => k.r === role);
  if (s.length >= 8) {
    const n=s.length, sx=s.reduce((a,k)=>a+k.x,0), sy=s.reduce((a,k)=>a+k.y,0);
    const sxy=s.reduce((a,k)=>a+k.x*k.y,0), sxx=s.reduce((a,k)=>a+k.x*k.x,0);
    const b=(n*sxy-sx*sy)/(n*sxx-sx*sx||1), a=(sy-b*sx)/n;
    REG[role] = { a, b, n };
  } else REG[role] = { a: {P:5.2,D:6.0,C:6.0,A:6.1}[role], b: 0.15, n: s.length };
}
const estFM = (role,q) => {
  const [lo,hi] = CLAMP[role];
  const v = REG[role].a + REG[role].b*Math.log(q||1);
  return Math.round(Math.max(lo, Math.min(hi, v)) * 100) / 100;
};

/* ================= DATI REALI 2025-26 (Understat: 430 giocatori con >=450') =================
   [nome, squadra25-26, minuti, presenze, gol, xG, assist, xA, npxG, tiri, keyPasses]
   Danno: minuti/titolarità REALI (non stimati), gol+assist reali e soprattutto i segnali di
   regressione (gol vs npxG, assist vs xA) = le occasioni nascoste. */
const US = JSON.parse(fs.readFileSync(`${REPO}/data/understat-2025-26.json`, "utf8"))
  .map(r => ({ n:r[0], t:r[1], min:r[2], gp:r[3], gol:r[4], xg:r[5], ass:r[6], xa:r[7], npxg:r[8], tiri:r[9], kp:r[10] }));

/* Il listone scrive "Cognome I." / "Cognome N.C.", Understat il nome completo:
   abbino sul cognome e, quando c'è, verifico l'iniziale del nome (evita Martinez L. vs Martinez Jo.). */
const surnameOf = n => { const t = toks(n); return t[t.length-1]; };
const initialsOf = n => (String(n).match(/\b([A-Z])\./g) || []).map(s => s[0].toLowerCase());
/* Indicizzo per OGNI token del nome, non solo per l'ultimo: molti giocatori hanno più cognomi
   (es. "Pierre Kalulu Kyatengwa" nel listone è solo "Kalulu") e altrimenti si perderebbero. */
const USBY = new Map();
for (const u of US) for (const t of toks(u.n)) { if (!USBY.has(t)) USBY.set(t, []); if (!USBY.get(t).includes(u)) USBY.get(t).push(u); }
function findUS(p){
  const cands = USBY.get(surnameOf(p.n)) || [];
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];
  const ini = initialsOf(p.n);
  if (ini.length) {
    const byIni = cands.filter(u => { const first = toks(u.n)[0] || ""; return first.startsWith(ini[0]); });
    if (byIni.length === 1) return byIni[0];
  }
  const byTeam = cands.filter(u => norm(u.t) === norm(p.t));   // stessa squadra = non si è mosso
  if (byTeam.length === 1) return byTeam[0];
  return null;                                                  // ambiguo: meglio nessun dato che dati sbagliati
}
/* ---- TITOLARITÀ ATTESA dai minuti reali ----
   Non conta il totale stagionale (penalizzerebbe chi è arrivato a gennaio o si è
   infortunato), ma soprattutto QUANTO GIOCA QUANDO C'È: è quello che distingue un
   titolare da un subentrante.
     - share = minuti per presenza / 85' → 1.0 se giocare sempre tutta la partita
     - avail = presenze / 28 → continuità nell'arco della stagione
   Con poche presenze il campione è debole (un gol in 2 partite non fa un titolare):
   sotto le 10 presenze il valore viene fortemente ridimensionato. */
const titFromMinutes = u => {
  const perGame = u.gp ? u.min / u.gp : 0;
  const share = Math.min(1, perGame / 85);
  const avail = Math.min(1, u.gp / 28);
  let t = (share * 0.7 + avail * 0.3) * 100;
  if (u.gp < 10) t *= (0.45 + u.gp * 0.055);       // campione insufficiente
  return Math.max(8, Math.min(97, Math.round(t)));
};

/* ---- titolarità stimata dal rango della quota dentro squadra+ruolo (fallback) ---- */
/* ---- GERARCHIE PORTIERI 2026-27 (fonte: FantaMaster/Goal/SosFanta) ----
   Servono come SPAREGGIO: quota e FVM spesso non distinguono secondo e terzo (alla Roma
   Gollini e De Marzi hanno entrambi quota 1 e FVM 1, al Torino tutti e tre). Dove invece
   il FVM è chiaro comanda lui, perché è il dato ufficiale più aggiornato. */
const GK_RANK = {
  "Atalanta":["Carnesecchi","Sportiello"],
  "Bologna":["Skorupski","Pessina Mas.","Happonen"],
  "Cagliari":["Caprile","Sherri","Ciocci"],
  "Como":["Butez","Tornqvist","Vigorito"],
  "Fiorentina":["De Gea","Christensen O.","Lezzerini"],
  "Frosinone":["Palmisani","Desplanches","Lolic"],
  "Genoa":["Bijlow","Stolz","Sommariva"],
  "Inter":["Martinez Jo.","Provedel","Di Gennaro"],
  "Juventus":["Vicario","Grabara","Pinsoglio"],
  "Lazio":["Mandas","Motta","Renzetti"],
  "Lecce":["Falcone","Samooja"],
  "Milan":["Maignan","Terracciano","Torriani"],
  "Monza":["Thiam","Tornqvist","Strajnar"],
  "Napoli":["Meret","Milinkovic-Savic V.","Contini"],
  "Parma":["Corvi","Ghidotti","Daffara"],   // Suzuki in chiusura al PSG: Corvi titolare in amichevole
  "Roma":["Svilar","Gollini","De Marzi"],
  "Sassuolo":["Muric","Turati","Satalino","Russo A."],
  "Torino":["Perri","Paleari","Mascardi","Siviero"],   // Perri UFFICIALE e nel listone dal 31/8
  "Udinese":["Okoye","Mrozek","Padelli","Piana"],
  "Venezia":["Stankovic F.","Grandi","Pozzi"]
};
const gkRank = p => { const l = GK_RANK[p.t] || []; const i = l.findIndex(n => norm(n) === norm(p.n)); return i < 0 ? 99 : i; };

const rankTit = (p) => {
  /* I PORTIERI sono un caso a sé: gioca solo il primo. Il secondo fa 2-3 presenze,
     il terzo praticamente nessuna. Negli altri ruoli le riserve ruotano davvero. */
  if (p.r === "P") {
    const same = L.filter(x => x.t === p.t && x.r === "P")
      .sort((a,b) => (b.fvm - a.fvm) || (gkRank(a) - gkRank(b)));
    const i = same.findIndex(x => x.id === p.id);
    return i === 0 ? 90 : (i === 1 ? 25 : 14);
  }
  const same = L.filter(x => x.t === p.t && x.r === p.r).sort((a,b) => b.q - a.q);
  const i = same.findIndex(x => x.id === p.id);
  const slots = { D:4, C:4, A:2 }[p.r];
  if (i < slots) return p.q >= same[0].q * 0.7 ? 88 : 80;
  if (i < slots + 2) return 60;
  return 40;
};

/* ---- rigoristi 2026-27 (fonti: FantaMaster, Goal, SosFanta) 2=primo, 1=alternativa ---- */
/* Rivisto il 6 agosto su 5 fonti (FantaMaster, SosFanta, CalcioDangolo, TMW, Goal).
   Criterio: 2 = primo rigorista quando le fonti concordano o c'è una maggioranza chiara;
   1 = alternativa, usato anche quando le fonti si dividono — in quei casi nessuno prende
   il bonus pieno, perché un rigorista incerto non vale come uno designato. */
const RIG = {
  "Calhanoglu":2, "Martinez L.":1, "Zielinski":1,                       // Inter: unanime
  "Kolo Muani":1, "Locatelli":1, "Yildiz":1,                            // Juve: gerarchia APERTA (Yildiz non più designato)
  "Pulisic":1, "Ramos G.":1,                                // Milan: aperta (Ramos primo per 1 fonte, Pulisic per 2)
  "Malen":2, "Dybala":1, "Soulè":1, "Castro S.":1,                      // Roma: Malen ha scavalcato Dybala
  "Scamacca":2, "De Ketelaere":1, "Samardzic":1,                        // Atalanta
  "Orsolini":2, "Dovbyk":1, "Bernardeschi":1,                           // Bologna: Dovbyk insidia (27/32 in carriera)
  "Da Cunha":2, "Paz N.":1, "Douvikas":1, "Baturina":1,                 // Como
  /* Fiorentina SENZA rigorista designato: Gudmundsson alla Lazio, Kean al Como e Mandragora al Torino. Si saprà solo dal campo: nessun bonus-rigori viola è pagabile oggi. */                         // Fiorentina: ballottaggio col Kean
  "Zaccagni":2, "Cataldi":1, "Taylor K.":1,                             // Lazio: unanime
  "De Bruyne":2, "Hojlund":1,                                           // Napoli: designato dopo l'addio di Lukaku
  "Bernabè":2, "Valeri":1,                                              // Parma: Bernabè designato + punizioni e corner (Pellegrino ceduto alla Fiorentina, dove dal dischetto va Gudmundsson)
  "Berardi":2, "Laurientè":1,                            // Sassuolo: unanime
  "Vlasic":2, "Kulenovic":1, "Zapata D.":1, "Simeone":1,                // Torino: unanime
  "Davis K.":2, "Solet":1, "Zaniolo":1, "Ekkelenkamp":1,                // Udinese: unanime
  "Colombo":2, "Messias":1, "Vitinha O.":1,                             // Genoa
  "Mina":2, "Borrelli":1, "Fazzini":1,                                  // Cagliari: Esposito ceduto → Mina primo
  "Pessina":2, "Cutrone":1,                                // Monza: Pessina 16/17 in carriera
  "Calò":2, "Raimondo":1, "Ghedjemis":1, "Hasa":1,                      // Frosinone
  "Geubbels":2, "Stulic":1, "Berisha M.":1, "Pierotti":1,               // Lecce: Geubbels 7/7 in carriera
  "Adams A.":2, "Rrahmani Al.":1, "Yeboah J.":1, "Busio":1,             // Venezia: Adams designato
  "Camarda":1, "Krstovic":1
};

/* ---- note/insight dalla pre-ricerca (segnali data-driven) ---- */
const NOTE = {
  "Martinez L.":"Capocannoniere 25-26 con 17 gol e xG 17.1: segna esattamente quanto crea, rendimento pienamente sostenibile.",
  "Malen":"FM 8.81 su mezza stagione nel sistema Gasperini + ora primo rigorista: il colpo più pesante dopo Lautaro.",
  "Thuram":"npxG/90 0.64 (top 99°): segna esattamente quanto crea, rendimento sostenibile.",
  "Hojlund":"11 gol in linea col suo xG: affidabile, riferimento offensivo di Allegri.",
  "Paz N.":"12 gol e 6 assist con npxG/90 0.51 (98° percentile): non è stata fortuna. Ma Da Cunha gli ha tolto i rigori.",
  "Baturina":"xA/90 0.34 (98° pct) ma solo 17 titolarità su 38: chiuso da Paz. Ottimo SE trova spazio.",
  "Orsolini":"Ora vale come CENTROCAMPISTA: doppia cifra perenne + primo rigorista del Bologna. Bonus da attaccante a prezzo di centrocampista.",
  "Soulè":"Ora ATTACCANTE: xA/90 0.27 (94° pct) con assist sprecati dai compagni, nel sistema Gasperini.",
  "Pulisic":"xA/90 0.28 (95° pct): crea e finalizza, nel giro rigoristi del Milan.",
  "McTominay":"Doppia cifra due stagioni di fila dal centrocampo: sostenibile e centrale con Allegri.",
  "Ramos G.":"Al PSG 6 gol ma xG 8.22 (sfortunato) con npxG/90 0.51 in soli 1300': ora primo rigorista del Milan.",
  "Dovbyk":"Al Bologna da titolare dopo il ruolo perso alla Roma: xG/tiro 0.31 (7° in A), il contesto ora lo favorisce.",
  "Svilar":"Miglior portiere 25-26: 18 clean sheet, 77.5% parate, para-rigori.",
  "Carnesecchi":"78.1% parate (2°), 0.87 gol subiti/90: élite, con Sarri più controllo.",
  "Martinez Jo.":"Erede di Sommer all'Inter: eredita la difesa meno battuta del campionato (Chivu 0.94 subiti/gara).",
  "Meret":"Con Allegri (0.88 gol subiti a partita in carriera) un portiere del Napoli vale più della sua quota.",
  "Dimarco":"MVP difensori 25-26: gol, assist e piazzati. La quota 32 dice tutto: è un centrocampista travestito.",
  "Yildiz":"10+6 a 21 anni e ora rigorista: la Juve ha creato 50.67 xG segnando solo 43 gol, c'è margine di crescita.",
  "Kolo Muani":"Torna alla Juventus (operazione da ~90M con Alajbegovic): in Serie A aveva già fatto 10 gol in 22 gare col prestito precedente. Prima punta titolare di Spalletti, ma nessun dato 25-26 in A (era al PSG).",
  "Alajbegovic":"Giovane bosniaco pagato caro dal Leverkusen: talento vero ma nessun minuto in Serie A, spazio da conquistare. Scommessa, non certezza.",
  "Stones":"Ufficiale all'Inter dal Manchester City: qualità assoluta nella difesa meno battuta del campionato, ma storico di infortuni e nessun dato in A.",
  "Ratkov":"Nuovo attaccante della Lazio: quota media, titolarità da verificare con Gattuso.",
  "Akanji":"Dal Manchester City all'Inter: difesa più solida del campionato, clean sheet probabili.",
  "Stones":"Dal Manchester City all'Inter a parametro zero: qualità assoluta, da valutare la tenuta fisica.",
  "Camarda":"Passato al Milan: talento 19enne, ma davanti ha Ramos e Nkunku — titolarità da conquistare.",
  "Da Cunha":"Ha scavalcato Paz come primo rigorista del Como: i rigori valgono 1-2 fasce.",
  "Kean":"Rigorista alternativo dietro Gudmundsson, ma resta bomber da doppia cifra.",
  "Gudmundsson A.":"Ora CENTROCAMPISTA e primo rigorista della Fiorentina: combinazione d'oro per il fantacalcio.",
  "Zaccagni":"Primo rigorista della Lazio, capitano: bonus garantiti dal dischetto.",
  "Scamacca":"Primo rigorista dell'Atalanta di Sarri; 4° per FM 25-26 ma storia clinica pesante.",
  "Krstovic":"npxG/90 0.63: generatore di occasioni efficiente.",
  "Zaniolo":"All'Udinese con quota alta: rilancio da verificare sul campo.",
  "Atta":"Passato alla Fiorentina con quota raddoppiata (8→17): fisico e inserimenti, il mercato ci crede.",
  "Gila":"Al Milan: 3° difensore per FM 25-26 (7.26), con Amorim però meno clean sheet della Lazio."
};

/* ================= AGGIORNAMENTO MERCATO — 6 agosto 2026 =================
   Blocco separato che ha la precedenza su NOTE e UNC: si aggiorna qui a ogni giro di
   mercato, senza toccare le mappe storiche.
   NB: molti nuovi acquisti (Molina, Mastantuono, Chalobah, Couto, Badiashile, Touré,
   Zirkzee) NON sono ancora nel listone: qui si annota l'effetto sulla concorrenza
   dei giocatori già in lista. */
const MERCATO_NOTE = {
  "Ramos G.":"⚠️ Record storico del Milan (65M+5 dal PSG), ma nel derby amichevole di Perth (5 ago) è partito dalla PANCHINA con Camarda titolare. E i rigori non sono suoi: le fonti danno Pulisic davanti. A quota 27 stai pagando un titolare che oggi non lo è.",
  "Hojlund":"Riscattato dal Napoli per 44M: 13 gol con xG 12.5, rendimento in linea. Riferimento offensivo di Allegri e rigorista.",
  "Gila":"Pagato 30M dal Milan: 3° per fantamedia tra i difensori nel 25-26 (7.26). Con Amorim meno clean sheet che alla Lazio, ma qualità alta.",
  "Frattesi":"⚠️ Scambio con Nico Gonzalez ancora solo ALLO STUDIO tramite intermediari: nessun accordo, ostacoli su ingaggi e plusvalenze. Lui si allena con l'Inter ma vuole la Juve. Gol garantiti quando gioca, squadra però incerta.",
  "Santos A.":"Preso dal Napoli per 20M dallo Sporting: nessun dato in Serie A, deve conquistarsi lo spazio dietro Hojlund.",
  "Boga":"Alla Juventus da Nizza per 4.75M: quota bassa, ruolo di rotazione nell'affollato attacco bianconero.",
  "Stankovic A.":"Riacquistato dall'Inter dal Bruges per 23M: investimento importante ma quota da riserva, titolarità tutta da conquistare.",
  "Koulierakis":"Titolare al Wolfsburg (29 presenze, 4 gol): arriva alla Roma per giocare, nel sistema Gasperini dove i difensori fanno bonus.",
  "Joao Mario":"In prestito alla Fiorentina dalla Juventus: quota minima, riserva.",
  "Adzic":"In prestito al Sassuolo dalla Juventus: nelle probabili è favorito per la terza maglia di centrocampo.",
  "Doekhi":"Titolare fisso all'Union Berlino (34 su 34, 5 gol quasi tutti di testa/piazzati): colpo a zero, titolare nelle probabili della Lazio.",
  "Kolo Muani":"⚠️ Stagione 25-26 pessima: 1 gol in 30 presenze al Tottenham (xG 2.69). Alla Juve da prima punta di Spalletti, in A aveva fatto bene, ma a quota 26 il rischio è tutto tuo.",
  "Corvi":"Con Suzuki in partenza verso il PSG è il candidato titolare del Parma: titolare nell'amichevole con l'Arezzo. A quota 1 è il tipo di scommessa che costa nulla.",
  "Esposito Se.":"Ceduto dal Cagliari (al suo posto arriva Maldini): non sarà in Serie A, non prenderlo.",
  "Maldini":"✅ Ora nel listone col CAGLIARI (prestito 1M + riscatto a 8): lascia l'Atalanta dove non giocava e lì si gioca il posto in attacco. A quota 5 è una delle scommesse migliori del listone.",
  /* --- entrati col listone aggiornato dell'8 agosto --- */
  "Mastantuono":"💎 UFFICIALE alla Fiorentina in prestito secco dal Real Madrid (nessun riscatto): titolare come ala/trequartista destra a 19 anni. Nessun dato in Serie A, ma il ruolo è da protagonista.",
  "Tourè E.":"El Bilal Touré, dall'Atalanta al Parma in prestito con obbligo/diritto a 11M: ballottaggio aperto con Pellegrino per il posto di punta.",
  "Pellegrini Lo.":"Capitano della Roma con rinnovo di un anno, ma nelle formazioni tipo di Gasperini parte dietro: minutaggio da verificare.",
  "Couto":"Yan Couto al Como in prestito dal Dortmund (riscatto a 20M): si gioca la fascia destra con Van Der Brempt, le fonti sono divise.",
  "Sow":"Djibril Sow UFFICIALE al Genoa dal Siviglia per 4-5M (contratto quadriennale): indicato come punto fermo del centrocampo di De Rossi.",
  "Robinson J.":"Ala inglese di 19 anni in prestito dal Southampton: prospetto, spazio tutto da conquistare.",
  /* --- entrati col listone del 12 agosto (giorno d'asta) --- */
  "Kevin Carlos":"⚠️ UFFICIALE al Cagliari in prestito dal Nizza (riscatto a 3.5M): centravanti spagnolo di 25 anni preso per sostituire Esposito. ATTENZIONE ai numeri: al Nizza 23 presenze in Ligue 1 con 874 minuti e ZERO gol, 2 in tutte le competizioni. Il suo picco resta il capocannoniere in Svizzera nel 23-24 (14 gol). Quota 13 è il prezzo della novità, non del rendimento.",
  "Chalobah T.":"UFFICIALE al Como dal Chelsea (30M+3): l'acquisto più caro della difesa, si gioca il posto centrale con Kempf. Nessun dato in Serie A.",
  "Aurelio":"Arrivato al Cagliari: quota minima, ruolo di rotazione tutto da verificare.",
  "Masini":"Passato al Frosinone dal Genoa a titolo definitivo (~5M, quadriennale): regista davanti alla difesa, titolare nelle probabili.",
  "Dominguez B.":"Passato dal Bologna al Sassuolo: gerarchie da verificare, parte dietro.",
  "Paleari":"⚠️ Il Torino ha chiuso per Lucas PERRI dal Leeds (prestito con riscatto a 11M, visite entro l'8 agosto): sarà lui il titolare. Nessun portiere del Torino presente nel listone è più da prendere.",
  "Milinkovic-Savic V.":"Allegri ha scelto Meret come titolare fisso: lui è in uscita (accostato all'Hull City). Da evitare.",
  "Meret":"✅ Allegri ha sciolto il ballottaggio: titolare fisso, niente alternanza. Titolare in entrambe le amichevoli. Con la difesa del Napoli vale più della quota 11.",
  "Pinamonti":"⚠️ Cedibile dopo l'arrivo di Bowie: il Sassuolo ha già rifiutato un'offerta dalla Premier ma la richiesta è alta. Se resta è il titolare, se parte tocca a Bowie.",
  "Alajbegovic":"9 gol e 3 assist in prestito a Salisburgo: talento in forte ascesa che insidia Conceicao. Scommessa da ultima fascia interessante.",
  "Ratkov":"Capocannoniere del Salisburgo (9 gol in 17) prima del passaggio alla Lazio a gennaio: ha scavalcato Dia nelle gerarchie da punta.",
  "Dia":"Scavalcato da Ratkov come punta nelle probabili: quota da riserva.",
  "Stones":"Solo 439 minuti al City nel 25-26: qualità enorme ma condizione tutta da verificare; ruota con Bisseck.",
  "Dragusin":"Titolare nelle probabili della Fiorentina, ma nel 25-26 ha giocato appena 515' al Tottenham rientrando dal crociato: condizione da monitorare.",
  "Camarda":"💎 TITOLARE nel derby amichevole di Perth con Ramos in panchina, dopo la doppietta in 7' col Celtic: Amorim gli dà fiducia per l'avvio. A quota bassa è la scommessa migliore del Milan.",
  "Krstovic":"⚠️ Sarri punta su Scamacca: nelle probabili parte dietro. A quota 18 il rischio panchina è concreto.",
  "Bijlow":"Titolare designato del Genoa ma stagione 25-26 rovinata dagli infortuni al Feyenoord (4 presenze): affidabilità fisica da verificare.",
  /* Molina NON è un problema per Wesley: nel 3-4-2-1 di Gasperini gli esterni sono due,
     Molina occupa la destra e Wesley resta a sinistra. A perderci è Rensch. */
  "Rensch":"Con Molina alla Roma scivola dietro sulla fascia destra: solo da ultimo slot.",
  "Spinazzola":"Gutierrez ceduto al Leverkusen per 30M: la fascia sinistra del Napoli si libera, minuti in più in vista.",
  "Olivera":"Gutierrez ceduto al Leverkusen: torna in corsa per la maglia da titolare a sinistra, occhio però al Napoli su Badiashile.",
  "Beukema":"Napoli vicino a Badiashile dal Chelsea: un centrale in più significa meno spazio per lui.",
  "Atta":"Passato alla Fiorentina con quota raddoppiata (8→17), ma ⚠️ Mastantuono UFFICIALE dal Real Madrid (prestito secco): concorrenza pesante sulla trequarti. Non pagarlo a prezzo pieno.",
  "Gudmundsson A.":"Mastantuono ufficiale alla Fiorentina: un creativo in più che può togliergli il posto o spostarlo. Resta però il rigorista designato (in ballottaggio con Kean).",
  "Ramon":"⚠️ Chalobah UFFICIALE al Como (30M+3 dal Chelsea) e Couto in prestito dal Dortmund: la difesa è stata rifatta, la sua titolarità non è più scontata.",
  "Kaiki":"Yan Couto ufficiale al Como (prestito con riscatto a 20M dal Dortmund): concorrenza diretta sulla fascia destra.",
  "Pellegrino M.":"El Bilal Touré UFFICIALE al Parma (prestito dall'Atalanta): concorrenza vera in attacco, non è più l'unica punta. Resta il rigorista designato (7/9 in carriera).",
  "David":"Zirkzee resta un'ipotesi ma la Juve l'ha rinviata alla seconda metà di agosto: l'attacco è già affollato e lui è dietro Kolo Muani.",
  "Yildiz":"⚠️ NON è più il rigorista designato: le fonti danno Kolo Muani o Locatelli davanti, con Spalletti che deve ancora decidere. 10+6 a 21 anni restano, ma senza rigori la quota 23 è cara.",
  "Kolo Muani":"⚠️ Stagione 25-26 pessima: 1 gol in 30 presenze al Tottenham (xG 2.69). Alla Juve è la prima punta di Spalletti e 2 fonti su 4 lo danno primo rigorista, ma la gerarchia dal dischetto è aperta. A quota 26 il rischio è tutto tuo.",
  "Vlasic":"💎 Rigorista del Torino su indicazione UNANIME delle fonti (5/5 recenti). A quota 14 un centrocampista che tira i rigori è un affare spesso ignorato all'asta.",
  "Dovbyk":"Insidia Orsolini sui rigori del Bologna (27/32 in carriera dal dischetto): se li prende lui, la quota 16 diventa bassa.",
  "Raspadori":"Titolare nel tridente di Sarri come esterno sinistro, davanti a Zalewski e Sulemana: la quota 13 non riflette il ruolo da titolare.",
  "Koulierakis":"💎 Titolare all'esordio col Newport e subito in gol di testa, davanti a Ghilardi: nel sistema Gasperini i braccetti fanno bonus. Quota 8 per un titolare della Roma.",
  "Ghilardi":"Scavalcato da Koulierakis nelle amichevoli (entrato solo al 70' al suo posto): parte dietro.",
  "Hermoso":"Gasperini lo sta provando da esterno/mezzala destra, ruolo inedito, ed è andato in gol: usato ma non come centrale puro.",
  "Castro S.":"Gioca INSIEME a Dybala (lui punta, Dybala trequarti) e ha calciato il rigore col Newport pur avendo Dybala in campo: segnale forte sulle gerarchie dal dischetto.",
  "Dybala":"Titolare sulla trequarti con Castro punta, ma ⚠️ uscito col ghiaccio al ginocchio dopo un fallo nell'amichevole col Newport: verifica le condizioni prima dell'asta.",
  "Douvikas":"Confermato punta titolare del 4-2-3-1 di Fabregas: titolare e doppietta col Famalicao. Quota 20 giustificata.",
  "Motta":"Titolare nell'amichevole con l'Ostiamare (5 ago) con Mandas in panchina: il ballottaggio in porta alla Lazio è vero e ancora aperto.",
  "Mandas":"⚠️ Ballottaggio aperto: nell'ultima amichevole è partito dalla panchina con Motta titolare. Gattuso non ha ancora dichiarato la gerarchia.",
  /* --- audit giocatore per giocatore, 7 agosto --- */
  "Vigorito":"❌ Svincolato: ha lasciato il Como. Non è più in Serie A.",
  "Maldini":"❌ Passato al Cagliari (prestito 1M + riscatto 8M): non convocato dall'Atalanta il 7 agosto. Lì sarebbe titolare, ma nel listone risulta ancora all'Atalanta.",
  "De Roon":"⚠️ 35 anni e scavalcato da Gaetano in regia nelle probabili di Sarri: non è più il titolare inamovibile di un tempo.",
  "Gaetano":"Regista titolare nelle probabili di Sarri (in adattamento nel ruolo), davanti a De Roon: a quota 7 vale la scommessa.",
  "Samardzic":"💎 Mezzala titolare di Sarri insieme a Gaetano ed Ederson (Pasalic è alternativa), terzo rigorista e sulle punizioni. 2.51 passaggi chiave/90, tra i migliori del campionato. La media voto in calo NON è un difetto: sui dati delle ultime tre stagioni chi arrivava da un calo è risalito il 75% delle volte. A quota 12 è un titolare dell'Atalanta pagato come riserva.",
  "Bernasconi":"20 anni, terzino sinistro titolare nelle probabili davanti ad Ahanor: quota 6 per un posto da titolare.",
  "Lucumì":"⚠️ Titolare del Bologna ma la Juventus insiste (offerti Miretti e Cabal per abbassare i 25M): se parte, sale Vitik.",
  "Obert":"Titolare a sinistra nel nuovo 4-4-2 di Pisacane: promosso rispetto ai ballottaggi di luglio.",
  "Fazzini":"💎 Titolare nel 4-4-2 del Cagliari ed è il secondo rigorista con le punizioni: a quota 7 è tra le occasioni migliori.",
  "Winks":"Nuovo regista titolare del Cagliari e incaricato dei calci da fermo: 30 anni, affidabile.",
  "Ramon":"Centrale titolare fisso del Como a 21 anni: l'arrivo di Chalobah non lo ha scalzato, gli è costato il posto Smolcic.",
  "Baturina":"💎 Promosso titolare sulla trequarti del Como e secondo rigorista: quota 19 ma con un ruolo da protagonista.",
  "Perrone":"Titolare in mediana nel Como di Fabregas, insidiato da Caqueret e Milla ma davanti a entrambi.",
  "Paz N.":"✅ RESTA al Como: accordo col Real Madrid del 29 giugno, la recompra slitta al 2027-28. Batte le punizioni.",
  "Bartesaghi":"Promosso titolare come quinto di sinistra nel 3-4-2-1 di Amorim: 20 anni, quota 8 per un posto da titolare del Milan.",
  "Gabbia":"Titolare nel terzetto Gila-Gabbia-Pavlovic secondo le probabili di agosto.",
  "Modric":"40 anni: ancora in ballottaggio con Jashari per la mediana, il minutaggio andrà gestito.",
  "Provstgaard":"💎 Promosso titolare accanto a Doekhi in tutte le formazioni tipo estive, scavalcando Romagnoli: quota 3 per un titolare della Lazio.",
  "Dele-Bashiru":"💎 Titolare da mezzala/trequartista in tutte le formazioni tipo di Gattuso: quota 5 sottovalutata.",
  "Romagnoli":"⚠️ Scavalcato da Provstgaard nelle formazioni tipo e con la trattativa Al-Sadd solo congelata: doppio rischio.",
  "Pellegrini Lu.":"Chiuso da Tavares e Pedraza a sinistra: fuori dalle rotazioni.",
  "Celik":"Arrivato a zero dalla Roma ed è nell'XI probabile di Spalletti: a quota 8 un titolare della Juve.",
  "Kelly L.":"⚠️ Non più intoccabile: con Celik nell'XI il ballottaggio è aperto (se gioca Celik, Kalulu si allarga).",
  "Alajbegovic":"💎 Nell'XI probabile di Spalletti sulla trequarti a 19 anni, dopo 9 gol in prestito a Salisburgo: ballottaggio serrato con Conceicao.",
  "Koopmeiners":"⚠️ Fuori dall'XI e dichiarato cedibile dalla Juventus: da evitare.",
  "Kolo Muani":"⚠️ UFFICIALE alla Juventus dal PSG il 2 agosto (38M+12 bonus), prima punta di Spalletti e candidato n.1 per i rigori — ma la gerarchia dal dischetto non è ancora decisa. Stagione 25-26 pessima: 1 gol in 30 presenze al Tottenham.",
  /* --- audit completo 20 squadre, 7 agosto --- */
  "Mkhitaryan":"⚠️ 37 anni e non compare più negli undici tipo dell'Inter: ruolo di rotazione, non più il jolly di un tempo.",
  "Akanji":"✅ Confermato all'Inter: l'obbligo di riscatto (15M al Manchester City) è scattato con lo scudetto, contratto fino al 2028. Titolare nella difesa meno battuta del campionato.",
  "Diouf":"💎 Con Dumfries ceduto al Real Madrid si gioca la fascia destra con Luis Henrique, e alcune fonti lo danno già titolare: quota 8 per un posto nell'Inter.",
  "Wesley":"Incedibile per Gasperini: la Roma ha respinto offerte da Chelsea e Arsenal fissando il prezzo a 60M. Titolare a sinistra nonostante l'arrivo di Molina a destra.",
  "Hermoso":"⚠️ Perde il ballottaggio con Koulierakis e prende molti cartellini: a quota 10 non conviene.",
  "Castro S.":"⚠️ Pagato ~35M dal Bologna ma è l'alternativa a Malen: titolare solo se Gasperini passa al 3-4-1-2. Ha però calciato il rigore col Newport.",
  "Dybala":"Titolare sulla trequarti con punizioni e corner, secondo rigorista dietro Malen. La contusione al ginocchio nell'amichevole col Newport non è grave.",
  "De Bruyne":"💎 RIGORISTA designato del Napoli dopo l'addio di Lukaku, più punizioni e corner da sinistra. 35 anni, ma il pacchetto di calci piazzati vale molto.",
  "Marianucci":"Con Buongiorno operato e Beukema acciaccato è il candidato titolare per le prime giornate: a quota 1 la scommessa costa nulla.",
  "Buongiorno":"❌ Operato al menisco a luglio: fuori 3-4 mesi, rientro atteso dopo la sosta di ottobre. Non prenderlo come titolare.",
  "Neres":"❌ Fermo dal 14 gennaio 2026 (operazione alla caviglia), ancora in lavoro personalizzato: rientro lontano.",
  "Bernabè":"💎 Rigorista designato del Parma con punizioni e corner: il pacchetto piazzati completo a quota 7.",
  "Lipani":"💎 Promosso titolare in mediana nel Sassuolo con Konè fuori per mezza stagione: quota 2 per un posto da titolare.",
  "Laurientè":"⚠️ Titolare e sui piazzati da sinistra, ma il Sassuolo chiede 25M e ci sono Fenerbahce, Besiktas e club di Premier: verifica prima dell'asta.",
  "Matic":"38 anni e ancora titolare in mediana nel Sassuolo: rendimento noto, ma l'età impone prudenza sul minutaggio.",
  "Oristanio":"Favorito come trequartista del Torino davanti a Zapata e Adams: a quota 7 un titolare.",
  "Cacciamani":"19 anni, rientrato dal prestito alla Juve Stabia dove era allenato da Abate: titolare a sinistra nel Torino.",
  "Zaniolo":"Riscattato per 5M dal Galatasaray e rinnovo fino al 2029: primo sulle punizioni, corner e terzo rigorista dell'Udinese.",
  "Kabasele":"35 anni ma titolare della difesa a 3 dell'Udinese: affidabile sul breve, attenzione al minutaggio in stagione.",
  "Adams A.":"💎 Acquisto record del Venezia dal Siviglia (fino a 22M) e RIGORISTA designato: quota 12 per il terminale offensivo con i rigori.",
  "Busio":"Titolare e primo sui piazzati del Venezia: quota 5 con un ruolo centrale nella manovra.",
  "Geubbels":"💎 Primo acquisto estivo del Lecce (5M dal Paris FC) e RIGORISTA n.1 con 7/7 in carriera dal dischetto: a quota 9 è tra i colpi migliori del listone.",
  "Gandelman":"💎 Promosso mezzala offensiva titolare in tutte le formazioni tipo del Lecce: quota 5 per un titolare.",
  "Pierotti":"Titolare fisso a destra nel 4-3-3 del Lecce, incaricato di punizioni e corner.",
  "Lucchesi":"Promosso titolare nella difesa del Monza (prestito dalla Fiorentina con diritto): quota 4 per un posto da titolare.",
  "Mitaj":"Elogiato da De Rossi e favorito su Martin sulla corsia sinistra del Genoa.",
  "Traorè Hj.":"⚠️ Ancora in riabilitazione dal lungo infortunio rimediato al Marsiglia: non disponibile prima di fine agosto/settembre.",
  "Akpoguma":"Svincolato con esperienza in Bundesliga, inserito tra i titolari nelle formazioni tipo del Frosinone.",
  "Ghedjemis":"⚠️ Titolare del Frosinone ma il Monaco ha già offerto 7M+2 (rifiutati) e prepara il rilancio: rischio concreto di cessione.",
  "Valdepenas":"Con Parisi fuori per il crociato è il terzino sinistro favorito della Fiorentina: quota 6 per un titolare.",
  "Fagioli":"Regista favorito della Fiorentina su Oulai e Mandragora, ed è il battitore d'angoli.",
  /* --- GIRO PRE-ASTA, 12 agosto (queste voci hanno la precedenza: sono le ultime) --- */
  "Marianucci":"Fino a ieri era il candidato titolare d'emergenza a quota 1: quel consiglio è annullato dall'infortunio.",
  "Beukema":"Il Napoli, con Buongiorno operato e Marianucci ko, ha accelerato per BADIASHILE dal Chelsea (prestito con diritto): il francese si prende il posto accanto a Rrahmani e Di Lorenzo. Oltre al dubbio per la 1ª, ora ha anche concorrenza.",
  "Rrahmani":"Con Buongiorno, Beukema e Marianucci fuori è l'unico centrale sano del Napoli: titolare inamovibile nelle prime giornate.",
  "Di Lorenzo":"Sempre in campo, bonus costanti. Rinnovo fino al 2030 concordato e, nell'emergenza difensiva del Napoli, assolutamente intoccabile.",
  "Lucca":"⚠️ Sulla lista delle uscite del Napoli insieme a Lang: se partono entrambi arriva un attaccante (si parla di Gabriel Jesus). Terza punta a rischio partenza.",
  "Lang":"⚠️ Esubero dichiarato del Napoli: il club aspetta di cederlo per chiudere il colpo in attacco.",
  "Frattesi":"⚠️ CAMBIA TUTTO rispetto a ieri: non è più lo scambio con Nico Gonzalez, ma un PRESTITO ALLA LAZIO — contatti avanzati tra i club, l'Inter aspetta Curtis Jones se parte. Alla Lazio giocherebbe titolare, all'Inter no: finché non è deciso è una scommessa sulla squadra, non sul giocatore.",
  "Luis Henrique":"⚠️ Con Spence arrivato è diventato anche lui un'alternativa all'Inter, e questo spinge la cessione: c'è l'accordo con la ROMA (indicato sui 27M), manca il sì del giocatore che ha anche due club di Premier. In pre-campionato Chivu lo usava a SINISTRA. A quota 4 la scommessa è tutta sul trasferimento: a Roma troverebbe spazio, all'Inter ormai no.",
  "Diouf":"❌ CHIUSO DA SPENCE. Con Dumfries al Real Madrid la fascia destra era sua, ed era stato il miglior pre-campionato dell'Inter — ma l'arrivo dell'inglese dal Tottenham (oltre 30M) lo retrocede ad alternativa insieme a Luis Henrique. A quota 8 era il colpo che segnalavo stamattina: non lo è più.",
  "Lucumì":"⚠️ ACCORDO TOTALE col giocatore trovato dalla JUVENTUS: ora si tratta col Bologna. Al 12 agosto la cessione è la cosa più probabile: nel listone è ancora al Bologna, quindi rischi di pagarlo per una squadra che lascia.",
  "Vitik":"💎 Se Lucumì va alla Juve (accordo col giocatore già fatto) diventa il centrale titolare del Bologna: a quota 5 è la scommessa da fare in coda al reparto difensivo.",
  "Kristensen T.":"⚠️ IN CHIUSURA ALL'ATALANTA (22M+3 di bonus e 10% sulla rivendita) come erede di Djimsiti: nel listone è ancora all'UDINESE. Con Hien operato e fuori fino a ottobre a Bergamo giocherebbe subito. Quota 7 per un titolare, ma la squadra sul cartellino è sbagliata.",
  "Kabasele":"35 anni ma titolare della difesa a 3 dell'Udinese: affidabile sul breve, attenzione al minutaggio in stagione. Con Kristensen ceduto all'Atalanta lo spazio non gli manca — ma parte con due turni di squalifica.",
  "Mkhitaryan":"❌ 37 anni e non compare più negli undici tipo dell'Inter: ruolo di rotazione, non più il jolly di un tempo. Nessun motivo per prenderlo.",
  "Douglas Luiz":"✅ Spalletti: resterà 'molto probabilmente'. L'incertezza si è chiusa, ma nell'XI titolare della Juve continua a non esserci.",
  "Orsolini":"Ora vale come CENTROCAMPISTA: doppia cifra perenne + primo rigorista del Bologna. Bonus da attaccante a prezzo di centrocampista. Rinnovo in dirittura d'arrivo (firma attesa dopo il 15 agosto): resta. ⚠️ Sui rigori però Dovbyk insidia davvero (27/32 in carriera dal dischetto).",
  "Ghedjemis":"✅ Il rischio si è molto ridotto: il Frosinone ha ALZATO la richiesta a 20M e ha rifiutato il Monaco (7+2, poi 9M) e Celtic e Rangers (10M). Al 12 agosto resta un titolare del Frosinone e la distanza tra domanda e offerta è grande.",
  "Cancellieri":"✅ Nessuna offerta concreta e, con Isaksen fermo dalla pubalgia, la Lazio ha congelato la cessione: resta, e con Isaksen out ha spazio nelle prime giornate.",
  "Pinamonti":"⚠️ C'è il SÌ DEL GIOCATORE alla Lazio: il Sassuolo chiede ~15M, manca l'intesa tra i club e la Lazio deve prima cedere (mercato bloccato dalle uscite). Se si sblocca parte e a Sassuolo tocca a Bowie; se resta è il titolare. Al 12 agosto è la situazione più incerta del listone.",
  "Laurientè":"⚠️ Il Sassuolo chiede sempre 25M e NON è arrivata nessuna offerta convincente (Fenerbahce, Besiktas, ora anche l'Ipswich): al 12 agosto è più probabile che resti, ma il club lo ha messo in vetrina. Titolare e sui piazzati da sinistra se rimane.",
  "Tomori":"⚠️ In uscita: Coventry, Newcastle e Liverpool su di lui, il Milan si siede davanti a 15-20M. Giovedì 13 c'è il summit Cardinale-Amorim che decide le cessioni. A quota 7 il rischio è concreto.",
  "Fofana Y.":"⚠️ Fuori dal progetto e cercato da Crystal Palace, Marsiglia e Besiktas (valutazione 20-25M): da evitare.",
  "Loftus-Cheek":"⚠️ Contratto in scadenza 2027 e tentato dal ritorno in Premier: sulla lista dei cedibili del Milan.",
  "Ricci S.":"⚠️ Il Milan cede uno tra lui e Musah: situazione da chiarire al summit del 13 agosto.",
  "Musah":"⚠️ Il Milan cede uno tra lui e Ricci: situazione da chiarire al summit del 13 agosto.",
  "Estupinan":"⚠️ Il Milan gli sta cercando una sistemazione: fuori dai piani di Amorim.",
  "Corvi":"Con Suzuki ceduto al PSG (operazione chiusa) è il portiere titolare del Parma: a quota 1 è il tipo di scommessa che costa nulla.",
  "Dybala":"Titolare sulla trequarti con punizioni e corner, secondo rigorista dietro Malen. ⚠️ Ma RODRIGO MORA sta arrivando dal Porto: un trequartista con le sue stesse caratteristiche, preso proprio per quel ruolo. Con 32 anni e quel passato, la gestione del minutaggio è certa.",
  "Pellegrini Lo.":"Capitano della Roma con rinnovo di un anno, ma ⚠️ nelle formazioni tipo di Gasperini parte dietro, e con l'arrivo di Rodrigo Mora sulla trequarti il suo spazio si riduce ancora: a quota 10 non conviene.",
  "Isaksen":"⚠️ Operato di pubalgia: rientro in gruppo dal 10 agosto ma in campo tra fine agosto e settembre. La sua assenza è il motivo per cui la Lazio ha congelato la cessione di Cancellieri.",
  "Sulemana I.":"❌ Lesione del legamento collaterale mediale: rientro atteso a ottobre. Non prenderlo.",
  "Konè I.":"❌ Frattura di tibia e perone: il rientro è ora indicato a GENNAIO, peggio delle stime di una settimana fa. Non prenderlo.",
  "Hien":"❌ Operato al tendine della coscia, rientro a ottobre — e l'Atalanta sta chiudendo per Kristensen proprio per coprire il buco. Non prenderlo come titolare.",
  /* ===== AUDIT DELLE GERARCHIE, 12 agosto pomeriggio =====
     Incrociate DUE liste indipendenti degli XI di tutte e 20 le squadre (ToroNews e
     PazziDiFanta) con le fonti dedicate per squadra. Dove le due liste contraddicevano il
     database ho verificato con una terza fonte: in 6 casi aveva ragione la fonte, in 2
     (Samardzic, Masini/Akpoguma) aveva ragione il database e le liste erano vecchie. */
  "Camarda":"⚠️ CORREZIONE: NON è il titolare. La doppietta al Celtic e la maglia nel derby di Perth restano, e Amorim ha detto che resta tutta la stagione ('credo molto in lui') — ma il centravanti è Goncalo Ramos, pagato 74M, e Camarda è il PRIMO CAMBIO. Con Gimenez in uscita il minutaggio ci sarà, ma è un vice, non un titolare: vale come ultimo slot, non come scommessa da fascia media.",
  "Ramos G.":"Acquisto record del Milan (74M dal PSG) e TITOLARE indiscusso del 3-4-2-1 di Amorim in tutte le formazioni tipo. Al PSG 6 gol con xG 8.22 in soli 1300': sfortunato, non incapace. ⚠️ Sui rigori la gerarchia è aperta a tre — lui 11/13 in carriera, Nkunku 17/20, Pulisic 13/15 — e Amorim non ha ancora deciso: a quota 27 stai pagando il posto da titolare, non i rigori.",
  "Koulierakis":"⚠️ CORREZIONE: parte dalla PANCHINA. Il trio titolare di Gasperini è Mancini-N'Dicka-Hermoso; lui, Ghilardi e Ziolkowski sono le riserve. Ha qualità, età e aggressività per prendersi il posto di Hermoso (che dà meno garanzie fisiche) ed è andato in gol all'esordio col Newport, ma oggi il posto non ce l'ha. A quota 8 è una scommessa sul sorpasso, non un titolare.",
  "Hermoso":"Confermato nel trio titolare della Roma insieme a Mancini e N'Dicka. ⚠️ Due nei: è quello che dà meno garanzie fisiche del reparto e Koulierakis è arrivato per insidiarlo, e prende molti cartellini.",
  "Lipani":"⚠️ CORREZIONE: non è il titolare designato. In mediana Aquilani ha Matic come regista e Thorstvedt/Adzic per l'altra maglia; lui si gioca il posto con Bakola. Konè fuori fino a gennaio gli lascia spazio, ma a oggi parte dietro.",
  "Lucchesi":"⚠️ CORREZIONE: non è promosso titolare. Si gioca il posto centrale della difesa a 3 di Juric con Delli Carri e Kouadio: ballottaggio a tre, non una maglia sicura.",
  "Celik":"⚠️ CORREZIONE: non è nell'XI titolare. Ha giocato terzino destro nell'amichevole col Palermo, ma solo perché Kalulu era fermo per precauzione: il padrone della fascia destra resta Kalulu. Buon dodicesimo, non un titolare da quota 8.",
  "Kelly L.":"✅ Titolare in TUTTE le formazioni tipo di Spalletti (Kalulu-Bremer-Kelly-Cambiaso) e nell'ultima amichevole: il dubbio di una settimana fa è rientrato.",
  "Mandas":"✅ GERARCHIA SCIOLTA: Gattuso lo ha confermato titolare (dato per favorito 70-30 su Motta) e Provedel è stato ceduto all'Inter. Il ballottaggio dell'amichevole non ha cambiato nulla.",
  "Motta":"Secondo portiere della Lazio dietro Mandas, che Gattuso ha confermato titolare. A quota 1 solo come terzo slot.",
  "Thorstvedt":"Titolare sulla trequarti del 4-2-3-1 di Aquilani in entrambe le formazioni tipo. La partenza resta un'ipotesi senza nessuna trattativa avanzata.",
  /* --- giocatori di quota alta che erano rimasti senza spiegazione --- */
  "Rabiot":"Titolare fisso in mediana nel 3-4-2-1 di Amorim in tutte le formazioni tipo, accanto a Modric/Jashari. FM 6.98 con 91% di titolarità: paghi i voti e la presenza costante, non i bonus — non tira rigori né punizioni.",
  "Barella":"Titolare inamovibile del 3-5-2 di Chivu, presente in ogni formazione tipo. ⚠️ Ma i piazzati sono tutti di Calhanoglu e Dimarco: a quota 17 compri regolarità e voti alti, non bonus.",
  "Mancini":"Titolare inamovibile del trio difensivo di Gasperini da due stagioni: 4 gol e 2 assist nel 25-26 con 97% di titolarità. ⚠️ Tanti cartellini: è il difensore che più spesso ti toglie mezzo punto.",
  "Pavlovic":"Titolare nel terzetto Gila-Gabbia-Pavlovic in tutte le formazioni tipo di Amorim: 5 gol da difensore nel 25-26, il dato che giustifica la quota 14.",
  "N'Dicka":"Titolare inamovibile della difesa di Gasperini (97% di titolarità, 3 gol): la certezza silenziosa del reparto, senza i cartellini di Mancini.",
  "Kalulu":"Titolare a destra nella difesa di Spalletti in tutte le formazioni tipo, 37 presenze e 4 assist nel 25-26. Celik è arrivato a zero ma è il dodicesimo, non un'insidia vera.",
  "De Gea":"Titolare indiscusso della Fiorentina (37 presenze, 93% di titolarità). ⚠️ Ma FM 5.00 tonda e una difesa da rating 3: a quota 13 stai pagando il nome più della resa.",
  "Taylor K.":"Titolare in mediana nel 4-3-3 di Gattuso in entrambe le formazioni tipo, ed è la seconda scelta sui rigori dietro Zaccagni: il pacchetto piazzati gli dà un margine che la FM da sola non mostra.",
  "Rodriguez Je.":"Sceso a CENTROCAMPISTA col nuovo listone (era attaccante): stesso rendimento, ruolo più conveniente. ⚠️ Ma nel Como di Fabregas si gioca la fascia con Diao, che nelle formazioni tipo parte davanti: 76% di titolarità è il numero onesto.",
  "Molina N.":"✅ UFFICIALE alla Roma il 12 agosto, a titolo definitivo dall'Atletico Madrid con contratto di 4 anni. Quinto destro titolare nel 3-4-2-1 di Gasperini: è il ruolo che nell'era Gasperini ha prodotto più bonus dai difensori (101 gol dal reparto). 249 presenze e 19 gol tra Udinese e Atletico, campione del mondo 2022. ⚠️ Nessun dato in Serie A recente — l'ultimo campionato italiano è del 2022 — quindi la fantamedia è STIMATA dalla quota, non misurata: è la scommessa sul ruolo, non sul rendimento certificato. E ha 28 anni, quindi niente margine di crescita.",
  "Rensch":"❌ CHIUSO da Molina, ufficiale il 12 agosto: sulla fascia destra parte l'argentino. A quota 5 non vale più nemmeno l'ultimo slot.",
  "Kaiki":"✅ CORREZIONE: è il terzino SINISTRO titolare del Como, dato favorito su Valle. Yan Couto occupa la fascia destra, non la sua: non erano in concorrenza diretta.",
  "Valle":"⚠️ CORREZIONE: parte dietro a Kaiki sulla fascia sinistra secondo le fonti. Non è il titolare che il database indicava fino a stamattina.",
  "Kempf":"⚠️ Alle spalle di Chalobah al centro della difesa: nelle formazioni tipo il titolare accanto a Ramon è il nuovo acquisto dal Chelsea.",
  /* Il Como gioca la Champions: Fabregas ha annunciato turnover costante, quindi anche i
     titolari lariani vanno pesati con un minutaggio meno pieno delle altre big. */
  "Douvikas":"Confermato punta titolare del 4-2-3-1 di Fabregas in tutte le formazioni tipo: titolare e doppietta col Famalicao. ⚠️ Ma col Como in Champions Fabregas ha annunciato turnover costante: la quota 20 è giusta, non scontata.",
  /* ===== SCAMBIO INCROCIATO PELLEGRINO / PICCOLI (11-12 agosto) =====
     Le due operazioni sono legate: la cessione di Piccoli al Bologna libera il posto per
     Pellegrino alla Fiorentina. Nel listone entrambi risultano ancora nella squadra vecchia. */
  "Pellegrino M.":"⚠️ ATTENZIONE, CAMBIA SQUADRA: alla FIORENTINA dal Parma (prestito con obbligo, oltre 20M) — nel listone risulta ancora al Parma. È un DECLASSAMENTO per il fantacalcio: al Parma era la punta titolare, a Firenze è in ballottaggio quasi pari con Kean (le fonti danno 51-49 per Kean). Perde anche i rigori, che a Firenze sono di Gudmundsson. I viola hanno investito e i problemi fisici di Kean gli daranno spazio, ma a quota 15 stai pagando un titolare che è diventato mezzo titolare: vale come quarto slot da schierare nelle giornate favorevoli, non come punta su cui costruire.",
  "Kean":"Bomber da doppia cifra e rigorista alternativo dietro Gudmundsson. ⚠️ Ma con Pellegrino arrivato dal Parma per oltre 20M il posto non è più suo da solo: le fonti danno un ballottaggio 51-49. Aggiungi i suoi precedenti problemi fisici e la quota 25 diventa cara: resta forte, non è più una certezza da schierare a occhi chiusi.",
  "Tourè E.":"💎 PROMOSSO: con Pellegrino ceduto alla Fiorentina è rimasto lui la punta titolare del Parma, senza più ballottaggio. El Bilal Touré arriva dall'Atalanta in prestito con obbligo/diritto a 11M. A quota 11 compri il centravanti di una squadra intera al prezzo di una riserva — è l'occasione che apre questo scambio di mercato.",
  "Piccoli":"⚠️ CAMBIA SQUADRA: dalla Fiorentina al BOLOGNA (prestito con obbligo, 16-20M, quinquennale) — nel listone risulta ancora alla Fiorentina. Ma non è una promozione: a Bologna trova DOVBYK titolare nel 4-3-3 di Tedesco e parte dietro. Il suo picco resta la doppia cifra a Cagliari; a Lecce e Firenze ha faticato. A quota 8 è una scommessa sul sorpasso, non un titolare.",
  "Dovbyk":"Al Bologna da titolare dopo il ruolo perso alla Roma: xG/tiro 0.31 (7° in Serie A), il contesto ora lo favorisce, e insidia Orsolini sui rigori (27/32 in carriera dal dischetto). ⚠️ Il Bologna ha però preso Piccoli dalla Fiorentina per ~18M: non lo scalza subito, ma il turnover ora esiste.",
  /* Unico caso emerso dal confronto sistematico fra i titolari del database e i due XI
     pubblicati: le liste aggregate mettevano Comert al suo posto, le fonti dedicate no. */
  "Coco":"Titolare nella difesa a 3 di Abate secondo le fonti dedicate al Torino, che lo danno con Ismajli e Comuzzo. ⚠️ Due punti di attenzione: la concorrenza è a quattro per tre maglie (c'è anche Comert) e soprattutto la sua media voto è 5.84 — col modificatore difesa attivo un difensore che vota così basso ti abbassa la media del reparto anche quando la fantamedia sembra decente. A quota 7 prendilo solo se ti serve il quantitativo, non per il modificatore.",
  "Ismajli":"Titolare della difesa a 3 del Torino in tutte le formazioni tipo. ⚠️ Media voto 5.92: come tutto il reparto granata, col modificatore difesa rende meno di quanto suggerisca la quota.",
  /* --- entrati col listone delle 14 del 12 agosto --- */
  "Schmid":"UFFICIALE al Frosinone dal Werder Brema per ~8.5M, contratto di 4 anni: è l'investimento più pesante dei giallazzurri, e per una neopromossa 8.5M significa titolare. Trequartista austriaco di 26 anni, qualità offensiva. ⚠️ Nessun dato in Serie A: la fantamedia è stimata dalla quota, non misurata. A quota 8 è una scommessa ragionevole sul ruolo, non una certezza.",
  "Grillitsch":"UFFICIALE al Frosinone a parametro zero, contratto fino al 2027: regista austriaco di 31 anni con un passato di buon livello (Hoffenheim, Ajax). Porta esperienza e gestione del ritmo, ma ⚠️ nessun dato in Serie A, 31 anni e un contratto di un anno solo: è un tampone di categoria, non un titolare garantito.",
  "Calò":"⚠️ ATTENZIONE, la sua situazione è cambiata oggi: è il rigorista designato del Frosinone, ma con Grillitsch e Schmid ufficiali il centrocampo giallazzurro diventa affollato (Calò, Hasa, Koutsoupias, Masini più i due austriaci per tre maglie). I rigori restano il motivo per prenderlo, il posto non è più scontato.",
  "Masini":"Regista arrivato dal Genoa a titolo definitivo (~5M, quadriennale) e dato titolare dalle fonti dedicate. ⚠️ Ma con Grillitsch ufficiale oggi — un regista di 31 anni con carriera in Bundesliga ed Eredivisie — quel posto è ora in ballottaggio vero.",
  "Hasa":"Titolare in mediana nelle formazioni tipo del Frosinone. ⚠️ Con Grillitsch e Schmid ufficiali il reparto è passato a sei giocatori per tre maglie: verifica prima di puntarci.",
  /* ===== ULTIMO GIORNO DI MERCATO, 31 agosto (il mercato chiude domani) ===== */
  "Dovbyk":"⚠️ Nelle probabili di STASERA (Atalanta-Bologna, si gioca durante l'asta) il centravanti è PICCOLI, non lui: se stasera conferma la panchina, la quota 16 è cara. Verifica il risultato prima di rilanciare.",
  "Piccoli":"Nelle probabili di STASERA è lui il centravanti del Bologna, davanti a Dovbyk (q16 contro la sua q8): se parte titolare davvero, è un'occasione seria. Verifica la formazione durante l'asta.",
  "Molina N.":"Nelle probabili di STASERA (Lecce-Roma) è TITOLARE a destra: il posto che ad agosto non aveva sta arrivando. Attenzione: si gioca durante l'asta, verifica.",
  "Pinamonti":"Ceduto alla LAZIO nell'ultimo giorno di mercato, e le fonti lo danno PUNTA TITOLARE designata davanti a Dia e Ratkov: i suoi gol non dovrebbero calare, il contesto è migliore del Sassuolo.",
  "Esposito Se.":"✅ TORNA in Serie A: preso dal SASSUOLO nell'ultimo giorno di mercato (era stato ceduto dal Cagliari). Gerarchie da verificare dietro Bowie e Laurientè.",
  "Kessiè":"UFFICIALE all'Atalanta: mezzala di peso, e le fonti (FantaMaster) lo candidano ai RIGORI. Se li prende, la quota 12 diventa bassa: dal dischetto in carriera è quasi infallibile. Si gioca il posto con Ederson e Gaetano.",
  "Gonzalez N.":"UFFICIALE alla Juventus (lo scambio con Frattesi non si è mai fatto: è arrivato lo stesso). Subito in gol da subentrato: vedi il fatto della giornata.",
  "Theate":"UFFICIALE al Bologna: centrale titolare in Belgio/Francia, arriva per guidare la difesa. A quota 8 profilo solido.",
  "Balerdi":"UFFICIALE alla Roma dal Marsiglia: centrale con esperienza, nel sistema Gasperini dove i difensori fanno bonus. A quota 6 interessante.",
  "De Roon":"⚠️ Passato alla ROMA a 35 anni: esperienza in mediana ma Cristante e Konè davanti. Ruolo di rotazione.",
  "Perri":"✅ ORA NEL LISTONE (quota 9): il titolare del Torino, come previsto. Le mani su cui puntare per la porta granata.",
  "Paleari":"Con Perri ufficiale e nel listone è il DODICESIMO del Torino: non più da prendere se non come riserva a 1.",
  "Ngonge":"Al Monza in prestito: qualità da Serie A per la neopromossa, si gioca il posto con Cutrone e Mota.",
  "Bobcek":"Attaccante preso dal Frosinone: quota 9 e FVM alto dicono che il club ci crede, ma Raimondo (doppietta alla 2ª) è in forma.",
  "Fatah":"Esterno offensivo al Lecce: prospetto, spazio da conquistare.",
  "Lulli":"✅ ORA NEL LISTONE a quota 1: il giovane che Gasperini ha schierato titolare a destra nella 1ª. A un credito è la scommessa più economica della Roma.",
  "Folorunsho":"Al Monza dal Napoli: fisico e inserimenti, probabile titolare in mediana per la neopromossa.",
  "Fabbian":"Al Parma: mezzala d'inserimento, si gioca una maglia con Keita e Bernabè accanto.",
  "Ilic":"Al Lecce dal Torino: regista tecnico, probabile titolare nella mediana salentina.",
  "Van Der Brempt":"Al Sassuolo dal Como: fascia destra, ruolo da conquistare.",
  "Njie":"Alla Fiorentina dal Torino: giovane esterno, rotazione.",
  "Ricci S.":"Al Como dal Milan: mediana affollata con Perrone e Caqueret, rotazione.",
  "Kambwala":"Al Como: centrale giovane, dietro Ramon e Chalobah.",
  "Camarda":"Con Leao e Nkunku CEDUTI all'estero è la prima alternativa a Ramos: il minutaggio in attacco c'è, a 5 crediti.",
  "Pulisic":"⚠️ Non ha ancora preso voto e il Milan ha ceduto Leao e Nkunku: quando rientra, i piazzati e la trequarti sono suoi. A quota 24 serve fiducia sul recupero.",
  "Grabara":"Vice di Vicario alla Juventus: solo da ultimo slot.",
  "Mrozek":"Terzo portiere dell'Udinese: non prenderlo.",
  "Birligea":"Seconda punta del Frosinone: dietro Raimondo e Bobcek.",
  "Tchato":"Terzino del Frosinone: rotazione.",
  "Mout":"Centrocampista del Monza: FVM alto per la quota, da monitorare.",
};

/* ================= NOTE DELLA STAGIONE IN CORSO =================
   Queste NON sono note d'asta: sono i fatti delle giornate giocate. Hanno la precedenza su
   tutto, non passano dal filtro ripulisci() e non vengono retrocesse in coda — sarebbe
   assurdo etichettare "Ad agosto:" il racconto di una tripletta di domenica scorsa.
   È QUI che si scrive il giro settimanale: una riga per giocatore, il fatto della giornata.
   Le voci vecchie si sovrascrivono, non si accumulano. */
const CAMPO_NOTE = {
  "Kabasele":"Le due assenze sono spiegate: squalifica ereditata, scontata. Dalla 3ª è di nuovo disponibile.",
  "Mina":"⚠️ 0 presenze in 2 giornate e NESSUNA spiegazione nelle fonti (né infortunio né squalifica): il capitano che non gioca è un segnale che il prezzo non racconta. Chiarire prima di pagarlo.",
  "Kaiki":"⚠️ Mai in campo nelle prime due giornate: la previsione d'agosto (titolare a sinistra su Valle) è stata rovesciata dal campo — gioca Valle. Solo da ultimo slot.",
  "Valle":"Ha vinto sul campo il ballottaggio con Kaiki: in campo in entrambe le giornate sulla sinistra del Como.",
  /* ===== 2ª GIORNATA (28-30 agosto, 8 gare; Atalanta-Bologna e Lecce-Roma stasera) ===== */
  "Ramos G.":"Primo gol in campionato nella 2ª (Milan-Venezia 2-0). Con Leao e Nkunku ceduti all'estero, l'attacco del Milan è suo.",
  "Raimondo":"💥 DOPPIETTA al Franchi nella 2ª: Fiorentina-Frosinone 0-3. È lui a guidare l'attacco della neopromossa.",
  "Bracaglia":"In gol al Franchi nella 2ª, nel clamoroso 0-3 del Frosinone.",
  "Ekkelenkamp":"Gol nella 2ª dopo l'assist nella 1ª: con Zaniolo fuori fino a ottobre la trequarti dell'Udinese è sua.",
  "Kamara H.":"Secondo gol in due giornate: un difensore che segna a questo ritmo si paga da solo.",
  "Piotrowski":"In gol nella 2ª (Monza-Udinese 2-3).",
  "Colpani":"In gol nella 2ª: primo squillo nel Monza.",
  "Varela G.":"Secondo gol in due giornate: chiede spazio da titolare nel Monza.",
  "Volpato":"In gol nella 2ª contro il Torino: il posto di Konè se lo sta prendendo lui.",
  "Berardi":"✅ Tornato dalla caviglia e SUBITO IN GOL nella 2ª (decisivo nel 2-1 al Torino): nessuno strascico.",
  "Comuzzo":"In gol nella 2ª a Sassuolo (unico squillo del Torino).",
  "Gonzalez N.":"Gol al DEBUTTO in Juve-Parma 2-0, ma da SUBENTRATO: entrato e decisivo. Il posto da titolare se lo deve ancora prendere.",
  "Koopmeiners":"✅ RIBALTONE: era fuori dall'XI e dato cedibile, nella 2ª è rientrato e ha SEGNATO (Juve-Parma 2-0). A quota 5 il rischio è quasi zero.",
  "Baturina":"In gol al Maradona nella 2ª: il Como ha espugnato Napoli 2-1.",
  "Douvikas":"Gol-vittoria al Maradona nella 2ª: il Como di Fabregas fa sul serio, e lui è il terminale.",
  "Hojlund":"In gol nella 2ª (unico del Napoli nella sconfitta col Como).",
  "Calhanoglu":"In gol al 9' a Cagliari: ha deciso lui la 2ª dell'Inter.",
  "Frattesi":"Secondo gol in due giornate: alla Lazio gioca E segna, esattamente il motivo del trasferimento.",
  "Bowie":"💎 Centravanti titolare nella formazione VERA della 1ª, arrivato dal Verona per ~10M. ⚠️ Ma il motivo è cambiato: Pinamonti è uscito dal bollettino del 25 agosto, quindi il posto non è più libero per infortunio — se lo tiene solo continuando a giocarselo. Alla 2ª il Sassuolo riceve il Torino, uno dei turni più morbidi.",
  "Malen":"💥 TRIPLETTA all'esordio in Roma-Fiorentina 4-0, voto 8,5-9: 'inarrestabile'. Il listone lo ha già premiato portandolo da 34 a 36. È il rigorista e il terminale di Gasperini, servito da Dybala.",
  "Dybala":"💥 TRE ASSIST in Roma-Fiorentina 4-0, voto 8. Titolare sulla trequarti accanto a Mora, sostituito al 79' a partita chiusa. I 3,64 passaggi chiave a partita dell'anno scorso non erano un caso: è il rifornitore di Malen.",
  "Mora":"UFFICIALE alla Roma dal Porto, quota 19. TITOLARE all'esordio sulla trequarti accanto a Dybala (uscito al 54' per Soulè). A 19 anni è il investimento di Gasperini sulla creatività: prezzo alto per uno senza storico in Serie A, ma il posto ce l'ha.",
  "Soulè":"⚠️ DECLASSATO dalla 1ª giornata: è entrato al 54' al posto di Mora, non ha iniziato. Il posto sulla trequarti se lo giocano in tre con Dybala e Mora.",
  "Molina N.":"⚠️ NON titolare all'esordio: a destra Gasperini ha scelto il giovane Lulli. L'acquisto dall'Atletico non ha ancora il posto.",
  "Vicario":"✅ IL PORTIERE DELLA JUVENTUS: preso dal Tottenham e titolare subito a Frosinone, con Di Gregorio dato in partenza verso il Bournemouth. Quota 16: la questione portiere bianconero è chiusa, ed è lui.",
  "Celik":"✅ CORREZIONE (avevo sbagliato): titolare all'esordio come TERZINO SINISTRO al posto di Cambiaso, non come dodicesimo di Kalulu. Spalletti lo usa davvero.",
  "Douglas Luiz":"✅ CORREZIONE: titolare in mediana accanto a Locatelli nella 1ª giornata. Non era 'fuori dall'XI' come indicavano le fonti d'agosto.",
  /* Yildiz: l'infortunio lo racconta già INJURY, qui basta l'effetto sul valore */
  "Yildiz":"Il listone lo ha già abbassato da 23 a 22, ma finché non rientra vale zero: non è una occasione, è un posto rosa bloccato.",
  "Krstovic":"💥 ENTRATO NELLA RIPRESA E DECISIVO in Atalanta-Sassuolo 2-1: gol dopo sei minuti dal suo ingresso. Sarri lo usa in staffetta con Scamacca, e le pagelle parlano di 'staffetta d'oro'. Prenderli entrambi copre il posto di centravanti dell'Atalanta quasi sempre.",
  "Scamacca":"Titolare all'esordio contro il Sassuolo, poi sostituito da Krstovic che ha deciso la partita. È lui il rigorista, l'altro entra e segna: la staffetta funziona per chi ha tutti e due.",
  "Pasalic":"✅ CORREZIONE: TITOLARE in mediana alla 1ª con Gaetano ed Ederson. Le fonti d'agosto lo davano dietro Samardzic: sbagliavano.",
  "Samardzic":"⚠️ CORREZIONE: NON titolare alla 1ª — in mediana Sarri ha schierato Pasalic, Gaetano ed Ederson. Resta una buona alternativa, non un titolare.",
  "Zalewski":"💎 SORPRESA: titolare nel tridente dell'Atalanta alla 1ª insieme a Raspadori, con De Ketelaere in panchina. Era dato come riserva.",
  "Kossounou":"Titolare nella difesa dell'Atalanta alla 1ª (con Hien operato), anche se le pagelle lo hanno bocciato per gli errori.",
  "Carnesecchi":"Confermato: 'un vero e proprio muro' nelle pagelle di Atalanta-Sassuolo. Titolare inamovibile e con la media voto più alta fra i portieri.",
  "Spence":"UFFICIALE all'Inter dal Tottenham, quota 12: è lui il titolare sulla fascia destra. Diouf e Luis Henrique restano alternative.",
  "Badiashile":"UFFICIALE al Napoli dal Chelsea, quota 7: con Buongiorno out fino a novembre e Marianucci per due mesi, è titolare accanto a Rrahmani.",
  "Lucumì":"✅ UFFICIALE alla JUVENTUS: il listone lo registra già bianconero. Trova Bremer e Kelly davanti, quindi il posto va conquistato.",
  "Kristensen T.":"✅ UFFICIALE all'ATALANTA (prestito con diritto dall'Udinese), ora nel listone con la squadra giusta. ⚠️ Ma è arrivato con un problema alla caviglia: in dubbio per il Bologna.",
  "Pellegrino M.":"✅ UFFICIALE alla FIORENTINA a titolo definitivo (22,5M + 2,5 di bonus), ora nel listone come viola. ⚠️ All'esordio contro la Roma le pagelle dicono 'non si vede': il ballottaggio con Kean è tutto da giocare.",
  "Piccoli":"✅ UFFICIALE al BOLOGNA (prestito con obbligo), ora nel listone coi rossoblù. Trova Dovbyk davanti a sé.",
  "Frattesi":"✅ UFFICIALE alla LAZIO: il listone lo registra biancoceleste e lo ha già alzato da 7 a 9. Alla Lazio gioca, all'Inter non giocava.",
  "Schmid":"✅ Titolare all'esordio nel Frosinone, confermando l'investimento da 8,5M. È il trequartista dei ciociari.",
  "Cichella":"✅ CORREZIONE: titolare in mediana alla 1ª. Lo avevo declassato a riserva quando sono arrivati Grillitsch e Schmid: sbagliato.",
  "Grillitsch":"⚠️ NON titolare all'esordio: in mediana Alvini ha scelto Calò, Fini e Cichella.",
  "Masini":"⚠️ NON titolare all'esordio del Frosinone.",
  "Pinamonti":"✅ Restato al Sassuolo e USCITO dal bollettino: al 25 agosto non risulta più fermo da nessuna fonte. Ma alla 1ª il centravanti era Bowie e lui non ha preso voto: il posto ora va riconquistato sul campo, non in infermeria.",
  "Laurientè":"✅ RESTATO al Sassuolo, e alla 1ª le pagelle lo indicano come 'un leader'. L'incertezza di mercato è finita.",
  /* ===== ULTIME ORE DI MERCATO, sera del 31 (chiude domani alle 20) ===== */
  "Kean":"🚨 ACCORDO FATTO col COMO (35M+5): manca solo l'ufficialità, attesa entro domani sera. Se lo compri, comprati un attaccante del Como in ballottaggio con Douvikas — NON la punta della Fiorentina, e NON più il rigorista n.2 di Gudmundsson. A quota 25 è un rischio che deve scontare parecchio.",
  "Pellegrino M.":"Con Kean verso il Como e BETO in visite mediche per la Fiorentina, il reparto cambia faccia: il ballottaggio non è più con Kean ma col nuovo arrivato. Titolare oggi, da monitorare domani.",
  "Douvikas":"2 gol in 2 giornate e il gol-vittoria al Maradona. ⚠️ Ma il Como ha chiuso l'accordo per KEAN (35M+5): se arriva davvero, il posto da unica punta va conteso col colpo più caro dell'estate lariana.",
  "Mazzocchi":"UFFICIALE al Venezia dal Napoli (prestito con obbligo in caso di salvezza): da riserva del Napoli a possibile titolare della fascia in laguna. A quota 1 diventa interessante.",
  "Ziolkowski":"UFFICIALE al Monza dalla Roma (prestito con diritto): a Roma non giocava, al Monza si gioca un posto vero. Quota 1.",
  "Fofana Y.":"❌ Cessione al LIONE in finalizzazione: sta USCENDO dalla Serie A. Non prenderlo.",
  "Saelemaekers":"⚠️ Il Milan ha Hutchinson (Chelsea) in visite mediche: un esterno offensivo in più che può insidiarlo. Resta titolare oggi, ma la concorrenza sale.",
  "Locatelli":"La Juventus ha l'accordo per Pape Sarr dal Tottenham: un centrocampista fisico in più. Lui resta il regista titolare, ma le rotazioni si allargano.",
  /* ===== MERCATO CHIUSO, 1° settembre ore 20: il quadro definitivo ===== */
  "Kean":"✅ ORA UFFICIALE al COMO (35M+5): nel listone è lariano. Ballottaggio vero con Douvikas (2 gol in 2) per una maglia sola: due bomber, un posto. Nessuno dei due va più pagato da titolare certo.",
  "Douvikas":"2 gol in 2 giornate, gol-vittoria al Maradona. ⚠️ Ma ora KEAN è ufficiale: ballottaggio da 40M in casa. Il campo dice lui, il mercato dice Kean: prezzo di conseguenza.",
  "Gudmundsson A.":"🚨 CEDUTO alla LAZIO in chiusura: NON è più il rigorista (a Formello tira Zaccagni) e la trequarti se la gioca con Dele-Bashiru. Il pacchetto che lo rendeva d'oro alla Fiorentina — rigori+punizioni — è rimasto a Firenze.",
  "Mandragora":"Con Gudmundsson alla Lazio e Kean al Como è il candidato n.1 ai RIGORI della Fiorentina (già seconda scelta): se confermato, la quota 9 è bassissima. Verifica alla ripresa.",
  "Rowe":"Ceduto all'ATALANTA in chiusura: Sarri lo ha voluto per il tridente, si gioca il posto con De Ketelaere e Zalewski. Era titolare fisso a Bologna: gerarchia da riverificare, talento intatto.",
  "Mbangula":"Preso dal Bologna per SOSTITUIRE Rowe sulla corsia: esterno ex Juve, il posto c'è. A quota 8 è tra i nuovi più interessanti.",
  "Woltemade":"Colpo Juve da FVM 160: torre da 1.98 in un attacco AFFOLLATISSIMO (Kolo Muani 25, David, Milik). Il talento è enorme, i minuti sono la domanda: a quota 23 paghi il nome, non un posto garantito.",
  "Beto":"UFFICIALE alla Fiorentina: punta fisica, sfida Pellegrino per la maglia da titolare. Reparto rifondato in 48 ore: gerarchie tutte da leggere alla ripresa.",
  "Gnonto":"Alla Fiorentina dal Leeds: esterno rapido, con Mastantuono e Atta la trequarti viola è piena. Quota 7 da rotazione.",
  "Hutchinson":"UFFICIALE al Milan: xA/90 nel 94° percentile della Premier (FBref) — un creatore vero, non un goleador (1 gol su 2.76 attesi). Insidia Saelemaekers, e a quota 8 con bonus assist pieni è un colpo.",
  "Sarr P.":"UFFICIALE alla Juventus dal Tottenham: fisico e corsa in mediana, rotazione con Locatelli e Thuram K. Quota 7 onesta.",
  "Diego Carlos":"Al Parma dal Como: centrale d'esperienza, probabile titolare in una difesa giovane. Quota 8 sensata.",
  "Fofana Y.":"✅ RESTA al Milan: la cessione al Lione NON si è chiusa. Torna una rotazione di mediana — non più da evitare, ma nemmeno un titolare.",
  "Sulemana I.":"Ceduto al SassUOLO da infortunato (collaterale, rientro a metà ottobre): lo compri solo se hai pazienza.",
  "Dovbyk":"⚠️ Piccoli gli è stato preferito nel posticipo e il Bologna NON lo ha ceduto: gerarchia da campo, e il campo finora dice Piccoli. A quota 15 il rischio staffetta è concreto."
,
  /* ===== CHIUSI DOPO L'EXPORT DEL LISTONE (segnalazione utente + live Sky) ===== */
  "Mandragora":"🚨 CEDUTO al TORINO nelle ultime ore di mercato (5M, quadriennale): il file lo dà ancora viola, la squadra è corretta dal database. In granata è il regista davanti alla difesa: piazzati probabili, ma i rigori del Torino sono di Vlasic. La pista 'rigorista della Fiorentina' è MORTA.",
  "David":"❌ CEDUTO all'ATLÉTICO MADRID nelle ultime ore (prestito con diritto): FUORI dalla Serie A anche se il file lo mostra ancora. Non prenderlo.",
  "Fofana Y.":"❌ Al LIONE: la cessione si è chiusa davvero nelle ultime ore (2M + diritto a 12). FUORI dalla Serie A. La nota precedente diceva che restava: era vera al momento della scrittura, il mercato l'ha superata in serata.",
  "Vlasic":"Con Mandragora arrivato in granata i piazzati si dividono, ma i RIGORI restano suoi: la designazione non cambia.",
  "Beto":"UFFICIALE alla Fiorentina (18M dall'Everton): punta titolare designata di un reparto rifatto — Kean e Nzola via, dentro lui e Gnonto. ⚠️ La Fiorentina è rimasta SENZA rigorista designato: se il dischetto va a lui, il valore sale di una fascia.",
  "Woltemade":"Colpo Juve in PRESTITO dal Newcastle (5M): torre da 1.98. Con DAVID ceduto all'Atlético la concorrenza vera è il solo Kolo Muani (più Milik di rientro): i minuti ci sono più di quanto la quota 23 facesse temere ieri."

};

/* Trattative ancora APERTE: 2 = futuro in bilico (il motore lo classifica "da monitorare"),
   3 = praticamente in uscita. Da azzerare quando il mercato si chiude. */
/* Mercato CHIUSO (1° settembre): niente più trattative aperte. La mappa resta per il
   mercato di riparazione di gennaio — si riapre lì, non prima. */
/* Il mercato chiude domani (1° settembre, ore 20): le ultime ore hanno ancora
   situazioni davvero aperte. Da azzerare a mercato chiuso. */
/* MERCATO CHIUSO il 1° settembre alle 20: nessuna trattativa aperta.
   Si riapre col mercato di riparazione a GENNAIO — fino ad allora resta vuota. */
const MERCATO_UNC = {  /* fuori dalla Serie A DOPO l'export del listone: il file li mostra ancora */
  "David": 3,       // ceduto all'Atlético Madrid (prestito con diritto a 25M)
  "Fofana Y.": 3    // al Lione: la chiusura è arrivata nelle ultime ore

};

/* ================= XI PROBABILI 2026-27 (ricerca 5 agosto: fantamaster/sosfanta/
   pazzidifanta/lottomatica + amichevoli). T = titolare · B+ = ballottaggio favorito ·
   B- = ballottaggio sfavorito · R = riserva chiara. Applicata DOPO il calcolo della
   titolarità dai minuti: le gerarchie nuove contano più della stagione scorsa. */
const XI_STATUS = {
  /* --- listone di CHIUSURA, 1° settembre: gerarchie iniziali prudenti, il campo correggerà --- */
  "Woltemade":"B+","Beto":"B+","Gnonto":"B+","Hutchinson":"B+","Sarr P.":"B+","Mbangula":"B+",
  "Diego Carlos":"B+","Caleta-Car":"B+","Sugawara":"B+","Belghali":"B-","Patterson":"B-",
  "Juan Jesus":"B-","Drameh":"B-","Goglichidze":"R","Monteiro J.":"B-","Braganca":"B-",
  "Massolin":"R","Gagliardini":"B-","Jovanovic":"B-","Zeballos":"B-","Robinho Junior":"R",
  "Ghidotti":"R","Tornqvist":"R",
  /* --- nuovi del listone del 31 agosto e fatti della 2ª (8 gare giocate; Atalanta-Bologna
     e Lecce-Roma si giocano stasera, dopo l'asta: per quelle squadre vale ancora la 1ª) --- */
  "Perri":"T","Grabara":"R","Mrozek":"R",
  "Gonzalez N.":"B+",                                   // gol al debutto ma da SUBENTRATO: il posto se lo gioca con Conceicao e Zhegrova
  "Kessiè":"B+","De Roon":"B-","Theate":"B+","Balerdi":"B+","Lulli":"B+",
  "Ngonge":"B+","Folorunsho":"B+","Mout":"B-","Foe Ondoa":"R","Maye":"R",
  "Bobcek":"B+","Birligea":"B-","Tchato":"B-",
  "Esposito Se.":"B-","Van Der Brempt":"B-",
  "Kambwala":"B-","Ricci S.":"B-","Njie":"B-","Fabbian":"B+","Drobnic":"R",
  "Ilic":"B+","Fatah":"B-","Dembelè A.":"R","Ciervo":"R",
  /* Atalanta (4-3-3 Sarri) */
  /* riscritta sulla formazione VERA di Atalanta-Sassuolo 2-1 (1a giornata):
     Carnesecchi; Zappacosta, Scalvini, Kossounou, Bernasconi; Pasalic, Gaetano, Ederson;
     Zalewski, Raspadori; Scamacca. Krstovic entrato nella ripresa e decisivo. */
  "Carnesecchi":"T","Sportiello":"R","Scalvini":"T","Hien":"R","Zappacosta":"T","Bellanova":"B-","Bernasconi":"T","Kolasinac":"B-","Kossounou":"T",
  "Ederson D.S.":"T","Samardzic":"B-","Pasalic":"T","Gaetano":"T","Zalewski":"B+","De Roon":"B-",
  "Sulemana I.":"R","Scamacca":"T","Krstovic":"B+","De Ketelaere":"B+","Raspadori":"T",
  "Sulemana K.":"R",
  /* Bologna (4-3-3 Tedesco) */
  "Skorupski":"T","Happonen":"R","Pessina Mas.":"R","Lucumì":"B+","Miranda J.":"T","Heggem":"T",
  "Zortea":"B+","Vitik":"B+","Holm":"B-","Casale":"R","Helland":"R","Alhassane":"R",   // Vitik promosso: Lucumì ha l'accordo con la Juve
  "De Silvestri":"R","Orsolini":"T","Rowe":"B+","Bernardeschi":"B-","Odgaard":"B+","Cambiaghi":"R",
  "Ferguson":"T","Pobega":"B+","Amondarain":"R","Moro N.":"B+","Dominguez B.":"R",
  "El Azzouzi O.":"R","Dovbyk":"T",
  /* Cagliari (4-4-2 Pisacane) */
  "Caprile":"T","Sherri":"R","Mina":"T","Obert":"T","Kofler":"B-","Zè Pedro":"B+","Rodriguez Ju.":"B+","Idrissi R.":"B-","Fazzini":"T","Adopo":"T",
  "Winks":"T","Romano":"B+","Felici":"B-","Deiola":"B-","Liteta":"R",
  "Esposito Se.":"R","Mutandwa":"B+","Borrelli":"B-","Mendy P.":"T","Trepy":"R",
  "Maldini":"B+","Kevin Carlos":"B+","Aurelio":"B-",   // Cagliari: attacco rifatto dopo l'addio di Esposito
  /* Como (4-2-3-1 Fabregas) */
  "Butez":"T","Tornqvist":"R","Vigorito":"R","Ramon":"T","Kaiki":"R","Valle":"B+","Kempf":"B-",   // il campo ha rovesciato agosto: Valle 2 presenze su 2, Kaiki zero
  "Smolcic I.":"R","Van Der Brempt":"B-","Goldaniga":"R","Paz N.":"T",
  "Baturina":"T","Da Cunha":"T","Rodriguez Je.":"B+","Perrone":"T","Caqueret":"B-","Liberali":"R",
  "Milla":"B-","Addai":"B-","Fadera":"R","Lahdo":"R","Douvikas":"T","Diao":"B+","Couto":"B+","Chalobah T.":"B+",
  /* Fiorentina (4-3-2-1 Grosso) */
  "De Gea":"T","Christensen O.":"R","Lezzerini":"R","Dodò":"B+","Dragusin":"T","Jimenez A.":"B+",
  "Valdepenas":"B+","Viery":"B+","Parisi":"R","Pongracic":"B-","Ranieri L.":"B-","Joao Mario":"B-",
  "Atta":"T","Gudmundsson A.":"B+","Mandragora":"B-","Fagioli":"B+","Ndour":"B+","Oulai":"B+",
  "Fabbian":"R","Brescianini":"R","Kean":"B+","Piccoli":"B-","Mastantuono":"T",   // Kean 51-49 su Pellegrino; Piccoli venduto al Bologna
  /* Frosinone (4-2-3-1 Alvini) */
  "Palmisani":"B+","Desplanches":"B-","Lolic":"R","Monterisi":"T","Bracaglia":"T","Oyono A.":"T",
  "Calvani":"B+","Akpoguma":"B-","Cittadini":"T","Amey":"R","Calò":"T","Zerbin":"B-","Cichella":"T","Koutsoupias":"B-","Gelli F.":"B-",
  "Hasa":"B-","El Azzouzi A.":"B-","Kone B.":"R","Ghedjemis":"T","Raimondo":"T","Kvernadze":"B+",
  /* Schmid (8.5M dal Werder) e Grillitsch (a zero) ufficiali il 12 agosto: il centrocampo
     passa a sei giocatori per tre maglie, quindi tutti gli altri scendono di un gradino. */
  "Schmid":"T","Grillitsch":"B-","Masini":"B-",
  /* Genoa (3-4-2-1 De Rossi) */
  "Bijlow":"T","Sommariva":"R","Stolz":"R","Ostigard":"T","Vasquez":"T","Norton-Cuffy":"T",
  "Marcandalli":"T","Mitaj":"B+","Otoa":"B-","Puczka":"R","Sabelli":"B-","Baldanzi":"B+","Frendrup":"T","Ellertsson":"B-","Meichtry":"B-",
  "Traorè Hj.":"B-","Amorim":"B-","Messias":"R","Masini":"B-","Venturino":"R","Colombo":"T",
  "Vitinha O.":"B+","Havel":"B-","Sow":"T",
  /* Inter (3-5-2 Chivu) */
  "Martinez Jo.":"T","Provedel":"R","Di Gennaro":"R","Dimarco":"T","Akanji":"T","Bastoni":"T",
  "Stones":"B+","Bisseck":"B-","Carlos Augusto":"B-","Pavard":"R","Calhanoglu":"T","Barella":"T",
  "Zielinski":"B+","Diouf":"B-","Sucic P.":"B-","Frattesi":"T","Mkhitaryan":"B-",
  "Luis Henrique":"B-","Stankovic A.":"R", "Martinez L.":"T","Thuram":"T","Esposito F.P.":"B-",   // Spence titolare a destra: Diouf e Luis Henrique alternative
  "Bonny":"B-",
  /* Juventus (4-2-3-1 Spalletti) */"Pinsoglio":"R","Bremer":"T","Kalulu":"T","Cambiaso":"B+",   // Spalletti lo ha scaricato: aspetta Suzuki
  "Celik":"T","Kelly L.":"T","Gatti":"B-","Rugani":"R","Cabal":"R","McKennie":"T",   // Kelly titolare in tutte le fonti; Celik insidia Kalulu a destra
  "Alajbegovic":"B-","Conceicao":"T","Thuram K.":"B+","Locatelli":"T","Zhegrova":"R",
  "Koopmeiners":"B+","Douglas Luiz":"T","Kolo Muani":"T","Yildiz":"T","David":"R",
  "Boga":"R","Ekhator":"R",
  /* Lazio (4-3-3 Gattuso) */
  "Mandas":"T","Motta":"R","Renzetti":"R","Doekhi":"T","Romagnoli":"B-","Tavares N.":"B+",   // Gattuso ha confermato Mandas titolare, Motta vice
  "Marusic":"B+","Pedraza":"B-","Provstgaard":"T","Floriani Mussolini":"R","Lazzari":"B-",
  "Pellegrini Lu.":"R","Patric":"B-","Zaccagni":"T","Taylor K.":"T","Cancellieri":"B+",   // con Isaksen out ha spazio
  "Isaksen":"B+","Rovella":"T","Dele-Bashiru":"T","Cataldi":"B-","Belahyane":"B-",
  "Przyborek":"R","Dia":"B-","Ratkov":"T","Noslin":"B-",
  /* Lecce (4-3-3 Di Francesco) */
  "Falcone":"T","Tiago Gabriel":"T","Gallo":"T","Gaspar K.":"B+",
  "Veiga D.":"T","Siebert":"B-","Jean":"R","Ndaba":"R","Coulibaly L.":"T",
  "Pierotti":"T","Berisha M.":"B+","Gandelman":"T","Ngom":"B+","Maleh":"R","Gorter":"R",
  "Kaba":"R","Fofana Sa.":"R","Geubbels":"T","Stulic":"B-","N'Dri":"T",
  /* Milan (3-4-2-1 Amorim) */
  "Maignan":"T","Terracciano":"R","Torriani":"R","Pavlovic":"T","Gila":"T","Bartesaghi":"T",
  "Gabbia":"T","Tomori":"B-","De Winter":"B-","Estupinan":"B-","Diawara S.":"R",
  "Pulisic":"T","Rabiot":"T","Modric":"B+","Saelemaekers":"T","Chukwueze":"R","Fofana Y.":"R",
  "Ricci S.":"R","Jashari":"B-","Loftus-Cheek":"R","Musah":"R",
  /* fonti discordi sulla punta: nel derby di Perth ha giocato Camarda, ma Ramos è il colpo da 70M */
  "Ramos G.":"T","Camarda":"B-",   // Amorim: Ramos titolare, Camarda primo cambio
  /* Monza (3-4-2-1 Juric) */
  "Thiam":"T","Strajnar":"R","Mangas":"T","Lucchesi":"B-",   // ballottaggio con Delli Carri, non promosso
  "Birindelli":"T","Kouadio":"B+","Carboni A.":"B+","Antov":"R","Bakoune":"R","Colpani":"T",
  "Pessina":"T","Akinsanmiro":"B+","Colombo L.":"B-","Ciurria":"B-","Cutrone":"T","Mota":"B+",
  "Varela G.":"B-","Robinson J.":"R",
  /* Napoli (4-3-3 Allegri) */
  "Meret":"T","Milinkovic-Savic V.":"B-","Contini":"R","Rrahmani":"T","Di Lorenzo":"T",
  "Spinazzola":"T","Buongiorno":"R","Beukema":"B+","Olivera":"B-","Marin R.":"B-",   // Beukema: arriva Badiashile
  "Marianucci":"R","Mazzocchi":"R", "McTominay":"T","De Bruyne":"T","Zambo Anguissa":"B-",   // Marianucci: collaterale, stop lungo
  "Politano":"T","Vergara":"B-","Lobotka":"T","Folorunsho":"R","Gilmour":"B-","Hojlund":"T",
  "Santos A.":"T","Neres":"R","Giovane":"B-","Lang":"R","Lucca":"R",
  /* Parma (3-5-2 Cuesta) */
  "Daffara":"B-","Corvi":"T","Delprato":"T", "Valeri":"T",   // Suzuki chiuso al PSG: Corvi e il titolare
  "Valenti":"B-","Troilo":"T","Britschgi":"B-","Ndiaye":"B-","Carboni F.":"R","Bernabè":"T",
  "Nicolussi Caviglia":"B+","Keita M.":"T","Almqvist":"B-",
  "Diallo O.":"R","Ordonez C.":"B-","Cremaschi":"R","Pellegrino M.":"B+","Frigan":"B-",
  "Elphege":"B-","Tourè E.":"T",   // Pellegrino ceduto alla Fiorentina: Tourè e la punta titolare del Parma
  /* Roma (3-4-2-1 Gasperini) */
  "Svilar":"T","De Marzi":"R","Gollini":"R","Wesley":"T","Mancini":"T","N'Dicka":"T",
  "Hermoso":"T","Koulierakis":"B+","Molina N.":"B+","Rensch":"R","Ghilardi":"B-",   // Molina UFFICIALE: quinto destro titolare, Rensch chiuso
  "Ziolkowski":"R","Konè M.":"T","Cristante":"T","Pisilli":"B-","El Aynaoui":"B-","Malen":"T",
  "Dybala":"T","Castro S.":"B-","Soulè":"B+","Vaz":"R","Pellegrini Lo.":"B-",
  /* Sassuolo (4-3-3 Aquilani) */
  "Muric":"T","Russo A.":"R","Turati":"B-","Idzes":"T","Walukiewicz":"T","Doig":"T",
  "Candè":"B-","Pieragnolo":"B-","Thorstvedt":"T","Konè I.":"R","Volpato":"R",
  "Matic":"T","Adzic":"B-","Bakola":"B-","Boloca":"B-","Lipani":"B-","Berardi":"T",   // Lipani in ballottaggio, non titolare
  "Laurientè":"T","Pinamonti":"B+","Bowie":"T","Satalino":"R","Dominguez B.":"R",
  /* Torino (3-4-2-1 Abate) — il titolare in porta sarà Perri, non presente nel listone */
  "Mascardi":"R","Paleari":"R","Siviero":"R","Coco":"T","Ismajli":"T","Comuzzo":"T","Comert":"B-","Biraghi":"R","Vlasic":"T","Casadei":"T","Oristanio":"T",
  "Cacciamani":"T","Gineitis":"B-","Fitz-Jim":"B+","Ilkhan":"R","Njie":"R","Aboukhlal":"R",
  "Ilic":"R","Anjorin":"R","Simeone":"T","Adams C.":"B-","Zapata D.":"B-","Kulenovic":"B-",
  /* Udinese (3-4-2-1 Runjaic) */
  "Okoye":"T","Padelli":"R","Piana":"R","Solet":"T","Vojvoda":"T","Kristensen T.":"B+",
  "Kamara H.":"T","Kabasele":"T","Bertola":"B-","Zanoli":"B-","Arizala":"R","Palma":"R",
  "Ebosse":"R","Abankwah":"R","Zaniolo":"T","Ekkelenkamp":"T","Unai Gomez":"B-",
  "Karlstrom":"T","Piotrowski":"B+","Miller L.":"B+","Chakvetadze":"R",
  "Zarraga":"R","Davis K.":"T","Gueye":"B+","Bayo V.":"B-",
  /* Venezia (3-5-2 Stroppa) */
  "Stankovic F.":"T","Grandi":"R","Pozzi":"R","Bella-Kotchap":"T","Moreno M.":"T","Haps":"T",
  "Halhal":"B-","Correia T.":"B-","Schingtienne":"T","Sverko":"R","Hainaut":"B+","Franjic":"R",
  "Sagrado":"R","Gomes":"R","Basic":"T","Busio":"T","Sohm":"B+","Perez K.":"B-","Helgason":"R",
  "Duncan":"R","Dagasso":"B-","Adams A.":"T","Yeboah J.":"B+",
  "Rrahmani Al.":"B-","Adorante":"R","Lisman":"R","Lauberbach":"R",
  /* --- formazioni reali della 1ª giornata e nuovi arrivi (25 agosto) --- */
  "Mora":"T","Fini ":"T","Vicario":"T","Milik":"B-","Cinquegrano":"T","Odenthal":"T","Spence":"T","Badiashile":"T","Jones C.":"B+","Elmas":"B+","Sutalo J.":"B-",
};
const XI_ADJ = {
  "T":  t => Math.max(t, 88),
  "B+": t => Math.min(Math.max(t, 74), 84),
  "B-": t => Math.min(t, 60),
  "R":  t => Math.min(t, 42)
};

/* ================= INFORTUNATI — BOLLETTINO DEL 25 AGOSTO 2026, verso la 2ª giornata =====
   [giornate che salta DI SICURO, nota]. 4+ → inj=3; 2-3 → inj=2; 0-1 → solo nota.

   Il numero e una CERTEZZA, non un rischio: una squalifica vale 1, un "da valutare" vale 0.
   Il tab Formazione ci si appoggia per escludere -- se un dubbio valesse 1, Leao finirebbe
   in panchina come se fosse fermo, mentre merita solo il malus da incerto.

   Fonti incrociate: Sky Sport (elenco squadra per squadra degli indisponibili per la 2ª),
   FantaMaster (dettaglio sui dubbi) e Fantacalcio-Online (date di rientro dichiarate).

   L'elenco di Sky è COMPLETO squadra per squadra, quindi vale anche per esclusione: chi non
   c'è è disponibile. È così che si sono chiuse tre voci vecchie che nessuno avrebbe pensato
   di andare a togliere — Pulisic, Pellegrini Lu. e Dybala non risultano più fermi da nessuna
   parte, e le loro note d'agosto stavano ancora lì a parlare di dubbi per la 1ª giornata.

   Le giornate si contano DA QUELLA IN ARRIVO. Una data di rientro dichiarata vale più di una
   stima a parole: dove c'è, è quella che decide il numero. */
const INJURY = {
  "Walukiewicz":[1,"Infortunato (con Boloca e Konè): ha saltato le prime due giornate, rientro da verificare dopo la sosta."],
  /* --- Atalanta --- */
  "Hien":[4,"Lesione al semitendinoso: rientro dichiarato l'11 ottobre."],
  "Sulemana I.":[8,"Lesione al collaterale del ginocchio: rientro a metà ottobre."],
  "Kristensen T.":[1,"Non ha ancora giocato: il problema fisico lo tiene fuori dalle prime due, rientro da verificare dopo la sosta."],
  /* --- Cagliari --- */
  "Idrissi R.":[11,"Lesione del crociato anteriore: rientro a novembre."],
  "Trepy":[2,"Fermo per un incidente domestico: tempi non comunicati."],
  /* --- Como --- */
  "Addai":[4,"❌ Operato per la rottura del tendine d'Achille sinistro: rientro dichiarato l'11 ottobre."],
  /* --- Fiorentina --- */
  "Parisi":[8,"❌ Lesione del legamento crociato anteriore: rientro a fine novembre. Non prenderlo."],
  /* --- Genoa --- */
  "Havel":[1,"Non convocato in nessuna delle prime due giornate: recupero da verificare dopo la sosta."],
  "Venturino":[3,"In recupero dall'operazione al tendine rotuleo: rientro a metà settembre."],
  "Traorè Hj.":[1,"Mai in campo nelle prime due giornate: la condizione non è ancora da partita."],
  /* --- Juventus --- */
  "Yildiz":[11,"❌ Sospetta frattura al piede sinistro rimediata a Frosinone: se si opera sono almeno due mesi. Fuori dai giochi fino a novembre."],
  "Ekhator":[1,"Lesione al bicipite femorale: ha saltato le prime due giornate, rientro da verificare dopo la sosta."],
  "Gatti":[1,"Stiramento muscolare: ha saltato anche la 2ª, rientro da verificare dopo la sosta."],
  /* --- Lazio --- */
  "Marusic":[1,"Il problema alla coscia gli ha fatto saltare la 2ª: da verificare dopo la sosta."],
  "Dele-Bashiru":[1,"Il problema muscolare gli ha fatto saltare la 2ª: da verificare dopo la sosta."],
  "Cataldi":[1,"Ha saltato le prime due giornate: recupero atletico ancora in corso."],
  /* --- Lecce --- */
  /* --- Milan --- */
  /* --- Monza --- */
  "Pessina":[11,"❌ Lesione alla rotula: rientro a novembre."],
  /* --- Napoli --- */
  "Buongiorno":[3,"Operato al menisco: rientro ANTICIPATO, dichiarato il 30 settembre. Non è più mezzo girone: sono tre giornate."],
  "Marianucci":[4,"❌ Lesione di alto grado al collaterale mediale del ginocchio: rientro a metà ottobre."],
  /* Neres non compare in nessun bollettino del 25, ma nemmeno c'è una conferma positiva che
     sia rientrato: viene da un'operazione alla caviglia (Londra, gennaio 2026) e dal 5 agosto
     risultava "ancora lontano". Sparire da un elenco di indisponibili non è la stessa cosa
     che essere arruolabile, quindi resta un dubbio dichiarato invece di un azzeramento. */
  "Neres":[1,"⚠️ Non risulta più negli indisponibili del 25 agosto, ma manca una conferma che sia tornato in gruppo: viene dall'operazione alla caviglia di gennaio e a inizio agosto i tempi erano ancora indefiniti. Da verificare prima di puntarci."],
  /* --- Parma --- */
  "Nicolussi Caviglia":[1,"Lesione muscolare di medio grado alla coscia: rientro a metà settembre."],
  /* --- Roma --- */
  "Rensch":[1,"Stiramento del flessore: ha saltato le prime due giornate, rientro da verificare dopo la sosta."],
  "Vaz":[3,"Infortunio muscolare: rientro dopo la sosta delle nazionali."],
  /* Dybala non è fermo — non compare in nessun bollettino di oggi. Resta però la condizione
     di fondo, che non è una notizia di giornata ma un dato con cui convivere tutto l'anno. */
  "Dybala":[0,"Giocatore operato al menisco a marzo 2026: il minutaggio va gestito tutto l'anno, il turnover è una certezza più che un rischio."],
  /* --- Sassuolo --- */
  "Konè I.":[18,"❌ Frattura di tibia e perone: rientro previsto a gennaio 2027. Non prenderlo."],
  "Candè":[1,"Ricostruzione del crociato anteriore destro: rientro dichiarato il 15 settembre."],
  /* --- Torino --- */
  "Zapata D.":[1,"Ha saltato le prime due giornate: il rientro è ancora graduale."],
  /* --- Udinese --- */
  "Zaniolo":[3,"Stiramento alla coscia: rientro dichiarato il 1° ottobre — salta fino alla 5ª."],
  "Zanoli":[3,"In riabilitazione dal crociato: rientro dopo la sosta delle nazionali."],
  /* --- Venezia --- */
  "Sverko":[9,"❌ Problemi alle anche: rientro a fine ottobre."],
  "Adorante":[9,"❌ Operato alla schiena: rientro a fine ottobre."]
};

/* ================= MINUTI/PRODUZIONE ESTERO 25-26 dei nuovi arrivi =================
   Stesse colonne di understat: [nome, squadra 25-26, min, presenze, gol, xG, assist, xA, npxG, tiri, kp].
   Dove xG/xA non sono verificabili si usano gol/assist (delta zero: nessun segnale inventato).
   Servono a far calcolare titolarità e xgd anche a chi non ha dati Serie A. */
const EXTRA_US = [
  ["Goncalo Ramos","PSG",1318,30,6,8.22,1,1,6.7,0,0],
  ["Randal Kolo Muani","Tottenham",1670,30,1,2.69,1,1,2.69,0,0],
  ["Danilho Doekhi","Union Berlin",3060,34,5,5,0,0,5,0,0],
  ["Konstantinos Koulierakis","Wolfsburg",2482,29,4,4,1,1,4,0,0],
  ["Aleksandar Stankovic","Club Brugge",1911,24,4,4,1,1,4,0,0]
];
for (const r of EXTRA_US) {
  const u = { n:r[0], t:r[1], min:r[2], gp:r[3], gol:r[4], xg:r[5], ass:r[6], xa:r[7], npxg:r[8], tiri:r[9], kp:r[10] };
  US.push(u);
  for (const t of toks(u.n)) { if (!USBY.has(t)) USBY.set(t, []); if (!USBY.get(t).includes(u)) USBY.get(t).push(u); }
}

/* ---- squadre 2026-27 con profili allenatore data-driven ---- */
const TEAMS = {
  "Inter":{atk:5,def:5,coach:"Chivu",cn:"Campione d'Italia; Chivu 0.94 gol subiti/gara (3° storico): difesa top + attacco fortissimo"},
  "Napoli":{atk:4,def:5,coach:"Allegri",cn:"Allegri = 0.88 gol subiti/gara: porta e difesa d'oro, specie col modificatore"},
  "Roma":{atk:5,def:4,coach:"Gasperini",cn:"101 gol dai difensori nell'era Gasperini: braccetti ed esterni fanno bonus"},
  "Milan":{atk:4,def:4,coach:"Amorim",cn:"3-4-3 offensivo: quinti alti e attacco premiati, meno clean sheet"},
  "Juventus":{atk:4,def:4,coach:"Spalletti",cn:"Spalletti: 24 gol da palla inattiva nello scudetto; attacco che ha creato più di quanto ha segnato"},
  "Como":{atk:4,def:4,coach:"Fabregas",cn:"Possesso e trequartista libero: talenti creativi esaltati"},
  "Atalanta":{atk:4,def:4,coach:"Sarri",cn:"Sarri 1.06 subiti/gara: più ordine e difesa, meno gol dai difensori dell'era Gasp"},
  "Bologna":{atk:4,def:4,coach:"Tedesco",cn:"Verticale e intenso, arriva in fretta in area"},
  "Lazio":{atk:3,def:4,coach:"Gattuso",cn:"Pressing intenso e compattezza, forte sulle transizioni"},
  "Fiorentina":{atk:4,def:3,coach:"Grosso",cn:"Pragmatico, verticale sugli esterni"},
  "Udinese":{atk:3,def:3,coach:"Runjaic",cn:"Organizzata e solida dietro"},
  "Torino":{atk:3,def:3,coach:"Abate",cn:"Gioco ordinato, valorizza i giovani"},
  "Cagliari":{atk:3,def:3,coach:"Pisacane",cn:"Pragmatico da salvezza, difesa prima di tutto"},
  "Genoa":{atk:3,def:3,coach:"De Rossi",cn:"4-3-3: intensità, costruzione e compattezza"},
  "Parma":{atk:3,def:3,coach:"Cuesta",cn:"Scuola possesso, rosa giovane"},
  "Sassuolo":{atk:3,def:3,coach:"Aquilani",cn:"Propositivo, cerca il bel gioco"},
  "Lecce":{atk:2,def:3,coach:"Di Francesco",cn:"4-3-3 offensivo ma materiale da salvezza"},
  "Monza":{atk:3,def:3,coach:"Juric",cn:"3-4-3 a uomo: il suo Torino fu 4ª difesa (17 subiti)"},
  "Venezia":{atk:2,def:3,coach:"Stroppa",cn:"Neopromossa accorta"},
  "Frosinone":{atk:2,def:2,coach:"Alvini",cn:"Neopromossa, obiettivo salvezza"}
};

/* ================= NOTE: LA STAGIONE IN CORSO PARLA PER PRIMA =================
   Fino a ieri i dati di quest'anno correggevano la titolarità ma non arrivavano al testo:
   le note restavano quelle scritte a mano fra il 6 e il 12 agosto, con la cornice dell'asta
   addosso. Da qui in poi il campo scrive per primo, e quel che è stato superato dai fatti
   viene tolto automaticamente — la prossima riscrittura a mano è prevista a fine gennaio,
   quindi tutto quello che cambia ogni settimana deve uscire dai file di dati da solo. */

/* ---- 1) il blocco della stagione in corso ----
   ATTENZIONE alla differenza fra presenza e titolarità: nelle statistiche ufficiali `Pv`
   conta chi ha preso VOTO, subentrati compresi. Chi è partito dal primo minuto lo sa solo
   XI_STATUS, che è curato a mano sulle formazioni vere. Per questo il testo dice sempre
   "in campo" / "ha preso voto" e mai "è partito titolare", tranne quando è XI_STATUS a dirlo. */
const RISERVA = new Set(["R", "B-"]);
/* Con una giornata sola ogni formula plurale suona sbagliata, e sono proprio le settimane
   in cui questo testo viene letto di più. */
const inGior  = g => g === 1 ? "nella 1ª giornata" : `in ${g} giornate`;
const tutteGior = g => g === 1 ? "nella 1ª giornata" : `in tutte e ${g} le giornate`;
/* `stop` = giornate di assenza dal bollettino di OGGI (null se non è in INJURY). Non si usa
   `inj`, che vale anche 2 per fragilità ereditata dallo storico: De Bruyne ha 35 anni e un
   passato di infortuni, quindi eredita inj=2 pur essendo sanissimo — e con `inj` al posto di
   `stop` gli spariva la riga "confermato dal campo" dopo che aveva segnato all'esordio. */
function campoNote(nome, ora, stop, nuovo, gSquadra) {
  if (!GIORNATE) return "";
  const g = gSquadra || GIORNATE, pv = ora ? ora.pv : 0;
  const fermoOra = stop !== null && stop >= 2;      // assenza vera, in corso
  const inBollettino = stop !== null;               // anche solo un acciacco segnalato oggi
  const xi = XI_STATUS[nome] || "";
  const parti = [];

  /* --- stato: cosa dice il campo sulle gerarchie ---
     Due cautele che qui contano più della prosa.
     1) `pv` conta chi ha preso VOTO. Zero non vuol dire per forza "non ha giocato": si può
        entrare per pochi minuti e restare senza voto. Per questo si dice "non ha preso voto"
        e non "non ha giocato" — è l'unica cosa che il dato permette di affermare.
     2) XI_STATUS è GIÀ riscritto sulle formazioni vere della 1ª giornata. Quindi una riserva
        che prende voto non è un giocatore "promosso dal campo": è un subentrato, e dirlo al
        contrario contraddirebbe il dato curato a mano (è il caso di Samardzic, entrato ma
        dato dietro a Pasalic proprio dalla formazione vera).
     3) Chi è fermo per infortunio serio (2+ giornate nel bollettino di oggi) non riceve la
        riga positiva: aver preso voto prima di rompersi non è una conferma utile a nessuno. */
  if (pv === g && pv > 0 && !fermoOra) {
    if (xi === "T")            parti.push(`🟢 Confermato dal campo: ha preso voto ${tutteGior(g)}.`);
    else if (RISERVA.has(xi))  parti.push(`🔄 Le formazioni vere lo danno dietro, ma ha preso voto ${tutteGior(g)}: subentra e porta a casa il voto.`);
    else                       parti.push(`🟢 In campo: ha preso voto ${tutteGior(g)}.`);
  }
  /* L'allarme si tace se c'è un bollettino aperto: l'assenza è già spiegata, ripeterla come
     "gerarchia da verificare" darebbe la colpa al tecnico invece che all'infermeria. */
  /* L'avviso tace anche quando c'è un fatto di giornata scritto a mano (CAMPO_NOTE): le
     statistiche arrivano a giornata conclusa, i fatti prima — e "non ha ancora preso voto"
     seguito da "ha segnato nella 2ª" è la contraddizione che queste note devono evitare. */
  /* E tace per i NUOVI ARRIVI: "dato titolare ad agosto ma non ha preso voto" detto di uno
     arrivato ieri non è un avviso, è un errore di persona. */
  else if (pv === 0 && !inBollettino && !CAMPO_NOTE[nome] && !nuovo && (xi === "T" || xi === "B+"))
    parti.push(`⚠️ Dato ${xi === "T" ? "titolare" : "in ballottaggio"} ad agosto ma non ha ancora preso voto ${inGior(g)}: il campo per ora non lo conferma.`);
  else if (pv > 0 && pv < g && !fermoOra)
    parti.push(`🔄 ${pv} presenz${pv===1?"a":"e"} su ${g}: rotazione, non un titolare fisso.`);

  /* --- produzione: solo fatti, e con il campione dichiarato --- */
  if (ora && pv > 0) {
    const bonus = [];
    if (ora.gf) bonus.push(`${ora.gf} gol`);
    if (ora.ass) bonus.push(`${ora.ass} assist`);
    /* i rigori CALCIATI quest'anno valgono più di qualunque fonte di agosto: la gerarchia
       dal dischetto la decide l'allenatore in campo, non l'indiscrezione di mercato. */
    const rTot = ora.rplus + ora.rminus;
    if (rTot) bonus.push(`${ora.rplus} rigor${ora.rplus === 1 ? "e" : "i"} segnat${ora.rplus === 1 ? "o" : "i"} su ${rTot} calciat${rTot === 1 ? "o" : "i"}`);
    if (ora.rp) bonus.push(`${ora.rp} rigor${ora.rp === 1 ? "e parato" : "i parati"}`);
    if (bonus.length)
      parti.push(`⚽ Quest'anno ${bonus.join(", ")} in ${pv} ${pv === 1 ? "giornata" : "giornate"}.` +
        (g <= 4 ? ` Su ${g} ${g === 1 ? "giornata" : "giornate"} è un fatto, non ancora una tendenza.` : ""));
    /* Medie e fantamedie di quest'anno solo quando il campione regge: sotto le 5 giornate
       una fantamedia è il racconto di un episodio, non di un rendimento. */
    if (g >= 5 && pv >= 3)
      parti.push(`📊 Fantamedia ${ora.fm.toFixed(2)} e media voto ${ora.mv.toFixed(2)} su ${pv} ${pv === 1 ? "giornata" : "giornate"} di quest'anno.`);
  }
  return parti.join(" ");
}

/* ---- 2) il filtro sulle note d'asta ----
   Le voci scritte a mano restano (a settembre si rifà un'asta completa e quel contesto
   serve ancora), ma si tagliano FRASE PER FRASE i pezzi che i fatti hanno superato.
   Quel che sopravvive è contesto di sfondo — chi tira i rigori, da dove arriva uno, il
   profilo xG — e va in coda, dietro "Ad agosto:", così si legge come storia. */
const SUPERATO = [
  /\bprobabil[ei]\b|formazioni? tipo|XI probabile|nell'XI\b/i,      // le formazioni vere hanno risposto
  /amichevol|\bPerth\b|\bNewport\b|precampionato|\britiro\b|\besordio\b/i,   // il precampionato è finito
  /prima dell'asta|verifica prima|all'asta\b/i,                    // l'asta di agosto è finita
  /* Attese riferite a giornate GIÀ GIOCATE. Va costruita sul calendario vero, non fissata:
     "in dubbio fino alla 3ª" è ancora un'informazione utile alla 2ª giornata, e un pattern
     fisso la buttava via insieme a "atteso per la 1ª".
     Il prefisso conta: si cattura l'ATTESA ("per la 1ª", "fino alla 1ª"), non il racconto di
     quando è successo qualcosa — "frattura rimediata alla 1ª" descrive un fatto e resta. */
  GIORNATE
    ? new RegExp(`(?:per la|fino alla|entro la|in tempo per la)\\s*(?:${Array.from({length:GIORNATE},(_,i)=>i+1).join("|")})ª`, "i")
    : /(?!)/,
  /\bquota \d+|a quota\b|prezzo pieno|\bquota bassa|\bquota alta|\bquota minima|\bquota media|quota da riserva/i,  // 85 quote cambiate col listone del 25
  /* Trasferimenti raccontati come ancora IN SOSPESO. A campionato iniziato non lo sono più:
     il listone si riscarica ogni settimana e dice dove sta ciascuno, e MERCATO_UNC è stato
     azzerato. Restava però la prosa d'agosto, che invecchia male e in modo vistoso — la nota
     di Dybala avvisava che "RODRIGO MORA sta arrivando dal Porto" quando Mora era già alla
     Roma, aveva giocato titolare la 1ª e nel database c'era col suo prezzo. */
  /sta arrivando|è in arrivo|in arrivo dal|sta per arrivare|potrebbe arrivare|atteso l'arrivo|in caso di arrivo|se arriva\b|se partono/i,
  /in dirittura|firma attesa|è in uscita|in uscita dal|lista delle uscite|accostato a|in pressing|si parla di|trattativa|resta un'ipotesi|il club chiede/i
];
/* Si divide sulla punteggiatura forte tenendo il separatore, così una frase scartata non
   si porta via il punto della precedente. Il ":" NON separa: spezzerebbe a metà quasi tutte
   le note, che sono scritte nella forma "fatto: conseguenza". */
function ripulisci(txt) {
  if (!txt) return "";
  const frasi = String(txt).match(/[^.!?]+[.!?]*/g) || [];
  const tenute = frasi.filter(f => f.trim() && !SUPERATO.some(re => re.test(f)));
  if (!tenute.length) return "";
  const out = tenute.join("").replace(/\s+/g, " ").trim();
  return out.length < 15 ? "" : out;   // moncherini senza senso: meglio niente
}

/* ---- TRASFERIMENTI UFFICIALIZZATI DOPO L'EXPORT DEL LISTONE (31 agosto, live Sky) ----
   Le Quotazioni si scaricano al mattino, le ufficialità arrivano nel pomeriggio: chi si è
   mosso DOPO l'export risulta ancora nella squadra vecchia. Qui si corregge la squadra
   (la quota resta quella del file: è l'unica che esiste). Solo UFFICIALI, mai accordi. */
/* Chi è entrato nel listone (o ha cambiato squadra) SOLO il 31 agosto: l'unico gruppo che
   davvero non poteva giocare le prime due giornate con la squadra attuale. L'esenzione dalla
   correzione dal campo vale per loro e basta: un Kaiki, al Como da inizio agosto e mai in
   campo in due giornate, la correzione se la merita tutta — 0 presenze È il segnale. */
const ARRIVATI_COL_LISTONE_31 = new Set([
  "Perri","Grabara","Mrozek","Theate","Balerdi","Tchato","Kambwala","Macchioni","Lulli",
  "Maye","Drobnic","Dembelè A.","Kessiè","Gonzalez N.","Foe Ondoa","Mout","Ciervo",
  "Bobcek","Birligea","Ngonge","Fatah",
  "Van Der Brempt","Njie","De Roon","Fabbian","Ricci S.","Folorunsho","Ilic",
  "Esposito Se.","Pinamonti","Mazzocchi","Ziolkowski",
  /* --- e i nuovi del listone di CHIUSURA (1° settembre) --- */
  "Ghidotti","Diego Carlos","Belghali","Caleta-Car","Sugawara","Patterson","Juan Jesus",
  "Drameh","Goglichidze","Hutchinson","Mbangula","Monteiro J.","Sarr P.","Braganca",
  "Massolin","Gagliardini","Jovanovic","Woltemade","Beto","Gnonto","Zeballos",
  "Robinho Junior","Tornqvist","Gudmundsson A.","Rowe","Sulemana I.","Kean"
]);

const TRASFERIMENTI_POST_LISTONE = {
  /* chiusi DOPO l'export del file del 1° settembre (live Sky deadline): il prossimo listone
   li avrà, fino ad allora la squadra la corregge questa mappa. */
  "Mandragora": "Torino"       // dalla Fiorentina, 5M, quadriennale — ufficiale
};

/* ---- costruzione ---- */
const esc = s => String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"');
const ROLE_TITLE = { P:"PORTIERI", D:"DIFENSORI", C:"CENTROCAMPISTI", A:"ATTACCANTI" };
let matched = 0, estimated = 0, withUS = 0;
const lines = [];
for (const role of ["P","D","C","A"]) {
  let first = true;
  for (const p of L.filter(x => x.r === role).sort((a,b) => b.q - a.q)) {
    if (TRASFERIMENTI_POST_LISTONE[p.n]) p.t = TRASFERIMENTI_POST_LISTONE[p.n];
    const o = findOld(p);
    const u = findUS(p);                       // Understat: minuti e xG (per titolarità e xgd)
    if (u) withUS++;
    /* FONTE PRIMARIA: statistiche ufficiali 25-26, agganciate per ID (nessun rischio di
       omonimia). Understat resta per i minuti e i segnali xG, che le statistiche non hanno. */
    const st = ST26.get(p.id);
    const hasReal = !!st && st.pv >= 5;        // sotto 5 presenze il dato non è significativo
    if (hasReal) matched++; else estimated++;
    const fm  = hasReal ? st.fm : estFM(p.r, p.q);
    const est = hasReal ? 0 : 1;
    const pres = st ? st.pv  : (u ? u.gp  : (o ? o.pres : 0));
    const gol  = st ? st.gf  : (u ? u.gol : (o ? o.gol : 0));
    const ass  = st ? st.ass : (u ? u.ass : (o ? o.ass : 0));
    /* NIENTE eredità dallo storico: la mappa RIG copre ora tutte e 20 le squadre con le
       gerarchie 2026-27, quindi chi non c'è semplicemente non tira i rigori quest'anno.
       Ereditare il dato vecchio resuscitava designazioni superate (Lukaku, Gimenez). */
    const rig  = RIG[p.n] ?? 0;
    /* Cancello titolarità. Priorità ai MINUTI REALI giocati; chi ha cambiato squadra riparte
       dalle gerarchie nuove (un titolare altrove può essere riserva qui: Provedel, Lazio → vice Inter). */
    /* Chi ha cambiato squadra: pesa soprattutto la GERARCHIA NUOVA (dedotta dalla quota
       nella nuova rosa), perché lo storico dice quanto giocava altrove, non qui.
       Es. Provedel: titolare alla Lazio ma quota 2 da vice all'Inter → resta una riserva. */
    const changedTeam = !u || norm(u.t) !== norm(p.t);
    /* Per i PORTIERI la gerarchia dichiarata pesa sempre più dei minuti passati: il ruolo è
       binario (o giochi tutte o nessuna) e un vice che l'anno prima era titolare altrove
       resta un vice. Negli altri ruoli i minuti reali sono il segnale migliore. */
    let tit = !u
      ? rankTit(p)
      : p.r === "P"    ? Math.round(titFromMinutes(u) * 0.4 + rankTit(p) * 0.6)
      : changedTeam    ? Math.round(titFromMinutes(u) * 0.3 + rankTit(p) * 0.7)
                       : titFromMinutes(u);
    /* le probabili formazioni 2026-27 correggono la storia: gerarchie nuove > minuti vecchi */
    if (XI_STATUS[p.n]) tit = XI_ADJ[XI_STATUS[p.n]](tit);
    /* ---- UPSIDE data-driven (tools/scovatore.mjs, 2 stagioni di verifica) ----
       Misurato su 378 giocatori economici: la probabilità di diventare titolare (28+
       presenze) dipende quasi solo da QUANTO GIOCAVA GIÀ, non dalla media voto.
         28+ presenze l'anno prima → 53% ce la fa   (base di tutti gli economici: 19%)
         18-27 →14%   8-17 →18%   1-7 →25%   mai visto in A →8%
       Il mito "media voto alta e poco spazio" NON regge: quel gruppo ha fatto peggio
       della media. Chi arriva dall'estero è un caso a parte (nessuno storico in A):
       resta neutro, perché tra i migliori colpi del 25-26 ce n'erano parecchi. */
    const age  = ETA[p.n] ?? (o && o.age ? o.age : 26);
    const prev = findPrev(p);                           // c'era nel listone dell'anno scorso?
    const pv25 = st ? st.pv : 0;
    const pv24 = ST25.get(p.id) ? ST25.get(p.id).pv : 0;
    const inCalo = pv24 >= 8 && pv25 <= pv24 - 8;       // spazio in contrazione: 14% contro 32%
    let up;
    if (!prev) up = 2;                                  // mai in Serie A: neutro, non penalizzato
    else if (pv25 >= 28) up = 4;
    else if (pv25 >= 18) up = 3;
    else if (pv25 >= 8)  up = 2;
    else                 up = 1;
    if (inCalo) up = Math.max(1, up - 1);
    /* l'upside è potenziale di crescita: a 33 anni suonati non esiste più, per quanto
       il giocatore sia stato titolare (altrimenti Mkhitaryan a 37 anni risultava "Scommessa") */
    if (age >= 33) up = Math.min(up, 2);
    /* Senza bollettino di oggi si eredita il dato della stagione scorsa: è la "fragilità"
       storica del giocatore, ed è giusto che pesi. Ma se il giocatore È nel bollettino di
       oggi, oggi ha ragione: altrimenti un infortunio del 2025-26 già guarito continuerebbe
       a escluderlo dai consigliati (stesso motivo per cui i rigoristi non si ereditano). */
    let inj  = o ? o.inj : 0;
    /* Quante giornate gli fa saltare il BOLLETTINO DI OGGI. Serve per la formazione: `inj`
       e una scala di rischio 0-3 e non distingue "salta la prossima" da "storicamente
       fragile" — con quella sola, Kabasele squalificato per la 2a risultava schierabile. */
    const stop = INJURY[p.n] ? INJURY[p.n][0] : 0;
    let injNote = "";
    const ora = ST_ORA.get(p.id);                       // stagione in corso: serve già qui
    if (INJURY[p.n]) {
      const [gior, txt] = INJURY[p.n];
      inj = gior >= 4 ? 3 : gior >= 2 ? 2 : Math.min(inj, 1);
      /* Un acciacco da 0-1 giornate è un dubbio, non uno stop: se il giocatore ha poi preso
         voto, quel dubbio se l'è sciolto il campo. Prima qui si buttava via la nota intera;
         ora si passa dal filtro frase per frase, che è meglio — la nota di Dybala diceva
         "la contusione col Newport non è grave: c'è per la 1ª" (superata) MA anche "operato
         al menisco a marzo, minutaggio da gestire tutto l'anno", che vale ancora e andava
         persa. Da 2 giornate in su il bollettino è un'assenza vera e resta intatto. */
      const risolto = gior <= 1 && ora && ora.pv > 0;
      const testo = (GIORNATE && risolto) ? ripulisci(txt) : txt;
      if (testo) injNote = `⚕️ ${testo}`;
    }
    const unc  = MERCATO_UNC[p.n] ?? 0;   // trattativa aperta -> il motore lo marca "da monitorare"
    /* "nuovo acquisto" = non era in Serie A l'anno scorso, oppure c'era ma in un'altra
       squadra. Fonte: listone 2025-26 completo (non lo snapshot parziale del KB). */
    const newT = prev ? (norm(prev.t) !== norm(p.t) ? 1 : 0) : 1;

    /* ---- xgd: correzione numerica di regressione verso la media (in punti FM) ----
       Il backtest 25-26 (tools/backtest.mjs) mostra che chi segna 3+ gol sopra il proprio
       xG porta ~+0.3 FM NON sostenibili (e viceversa): la parte fortunata va scontata.
       Fattore 0.65 = quota della sovra/sotto-performance che regredisce (xG predice i gol
       futuri meglio dei gol stessi); un gol vale 3 punti, un assist 1, spalmati sulle presenze.
       In più: il bump rigorista del motore (+0.15) ha senso solo per chi i rigori li ha PRESI
       ORA; chi li tirava già ce li ha dentro FM e quota (backtest: residuo -0.14 sui rigoristi
       confermati) → compensazione -0.10 se l'anno scorso ha calciato rigori (xG-npxG >= 1.5). */
    let xgd = 0;
    if (u && u.min >= 700 && u.gp > 0) {
      const adj = -( (u.gol - u.xg) * 0.65 * 3 + (u.ass - u.xa) * 0.60 * 1 ) / u.gp;
      xgd = Math.max(-0.35, Math.min(0.35, adj));
      if ((RIG[p.n] ?? 0) === 2 && (u.xg - u.npxg) >= 1.5) xgd -= 0.10;
      xgd = Math.max(-0.40, Math.min(0.40, xgd));
      xgd = Math.round(xgd * 100) / 100;
    }

    /* ---- segnali di regressione dai dati reali: le occasioni nascoste ----
       gol molto sotto npxG = ha creato più di quanto ha segnato → risalirà (e viceversa).
       Stessa logica su assist vs xA. Solo con minuti sufficienti per essere significativo. */
    let signal = "";
    const volSig = [];
    if (u && u.min >= 700) {
      /* Confronto gol totali con xG TOTALE (non npxG): npxG esclude i rigori, quindi userebbe
         un metro sbagliato per i rigoristi (es. Calhanoglu risulterebbe +7.7 sopra le attese). */
      const dG = u.gol - u.xg, dA = u.ass - u.xa;
      const p90 = (u.npxg / u.min * 90);
      if (dG <= -3)      signal = `💎 Ha segnato ${u.gol} gol creandone ${u.xg.toFixed(1)} (${dG.toFixed(1)}): finalizzazione sfortunata, il rendimento dovrebbe risalire.`;
      else if (dG >= 3)  signal = `🔻 ${u.gol} gol su ${u.xg.toFixed(1)} attesi (+${dG.toFixed(1)}): stagione sopra le righe, difficile da ripetere.`;
      else if (dA <= -2.5) signal = `💎 ${u.ass} assist ma ${u.xa.toFixed(1)} attesi: crea occasioni che i compagni sprecano, gli assist arriveranno.`;
      else if (p90 >= 0.45 && u.min < 1600) signal = `⚡ ${p90.toFixed(2)} npxG/90 in sole ${Math.round(u.min/90)} partite piene: rendimento alto con pochi minuti, se gioca di più esplode.`;
    }

    /* ---- VOLUME: tiri e passaggi chiave per 90 ----
       Erano nel file di Understat e non li leggeva nessuno. Sono i dati più stabili che
       abbiamo: misurati su 338 giocatori con 900+ minuti, tiri/90 predice l'xG/90 con
       r=0.89 e i passaggi chiave/90 predicono l'xA/90 con r=0.90. Il volume si ripete di
       anno in anno, la conversione no — per questo un giocatore ad alto volume che ha
       convertito poco è un'occasione, non un rischio. */
    if (u && u.min >= 900) {
      const t90 = u.tiri / u.min * 90, k90 = u.kp / u.min * 90;
      if (t90 >= 2.5)      volSig.push(`🎯 ${t90.toFixed(2)} tiri ogni 90 minuti: volume da protagonista, ed è il dato che si ripete più di ogni altro.`);
      if (k90 >= 1.75)     volSig.push(`🅰️ ${k90.toFixed(2)} passaggi chiave ogni 90: fabbrica occasioni, gli assist seguono il volume.`);
    }

    /* ---- SEGNALI DAL DATABASE UFFICIALE (media voto, cartellini, dischetto, traiettoria) ----
       Sono dati che c'erano già nei file delle statistiche ma che il motore non leggeva.
       Non entrano nella fantamedia attesa — la Fm ufficiale li contiene GIÀ tutti, sommarli
       sarebbe contarli due volte — ma cambiano la decisione all'asta, quindi vanno detti. */
    const extra = [];
    const stx = ST26.get(p.id);
    if (stx && stx.pv >= 15) {
      /* 1) MEDIA VOTO: col modificatore difesa la lega somma i VOTI di difensori e portiere,
            non le fantamedie. Per quei due ruoli è il numero che decide il modificatore. */
      if ((p.r === "D" || p.r === "P") && stx.mv > 0) {
        const soglia = p.r === "P" ? [6.10, 5.85] : [6.15, 5.95];
        if (stx.mv >= soglia[0])      extra.push(`📊 Media voto ${stx.mv.toFixed(2)} su ${stx.pv} partite: se la tua lega ha il modificatore difesa è QUESTO il numero che conta, e lui lo alza.`);
        else if (stx.mv <= soglia[1]) extra.push(`📊 Media voto solo ${stx.mv.toFixed(2)}: col modificatore difesa abbassa la media del reparto anche quando la fantamedia sembra buona.`);
      }
      /* 2) CARTELLINI: già dentro la Fm, ma dicono QUANTO di quella Fm se ne va in malus. */
      const malus = (stx.amm * 0.5 + stx.esp * 1) / stx.pv;
      if (stx.pv >= 20 && malus >= 0.12)
        extra.push(`🟨 ${stx.amm} ammonizioni${stx.esp ? ` e ${stx.esp} espulsion${stx.esp === 1 ? "e" : "i"}` : ""} in ${stx.pv} partite: −${malus.toFixed(2)} di fantamedia a gara buttati in malus.`);
      /* 3) DISCHETTO: il record vero, non l'indicazione delle fonti. */
      const tot = stx.rplus + stx.rminus;
      if (tot >= 2)
        extra.push(`⚽ Dal dischetto nel 25-26: ${stx.rplus} su ${tot}${stx.rminus === 0 ? " (nessuno sbagliato)" : ""}.`);
      /* 4) TRAIETTORIA su tre stagioni — ATTENZIONE AL VERSO.
         La prima versione di questo segnale diceva che una media voto in calo era una
         parabola in discesa. È FALSO, e l'ho misurato sulle tre stagioni che abbiamo:
         di chi arrivava da due stagioni in calo, il 75% è RISALITO l'anno dopo (+0.08 di
         media voto); di chi arrivava da due stagioni in crescita, solo il 42% ha
         continuato a salire (-0.08). È regressione verso la media, e va nel verso opposto
         all'intuizione: il calo è più spesso rumore che tendenza. n=36 per gruppo. */
      const s25 = ST25.get(p.id), s24 = ST24.get(p.id);
      if (s25 && s24 && s25.pv >= 15 && s24.pv >= 15 && stx.mv && s25.mv && s24.mv) {
        const d = stx.mv - s24.mv;
        if (stx.mv > s25.mv && s25.mv > s24.mv && d >= 0.15)
          extra.push(`📈 Media voto in crescita da tre stagioni (${s24.mv.toFixed(2)} → ${s25.mv.toFixed(2)} → ${stx.mv.toFixed(2)}). ⚠️ Ma la crescita è già nel prezzo: sulle ultime tre stagioni chi arrivava da una salita ha poi PERSO 0.08 di media voto, e solo il 42% ha continuato a migliorare.`);
        else if (stx.mv < s25.mv && s25.mv < s24.mv && d <= -0.15)
          extra.push(`📉 Media voto in calo da tre stagioni (${s24.mv.toFixed(2)} → ${s25.mv.toFixed(2)} → ${stx.mv.toFixed(2)}). ✅ NON è un motivo per scartarlo: chi arrivava da un calo è RISALITO il 75% delle volte (+0.08 di media voto). Il mercato lo sconta, i dati dicono rimbalzo.`);
      }
    }
    if (volSig.length || extra.length) signal = [signal, ...volSig, ...extra.slice(0, 3)].filter(Boolean).join(" ");
    /* ---- ORDINE DELLA NOTA ----
       Prima l'infermeria, poi quello che dice il campo di quest'anno, poi i segnali storici
       (xG, volume, dischetto: restano validi, sono un profilo di giocatore, non una notizia),
       e infine — retrocesso — quel che sopravvive delle note d'asta di agosto.
       Prima il testo d'agosto stava in testa e si leggeva come stato attuale: era la ragione
       per cui l'app diceva "titolare nelle probabili" di gente già scesa in campo. */
    const campo = campoNote(p.n, ora, INJURY[p.n] ? INJURY[p.n][0] : null, !!newT, giornateDi(p.t));
    /* CAMPO_NOTE è il giro settimanale: racconta le giornate giocate, quindi non è
       "roba d'asta" e non passa dal filtro né dalla retrocessione. */
    const fatti = CAMPO_NOTE[p.n] || "";
    const baseNote = MERCATO_NOTE[p.n] || NOTE[p.n] || (o ? o.note : "");   // il mercato ha la precedenza
    const storico = GIORNATE ? ripulisci(baseNote) : baseNote;              // fuori stagione resta com'era
    const testa = [injNote, campo, fatti, signal].filter(Boolean).join(" ");
    /* Il "·" separa la coda da quello che viene prima. Se prima non c'è niente — capita ai
       giocatori di cui si sa solo quel che si diceva ad agosto — la nota comincerebbe con un
       punto sospeso: allora l'etichetta resta, il separatore no. */
    const coda = !storico ? "" : GIORNATE ? `${testa ? "· " : ""}Ad agosto: ${storico}` : storico;
    const note = [testa, coda].filter(Boolean).join(" ");
    /* fm2 = fantamedia della stagione PRECEDENTE (24-25), solo se significativa in
       entrambe le annate: il motore la fonde 65/35 con l'ultima (misurato su 140
       giocatori: errore di previsione -9% rispetto alla sola ultima stagione).
       Un'annata anomala — in su o in giù — così non domina più la proiezione. */
    const st25p = ST25.get(p.id);
    const fm2 = (hasReal && st25p && st25p.pv >= 15 && st.pv >= 15) ? st25p.fm : 0;

    /* ---- STAGIONE IN CORSO: il campo corregge la stima ----
       La titolarità è la probabilità di prendere voto. Sul campo si misura direttamente:
       presenze / giornate giocate. Si fondono le due con un peso che cresce col campionato.
       Chi è infortunato NON viene punito due volte: l'assenza è già scontata da `inj`,
       quindi la correzione si applica solo a chi era disponibile. */
    const pvOra = ora ? ora.pv : 0;
    const golOra = ora ? ora.gf : 0, assOra = ora ? ora.ass : 0;
    const mvOra = (ora && ora.pv) ? ora.mv : 0, fmOra = (ora && ora.pv) ? ora.fm : 0;
    /* Un NUOVO ARRIVO senza presenze non viene corretto: alla 1ª non era in Serie A, e
       contargli quelle giornate come assenze punirebbe una partita che non poteva giocare
       (Perri e Nico Gonzalez, arrivati il 31, scendevano da 88 a 81 di titolarità).
       Appena prende voto rientra nella correzione come tutti. Imprecisione accettata e
       dichiarata: newT copre anche chi è arrivato PRIMA della 1ª (Kevin Carlos) — per quei
       casi resta il ⚠️ della sezione trappole, che qui non viene toccata. */
    if (GIORNATE && inj < 3 && !(ARRIVATI_COL_LISTONE_31.has(p.n) && !pvOra)) {
      const gSq = Math.max(1, giornateDi(p.t));
      const daCampo = Math.max(0, Math.min(100, pvOra / gSq * 100));
      const pesoSq = Math.min(0.80, gSq / 12);
      tit = Math.round(tit * (1 - pesoSq) + daCampo * pesoSq);
    }
    const row = `["${p.r}","${esc(p.n)}","${esc(p.t)}",${p.q},${fm.toFixed(2)},${est},${pres},${gol},${ass},${rig},${tit},${up},${inj},${age},${unc},${newT},"${esc(note)}","${p.id}",${p.fvm||0},${xgd},${fm2},${pvOra},${golOra},${assOra},${fmOra},${mvOra},${stop}]`;
    lines.push(first ? `\n/* ===== ${ROLE_TITLE[role]} ===== */\n${row}` : row);
    first = false;
  }
}

/* ---- verifica: nessuna voce inghiottita da un commento di riga ----
   La validazione dei nomi controlla che chi c'è sia scritto giusto, ma non si accorge di chi
   MANCA. È successo davvero: tre commenti `//` scritti in coda a una riga si sono mangiati le
   voci che stavano dopo, sulla STESSA riga, e sette titolari (McTominay, De Bruyne, Thuram,
   Martinez L., Zambo Anguissa, Esposito F.P., Valeri) non entravano in XI_STATUS. Nessun
   errore e nessun avviso: venivano semplicemente valutati sui soli minuti dell'anno prima,
   e McTominay si portava dietro una nota sulla caviglia di agosto che il campo aveva smentito.
   Contare i titolari per squadra non serve — `B+` indica chi è nell'undici ma in ballottaggio,
   e squadre con pochi "T" sono normali. Il guasto sta nel testo sorgente, e lì si cerca: una
   coppia "chiave":"valore" dentro un commento di riga non è mai una cosa voluta. */
{
  const righe = fs.readFileSync(new URL(import.meta.url), "utf8").split(/\r?\n/);
  const inghiottite = [];
  righe.forEach((r, i) => {
    const c = r.indexOf("//");
    if (c >= 0 && /"[^"]+"\s*:\s*("|\[|\d)/.test(r.slice(c + 2))) inghiottite.push(i + 1);
  });
  if (inghiottite.length)
    console.warn(`⚠️ VOCI PERSE: un commento // si sta mangiando delle voci di mappa alle righe ${inghiottite.join(", ")} — spostale prima del commento.`);
}

/* ---- verifica: niente linguaggio superato in quello che il filtro doveva ripulire ----
   Il filtro `ripulisci()` vale quanto valgono i suoi pattern, e i pattern si scoprono
   mancanti solo leggendo le note una per una — cosa che nessuno fa su 396 note. È così che
   è passata la frase di Dybala "RODRIGO MORA sta arrivando dal Porto", quando Mora era già
   alla Roma e aveva giocato titolare la 1ª.
   Si controlla SOLO quello che il filtro ha attraversato: la coda "Ad agosto" e le note
   d'infermeria risolte. CAMPO_NOTE è esente per scelta e va esclusa, altrimenti la tripletta
   "all'esordio" di Malen risulterebbe un errore. */
if (GIORNATE) {
  const sospette = [];
  for (const riga of lines) {
    const m = riga.match(/,"((?:[^"\\]|\\.)*)","\d+",/);           // il campo nota della riga kb
    if (!m) continue;
    const nota = m[1];
    const coda = nota.includes("· Ad agosto:") ? nota.split("· Ad agosto:")[1] : "";
    const inf  = nota.startsWith("⚕️ ") ? nota.slice(0, nota.indexOf("🟢") + 1 || 200) : "";
    const daControllare = coda + " " + inf;
    /* le attese si confrontano con le giornate della SQUADRA del giocatore: per chi ha il
       posticipo stasera "in dubbio per la 2ª" è ancora il futuro, non il passato */
    const squadra = (riga.match(/^\["[PDCA]","(?:[^"\\]|\\.)*","((?:[^"\\]|\\.)*)"/) || [])[1] || "";
    const gSq = giornateDi(squadra) || GIORNATE;
    const atteseSq = new RegExp("(?:per la|fino alla|entro la|in tempo per la)\\s*(?:" + Array.from({length: gSq}, (_, x) => x + 1).join("|") + ")ª", "i");
    /* si riconosce la voce-calendario dal contenuto, non dalla posizione: gli indici mentono
       appena qualcuno riordina la lista (è già successo) */
    const re = SUPERATO.map(r => r.source && r.source.startsWith("(?:per la") ? atteseSq : r).find(r => r.test(daControllare));
    if (re) sospette.push(`${(riga.match(/"([^"]+)","[^"]+",\d/) || [,"?"])[1]}: ${(daControllare.match(re) || [""])[0]}`);
  }
  /* Due cause diverse, stessa azione: guardare quel giocatore. O manca un pattern al filtro,
     oppure è una voce scritta a mano che il campo ha superato e che il filtro non attraversa
     (un bollettino INJURY di chi non ha ancora preso voto non viene ripulito, perché lì il
     dubbio potrebbe essere ancora vero — va aggiornato col bollettino del giorno). */
  if (sospette.length)
    console.warn(`⚠️ NOTE DA GUARDARE: ${sospette.length} parlano di giornate già giocate → ${sospette.slice(0, 6).join(" · ")}` +
      `\n   (manca un pattern a SUPERATO, oppure quella voce di INJURY/MERCATO_NOTE va aggiornata a mano)`);
}

/* verifica: ogni nome nelle mappe deve esistere nel listone (un typo = dato perso in silenzio) */
const LNAMES = new Set(L.map(p => p.n));
for (const [label, map] of [["XI_STATUS", XI_STATUS], ["INJURY", INJURY], ["MERCATO_NOTE", MERCATO_NOTE], ["CAMPO_NOTE", CAMPO_NOTE], ["MERCATO_UNC", MERCATO_UNC], ["RIG", RIG], ["NOTE", NOTE], ["ETA", ETA]]) {
  const missing = Object.keys(map).filter(n => !n.startsWith("_") && !LNAMES.has(n));
  if (missing.length) console.warn(`⚠️ ${label}: nomi non nel listone → ${missing.join(", ")}`);
}

const out = `/* FantaHQ — database giocatori e squadre. STAGIONE 2026-27 (listone ufficiale).
   Per aggiornare il motore (dopo una giornata o il mercato) basta modificare QUESTO file:
   - date: data dell'ultimo aggiornamento (mostrata nell'app)
   - teams: rating attacco/difesa 1-5 + allenatore (profili ricavati dai dati storici dei tecnici)
   - kb: [ruolo, nome, squadra, quotaUfficiale, fantamedia, fmStimata(0/1), presenze, gol, assist,
          rigorista(2=primo,1=alternativa,0=no), titolarità%, upside0-5, rischioInfortuni0-3,
          età, incertezzaMercato0-3, nuovoAcquisto(0/1), nota, idUfficiale, FVM(fantavalore su base 1000),
          xgd(correzione FM da regressione xG, ±0.40), fm2(fantamedia 24-25 se significativa),
          e infine la STAGIONE IN CORSO: presenze, gol, assist, fantamedia, media voto 26-27]
   Nota: la nota è composta in quest'ordine — infermeria, cosa dice il campo di quest'anno,
   il fatto della giornata (CAMPO_NOTE), i segnali storici xG/volume, e in coda, dietro
   "· Ad agosto:", quel che resta delle note d'asta dopo il filtro delle frasi superate.
   Nomi allineati al listone ufficiale ("Cognome I."): l'app aggancia per NOME+RUOLO.
   FM: reale 2025-26 dove disponibile (est=0); altrimenti stimata dalla quota ufficiale via
   regressione calibrata per ruolo sui giocatori con dati reali (est=1).
   Titolarità: minuti reali 25-26 corretti con le PROBABILI FORMAZIONI 2026-27 (XI_STATUS)
   e gli infortuni attuali (INJURY) del builder. */
window.FANTAHQ_DATA = {
  date: ${JSON.stringify("31 agosto 2026 — giro pre-asta: listone del 31, fatti della 2ª giornata (8 gare su 10), bollettino infortuni e mercato in chiusura")},
  official: true,
  calendario: ${JSON.stringify(CALENDARIO)},
  teams: ${JSON.stringify(TEAMS, null, 2).replace(/\n/g, "\n  ")},
  kb: [
${lines.join(",\n")}
]
};
`;
/* verifica: il file deve essere eseguibile e contenere tutti i giocatori */
const probe = { window: {} };
new Function("window", out)(probe.window);
if (!probe.window.FANTAHQ_DATA || probe.window.FANTAHQ_DATA.kb.length !== L.length)
  throw new Error(`file generato non valido: ${probe.window.FANTAHQ_DATA?.kb?.length} righe invece di ${L.length}`);
fs.writeFileSync(`${REPO}/data/kb.js`, out);
console.log("giocatori:", L.length, "| FM reale:", matched, "| FM stimata:", estimated);
console.log("regressioni:", JSON.stringify(Object.fromEntries(Object.entries(REG).map(([k,v]) => [k, `fm=${v.a.toFixed(2)}+${v.b.toFixed(3)}*ln(q) (n=${v.n})`]))));
console.log("con dati reali Understat:", withUS, "su", L.length, "| rigoristi:", L.filter(p => RIG[p.n]).length);
