# Pre-ricerca FantaHQ — verso il listone ufficiale (4 agosto 2026)

Documento di lavoro che accumula la ricerca **indipendente dal listone** (statistiche
storiche, profili-allenatore, trasferimenti, scouting nuovi) così che il 4 agosto il
rebuild del database sia veloce: basterà agganciare i codici Id ufficiali, calibrare i
valori sulle quotazioni vere e sistemare i movimenti last-minute.

**Principio guida:** decisioni solo da **dati** (fantamedia storica, xG/xA, minuti, gol/assist)
e **fatti verificabili** (trasferimenti, rigoristi, infortuni, ruolo assegnato dall'allenatore).
Mai opinioni/consigli soggettivi.

⚠️ NON toccare `data/kb.js` con questi dati finché non esce il listone: il mercato è aperto
fino al 1° settembre e le rose cambiano ancora. Questo file è la fonte di verità per il rebuild.

---

## 1. Metodologia motore 2.0

**FM attesa** = combinazione trasparente (nessuna scatola nera) di:
1. **Fantamedia pluriennale pesata** (2-3 stagioni, più peso alle recenti e a chi ha più minuti).
2. **Segnali sottostanti** (fbref/Understat): xG, xA, npxG, tiri, tiri in porta, big chances, tocchi in area, per-90.
3. **Rigorista** designato (fatto verificabile).
4. **Contesto squadra + allenatore** (vedi §2, profili data-driven che rimpiazzano l'attuale rating atk/def a mano).
5. **Età, infortuni, titolarità attesa, incertezza mercato.**

**Segnali di regressione (le occasioni nascoste):**
- 💎 `regressione+`: xG/xA alti ma gol/assist bassi → salirà (sottovalutato).
- 🔻 `regressione−`: gol molto sopra xG → probabile calo (non strapagare).
- ⚡ `breakout`: alto rendimento per-90 con pochi minuti → se gioca di più esplode (pattern Nico Paz).

**Auto-rosa ottimale:** dato budget + slot + valori attesi + prezzi, ottimizzatore (knapsack per reparto)
che propone la rosa migliore per valore atteso.

---

## 2. Profili-allenatore 2026-27 (data-driven)

Ogni allenatore riceve un peso per reparto ricavato dal **rendimento storico dei suoi reparti**,
applicato ai giocatori della sua squadra 2026-27. `P/D/C/A` = spinta sul valore fantacalcistico.

| Allenatore | Squadra 26-27 | Tilt (dati) | Effetto fantacalcio |
|---|---|---|---|
| **Allegri** | Napoli | Difesa élite: al Milan 43→2ª difesa Serie A; a fine Juve 270 gol subiti in 346 gare | **P ++ , D +** (specie col modificatore); attacco cinico ma meno volumi |
| **Gasperini** | Roma | Difensori: **101 gol** dal 2016/17 (record EU); braccetti/esterni bonus (Gosens 25g+16a) | **D + (bonus offensivo braccetti/esterni)** , **A/trequartisti ++** |
| Sarri | Atalanta | *(da ancorare)* possesso, più controllo del caos offensivo dell'Atalanta di Gasp | registi/mezzali; meno gol-difensori del passato Atalanta |
| Chivu | Inter | *(da ancorare)* rosa fortissima, equilibrata | valori alti diffusi |
| Spalletti | Juventus | *(da ancorare)* gioco offensivo, esalta trequartisti/gol | C/A offensivi |
| Fabregas | Como | *(da ancorare)* gioco propositivo, lancia i giovani | talenti C/A, occasioni |
| Gattuso | Lazio | *(da ancorare)* compattezza | D/portiere > attacco |
| Tedesco | Bologna | *(da ancorare)* squadra organizzata | equilibrio |
| Amorim | Milan | *(da ancorare)* 3-4-3, esterni | esterni/attacco |
| Pisacane | Cagliari | *(da ancorare)* | |
| De Rossi | Genoa | *(da ancorare)* | |
| Cuesta | Parma | *(da ancorare)* | |
| Di Francesco | Lecce | *(da ancorare)* | |
| Aquilani | Sassuolo | *(da ancorare)* | |
| Juric | Monza | *(da ancorare)* difesa aggressiva | |
| Stroppa | Venezia | *(da ancorare)* neopromossa | |
| Alvini | Frosinone | *(da ancorare)* neopromossa | |
| Grosso | Fiorentina | *(da ancorare)* | |
| Abate | Torino | *(da ancorare)* | |
| Runjaic | Udinese | *(da ancorare)* | |

> TODO: ancorare con dati (gol subiti/fatti, clean sheet, quota gol da difensori) i tecnici "da ancorare".

---

## 3. Transfer tracker 2026 (fatti verificati)

Movimenti che cambiano il contesto/valore (da riflettere nel rebuild):

| Giocatore | Da → A | Nota per il valore |
|---|---|---|
| **Dovbyk** | Roma → **Bologna** (prestito+riscatto 17M) | Da comprimario (Malen) a **9 titolare del Bologna**: valore in possibile risalita. xG/tiro élite (0.31, 7° in A) ma volume/minuti crollati alla Roma |
| **Santiago Castro** | Bologna → **Roma** | Nuovo 9 giallorosso nel sistema Gasperini; giovane, margini |
| **Gonçalo Ramos** | PSG → **Milan** | Vedi §4: per-90 forte, xG sfortunato; se titolare, upside |
| Dragusin | Tottenham → Fiorentina | Nuovo, difensore |
| Pedraza | Villarreal → Lazio (svincolo) | Esterno spinta continua |
| Celik | Roma → Juventus (svincolo) | Affidabile, pochi bonus |
| Winks | Leicester → Cagliari | |
| Cuenca | Barcellona → Como | Giovane, scommessa |

> TODO: completare col tabellone ufficiale al 4 agosto; verificare rigoristi post-mercato.

---

## 4. Log ricerca giocatori (stat avanzate 2025-26)

Fonti: fbref, FootyStats, FotMob, StatMuse. `npxG` = xG senza rigori. Percentili su Serie A.

| Giocatore | Squadra 26-27 | Dati chiave 25-26 | Segnale | Verdetto macchina |
|---|---|---|---|---|
| **Nico Paz** | Como (Fabregas) | 12 gol, 6 assist, 35 pres; **npxG/90 0.51 (~98° pct)** | — solido | 🟢 Rendimento sostenuto dai dati, non fortuna → **acquisto sicuro** |
| **Soulé** | Roma (Gasperini) | ~5 assist ma **xA/90 0.27 (~94° pct)**; 7 gol | 💎 regressione+ | Crea da top, i compagni hanno sprecato → **assist in arrivo, sottovalutato**. Fit Gasperini ottimo |
| **Gonçalo Ramos** | Milan (Amorim), NEW | PSG: 6 gol ma **xG 8.22** (sfortunato), **npxG/90 0.51** in ~1300' (chioccia) | ⚡ breakout | Nessuna FM in A → i sistemi solo-storico non lo vedono. Per-90 da titolare: **potenziale alto se gioca** |
| **Dovbyk** | Bologna (Tedesco), da Roma | 3 gol/14 gare; xG/tiro 0.31 (7° in A) ma **tiri in porta 7 vs 43 vs 58** (crollo volume/minuti) | contesto cambiato | Alla Roma 🔻 fade; **al Bologna da titolare il giudizio si ribalta** → rivalutare col ruolo nuovo |

> Il punto del demo: la stessa macchina ha **confermato** un top (Paz), **scovato** un sottovalutato (Soulé),
> **valutato** un nuovo senza storia (Ramos) e **contestualizzato** un caso mercato (Dovbyk). Solo numeri e fatti.

---

## 5. TODO al 4 agosto (rebuild)
- [ ] Importare il listone ufficiale 2026-27 → set definitivo di giocatori, ruoli, **Id**, quotazioni.
- [ ] Rigenerare `data/kb.js` con nomi in formato "Cognome I." (matching esatto col listone).
- [ ] Coprire (quasi) tutti gli ownable, non solo i ~170 attuali.
- [ ] Applicare media pluriennale + stat avanzate (§4) + profili-allenatore (§2) + transfer (§3).
- [ ] Rigoristi post-mercato squadra per squadra.
- [ ] (Se usciti) calendario → difficoltà avversario per giornata nel DB.
- [ ] Valutare l'auto-rosa ottimale come nuova feature.
