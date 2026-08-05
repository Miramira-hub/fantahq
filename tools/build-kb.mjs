/* Costruisce data/kb.js 2026-27 dal listone ufficiale + dati raccolti.
   Copertura: TUTTI i giocatori del listone (494), non solo i noti. */
import fs from "fs";

const SCRATCH = "C:/Users/snake/AppData/Local/Temp/claude/C--Users-snake-Desktop-Strumenti-Vari/2089b824-a8c6-4bb8-86c9-94e6decb2325/scratchpad";
const REPO = "C:/Users/snake/Desktop/Strumenti Vari/fantahq";

const rows = JSON.parse(fs.readFileSync(`${SCRATCH}/q27.json`, "utf8")).slice(2);
const L = rows.map(x => ({ id:x[0], r:x[1], rm:x[2], n:x[3], t:x[4], q:+x[5], fvm:+x[11] }));

/* ---- KB 2025-26 (fantamedie reali e attributi già raccolti).
   Letto da uno SNAPSHOT immutabile, non dal file di destinazione: altrimenti a ogni
   riesecuzione lo script si ri-alimenterebbe con i propri output (feedback loop). ---- */
const old = [...fs.readFileSync(`${SCRATCH}/kb-2025-26.js`, "utf8")
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

/* ---- regressione FM ~ log(quota) per ruolo ----
   Calibrata su TUTTI i giocatori riconosciuti dal vecchio KB (~170: FM reali + stime già ragionate),
   non solo sui pochi con FM verificata, altrimenti il campione è troppo piccolo e la retta impazzisce.
   Il risultato viene poi limitato a un intervallo realistico per ruolo. */
const known = [];
for (const p of L) { const o = findOld(p); if (o) known.push({ r:p.r, x:Math.log(p.q||1), y:o.fm }); }
const CLAMP = { P:[4.9,6.15], D:[5.7,7.6], C:[5.7,7.8], A:[5.7,8.6] };
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
const US = JSON.parse(fs.readFileSync(`${SCRATCH}/understat2526.json`, "utf8"))
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
const rankTit = (p) => {
  const same = L.filter(x => x.t === p.t && x.r === p.r).sort((a,b) => b.q - a.q);
  const i = same.findIndex(x => x.id === p.id);
  const slots = { P:1, D:4, C:4, A:2 }[p.r];
  if (i < slots) return p.q >= same[0].q * 0.7 ? 88 : 80;
  if (i < slots + 2) return 60;
  return 40;
};

/* ---- rigoristi 2026-27 (fonti: FantaMaster, Goal, SosFanta) 2=primo, 1=alternativa ---- */
const RIG = {
  "Calhanoglu":2, "Martinez L.":1, "Zielinski":1,
  "Yildiz":2, "Locatelli":1, "David":1,
  "Ramos G.":2, "Nkunku":1, "Pulisic":1,
  "Malen":2, "Dybala":1,
  "Scamacca":2, "De Ketelaere":1, "Samardzic":1,
  "Orsolini":2, "Bernardeschi":1,
  "Da Cunha":2, "Paz N.":1, "Douvikas":1,
  "Gudmundsson A.":2, "Mandragora":1, "Kean":1,
  "Zaccagni":2,
  "Pellegrino M.":2,
  "Calò":2, "Colombo":2, "Messias":1, "Vitinha":1,
  "Hojlund":2, "De Bruyne":1,
  "Berardi":2, "Pinamonti":1,
  "Camarda":1, "Krstovic":1, "Davis K.":2, "Mina":2, "Simeone":1, "Pessina":2, "Busio":2
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

/* ================= AGGIORNAMENTO MERCATO — 5 agosto 2026 =================
   Blocco separato che ha la precedenza su NOTE e UNC: si aggiorna qui a ogni giro di
   mercato, senza toccare le mappe storiche. */
const MERCATO_NOTE = {
  "Ramos G.":"Record storico del Milan (65M+5 dal PSG) e primo rigorista. Al PSG 6 gol ma xG 8.22: finalizzazione sfortunata con npxG/90 0.51 in soli 1300 minuti. Se gioca con continuità i numeri arrivano.",
  "Hojlund":"Riscattato dal Napoli per 44M: 13 gol con xG 12.5, rendimento in linea. Riferimento offensivo di Allegri e rigorista.",
  "Gila":"Pagato 30M dal Milan: 3° per fantamedia tra i difensori nel 25-26 (7.26). Con Amorim meno clean sheet che alla Lazio, ma qualità alta.",
  "Frattesi":"⚠️ ASSE INTER-JUVENTUS APERTO (possibile scambio con Nico Gonzalez): gol garantiti quando gioca, ma la squadra può cambiare. Verifica prima di puntarci all'asta.",
  "Santos A.":"Preso dal Napoli per 20M dallo Sporting: nessun dato in Serie A, deve conquistarsi lo spazio dietro Hojlund.",
  "Boga":"Alla Juventus da Nizza per 4.75M: quota bassa, ruolo di rotazione nell'affollato attacco bianconero.",
  "Stankovic A.":"Riacquistato dall'Inter dal Bruges per 23M: investimento importante ma quota da riserva, titolarità tutta da conquistare.",
  "Koulierakis":"Arrivato alla Roma dal Wolfsburg: giovane centrale nel sistema Gasperini, dove i difensori fanno bonus.",
  "Joao Mario":"In prestito alla Fiorentina dalla Juventus: quota minima, riserva.",
  "Adzic":"In prestito al Sassuolo dalla Juventus: giovane, spazio da verificare.",
  "Doekhi":"A parametro zero alla Lazio dall'Union Berlino: difensore fisico, buono nei piazzati."
};
/* Trattative ancora APERTE: 2 = futuro in bilico (il motore lo classifica "da monitorare"),
   3 = praticamente in uscita. Da azzerare quando il mercato si chiude. */
const MERCATO_UNC = {
  "Frattesi":2,      // asse Inter-Juventus con Nico Gonzalez
  "Leao":2,          // il Fenerbahçe ci prova, quota già crollata a 18
  "Fruchtl":3        // in chiusura al Salisburgo
};

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
    const u = findUS(p);                       // dati reali 25-26
    if (u) withUS++;
    const hasReal = o && !o.est;
    if (hasReal) matched++; else estimated++;
    const fm  = hasReal ? o.fm : estFM(p.r, p.q);
    const est = hasReal ? 0 : 1;
    const pres = u ? u.gp  : (o ? o.pres : 0);
    const gol  = u ? u.gol : (o ? o.gol : 0);
    const ass  = u ? u.ass : (o ? o.ass : 0);
    const rig  = RIG[p.n] ?? (o ? o.rig : 0);
    /* Cancello titolarità. Priorità ai MINUTI REALI giocati; chi ha cambiato squadra riparte
       dalle gerarchie nuove (un titolare altrove può essere riserva qui: Provedel, Lazio → vice Inter). */
    /* Chi ha cambiato squadra: pesa soprattutto la GERARCHIA NUOVA (dedotta dalla quota
       nella nuova rosa), perché lo storico dice quanto giocava altrove, non qui.
       Es. Provedel: titolare alla Lazio ma quota 2 da vice all'Inter → resta una riserva. */
    const changedTeam = !u || norm(u.t) !== norm(p.t);
    const tit = u
      ? (changedTeam ? Math.round(titFromMinutes(u) * 0.3 + rankTit(p) * 0.7) : titFromMinutes(u))
      : rankTit(p);
    const up   = o ? o.up : (p.q <= 6 ? 2 : 1);
    const inj  = o ? o.inj : 0;
    const age  = o && o.age ? o.age : 26;
    const unc  = MERCATO_UNC[p.n] ?? 0;   // trattativa aperta -> il motore lo marca "da monitorare"
    const newT = o ? (norm(o.t) !== norm(p.t) ? 1 : 0) : 1;

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
    const note = [baseNote, signal].filter(Boolean).join(" ");
    const row = `["${p.r}","${esc(p.n)}","${esc(p.t)}",${p.q},${fm.toFixed(2)},${est},${pres},${gol},${ass},${rig},${tit},${up},${inj},${age},${unc},${newT},"${esc(note)}","${p.id}",${p.fvm||0}]`;
    lines.push(first ? `\n/* ===== ${ROLE_TITLE[role]} ===== */\n${row}` : row);
    first = false;
  }
}

const out = `/* FantaHQ — database giocatori e squadre. STAGIONE 2026-27 (listone ufficiale).
   Per aggiornare il motore (dopo una giornata o il mercato) basta modificare QUESTO file:
   - date: data dell'ultimo aggiornamento (mostrata nell'app)
   - teams: rating attacco/difesa 1-5 + allenatore (profili ricavati dai dati storici dei tecnici)
   - kb: [ruolo, nome, squadra, quotaUfficiale, fantamedia, fmStimata(0/1), presenze, gol, assist,
          rigorista(2=primo,1=alternativa,0=no), titolarità%, upside0-5, rischioInfortuni0-3,
          età, incertezzaMercato0-3, nuovoAcquisto(0/1), nota, idUfficiale, FVM(fantavalore su base 1000)]
   Nomi allineati al listone ufficiale ("Cognome I."): l'app aggancia per NOME+RUOLO.
   FM: reale 2025-26 dove disponibile (est=0); altrimenti stimata dalla quota ufficiale via
   regressione calibrata per ruolo sui giocatori con dati reali (est=1). */
window.FANTAHQ_DATA = {
  date: ${JSON.stringify("5 agosto 2026 — listone ufficiale + mercato")},
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
