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
  "De Bruyne":1, "Hojlund":1,                                           // Napoli: aperta (De Bruyne per 2 fonti)
  "Pellegrino M.":2, "Bernabè":1, "Valeri":1,                           // Parma: unanime
  "Berardi":2, "Pinamonti":1, "Laurientè":1,                            // Sassuolo: unanime
  "Vlasic":2, "Zapata D.":1, "Simeone":1,                               // Torino: unanime (era assente)
  "Davis K.":2, "Solet":1, "Zaniolo":1, "Ekkelenkamp":1,                // Udinese: unanime
  "Colombo":2, "Messias":1, "Vitinha O.":1,                             // Genoa
  "Mina":2, "Borrelli":1, "Fazzini":1,                                  // Cagliari: Esposito ceduto → Mina primo
  "Pessina":2, "Cutrone":1,                                             // Monza
  "Calò":2, "Raimondo":1, "Ghedjemis":1, "Hasa":1,                      // Frosinone
  "Geubbels":1, "Stulic":1, "Pierotti":1,                               // Lecce: ballottaggio aperto
  "Adams A.":1, "Rrahmani Al.":1, "Busio":1,                            // Venezia: aperta tra i due nuovi
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
  "Bowie":"Arrivato dal Verona per ~10M: se il Sassuolo cede Pinamonti diventa il titolare, altrimenti resta alternativa."
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
  "Maldini":2        // accordo totale col Cagliari: cambia squadra
};

/* ================= XI PROBABILI 2026-27 (ricerca 5 agosto: fantamaster/sosfanta/
   pazzidifanta/lottomatica + amichevoli). T = titolare · B+ = ballottaggio favorito ·
   B- = ballottaggio sfavorito · R = riserva chiara. Applicata DOPO il calcolo della
   titolarità dai minuti: le gerarchie nuove contano più della stagione scorsa. */
const XI_STATUS = {
  /* Inter (3-5-2 Chivu) */
  "Martinez Jo.":"B+","Provedel":"R","Akanji":"T","Bastoni":"T","Stones":"B+","Bisseck":"B+",
  "Barella":"T","Calhanoglu":"T","Zielinski":"B+","Sucic P.":"B-","Diouf":"B-","Dimarco":"T",
  "Martinez L.":"T","Thuram":"T","Stankovic A.":"R",
  /* Napoli (4-3-3 Allegri) */
  "Meret":"T","Milinkovic-Savic V.":"R","Di Lorenzo":"T","Rrahmani":"T","Buongiorno":"B+",   // Allegri ha scelto Meret
  "Beukema":"B+","Spinazzola":"B+","Olivera":"B-","De Bruyne":"T","Lobotka":"T","McTominay":"T",
  "Zambo Anguissa":"B-","Politano":"B+","Vergara":"B-","Hojlund":"T","Santos A.":"B+","Neres":"B-","Lukaku":"R",
  /* Roma (3-4-2-1 Gasperini) */
  "Svilar":"T","Mancini":"T","N'Dicka":"T","Ghilardi":"B-","Hermoso":"B+","Koulierakis":"T",
  /* Newport (4 ago): Koulierakis titolare e in gol, Dybala trequarti CON Castro punta */
  "Cristante":"T","Konè M.":"T","Wesley":"B+","Rensch":"B+","Soulè":"B+","Dybala":"B+","Malen":"T",
  "Castro S.":"B+","Pisilli":"B-",
  /* Milan (3-4-2-1 Amorim) */
  "Maignan":"T","Gila":"T","Gabbia":"B+","Tomori":"B-","Pavlovic":"T","Saelemaekers":"T",
  "Modric":"B+","Rabiot":"T","Bartesaghi":"B+","Estupinan":"B-","Pulisic":"T","Nkunku":"B+",
  /* derby amichevole di Perth (5 ago): Camarda titolare, Ramos-Leao-Modric in panchina */
  "Leao":"B+","Ramos G.":"B-","Camarda":"T","Gimenez":"R","Chukwueze":"R","Loftus-Cheek":"R",
  /* Juventus (4-2-3-1 Spalletti) */
  "Di Gregorio":"B+","Perin":"R","Kalulu":"T","Bremer":"T","Kelly L.":"T","Cambiaso":"T",
  "Locatelli":"T","Thuram K.":"B+","Conceicao":"B+","Alajbegovic":"B-","McKennie":"B+",
  "Yildiz":"T","Kolo Muani":"T","Boga":"R","David":"R",
  /* Como (4-2-3-1 Fabregas) */
  "Butez":"T","Smolcic I.":"B+","Van Der Brempt":"B-","Ramon":"B+","Kempf":"B+","Cuenca A.":"B-",
  "Kaiki":"B+","Valle":"B-","Da Cunha":"T","Perrone":"B+","Diao":"B+","Paz N.":"T","Baturina":"B+",
  "Douvikas":"T","Rodriguez Je.":"R",
  /* Atalanta (4-3-3 Sarri) */
  "Carnesecchi":"T","Zappacosta":"T","Bellanova":"R","Scalvini":"T","Hien":"T","Djimsiti":"B+",
  "Ahanor":"B+","Bernasconi":"B-","Kolasinac":"B-","Ederson D.S.":"T","Pasalic":"B+","Samardzic":"B-",
  "De Ketelaere":"T","Scamacca":"B+","Krstovic":"B-","Raspadori":"T",   // Raspadori davanti a Zalewski/Sulemana
  /* Bologna (4-3-3 Tedesco) */
  "Skorupski":"T","Zortea":"B+","Holm":"B-","Heggem":"T","Lucumì":"B+","Vitik":"B-","Casale":"R",
  "Miranda J.":"T","Ferguson":"T","Pobega":"B+","Odgaard":"B+","Bernardeschi":"B-","Orsolini":"T",
  "Dovbyk":"T","Dallinga":"R","Rowe":"T","Cambiaghi":"R","Helland":"B-",
  /* Lazio (4-3-3 Gattuso) */
  /* Motta titolare vs Ostiamare (5 ago) con Mandas in panchina: gerarchia NON dichiarata */
  "Mandas":"B+","Motta":"B+","Marusic":"B+","Lazzari":"B-","Doekhi":"T","Provstgaard":"B+",
  "Tavares N.":"B+","Pedraza":"B-","Rovella":"T","Cataldi":"B-","Taylor K.":"T","Isaksen":"B+",
  "Cancellieri":"B-","Zaccagni":"T","Ratkov":"T","Dia":"B-",   // Ratkov miglior marcatore delle amichevoli
  /* Fiorentina (4-3-2-1 Grosso) */
  "De Gea":"T","Dodò":"B+","Joao Mario":"B-","Dragusin":"T","Viery":"B+","Pongracic":"B-",
  "Ranieri L.":"B-","Jimenez A.":"B+","Oulai":"B+","Fagioli":"B+","Mandragora":"B-","Ndour":"B+",
  "Atta":"B+","Gudmundsson A.":"T","Kean":"T","Piccoli":"B-",
  /* Udinese (3-5-2 Runjaic) */
  "Okoye":"T","Kristensen T.":"T","Kabasele":"T","Solet":"T","Vojvoda":"B+","Zanoli":"B-",
  "Ekkelenkamp":"T","Kamara H.":"B+","Zaniolo":"T","Davis K.":"T",
  /* Torino (3-5-2 Abate) */
  "Paleari":"R","Mascardi":"R","Comuzzo":"B+","Ismajli":"B+","Comert":"B-","Coco":"T","Pedersen":"T",   // arriva Perri dal Leeds
  "Casadei":"T","Vlasic":"T","Biraghi":"B-","Simeone":"T","Zapata D.":"B+","Adams C.":"B-","Oristanio":"B+",
  /* Cagliari (3-5-2 Pisacane) */
  "Caprile":"T","Zè Pedro":"B+","Mina":"T","Rodriguez Ju.":"B+","Zappa":"B+","Obert":"B+",
  "Fazzini":"B+","Deiola":"B-","Borrelli":"B+","Mendy P.":"B+","Felici":"B-",
  /* Genoa (3-4-2-1 De Rossi) */
  "Bijlow":"B+","Marcandalli":"T","Ostigard":"T","Vasquez":"T","Norton-Cuffy":"T","Frendrup":"T",
  "Ellertsson":"B+","Masini":"B-","Mitaj":"B+","Martin":"B-","Baldanzi":"B+","Vitinha O.":"B+",
  "Messias":"B-","Colombo":"T","Amorim":"B-","Traorè Hj.":"B-",
  /* Parma (3-5-2 Cuesta) */
  "Corvi":"B+","Daffara":"B-","Suzuki":"R","Circati":"T","Troilo":"B+","Valenti":"B+","Delprato":"T",
  "Nicolussi Caviglia":"B+","Valeri":"T","Pellegrino M.":"T","Elphege":"B-","Britschgi":"B-",
  /* Sassuolo (4-3-3 Aquilani) */
  "Muric":"B+","Turati":"B-","Walukiewicz":"B+","Idzes":"T","Doig":"B+","Thorstvedt":"T",
  "Adzic":"B+","Berardi":"T","Pinamonti":"B+","Laurientè":"T","Bowie":"B-","Volpato":"B-","Lipani":"B-",
  /* Lecce (4-3-3 Di Francesco) */
  "Falcone":"T","Veiga D.":"T","Gaspar K.":"B+","Siebert":"B-","Tiago Gabriel":"T","Gallo":"T",
  "Berisha M.":"B+","Pierotti":"B+","Geubbels":"B+","Stulic":"B-","N'Dri":"B+","Maleh":"B-",
  /* Monza (3-4-2-1 Juric) */
  "Thiam":"T","Kouadio":"B+","Delli Carri":"B+","Lucchesi":"B-","Carboni A.":"B+","Birindelli":"T",
  "Pessina":"T","Akinsanmiro":"B+","Mangas":"T","Colpani":"T","Mota":"B+","Cutrone":"T",
  "Petagna":"R","Ciurria":"B-",
  /* Venezia (3-5-2 Stroppa) */
  "Stankovic F.":"T","Bella-Kotchap":"T","Schingtienne":"B+","Sverko":"B+","Correia T.":"B+",
  "Hainaut":"B-","Busio":"T","Sohm":"B+","Haps":"B+","Moreno M.":"B-","Adams A.":"B+",
  "Rrahmani Al.":"B+","Yeboah J.":"B-",
  /* Frosinone (4-3-3 Alvini) */
  "Palmisani":"B+","Desplanches":"B-","Oyono A.":"T","Calvani":"B+","Monterisi":"T","Bracaglia":"T",
  "Calò":"T","Hasa":"B+","Gelli F.":"B-","Ghedjemis":"T","Raimondo":"B+","Kvernadze":"B+","Zerbin":"B-"
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
  "Konè I.":[14,"Frattura di tibia e perone: rientro previsto tra dicembre e gennaio."],
  "Parisi":[10,"Lesione del crociato: rientro tra novembre e dicembre."],
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
    let inj  = o ? o.inj : 0;
    let injNote = "";
    if (INJURY[p.n]) {
      const [gior, txt] = INJURY[p.n];
      if (gior >= 4) inj = 3; else if (gior >= 2) inj = Math.max(inj, 2);
      injNote = `⚕️ ${txt}`;
    }
    const age  = o && o.age ? o.age : 26;
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
    const row = `["${p.r}","${esc(p.n)}","${esc(p.t)}",${p.q},${fm.toFixed(2)},${est},${pres},${gol},${ass},${rig},${tit},${up},${inj},${age},${unc},${newT},"${esc(note)}","${p.id}",${p.fvm||0},${xgd}]`;
    lines.push(first ? `\n/* ===== ${ROLE_TITLE[role]} ===== */\n${row}` : row);
    first = false;
  }
}

/* verifica: ogni nome nelle mappe deve esistere nel listone (un typo = dato perso in silenzio) */
const LNAMES = new Set(L.map(p => p.n));
for (const [label, map] of [["XI_STATUS", XI_STATUS], ["INJURY", INJURY], ["MERCATO_NOTE", MERCATO_NOTE], ["MERCATO_UNC", MERCATO_UNC], ["RIG", RIG], ["NOTE", NOTE]]) {
  const missing = Object.keys(map).filter(n => !LNAMES.has(n));
  if (missing.length) console.warn(`⚠️ ${label}: nomi non nel listone → ${missing.join(", ")}`);
}

const out = `/* FantaHQ — database giocatori e squadre. STAGIONE 2026-27 (listone ufficiale).
   Per aggiornare il motore (dopo una giornata o il mercato) basta modificare QUESTO file:
   - date: data dell'ultimo aggiornamento (mostrata nell'app)
   - teams: rating attacco/difesa 1-5 + allenatore (profili ricavati dai dati storici dei tecnici)
   - kb: [ruolo, nome, squadra, quotaUfficiale, fantamedia, fmStimata(0/1), presenze, gol, assist,
          rigorista(2=primo,1=alternativa,0=no), titolarità%, upside0-5, rischioInfortuni0-3,
          età, incertezzaMercato0-3, nuovoAcquisto(0/1), nota, idUfficiale, FVM(fantavalore su base 1000),
          xgd(correzione FM da regressione xG, ±0.40)]
   Nomi allineati al listone ufficiale ("Cognome I."): l'app aggancia per NOME+RUOLO.
   FM: reale 2025-26 dove disponibile (est=0); altrimenti stimata dalla quota ufficiale via
   regressione calibrata per ruolo sui giocatori con dati reali (est=1).
   Titolarità: minuti reali 25-26 corretti con le PROBABILI FORMAZIONI 2026-27 (XI_STATUS)
   e gli infortuni attuali (INJURY) del builder. */
window.FANTAHQ_DATA = {
  date: ${JSON.stringify("6 agosto 2026 — mercato, rigoristi, amichevoli e infortuni aggiornati")},
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
