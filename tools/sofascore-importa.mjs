/* SOFASCORE-IMPORTA — porta i file della raccolta (tools/sofascore-raccogli.js) nel repo e
   aggancia ogni giocatore SofaScore all'Id ufficiale di fantacalcio.it.
   ------------------------------------------------------------------------------------
   L'aggancio è il lavoro vero: SofaScore scrive "Lautaro Martínez" / "L. Martínez",
   fantacalcio.it "Martinez L.". Si confronta stagione per stagione con il file delle
   statistiche ufficiali della STESSA stagione (squadra e ruolo di quell'anno), così un
   trasferimento non confonde due giocatori. Regole, in ordine:
     1. cognome (tutte le parole del nome fantacalcio senza l'iniziale) contenuto nel nome
        SofaScore, accenti tolti;
     2. stessa squadra, se fra i candidati ce n'è uno;
     3. l'iniziale ("L.", "Jo.") deve combaciare con il nome SofaScore, se c'è;
     4. il ruolo separa solo i portieri: SofaScore registra quello GIOCATO (un quinto è "M").
   Chi resta ambiguo o senza candidato NON si aggancia a caso: finisce nell'elenco da
   guardare, con i minuti giocati, e si sistema a mano in data/sofascore/mappa-manuale.json.

   uso:  node tools/sofascore-importa.mjs [cartella dei download]
*/
import fs from "fs";
import path from "path";
import { REPO } from "./app.mjs";

const SORG = process.argv[2] || path.join(process.env.USERPROFILE || "", "Downloads");
const DIR = path.join(REPO, "data", "sofascore");
fs.mkdirSync(DIR, { recursive: true });

/* le lettere che NFD non scompone (ð, đ, ø, ł, ı...) vanno tradotte a mano */
const LETTERE = { "ð": "d", "đ": "d", "ø": "o", "ł": "l", "ı": "i", "æ": "ae", "œ": "oe", "ß": "ss", "þ": "th" };
const pulisci = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[ðđøłıæœßþ]/g, c => LETTERE[c]).replace(/['’]/g, "").replace(/[.\-]/g, " ").replace(/\s+/g, " ").trim();
/* SofaScore scrive "SSC Napoli", "US Salernitana 1919", "Hellas Verona": si tengono le parole
   che contano (via sigle e anni) */
const SIGLE = new Set(["ac", "as", "ssc", "us", "fc", "ss", "acf", "calcio", "hellas", "bc", "1907", "1909", "1913", "1919"]);
const sq = s => { const p = pulisci(s).split(" ").filter(w => !SIGLE.has(w)).join(" "); return p === "internazionale" ? "inter" : p; };
/* SofaScore registra il ruolo GIOCATO (i quinti sono "M"): il ruolo separa solo i portieri */
const compatibile = (r, pos) => (r === "P") === (pos === "G");

const manuale = fs.existsSync(path.join(DIR, "mappa-manuale.json"))
  ? JSON.parse(fs.readFileSync(path.join(DIR, "mappa-manuale.json"), "utf8")) : {};

const mappa = {};          // sofaId → fantaId
const daGuardare = [];
for (const f of fs.readdirSync(SORG).filter(f => /^sofascore-\d{4}-\d{2}( \(\d+\))?\.json$/.test(f)).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(SORG, f), "utf8"));
  const st = raw.stagione;
  fs.writeFileSync(path.join(DIR, `${st}.json`), JSON.stringify(raw));
  const fileSt = path.join(REPO, "data", `statistiche-${st}.json`);
  if (!fs.existsSync(fileSt)) { console.log(`${st}: manca ${path.basename(fileSt)}, aggancio rimandato`); continue; }
  const ufficiali = JSON.parse(fs.readFileSync(fileSt, "utf8")).slice(2)
    .map(r => ({ id: r[0], r: r[1], nome: r[3], sq: sq(r[4]), parti: pulisci(r[3]).split(" ") }));

  /* un giocatore SofaScore per stagione, con la squadra dove ha giocato di più */
  const sofa = new Map();
  for (const g of raw.giornate) for (const p of g.partite) for (const x of p.giocatori) {
    const v = sofa.get(x.id) || { id: x.id, nome: x.nome, breve: x.breve, pos: x.pos, min: 0, perSq: {} };
    const m = x.st.minutesPlayed || 0;
    v.min += m; v.perSq[x.squadra] = (v.perSq[x.squadra] || 0) + m;
    sofa.set(x.id, v);
  }
  let presi = 0, sopra = 0;
  for (const v of sofa.values()) {
    if (!v.min) continue;
    if (v.id in manuale) { if (manuale[v.id]) { mappa[v.id] = manuale[v.id]; presi++; } continue; }   // null = non agganciare
    const squadraPrincipale = sq(Object.entries(v.perSq).sort((a, b) => b[1] - a[1])[0][0]);
    const nomeS = pulisci(v.nome), paroleS = nomeS.split(" ");
    /* "Martinez L." / "Ederson D.S." / "Pezzella Giu.": col punto finale l'ultima parola e quelle
       di 1-2 lettere sono iniziali, il resto è cognome. L'apostrofo si toglie: N'Dicka → ndicka */
    let cand = ufficiali.filter(u => {
      const iniziali = u.nome.trim().endsWith(".") ? u.parti.filter((w, i) => w.length <= 2 || i === u.parti.length - 1) : [];
      const cognome = u.parti.filter(w => !iniziali.includes(w));
      if (!cognome.length || !cognome.every(w => paroleS.includes(w))) return false;
      if (iniziali.length && paroleS.length > 1 && !paroleS.some(w => w.startsWith(iniziali[0]) && !cognome.includes(w))) return false;
      return compatibile(u.r, v.pos);
    });
    if (cand.length > 1) { const st2 = cand.filter(u => u.sq === squadraPrincipale); if (st2.length) cand = st2; }
    /* "Gaetano Oristanio": vince chi ha il cognome nell'ULTIMA parola del nome SofaScore */
    if (cand.length > 1) { const ul = cand.filter(u => u.parti.includes(paroleS[paroleS.length - 1])); if (ul.length) cand = ul; }
    if (cand.length === 1) { mappa[v.id] = cand[0].id; presi++; }
    else if (v.min >= 300) { sopra++; daGuardare.push(`${st} · ${v.nome} (${squadraPrincipale}, ${v.pos}, ${v.min}') → ${cand.length ? "ambiguo: " + cand.map(u => u.nome).join(", ") : "nessun candidato"}`); }
  }
  console.log(`${st}: ${raw.giornate.length} giornate, ${sofa.size} giocatori, agganciati ${presi}, da guardare (≥300') ${sopra}`);
}
fs.writeFileSync(path.join(DIR, "mappa.json"), JSON.stringify(mappa));
console.log(`\nmappa: ${Object.keys(mappa).length} giocatori SofaScore → Id ufficiale`);
if (daGuardare.length) console.log(`\n⚠️ DA GUARDARE (${daGuardare.length}):\n  ` + daGuardare.join("\n  "));
