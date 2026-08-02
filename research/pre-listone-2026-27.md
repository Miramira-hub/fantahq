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
applicato ai giocatori della sua squadra 2026-27. Legenda spinta: `++` forte, `+` medio, `=` neutro, `−` penalizza.

**Ancora quantitativa — gol subiti/partita in Serie A (storico allenatori):**
Conte 0.80 · **Allegri 0.88** · **Chivu 0.94** · **Sarri 1.06**. È la spina dorsale del "peso difensivo".

| Allenatore | Squadra 26-27 | P | D | C | A | Insight + ancora dati |
|---|---|:--:|:--:|:--:|:--:|---|
| **Allegri** | Napoli | ++ | + | = | = | Difesa élite (0.88 subiti; Milan 43→2ª difesa). **Porta/difesa d'oro col modificatore**; attacco cinico, pochi volumi |
| **Chivu** | Inter | + | + | + | ++ | 0.94 subiti (3° storico) + rosa fortissima: **valori alti diffusi**, difesa solida e attacco top |
| **Sarri** | Atalanta | + | + | + | = | Possesso + difesa (Lazio 2ª per clean sheet, 14; 1.06 subiti). Eredita l'Atalanta: **meno gol-dai-difensori** dell'era Gasp, più **registi/mezzali** |
| **Spalletti** | Juventus | = | + | ++ | ++ | Miglior attacco E difesa nello scudetto Napoli; possesso; **24 gol da palla inattiva** (bonus a chi batte/incorna). Esalta **trequartisti e attaccanti** |
| **Gasperini** | Roma | = | + | ++ | ++ | **101 gol dai difensori** dal 2016/17 (record EU): **braccetti/esterni fanno bonus**; trequartisti/attaccanti ++ |
| **Gattuso** | Lazio | + | + | + | + | Pressing intenso, verticale, compatto (Napoli 86 fatti/41 subiti). Equilibrio, punta su **transizioni**; non difensivista puro come Sarri |
| **Amorim** | Milan | = | + | + | ++ | 3-4-3 super offensivo (Sporting record gol, quinti alti sulla linea d'attacco): **esterni/quinti bonus, attacco ++**. Cautela: 1ª in A dopo il flop Man Utd |
| **Fabregas** | Como | + | + | ++ | + | Possesso 4-2-3-1, **trequartista libero fulcro** (Nico Paz), lancia giovani, difesa discreta. **Talenti C/trequartista ++**, occasioni nascoste |
| **Juric** | Monza | + | + | = | + | 3-4-3 marcatura a uomo, discepolo di Gasp: Torino **4ª difesa (17 subiti)**, quinti con inserimenti. Ma Monza neopromossa (materiale scarso) |
| **Tedesco** | Bologna | = | + | + | + | Verticale e intenso, arriva in fretta in area, difesa a 3/4 variabile, aggressivo in transizione. Equilibrio |
| **De Rossi** | Genoa | + | + | = | = | 4-3-3, intensità + costruzione + **compattezza difensiva**. Solidità da metà classifica |
| **Runjaic** | Udinese | + | + | = | = | *(tattico)* Udinese organizzata e solida dietro, poche fonti di bonus offensivo |
| **Cuesta** | Parma | = | + | + | = | *(tattico)* scuola possesso (assistente City), gioco propositivo ma rosa giovane |
| **Aquilani** | Sassuolo | = | = | + | + | *(tattico)* possesso/propositivo (pedigree Primavera Fiore); Sassuolo tende al bel gioco |
| **Di Francesco** | Lecce | = | = | + | + | *(tattico)* 4-3-3 offensivo, ma Lecce da salvezza: bonus limitati dal materiale |
| **Grosso** | Fiorentina | = | + | + | + | *(tattico)* pragmatico, verticale sugli esterni |
| **Abate** | Torino | = | + | + | = | *(tattico)* pedigree Primavera Milan, gioco ordinato, valorizza giovani |
| **Pisacane** | Cagliari | + | + | = | = | *(tattico)* confermato, pragmatico da salvezza, difesa prima di tutto |
| **Stroppa** | Venezia | + | + | = | = | *(tattico)* neopromossa, 3-5-2 accorto/difensivo |
| **Alvini** | Frosinone | = | + | = | = | *(tattico)* neopromossa, salvezza, pochi bonus attesi |

> Marcati *(tattico)* = profilo da identità di gioco, da rifinire con dati stagionali al rebuild.
> I `++/+` diventeranno moltiplicatori numerici nel motore (rimpiazzano il rating atk/def a mano per squadra).

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

## 4. Log ricerca giocatori (stat avanzate 2025-26) — reparto per reparto

Fonti: fbref, FootyStats, FotMob, StatMuse, Sky, fantacalcio.dev. `npxG` = xG senza rigori.
Legenda segnali: 🟢 confermato/sostenibile · 💎 regressione+ (sottovalutato, salirà) · 🔻 regressione−/cautela · ⚡ breakout.

**Contesto squadra (xG di squadra 25-26) — chi è stato sfortunato in porta:**
- **Sotto** (attacchi sfortunati → giocatori che saliranno): Juventus 50.67 xG / **43 gol** (2ª qualità occasioni ma pessima conversione), Roma 44.45 xG / 34 gol, Fiorentina −9/−13, Pisa −13.9 (ma retrocessa).
- **Sopra** (finalizzazione sopra la media → possibile calo): **Inter +13.3** (80 gol da 66.68 xG), Sassuolo.

### 4.P Portieri
| Giocatore | Squadra 26-27 | Dati chiave 25-26 | Segnale | Verdetto |
|---|---|---|---|---|
| **Svilar** | Roma (Gasperini) | 18 clean sheet, **77.5% parate**, 107 parate | 🟢 | Miglior portiere Serie A; para-rigori. Top affidabile |
| **Carnesecchi** | Atalanta (Sarri) | **78.1% parate (2°)**, 0.87 GA/90 (5°), 2 rig parati | 🟢 | Con Sarri (più controllo) resta élite. Migliore per FM |
| **Milinkovic-Savic V.** | Napoli (Allegri) | **3 rigori parati** (top) | 💎 contesto | **Con la difesa di Allegri (0.88 subiti) un portiere Napoli vale tanto**. Nodo ballottaggio Meret da sciogliere |
| **Maignan** | Milan (Amorim) | FM 5.84 | 🔻 contesto | Amorim offensivo → meno clean sheet; + voci mercato |
| Montipò | Hellas *(verificare cat.)* | 3 rigori parati | — | Specialista dischetto |

### 4.D Difensori
| Giocatore | Squadra 26-27 | Dati chiave 25-26 | Segnale | Verdetto |
|---|---|---|---|---|
| **Dumfries** | Inter (Chivu) | **npxG/90 ~0.9** (altissimo per un D), quinto offensivo | 🟢 | Macchina da bonus; oro col modificatore |
| **Dimarco** | Inter (Chivu) | Top reparto per gol+assist+piazzati | 🟢 | Certezza assoluta, primo investimento in difesa |
| **Cambiaso** | Juventus (Spalletti) | 2 gol 3 assist in **23** (limitato da infortuni) | 💎 | Esterno goleador; con Spalletti offensivo e se sano → bonus in crescita |
| **Angelino** | Roma (Gasperini) | Esterno da bonus nel sistema Gasp | ⚡/watch | Consacrazione possibile, ma **concorrenza Tsimikas**: verificare gerarchie |
| *(sistema)* | Roma (Gasperini) | 101 gol dai difensori nell'era Gasp | 💎 | Braccetti/esterni Roma (Wesley, Ndicka, Celik) candidati bonus a sorpresa |

### 4.C Centrocampisti
| Giocatore | Squadra 26-27 | Dati chiave 25-26 | Segnale | Verdetto |
|---|---|---|---|---|
| **Baturina** | Como (Fabregas) | **xA/90 0.34 (~98° pct)** ma solo 3 assist | 💎💎 | Crea da fuoriclasse, i compagni sprecano → **assist in arrivo, il vero sottovalutato** |
| **Koopmeiners** | Juventus (Spalletti) | 0 gol 0 assist in 22 (infortuni/panca) ma **1.12 xA** | 💎 | **Bounce-back**: era top all'Atalanta; se Spalletti gli ridà il ruolo da trequartista-gol, rimbalza |
| **Nico Paz** | Como (Fabregas) | 12 gol 6 assist; **npxG/90 0.51 (~98° pct)** | 🟢 | Non fortuna, dati solidi → acquisto sicuro (fulcro di Fabregas) |
| **Pulisic** | Milan (Amorim) | **xA/90 0.28 (~95° pct)**, 4 assist + gol | 🟢 | Creatore + finalizzatore élite; Amorim lo esalta |
| **Soulé** | Roma (Gasperini) | **xA/90 0.27 (~94° pct)**, ~5 assist, 7 gol | 💎 | Crea da top, compagni sprecano → assist in arrivo, sottovalutato |
| **McTominay** | Napoli (Allegri) | 10 gol, 3 assist, 33 pres | 🟢 | Doppia cifra dal centrocampo, sostenibile; centrale anche con Allegri |

### 4.A Attaccanti
| Giocatore | Squadra 26-27 | Dati chiave 25-26 | Segnale | Verdetto |
|---|---|---|---|---|
| **Thuram M.** | Inter (Chivu) | 13 gol, **npxG/90 0.64 (~99° pct)**, npxG 13.58 | 🟢 | Segna esattamente quanto crea → élite sostenibile |
| **Højlund** | Napoli (Allegri) | 12 gol, npxG/90 0.41, npxG 12.48, 60 tiri | 🟢 | In linea col suo xG, affidabile; riferimento di Allegri |
| **Krstović** | Atalanta (Sarri) | **npxG/90 0.63** (tra i top per-90) | 🟢 | Generatore di occasioni efficiente; buon valore se quota resta media |
| **Kean** | Fiorentina (Grosso) | Tra i leader npxG; Fiorentina −9/−13 come squadra | 💎 | Rigorista; **se la Fiore finalizza meglio, sale**. Rendimento suo già solido |
| **Lautaro** | Inter (Chivu) | Capocannoniere ma **+4.23 gol sopra xG** (max in A) | 🔻 cautela | Top vero, ma finalizzazione irripetibile: attendersi ~18-20, non 25 → non strapagare |
| **Yildiz** | Juventus (Spalletti) | 11 gol + 9 assist; Juve 2ª qualità occasioni ma mal finalizzata | 💎 | Gioiello 21 anni; con Spalletti e migliore conversione Juve → margini di crescita |
| **Camarda** | Lecce (Di Francesco) | 18 anni, **+44% potenziale al picco**, rigorista | ⚡ | La scommessa più intrigante: rigorista titolare giovanissimo |
| **Pio Esposito** | Inter (Chivu) | Giovane, primi gol in A | ⚡ | Upside alto, gerarchie Inter da capire |
| **Gonçalo Ramos** | Milan (Amorim), NEW | PSG: 6 gol ma xG 8.22 (sfortunato), npxG/90 0.51 in ~1300' | ⚡ | Nessuna FM in A; per-90 da titolare → potenziale alto se gioca |
| **Dovbyk** | Bologna (Tedesco), da Roma | 3 gol/14; xG/tiro 0.31 (7°) ma tiri in porta 7 vs 43 vs 58 (crollo) | contesto | Alla Roma 🔻; **al Bologna da titolare il giudizio si ribalta** → rivalutare col ruolo nuovo |

> **La macchina in azione:** conferma i top per dati (Thuram, Nico Paz, Svilar), scova i sottovalutati per
> regressione+ (**Baturina, Koopmeiners, Soulé, Cambiaso**), tempera le trappole (**Lautaro** overperformance),
> pesca i breakout (**Camarda, Gonçalo Ramos, Pio Esposito**) e ribalta i giudizi coi fatti di mercato (Dovbyk→Bologna).
> Tutto da numeri e fatti, zero opinioni.

---

## 5. TODO al 4 agosto (rebuild)
- [ ] Importare il listone ufficiale 2026-27 → set definitivo di giocatori, ruoli, **Id**, quotazioni.
- [ ] Rigenerare `data/kb.js` con nomi in formato "Cognome I." (matching esatto col listone).
- [ ] Coprire (quasi) tutti gli ownable, non solo i ~170 attuali.
- [ ] Applicare media pluriennale + stat avanzate (§4) + profili-allenatore (§2) + transfer (§3).
- [ ] Rigoristi post-mercato squadra per squadra.
- [ ] (Se usciti) calendario → difficoltà avversario per giornata nel DB.
- [ ] Valutare l'auto-rosa ottimale come nuova feature.
