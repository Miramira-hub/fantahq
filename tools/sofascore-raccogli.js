/* SOFASCORE-RACCOGLI — raccolta partita per partita della Serie A, da eseguire DENTRO una
   pagina di https://www.sofascore.com (la loro API risponde 403 a chi non è un browser).
   ------------------------------------------------------------------------------------
   Il browser integrato dell'app blocca le chiamate da un sito esterno verso localhost,
   quindi i dati escono come FILE: una stagione → un download "sofascore-<stagione>.json",
   che poi tools/sofascore-importa.mjs porta in data/sofascore/.

   Si definisce la funzione incollando questo file nella pagina, poi:
     await raccogliStagione("2025-26")            // tutta la stagione, poi il download
     await raccogliStagione("2026-27", {da:1, a:7})
     await provaGiornata("2026-27", 5)            // una giornata, nessun download: verifica

   Una richiesta ogni ~700 ms: una stagione intera sono ~420 richieste, circa 5 minuti.
   Si tengono solo le statistiche che servono al motore (minuti, voto, gol, assist, xG, xA,
   tiri, occasioni), non tutte le 60 che SofaScore espone: il file resta piccolo. */
const SOFA_STAGIONI = { "2023-24": 52760, "2024-25": 63515, "2025-26": 76457, "2026-27": 95836 };
const SOFA_TORNEO = 23;
const SOFA_STAT = ["minutesPlayed", "rating", "goals", "goalAssist", "expectedGoals", "expectedAssists",
  "totalShots", "onTargetScoringAttempt", "keyPass", "bigChanceCreated", "bigChanceMissed", "touches",
  "penaltyWon", "penaltyMiss", "penaltyConceded", "ownGoals", "errorLeadToAGoal", "saves", "goalsPrevented",
  "penaltySave", "totalPass", "accuratePass", "wasFouled", "fouls"];
const sofaPausa = ms => new Promise(r => setTimeout(r, ms));

async function sofaGet(percorso, tentativi = 3) {
  for (let t = 1; t <= tentativi; t++) {
    const r = await fetch("https://www.sofascore.com/api/v1/" + percorso);
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    await sofaPausa(3000 * t);                      // 403/429: si rallenta, non si insiste
  }
  throw new Error(`SofaScore non risponde su ${percorso}`);
}

function sofaGiocatore(x, squadra) {
  const s = x.statistics || {};
  const st = {};
  for (const k of SOFA_STAT) if (s[k] != null) st[k] = s[k];
  return { id: x.player.id, nome: x.player.name, breve: x.player.shortName, pos: x.position || x.player.position,
           squadra, panchina: !!x.substitute, st };
}

async function sofaGiornata(stagione, g) {
  const sid = SOFA_STAGIONI[stagione];
  const ev = await sofaGet(`unique-tournament/${SOFA_TORNEO}/season/${sid}/events/round/${g}`);
  if (!ev) return null;
  const partite = [];
  for (const e of ev.events) {
    if (e.status?.type !== "finished") continue;     // le non giocate (o rinviate) non hanno lineup
    await sofaPausa(700);
    const lu = await sofaGet(`event/${e.id}/lineups`);
    if (!lu) continue;
    const casa = e.homeTeam.name, ospite = e.awayTeam.name;
    partite.push({ id: e.id, data: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10),
      casa, ospite, gc: e.homeScore?.current, go: e.awayScore?.current,
      giocatori: [...(lu.home?.players || []).map(x => sofaGiocatore(x, casa)),
                  ...(lu.away?.players || []).map(x => sofaGiocatore(x, ospite))] });
  }
  return { stagione, giornata: g, partite };
}

async function provaGiornata(stagione, g) {
  const d = await sofaGiornata(stagione, g);
  const p = d.partite[0], gioc = p.giocatori.filter(x => x.st.minutesPlayed);
  return { partite: d.partite.length, esempio: `${p.casa}-${p.ospite} ${p.gc}-${p.go}`,
           conMinuti: gioc.length, campione: gioc.slice(0, 3), byte: JSON.stringify(d).length };
}

async function raccogliStagione(stagione, { da = 1, a = 38 } = {}) {
  const giornate = [];
  for (let g = da; g <= a; g++) {
    const d = await sofaGiornata(stagione, g);
    if (!d || !d.partite.length) { console.log(`giornata ${g}: niente di giocato, mi fermo`); break; }
    giornate.push(d);
    console.log(`${stagione} giornata ${g}: ${d.partite.length} partite`);
    await sofaPausa(700);
  }
  const blob = new Blob([JSON.stringify({ fonte: "sofascore", stagione, raccolta: new Date().toISOString(), giornate })],
                        { type: "application/json" });
  const a2 = document.createElement("a");
  a2.href = URL.createObjectURL(blob); a2.download = `sofascore-${stagione}.json`;
  document.body.appendChild(a2); a2.click(); a2.remove();
  return { stagione, giornate: giornate.length, partite: giornate.reduce((s, x) => s + x.partite.length, 0) };
}
