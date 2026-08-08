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
  pv:+r[5]||0, mv:+r[6]||0, fm:+r[7]||0, gf:+r[8]||0, gs:+r[9]||0,
  rp:+r[10]||0, ass:+r[14]||0, amm:+r[15]||0, esp:+r[16]||0
}]));
const ST26 = mkStat("2025-26");   // stagione appena conclusa: la fonte primaria
const ST25 = mkStat("2024-25");   // serve solo per la traiettoria (stava crescendo?)

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
  "Atalanta":["Carnesecchi","Sportiello","Rossi F."],
  "Bologna":["Skorupski","Pessina Mas.","Happonen"],
  "Cagliari":["Caprile","Sherri","Ciocci"],
  "Como":["Butez","Tornqvist","Vigorito"],
  "Fiorentina":["De Gea","Christensen O.","Lezzerini"],
  "Frosinone":["Palmisani","Desplanches","Lolic"],
  "Genoa":["Bijlow","Stolz","Sommariva"],
  "Inter":["Martinez Jo.","Provedel","Di Gennaro"],
  "Juventus":["Di Gregorio","Perin","Pinsoglio"],
  "Lazio":["Mandas","Motta","Renzetti"],
  "Lecce":["Falcone","Fruchtl","Samooja"],
  "Milan":["Maignan","Terracciano","Torriani"],
  "Monza":["Thiam","Pizzignacco","Strajnar"],
  "Napoli":["Meret","Milinkovic-Savic V.","Contini"],
  "Parma":["Corvi","Daffara","Suzuki"],   // Suzuki in chiusura al PSG: Corvi titolare in amichevole
  "Roma":["Svilar","Gollini","De Marzi"],
  "Sassuolo":["Muric","Turati","Russo A."],
  "Torino":["Paleari","Mascardi","Siviero"],   // il vero titolare sarà Perri (dal Leeds), non nel listone
  "Udinese":["Okoye","Padelli","Piana"],
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
  "Pulisic":1, "Ramos G.":1, "Nkunku":1,                                // Milan: aperta (Ramos primo per 1 fonte, Pulisic per 2)
  "Malen":2, "Dybala":1, "Soulè":1, "Castro S.":1,                      // Roma: Malen ha scavalcato Dybala
  "Scamacca":2, "De Ketelaere":1, "Samardzic":1,                        // Atalanta
  "Orsolini":2, "Dovbyk":1, "Bernardeschi":1,                           // Bologna: Dovbyk insidia (27/32 in carriera)
  "Da Cunha":2, "Paz N.":1, "Douvikas":1, "Baturina":1,                 // Como
  "Gudmundsson A.":2, "Kean":1, "Mandragora":1,                         // Fiorentina: ballottaggio col Kean
  "Zaccagni":2, "Cataldi":1, "Taylor K.":1,                             // Lazio: unanime
  "De Bruyne":2, "Hojlund":1,                                           // Napoli: designato dopo l'addio di Lukaku
  "Bernabè":2, "Pellegrino M.":1, "Valeri":1,                           // Parma: Bernabè designato + punizioni e corner
  "Berardi":2, "Pinamonti":1, "Laurientè":1,                            // Sassuolo: unanime
  "Vlasic":2, "Kulenovic":1, "Zapata D.":1, "Simeone":1,                // Torino: unanime
  "Davis K.":2, "Solet":1, "Zaniolo":1, "Ekkelenkamp":1,                // Udinese: unanime
  "Colombo":2, "Messias":1, "Vitinha O.":1,                             // Genoa
  "Mina":2, "Borrelli":1, "Fazzini":1,                                  // Cagliari: Esposito ceduto → Mina primo
  "Pessina":2, "Cutrone":1, "Petagna":1,                                // Monza: Pessina 16/17 in carriera
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
  "Nkunku":"Tra i rigoristi del Milan (17/20 in carriera dal dischetto): se conquista spazio con Amorim, i bonus arrivano.",
  "Akanji":"Dal Manchester City all'Inter: difesa più solida del campionato, clean sheet probabili.",
  "Stones":"Dal Manchester City all'Inter a parametro zero: qualità assoluta, da valutare la tenuta fisica.",
  "Camarda":"Passato al Milan: talento 19enne, ma davanti ha Ramos e Nkunku — titolarità da conquistare.",
  "Da Cunha":"Ha scavalcato Paz come primo rigorista del Como: i rigori valgono 1-2 fasce.",
  "Kean":"Rigorista alternativo dietro Gudmundsson, ma resta bomber da doppia cifra.",
  "Gudmundsson A.":"Ora CENTROCAMPISTA e primo rigorista della Fiorentina: combinazione d'oro per il fantacalcio.",
  "Zaccagni":"Primo rigorista della Lazio, capitano: bonus garantiti dal dischetto.",
  "Scamacca":"Primo rigorista dell'Atalanta di Sarri; 4° per FM 25-26 ma storia clinica pesante.",
  "Krstovic":"npxG/90 0.63: generatore di occasioni efficiente.",
  "Leao":"Quota crollata (18): il mercato lo dà in uscita, ma se resta a questo prezzo è un affare. Verifica prima dell'asta.",
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
  "Leao":"Il Milan ha RIFIUTATO il Galatasaray (30M+5, ne chiede 50) e il Fenerbahçe non è arrivato a 40: il giocatore non ha mai aperto alla Turchia. Al 6 agosto RESTA. Recuperato fisicamente, ma nel derby è partito dalla panchina. A quota 18 il rapporto qualità/prezzo è tra i migliori del listone.",
  "Kolo Muani":"⚠️ Stagione 25-26 pessima: 1 gol in 30 presenze al Tottenham (xG 2.69). Alla Juve da prima punta di Spalletti, in A aveva fatto bene, ma a quota 26 il rischio è tutto tuo.",
  "Nkunku":"Titolare nelle probabili sulla trequarti, MA il Milan lo ha messo sul mercato (~40M) dopo un 25-26 fuori dai meccanismi: futuro incerto, verifica prima dell'asta.",
  "Di Gregorio":"⚠️ Situazione a due facce: gioca lui le amichevoli (titolare in Juve-Chelsea del 5 ago) e una fonte lo dà confermato, ma il mercato racconta altro — la Juve punta Suzuki in prestito dal PSG, con Vicario e Atubolu come alternative. Se arriva il nuovo, lui parte.",
  "Suzuki":"⚠️ Il PSG è vicino alla chiusura col Parma (~33-35M) per poi girarlo in PRESTITO ALLA JUVENTUS: da vice-Corvi a possibile titolare bianconero. Alla quota di 7 è la scommessa più interessante tra i portieri, ma finché non è ufficiale resta un salto nel buio.",
  "Corvi":"Con Suzuki in partenza verso il PSG è il candidato titolare del Parma: titolare nell'amichevole con l'Arezzo. A quota 1 è il tipo di scommessa che costa nulla.",
  "Esposito Se.":"Ceduto dal Cagliari (al suo posto arriva Maldini): non sarà in Serie A, non prenderlo.",
  "Maldini":"⚠️ Accordo totale col CAGLIARI (prestito 1M + riscatto a 8): lascia l'Atalanta dove non giocava. Al Cagliari da titolare vale molto più della quota 5, ma finché non è ufficiale il rischio è tuo.",
  "Paleari":"⚠️ Il Torino ha chiuso per Lucas PERRI dal Leeds (prestito con riscatto a 11M, visite entro l'8 agosto): sarà lui il titolare. Nessun portiere del Torino presente nel listone è più da prendere.",
  "Angelino":"❌ CEDUTO al Deportivo La Coruña: non è più in Serie A. Non prenderlo.",
  "Vogliacco":"❌ CEDUTO alla Cremonese in Serie B: non è più in Serie A. Non prenderlo.",
  "Milinkovic-Savic V.":"Allegri ha scelto Meret come titolare fisso: lui è in uscita (accostato all'Hull City). Da evitare.",
  "Meret":"✅ Allegri ha sciolto il ballottaggio: titolare fisso, niente alternanza. Titolare in entrambe le amichevoli. Con la difesa del Napoli vale più della quota 11.",
  "Pinamonti":"⚠️ Cedibile dopo l'arrivo di Bowie: il Sassuolo ha già rifiutato un'offerta dalla Premier ma la richiesta è alta. Se resta è il titolare, se parte tocca a Bowie.",
  "Lukaku":"⚠️ Rapporto col Napoli in deterioramento: ingaggio da 11M giudicato eccessivo per una riserva, rientro agli allenamenti rinviato. Dietro Hojlund nelle gerarchie.",
  "Alajbegovic":"9 gol e 3 assist in prestito a Salisburgo: talento in forte ascesa che insidia Conceicao. Scommessa da ultima fascia interessante.",
  "Ratkov":"Capocannoniere del Salisburgo (9 gol in 17) prima del passaggio alla Lazio a gennaio: ha scavalcato Dia nelle gerarchie da punta.",
  "Dia":"Scavalcato da Ratkov come punta nelle probabili: quota da riserva.",
  "Stones":"Solo 439 minuti al City nel 25-26: qualità enorme ma condizione tutta da verificare; ruota con Bisseck.",
  "Dragusin":"Titolare nelle probabili della Fiorentina, ma nel 25-26 ha giocato appena 515' al Tottenham rientrando dal crociato: condizione da monitorare.",
  "Camarda":"💎 TITOLARE nel derby amichevole di Perth con Ramos in panchina, dopo la doppietta in 7' col Celtic: Amorim gli dà fiducia per l'avvio. A quota bassa è la scommessa migliore del Milan.",
  "Krstovic":"⚠️ Sarri punta su Scamacca: nelle probabili parte dietro. A quota 18 il rischio panchina è concreto.",
  "Bijlow":"Titolare designato del Genoa ma stagione 25-26 rovinata dagli infortuni al Feyenoord (4 presenze): affidabilità fisica da verificare.",
  "Wesley":"⚠️ Molina UFFICIALE alla Roma (13M+4): concorrenza diretta sulla fascia destra. FVM altissimo (90) ma la titolarità non è più scontata: non strapagarlo.",
  "Rensch":"Con Molina ufficiale alla Roma scivola a terza scelta sulla destra: solo da ultimo slot.",
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
  "Bowie":"Arrivato dal Verona per ~10M: se il Sassuolo cede Pinamonti diventa il titolare, altrimenti resta alternativa.",
  /* --- audit giocatore per giocatore, 7 agosto --- */
  "Djimsiti":"❌ Ha chiesto la cessione: Al-Diriyah (Arabia) in chiusura, non convocato per l'amichevole del 7 agosto. Non prenderlo.",
  "Vigorito":"❌ Svincolato: ha lasciato il Como. Non è più in Serie A.",
  "Maldini":"❌ Passato al Cagliari (prestito 1M + riscatto 8M): non convocato dall'Atalanta il 7 agosto. Lì sarebbe titolare, ma nel listone risulta ancora all'Atalanta.",
  "De Roon":"⚠️ 35 anni e scavalcato da Gaetano in regia nelle probabili di Sarri: non è più il titolare inamovibile di un tempo.",
  "Gaetano":"Regista titolare nelle probabili di Sarri (in adattamento nel ruolo), davanti a De Roon: a quota 7 vale la scommessa.",
  "Samardzic":"💎 Ha superato Pasalic come mezzala titolare nelle probabili, ed è il terzo rigorista con le punizioni: quota 12 per un titolare dell'Atalanta.",
  "Bernasconi":"20 anni, terzino sinistro titolare nelle probabili davanti ad Ahanor: quota 6 per un posto da titolare.",
  "Lucumì":"⚠️ Titolare del Bologna ma la Juventus insiste (offerti Miretti e Cabal per abbassare i 25M): se parte, sale Vitik.",
  "Obert":"Titolare a sinistra nel nuovo 4-4-2 di Pisacane: promosso rispetto ai ballottaggi di luglio.",
  "Fazzini":"💎 Titolare nel 4-4-2 del Cagliari ed è il secondo rigorista con le punizioni: a quota 7 è tra le occasioni migliori.",
  "Winks":"Nuovo regista titolare del Cagliari e incaricato dei calci da fermo: 30 anni, affidabile.",
  "Ramon":"Centrale titolare fisso del Como a 21 anni: l'arrivo di Chalobah non lo ha scalzato, gli è costato il posto Smolcic.",
  "Baturina":"💎 Promosso titolare sulla trequarti del Como e secondo rigorista: quota 19 ma con un ruolo da protagonista.",
  "Perrone":"Titolare in mediana nel Como di Fabregas, insidiato da Caqueret e Milla ma davanti a entrambi.",
  "Paz N.":"✅ RESTA al Como: accordo col Real Madrid del 29 giugno, la recompra slitta al 2027-28. Batte le punizioni.",
  "Morata":"Riscattato dal Milan: resta al Como come alternativa a Douvikas, non come titolare.",
  "Bartesaghi":"Promosso titolare come quinto di sinistra nel 3-4-2-1 di Amorim: 20 anni, quota 8 per un posto da titolare del Milan.",
  "Gabbia":"Titolare nel terzetto Gila-Gabbia-Pavlovic secondo le probabili di agosto.",
  "Modric":"40 anni: ancora in ballottaggio con Jashari per la mediana, il minutaggio andrà gestito.",
  "Gimenez":"⚠️ In uscita dal Milan (Porto in pressing, il club chiede 25-30M): al 7 agosto è ancora rossonero ma il rischio è alto.",
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
  "Petagna":"Alternativa a Cutrone ma terzo rigorista del Monza: a quota 2 vale come ultimo slot.",
  "Mitaj":"Elogiato da De Rossi e favorito su Martin sulla corsia sinistra del Genoa.",
  "Traorè Hj.":"⚠️ Ancora in riabilitazione dal lungo infortunio rimediato al Marsiglia: non disponibile prima di fine agosto/settembre.",
  "Akpoguma":"Svincolato con esperienza in Bundesliga, inserito tra i titolari nelle formazioni tipo del Frosinone.",
  "Ghedjemis":"⚠️ Titolare del Frosinone ma il Monaco ha già offerto 7M+2 (rifiutati) e prepara il rilancio: rischio concreto di cessione.",
  "Valdepenas":"Con Parisi fuori per il crociato è il terzino sinistro favorito della Fiorentina: quota 6 per un titolare.",
  "Fagioli":"Regista favorito della Fiorentina su Oulai e Mandragora, ed è il battitore d'angoli."
};
/* Trattative ancora APERTE: 2 = futuro in bilico (il motore lo classifica "da monitorare"),
   3 = praticamente in uscita. Da azzerare quando il mercato si chiude. */
const MERCATO_UNC = {
  "Frattesi":2,      // scambio con Nico Gonzalez solo "allo studio": non fatto
  "Leao":2,          // Milan ha rifiutato il Galatasaray, ma il mercato resta aperto
  "Fruchtl":3,       // in chiusura al Salisburgo
  "Di Gregorio":2,   // gioca lui le amichevoli, ma la Juve tratta Suzuki
  "Nkunku":2,        // il Milan ascolta offerte (chiede 35-40M)
  "Suzuki":3,        // PSG vicino alla chiusura, poi prestito alla Juventus
  "Esposito Se.":3,  // ceduto dal Cagliari
  "Angelino":3,      // CEDUTO al Deportivo: fuori dalla Serie A
  "Vogliacco":3,     // CEDUTO alla Cremonese: fuori dalla Serie A
  "Milinkovic-Savic V.":2, // in uscita dal Napoli (accostato all'Hull City)
  "Pinamonti":2,     // cedibile dopo l'arrivo di Bowie
  "Lukaku":2,        // rapporto col Napoli in deterioramento
  "Maldini":3,       // al Cagliari: non gioca più nell'Atalanta
  "Djimsiti":3,      // ha chiesto la cessione, Al-Diriyah in chiusura
  "Vigorito":3,      // svincolato dal Como
  "Lucumì":2,        // la Juventus insiste (offerti Miretti e Cabal)
  "Romagnoli":2,     // trattativa Al-Sadd congelata ma non chiusa
  "Cancellieri":2,   // sul mercato (Torino, Parma, Fiorentina)
  "Gimenez":2,       // il Milan chiede 25-30M, Porto in pressing
  "Zalewski":2,      // fuori dalle probabili, possibile prestito
  "Koopmeiners":2,   // dichiarato cedibile dalla Juventus
  "David":2,         // dichiarato cedibile dalla Juventus
  "Zhegrova":2,      // dichiarato cedibile dalla Juventus
  "Douglas Luiz":2,  // rientrato dal prestito, in uscita
  /* --- audit 7 agosto, tutte e 20 le squadre --- */
  "Masini":3,        // CEDUTO al Frosinone (era nel listone come Genoa)
  "Piccoli":3,       // cessione al Bologna in chiusura
  "Bjarkason":3,     // ceduto al Sudtirol
  "Parisi":3,        // crociato: fuori fino a fine 2026
  "Konè I.":3,       // grave infortunio al Mondiale: mezza stagione
  "Laurientè":2,     // in uscita, il Sassuolo chiede 25M (Fenerbahce, Besiktas, Premier)
  "Ghedjemis":2,     // il Monaco ha offerto 7M+2, rilancio atteso
  "Koutsoupias":2,   // obiettivo del Torino
  "Fabbian":2,       // in uscita, Lazio in pressing
  "Folorunsho":2,    // in uscita: Bologna, Monza, Torino
  "Lang":2,          // esubero del Napoli
  "Lucca":2,         // esubero del Napoli
  "Mazzocchi":2,     // messo sul mercato dal Napoli
  "Zambo Anguissa":2,// rinnovo in stallo, possibile cessione
  "Adams C.":2,      // indiziato numero uno alla cessione al Torino
  "Ilic":2,          // fuori dal progetto, cessione prioritaria
  "Aboukhlal":2,     // fuori dal progetto
  "Anjorin":2,       // sulla lista dei cedibili
  "Ilkhan":2,        // niente rinnovo, ritorno in Turchia possibile
  "Biraghi":2,       // ai margini, possibile cessione
  "Pavard":2,        // fuori dal progetto Inter
  "Gollini":2,       // trattativa con la Cremonese
  "Pongracic":2,     // cedibile davanti a offerte importanti
  "Thorstvedt":2     // possibile partenza, nessuna trattativa avanzata
};

/* ================= XI PROBABILI 2026-27 (ricerca 5 agosto: fantamaster/sosfanta/
   pazzidifanta/lottomatica + amichevoli). T = titolare · B+ = ballottaggio favorito ·
   B- = ballottaggio sfavorito · R = riserva chiara. Applicata DOPO il calcolo della
   titolarità dai minuti: le gerarchie nuove contano più della stagione scorsa. */
const XI_STATUS = {
  /* Atalanta (4-3-3 Sarri) */
  "Carnesecchi":"T","Rossi F.":"R","Sportiello":"R","Scalvini":"T","Hien":"T","Zappacosta":"T",
  "Djimsiti":"R","Ahanor":"B-","Bellanova":"B-","Bernasconi":"B+","Kolasinac":"B-","Kossounou":"B-",
  "Ederson D.S.":"T","Samardzic":"B+","Pasalic":"B-","Gaetano":"B+","Zalewski":"R","De Roon":"B-",
  "Sulemana I.":"R","Scamacca":"B+","Krstovic":"B-","De Ketelaere":"T","Raspadori":"T",
  "Sulemana K.":"R","Maldini":"R",
  /* Bologna (4-3-3 Tedesco) */
  "Skorupski":"T","Happonen":"R","Pessina Mas.":"R","Lucumì":"T","Miranda J.":"T","Heggem":"T",
  "Zortea":"B+","Vitik":"B-","Holm":"B-","Casale":"R","Helland":"R","Alhassane":"R",
  "De Silvestri":"R","Orsolini":"T","Rowe":"T","Bernardeschi":"B-","Odgaard":"B+","Cambiaghi":"R",
  "Ferguson":"T","Pobega":"B+","Amondarain":"R","Moro N.":"B+","Dominguez B.":"R",
  "El Azzouzi O.":"R","Dovbyk":"T","Dallinga":"R",
  /* Cagliari (4-4-2 Pisacane) */
  "Caprile":"T","Ciocci":"R","Sherri":"R","Mina":"T","Obert":"T","Kofler":"B-","Zè Pedro":"B+",
  "Zappa":"B-","Rodriguez Ju.":"B+","Idrissi R.":"B-","Raterink":"R","Fazzini":"T","Adopo":"T",
  "Winks":"T","Romano":"B+","Felici":"B-","Prati":"B-","Deiola":"B-","Liteta":"R",
  "Esposito Se.":"R","Mutandwa":"B+","Borrelli":"B-","Mendy P.":"T","Albarracin":"R","Trepy":"R",
  /* Como (4-2-3-1 Fabregas) */
  "Butez":"T","Tornqvist":"R","Vigorito":"R","Ramon":"T","Kaiki":"B-","Valle":"B+","Kempf":"B+",
  "Smolcic I.":"R","Van Der Brempt":"B-","Goldaniga":"R","Cuenca A.":"R","Paz N.":"T",
  "Baturina":"T","Da Cunha":"T","Rodriguez Je.":"B+","Perrone":"T","Caqueret":"B-","Liberali":"R",
  "Milla":"B-","Addai":"B-","Fadera":"R","Lahdo":"R","Douvikas":"T","Diao":"B+","Morata":"B-",
  "Kuhn":"R","Azon":"R",
  /* Fiorentina (4-3-2-1 Grosso) */
  "De Gea":"T","Christensen O.":"R","Lezzerini":"R","Dodò":"B+","Dragusin":"T","Jimenez A.":"B+",
  "Valdepenas":"B+","Viery":"B+","Parisi":"R","Pongracic":"B-","Ranieri L.":"B-","Joao Mario":"B-",
  "Atta":"T","Gudmundsson A.":"T","Mandragora":"B-","Fagioli":"B+","Ndour":"B+","Oulai":"B+",
  "Fabbian":"R","Brescianini":"R","Kean":"T","Piccoli":"B-",
  /* Frosinone (4-2-3-1 Alvini) */
  "Palmisani":"B+","Desplanches":"B-","Lolic":"R","Monterisi":"T","Bracaglia":"T","Oyono A.":"T",
  "Calvani":"B+","Akpoguma":"B+","Cittadini":"B-","Amey":"R","Gelli J.":"R","Oyono J.":"R",
  "Corrado":"R","Calò":"T","Zerbin":"B-","Cichella":"B-","Koutsoupias":"B+","Gelli F.":"B+",
  "Hasa":"B+","El Azzouzi A.":"B+","Kone B.":"R","Ghedjemis":"T","Raimondo":"T","Kvernadze":"B+",
  /* Genoa (3-4-2-1 De Rossi) */
  "Bijlow":"T","Sommariva":"R","Stolz":"R","Ostigard":"T","Vasquez":"T","Norton-Cuffy":"T",
  "Marcandalli":"T","Martin":"B-","Mitaj":"B+","Otoa":"B-","Puczka":"R","Sabelli":"B-",
  "Vogliacco":"R","Matturro":"R","Baldanzi":"B+","Frendrup":"T","Ellertsson":"B-","Meichtry":"B-",
  "Traorè Hj.":"B-","Amorim":"B-","Messias":"R","Masini":"R","Venturino":"R","Colombo":"T",
  "Vitinha O.":"B+","Havel":"B-",
  /* Inter (3-5-2 Chivu) */
  "Martinez Jo.":"T","Provedel":"R","Di Gennaro":"R","Dimarco":"T","Akanji":"T","Bastoni":"T",
  "Stones":"B+","Bisseck":"B-","Carlos Augusto":"B-","Pavard":"R","Calhanoglu":"T","Barella":"T",
  "Zielinski":"B+","Diouf":"B+","Sucic P.":"B-","Frattesi":"R","Mkhitaryan":"B-",
  "Luis Henrique":"B+","Stankovic A.":"R","Martinez L.":"T","Thuram":"T","Esposito F.P.":"B-",
  "Bonny":"B-",
  /* Juventus (4-2-3-1 Spalletti) */
  "Di Gregorio":"B+","Perin":"R","Pinsoglio":"R","Bremer":"T","Kalulu":"T","Cambiaso":"T",
  "Celik":"B+","Kelly L.":"B+","Gatti":"B-","Rugani":"R","Cabal":"R","McKennie":"B+",
  "Alajbegovic":"B+","Conceicao":"B+","Thuram K.":"B+","Locatelli":"T","Zhegrova":"R",
  "Koopmeiners":"R","Douglas Luiz":"R","Miretti":"R","Kolo Muani":"T","Yildiz":"T","David":"R",
  "Boga":"R","Ekhator":"R",
  /* Lazio (4-3-3 Gattuso) */
  "Mandas":"B+","Motta":"B-","Renzetti":"R","Doekhi":"T","Romagnoli":"B-","Tavares N.":"B+",
  "Marusic":"B+","Pedraza":"B-","Provstgaard":"T","Floriani Mussolini":"R","Lazzari":"B-",
  "Pellegrini Lu.":"R","Patric":"B-","Zaccagni":"T","Taylor K.":"T","Cancellieri":"B-",
  "Isaksen":"B+","Rovella":"T","Dele-Bashiru":"T","Cataldi":"B-","Belahyane":"B-",
  "Przyborek":"R","Dia":"B-","Ratkov":"T","Noslin":"B-",
  /* Lecce (4-3-3 Di Francesco) */
  "Falcone":"T","Fruchtl":"R","Samooja":"R","Tiago Gabriel":"T","Gallo":"T","Gaspar K.":"B+",
  "Veiga D.":"T","Siebert":"B-","Jean":"R","Perez M.":"R","Ndaba":"R","Coulibaly L.":"T",
  "Pierotti":"T","Berisha M.":"B+","Gandelman":"T","Ngom":"B+","Maleh":"R","Gorter":"R",
  "Kaba":"R","Fofana Sa.":"R","Geubbels":"T","Stulic":"B-","N'Dri":"T",
  /* Milan (3-4-2-1 Amorim) */
  "Maignan":"T","Terracciano":"R","Torriani":"R","Pavlovic":"T","Gila":"T","Bartesaghi":"T",
  "Gabbia":"T","Tomori":"B-","De Winter":"B-","Athekame":"R","Estupinan":"B-","Diawara S.":"R",
  "Pulisic":"T","Rabiot":"T","Modric":"B+","Saelemaekers":"T","Chukwueze":"R","Fofana Y.":"B-",
  "Ricci S.":"R","Jashari":"B-","Loftus-Cheek":"R","Musah":"R",
  /* fonti discordi sulla punta: nel derby di Perth ha giocato Camarda, ma Ramos è il colpo da 70M */
  "Ramos G.":"B+","Leao":"B+","Nkunku":"B+","Gimenez":"R","Camarda":"B+",
  /* Monza (3-4-2-1 Juric) */
  "Thiam":"T","Pizzignacco":"R","Strajnar":"R","Mangas":"T","Delli Carri":"B+","Lucchesi":"B+",
  "Birindelli":"T","Kouadio":"B+","Carboni A.":"B+","Antov":"R","Bakoune":"R","Colpani":"T",
  "Pessina":"T","Akinsanmiro":"B+","Colombo L.":"B-","Ciurria":"B-","Cutrone":"T","Mota":"B+",
  "Varela G.":"B-","Petagna":"B-",
  /* Napoli (4-3-3 Allegri) */
  "Meret":"T","Milinkovic-Savic V.":"B-","Contini":"R","Rrahmani":"T","Di Lorenzo":"T",
  "Spinazzola":"T","Buongiorno":"R","Beukema":"T","Olivera":"B-","Marin R.":"B-",
  "Marianucci":"B-","Mazzocchi":"R","McTominay":"T","De Bruyne":"T","Zambo Anguissa":"B-",
  "Politano":"T","Vergara":"B-","Lobotka":"T","Folorunsho":"R","Gilmour":"B-","Hojlund":"T",
  "Santos A.":"T","Lukaku":"R","Neres":"R","Giovane":"B-","Lang":"R","Lucca":"R",
  /* Parma (3-5-2 Cuesta) */
  "Daffara":"B-","Suzuki":"R","Corvi":"B+","Delprato":"T","Valeri":"T","Circati":"T",
  "Valenti":"B-","Troilo":"T","Britschgi":"B-","Ndiaye":"B-","Carboni F.":"R","Bernabè":"T",
  "Nicolussi Caviglia":"B+","Keita M.":"T","Ondrejka":"B+","Almqvist":"B-","Sorensen O.":"B-",
  "Diallo O.":"R","Ordonez C.":"B-","Cremaschi":"R","Pellegrino M.":"T","Frigan":"B-",
  "Elphege":"B-",
  /* Roma (3-4-2-1 Gasperini) */
  "Svilar":"T","De Marzi":"R","Gollini":"R","Wesley":"T","Mancini":"T","N'Dicka":"T",
  "Hermoso":"B-","Koulierakis":"T","Rensch":"B-","Ghilardi":"B-","Angelino":"R",
  "Ziolkowski":"R","Konè M.":"T","Cristante":"T","Pisilli":"B-","El Aynaoui":"B-","Malen":"T",
  "Dybala":"T","Castro S.":"B-","Soulè":"T","Vaz":"R",
  /* Sassuolo (4-3-3 Aquilani) */
  "Muric":"T","Russo A.":"R","Turati":"B-","Idzes":"T","Walukiewicz":"T","Doig":"T",
  "Candè":"B-","Missori":"B+","Pieragnolo":"B-","Thorstvedt":"T","Konè I.":"R","Volpato":"R",
  "Matic":"T","Adzic":"B-","Bakola":"R","Boloca":"B-","Lipani":"T","Iannoni":"R","Berardi":"T",
  "Laurientè":"T","Pinamonti":"B+","Bowie":"B-","Moro L.":"R",
  /* Torino (3-4-2-1 Abate) — il titolare in porta sarà Perri, non presente nel listone */
  "Mascardi":"R","Paleari":"R","Siviero":"R","Coco":"T","Ismajli":"T","Comuzzo":"T",
  "Pedersen":"T","Comert":"B-","Biraghi":"R","Vlasic":"T","Casadei":"T","Oristanio":"T",
  "Cacciamani":"T","Gineitis":"B-","Fitz-Jim":"B+","Ilkhan":"R","Njie":"R","Aboukhlal":"R",
  "Ilic":"R","Anjorin":"R","Simeone":"T","Adams C.":"B-","Zapata D.":"B-","Kulenovic":"B-",
  /* Udinese (3-4-2-1 Runjaic) */
  "Okoye":"T","Padelli":"R","Piana":"R","Solet":"T","Vojvoda":"T","Kristensen T.":"T",
  "Kamara H.":"T","Kabasele":"T","Bertola":"B-","Zanoli":"B-","Arizala":"R","Palma":"R",
  "Ebosse":"R","Mlacic":"R","Abankwah":"R","Zaniolo":"T","Ekkelenkamp":"T","Unai Gomez":"B-",
  "Karlstrom":"T","Piotrowski":"B+","Miller L.":"B+","Chakvetadze":"R","Camara A.":"R",
  "Zarraga":"R","Davis K.":"T","Gueye":"B+","Bayo V.":"B-",
  /* Venezia (3-5-2 Stroppa) */
  "Stankovic F.":"T","Grandi":"R","Pozzi":"R","Bella-Kotchap":"T","Moreno M.":"T","Haps":"T",
  "Halhal":"B-","Correia T.":"B-","Schingtienne":"T","Sverko":"R","Hainaut":"B+","Franjic":"R",
  "Sagrado":"R","Gomes":"R","Basic":"T","Busio":"T","Sohm":"B+","Perez K.":"B-","Helgason":"R",
  "Duncan":"R","Bjarkason":"R","Dagasso":"B-","Adams A.":"T","Yeboah J.":"B+",
  "Rrahmani Al.":"B-","Adorante":"R","Lisman":"R","Lauberbach":"R"
};
const XI_ADJ = {
  "T":  t => Math.max(t, 88),
  "B+": t => Math.min(Math.max(t, 74), 84),
  "B-": t => Math.min(t, 60),
  "R":  t => Math.min(t, 42)
};

/* ================= INFORTUNATI (ricerca 5 agosto: fantacalcio.it/sosfanta/sky) =================
   [giornate saltate stimate, nota]. 4+ giornate → inj=3; 2-3 → inj>=2; 0-1 → solo nota. */
const INJURY = {
  "Parisi":[10,"❌ Rottura del crociato (maggio 2026), operato a Villa Stuart: rientro atteso a fine 2026. Non prenderlo."],
  "Konè I.":[14,"❌ Grave infortunio al Mondiale: fuori circa mezza stagione. Non prenderlo."],
  "Adorante":[6,"Operato alla schiena: rientro non prima di settembre/ottobre."],
  "Traorè Hj.":[3,"Ancora in riabilitazione dal lungo infortunio del Marsiglia: non disponibile prima di fine agosto/settembre."],
  "Chakvetadze":[2,"Infortunato, in attesa del via libera per il rientro."],
  "Sverko":[8,"Operato all'anca: rientro a fine ottobre."],
  "Buongiorno":[8,"⚠️ Operato al menisco il 21 luglio: le fonti divergono molto (ottobre / metà novembre / dicembre). A Castel di Sangro nessuna accelerazione: rischio alto di perdere mezzo girone."],
  "Idrissi R.":[7,"Rottura del crociato: rientro tra settembre e fine ottobre."],
  "Hien":[5,"Operato al tendine della coscia: rientro a inizio ottobre."],
  "Zanoli":[5,"Lesione del crociato: rientro a ottobre, in dubbio fino alla 5ª."],
  "Neres":[4,"⚠️ Peggiorato: non ha ancora toccato il pallone e non si è mai allenato in gruppo. Rientro definito 'ancora lontano', tempi non fissati."],
  "Candè":[4,"Rottura del crociato: rientro tra metà settembre e ottobre."],
  "Nicolussi Caviglia":[3,"Lesione di medio grado alla coscia (25 luglio): rientro tra inizio e fine settembre."],
  "Thuram K.":[3,"⚠️ Sindrome femoro-rotulea non risolta: si è presentato col tutore al ginocchio ed è più indietro degli altri acciaccati. Tempi non definiti."],
  "Holm":[2,"Lesione al soleo: programma di 3-4 settimane, in dubbio fino alla 3ª."],
  "Pulisic":[2,"Microfrattura al perone con edema osseo: filtra pessimismo per la 1ª, rientro tra fine agosto e inizio settembre."],
  "Gimenez":[2,"Distorsione di 2° grado alla caviglia (~8 settimane): senza precampionato, in campo verosimilmente da settembre."],
  "Beukema":[2,"Riacutizzazione della tendinopatia achillea: punta alla 2ª giornata, la 1ª è a forte rischio."],
  "Berardi":[1,"Sovraccarico alla caviglia, in riatletizzazione: atteso comunque a disposizione per la 1ª."],
  "Ekhator":[1,"Lesione al bicipite femorale: da valutare per la 1ª giornata."],
  "Isaksen":[1,"Operato di pubalgia a inizio luglio: rientro in gruppo dal 10 agosto, in campo tra fine agosto e settembre."],
  "Cataldi":[1,"Operato di pubalgia: rientro in gruppo dal 10 agosto, in campo tra fine agosto e settembre."],
  "Walukiewicz":[0,"Acciaccato: in dubbio per la 1ª giornata."],
  "Tavares N.":[0,"Infiammazione al ginocchio superata: rientro in gruppo a breve."],
  "Pellegrini Lu.":[0,"Problema alla caviglia: recupero in corso, dubbio per la 1ª."],
  "McTominay":[0,"Fastidio alla caviglia in allenamento (4 agosto), out precauzionale in amichevole: recupero pressoché completo, atteso per la 1ª."],
  "Bisseck":[0,"Forte contusione alla testa nel derby amichevole: escluso il peggio, nessuno stop previsto."],
  "Gila":[0,"Risentimento al retto femorale senza lesioni: rientrato in anticipo dall'Australia, in gruppo dalla prossima settimana e disponibile per la 1ª."],
  "Messias":[0,"Recuperato dal problema all'adduttore: a disposizione di De Rossi."],
  "Malen":[0,"L'assenza era per un attacco influenzale: tornato in gruppo, nessun allarme per la 1ª."]
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

/* ---- costruzione ---- */
const esc = s => String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"');
const ROLE_TITLE = { P:"PORTIERI", D:"DIFENSORI", C:"CENTROCAMPISTI", A:"ATTACCANTI" };
let matched = 0, estimated = 0, withUS = 0;
const lines = [];
for (const role of ["P","D","C","A"]) {
  let first = true;
  for (const p of L.filter(x => x.r === role).sort((a,b) => b.q - a.q)) {
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
    let inj  = o ? o.inj : 0;
    let injNote = "";
    if (INJURY[p.n]) {
      const [gior, txt] = INJURY[p.n];
      if (gior >= 4) inj = 3; else if (gior >= 2) inj = Math.max(inj, 2);
      injNote = `⚕️ ${txt}`;
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
    const baseNote = MERCATO_NOTE[p.n] || NOTE[p.n] || (o ? o.note : "");   // il mercato ha la precedenza
    const note = [injNote, baseNote, signal].filter(Boolean).join(" ");
    /* fm2 = fantamedia della stagione PRECEDENTE (24-25), solo se significativa in
       entrambe le annate: il motore la fonde 65/35 con l'ultima (misurato su 140
       giocatori: errore di previsione -9% rispetto alla sola ultima stagione).
       Un'annata anomala — in su o in giù — così non domina più la proiezione. */
    const st25p = ST25.get(p.id);
    const fm2 = (hasReal && st25p && st25p.pv >= 15 && st.pv >= 15) ? st25p.fm : 0;
    const row = `["${p.r}","${esc(p.n)}","${esc(p.t)}",${p.q},${fm.toFixed(2)},${est},${pres},${gol},${ass},${rig},${tit},${up},${inj},${age},${unc},${newT},"${esc(note)}","${p.id}",${p.fvm||0},${xgd},${fm2}]`;
    lines.push(first ? `\n/* ===== ${ROLE_TITLE[role]} ===== */\n${row}` : row);
    first = false;
  }
}

/* verifica: ogni nome nelle mappe deve esistere nel listone (un typo = dato perso in silenzio) */
const LNAMES = new Set(L.map(p => p.n));
for (const [label, map] of [["XI_STATUS", XI_STATUS], ["INJURY", INJURY], ["MERCATO_NOTE", MERCATO_NOTE], ["MERCATO_UNC", MERCATO_UNC], ["RIG", RIG], ["NOTE", NOTE], ["ETA", ETA]]) {
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
          xgd(correzione FM da regressione xG, ±0.40), fm2(fantamedia 24-25 se significativa)]
   Nomi allineati al listone ufficiale ("Cognome I."): l'app aggancia per NOME+RUOLO.
   FM: reale 2025-26 dove disponibile (est=0); altrimenti stimata dalla quota ufficiale via
   regressione calibrata per ruolo sui giocatori con dati reali (est=1).
   Titolarità: minuti reali 25-26 corretti con le PROBABILI FORMAZIONI 2026-27 (XI_STATUS)
   e gli infortuni attuali (INJURY) del builder. */
window.FANTAHQ_DATA = {
  date: ${JSON.stringify("7 agosto 2026 — audit giocatore per giocatore di tutte e 20 le squadre")},
  official: true,
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
