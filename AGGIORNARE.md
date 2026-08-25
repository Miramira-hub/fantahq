# Come aggiornare FantaHQ

Guida operativa per riprendere il lavoro in una sessione nuova.

## Struttura

```
fantahq/
├── index.html                     # l'app (HTML+CSS+JS, zero dipendenze)
├── data/
│   ├── kb.js                      # DATABASE USATO DALL'APP — generato, non modificare a mano
│   ├── listone-2026-27.json       # listone ufficiale convertito (fonte)
│   ├── listone-2025-26.json       # listone stagione precedente: decide "nuovo acquisto"
│   ├── statistiche-2026-27.json   # STAGIONE IN CORSO: presenze, voti, gol di quest'anno
│   ├── statistiche-2025-26.json   # FONTE PRIMARIA: fantamedie ufficiali (aggancio per Id)
│   ├── statistiche-2024-25.json   # storico: traiettoria dei minuti
│   ├── statistiche-2023-24.json   # storico: controprova dell'analisi
│   ├── understat-2025-26.json     # xG/xA/minuti reali 25-26 (fonte)
│   └── kb-2025-26-snapshot.js     # KB stagione precedente (fonte, immutabile)
├── tools/
│   ├── build-kb.mjs               # rigenera data/kb.js dalle fonti
│   ├── backtest.mjs               # calibra i pesi del motore sui dati reali
│   ├── occasioni.mjs              # i colpi che il campo ha rivelato e il prezzo non ha recepito
│   ├── prova-download.mjs         # i rami del salvataggio file (link classico vs capacità Artifact)
│   ├── scovatore.mjs              # misura cosa predice le occasioni da pochi crediti
│   ├── xlsx-to-json.mjs           # converte un .xlsx estratto in JSON
│   └── build-artifact.mjs         # genera la versione single-file per l'Artifact
└── research/pre-listone-2026-27.md  # metodologia, profili allenatore, log statistiche
```

## Aggiornare il listone (nuovo file da Fantacalcio.it)

L'utente scarica il file da **fantacalcio.it → Quotazioni → Scarica** (serve login).
Allo stesso modo si scaricano le **Statistiche** di fine stagione: stesso convertitore,
destinazione `data/statistiche-<anno>.json`. Sono la fonte primaria delle fantamedie —
si agganciano per **Id ufficiale**, quindi senza alcun rischio di omonimia.

```bash
# 1) estrarre l'xlsx (è uno zip) e convertirlo
cd <cartella temporanea>
cp "<percorso>/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx" q.zip
mkdir qx && cd qx && unzip -o ../q.zip && cd ..
node "<repo>/tools/xlsx-to-json.mjs" qx > "<repo>/data/listone-2026-27.json"

# 2) rigenerare il database e la versione Artifact
cd <repo>
node tools/build-kb.mjs
node tools/build-artifact.mjs <percorso-output.html>
```

Prima di rigenerare, confrontare col listone precedente per vedere **nuovi / usciti / cambi
squadra / cambi ruolo / cambi quota**: sono le informazioni da cui parte la ricerca.

## Giro settimanale (in campionato)

Dopo ogni giornata, in quest'ordine:

1. **Scaricare le Statistiche** da fantacalcio.it (stesso posto delle Quotazioni) e
   convertirle in `data/statistiche-2026-27.json` con `tools/xlsx-to-json.mjs`.
   È il dato che fa vivere tutto il resto: presenze, voti, gol e assist di quest'anno.
2. **Riscaricare le Quotazioni**: durante la stagione cambiano ogni settimana, e sono anche
   il modo in cui i trasferimenti entrano nel database (un giocatore ceduto compare con la
   squadra nuova solo qui).
3. Aggiornare `INJURY` col bollettino del giorno e gli squalificati del giudice sportivo.
4. Correggere `XI_STATUS` con le **formazioni vere**, non con le probabili: una giornata
   giocata vale più di dieci articoli di agosto.
5. Scrivere il fatto della giornata in **`CAMPO_NOTE`** (non in `MERCATO_NOTE`): una riga per
   giocatore, si sovrascrive, non si accumula. È l'unica mappa di testo che va toccata durante
   la stagione.
6. `node tools/build-kb.mjs` · `node tools/occasioni.mjs` · `node tools/prova-schermate.mjs` ·
   pubblicare.

### Le note si aggiornano da sole

Dalla 1ª giornata in poi la nota di ogni giocatore si compone in quest'ordine:

| Pezzo | Da dove viene | Chi lo scrive |
|---|---|---|
| ⚕️ infermeria | `INJURY` | a mano, ogni giro |
| cosa dice il campo | `campoNote()` da `statistiche-2026-27.json` × `XI_STATUS` | **generato** |
| il fatto della giornata | `CAMPO_NOTE` | a mano, ogni giro |
| segnali storici xG e volume | Understat + statistiche 25-26 | **generato** |
| `· Ad agosto:` … | `MERCATO_NOTE` / `NOTE` filtrate | **generato** |

Due automatismi tolgono lavoro e impediscono che l'app racconti cose vecchie:

- **Il filtro `ripulisci()`** taglia dalle note d'asta, frase per frase, quello che i fatti
  hanno superato: probabili formazioni, amichevoli, l'attesa della 1ª giornata, e le frasi
  che inchiodano una quota (cambiano ogni settimana). Quel che resta va in coda, etichettato
  `· Ad agosto:`, così si legge come storia e non come stato attuale. `CAMPO_NOTE` non passa
  dal filtro: racconta le giornate giocate, non l'asta.
- **Gli acciacchi si spengono da soli**: una voce `INJURY` da 0 giornate su un giocatore che
  ha poi preso voto smette di stamparsi. Altrimenti l'app direbbe "in dubbio per la 1ª" di
  uno che la 1ª l'ha giocata.

Il testo generato è **prudente per costruzione**: dichiara sempre su quante giornate si basa,
e fantamedie e medie voto di quest'anno entrano nelle note **solo da 5 giornate in su**.
Sotto quella soglia una media è il racconto di un episodio.

## Trovare i colpi (`tools/occasioni.mjs`)

```bash
node tools/occasioni.mjs        # default: fino a 12 crediti
node tools/occasioni.mjs 20     # alza la soglia di prezzo
```

Legge `data/kb.js` — lo stesso database dell'app — e cerca lo **scarto fra quello che dice il
prezzo e quello che dice il campo**. Rifà la regressione `fm = a + b·ln(quota)` per ruolo sui
soli giocatori con fantamedia reale: chi rende sopra quella riga costa meno di quanto vale.
Quattro famiglie: titolari a due lire · subentranti che prendono voto · promossi
dall'infermeria (chi ha davanti un compagno di reparto fermo per 4+ giornate) · e le
**trappole**, chi era dato titolare e non si è ancora visto.

**Il limite, dichiarato anche dentro lo strumento.** `scovatore.mjs` ha misurato su tre
stagioni che "era già titolare l'anno prima" predice le esplosioni da pochi crediti (53%
contro il 19% medio). *"Ha giocato le prime giornate"* **non è stato misurato**: i file
storici contengono solo aggregati di stagione, non giornata per giornata, quindi quel
backtest non è possibile con i dati che abbiamo. È un indizio col campione dichiarato, non
un peso calibrato — e il motore lo tratta di conseguenza, con `PESO_CAMPO`.

**Come il campo corregge la stima.** La titolarità è la probabilità di prendere voto, e sul
campo si misura direttamente (presenze ÷ giornate). Il builder fonde la stima di agosto con
il dato reale usando un peso che cresce col campionato — `PESO_CAMPO = min(0.80, giornate/12)`.
Con una giornata sola pesa l'8%, alla quinta il 42%, dalla dodicesima in poi l'80%. Non
arriva mai al 100% perché le gerarchie cambiano anche a stagione inoltrata. Chi è
infortunato è escluso dalla correzione: l'assenza la sconta già `inj`, contarla due volte
lo affosserebbe.

## Calendario

`data/calendario-2026-27.json` è **generato e validato** da `tools/build-calendario.mjs`,
che legge un file grezzo con una riga per giornata nel formato
`numero|Casa-Trasferta,Casa-Trasferta,...` (20 squadre, 10 gare).

```bash
node tools/build-calendario.mjs <file-grezzo>
```

Il builder **rifiuta** un calendario che non sia coerente: 38 giornate numerate senza buchi,
10 gare e 20 squadre distinte per giornata, 19 partite in casa e 19 in trasferta per ogni
squadra, 190 accoppiamenti ciascuno esattamente due volte e mai due volte in casa dello
stesso. Un calendario sbagliato manderebbe fuori strada *tutte* le formazioni della stagione,
quindi meglio un errore rumoroso che un dato plausibile.

Il file finisce dentro `data/kb.js` (campo `calendario`), così arriva anche nella versione
single-file dell'Artifact. Da lì l'app calcola la **difficoltà del turno per ruolo**:
un attaccante teme la difesa avversaria, un difensore l'attacco, e giocare in casa vale
circa un terzo di livello (`CAMPO` in index.html).

## Dove si aggiornano i dati "di conoscenza"

Tutto dentro `tools/build-kb.mjs`:

| Cosa | Costante | Note |
|---|---|---|
| Fatti della giornata | `CAMPO_NOTE` | **l'unica da toccare in stagione**: una riga per giocatore, si sovrascrive. Non passa dal filtro e non viene retrocessa |
| Note di mercato | `MERCATO_NOTE` | il testo d'asta: da qui in poi viene filtrato e messo in coda dietro `· Ad agosto:` |
| Trattative aperte | `MERCATO_UNC` | 2 = futuro in bilico → "da monitorare"; azzerare a mercato chiuso |
| Probabili XI 2026-27 | `XI_STATUS` | T/B+/B-/R per giocatore; corregge la titolarità dai minuti vecchi |
| Infortunati attuali | `INJURY` | [giornate saltate, nota]; 4+ → inj=3, 2-3 → inj=2 |
| Minuti esteri nuovi | `EXTRA_US` | stesse colonne di understat; xG=gol dove non verificato (nessun segnale finto) |
| Rigoristi | `RIG` | 2 = primo, 1 = alternativa. **Non c'è eredità dallo storico**: chi non è in mappa non tira rigori, quindi la mappa va tenuta completa per tutte e 20 le squadre |
| Gerarchie portieri | `GK_RANK` | serve come spareggio: quota e FVM spesso non distinguono |
| Cambi di ruolo | `ROLE_CHANGE` | senza questa mappa un giocatore che cambia ruolo perde lo storico |
| Squadre e allenatori | `TEAMS` | rating attacco/difesa + profilo tecnico |
| Insight statistici | `NOTE` | segnali xG/xA per giocatore |

Il builder VALIDA i nomi di tutte le mappe contro il listone: un nome scritto male viene
segnalato a console (⚠️) invece di perdersi in silenzio.

### Pesi del motore (index.html, `expFM`)

Calibrati con `node tools/backtest.mjs` sul 2025-26 (quota pre-stagione vs produzione reale
Understat). Se si cambiano i pesi, rifare girare il backtest e verificare i residui.
Il campo `xgd` (19° della riga kb) è la correzione di regressione xG calcolata dal builder:
entra direttamente nella FM attesa. Il prezzo suggerito fonde FVM di mercato (55%) e
valore VORP (45%, entro ±25%): il VORP distribuisce i crediti dello split per ruolo in
proporzione al rendimento sopra l'ultimo titolare disponibile.

I segnali 💎 / 🔻 / ⚡ nelle note sono **generati automaticamente** dal confronto tra gol e xG
(totale, non npxG: escluderebbe i rigori e falserebbe i rigoristi).

## Giro pre-asta (checklist)

Da fare la mattina dell'asta, nell'ordine:

1. **Situazioni di mercato aperte** — sono quelle con `MERCATO_UNC >= 2`: chi si è chiarito
   va tolto dall'incertezza o segnato come uscito.
2. **Infortuni** — aggiornare `INJURY` con i bollettini del giorno (fantacalcio.it/infortunati,
   sosfanta, tuttofantacalcio): contano soprattutto i dubbi per la 1ª giornata.
3. **Ultime amichevoli** — le formazioni del fine settimana sciolgono i ballottaggi `B+`/`B-`
   ancora aperti in `XI_STATUS`.
4. **Ufficialità dell'ultima ora** — i nuovi arrivi non presenti nel listone cambiano comunque
   le gerarchie di chi c'è: annotarlo in `MERCATO_NOTE`.
5. Rigenerare, verificare, pubblicare (sotto).

## Le tre superfici, e i download

L'app gira su tre superfici e il salvataggio dei file non funziona allo stesso modo:

| Superficie | Come consegna un file |
|---|---|
| sito e `index.html` in locale | `<a download>` con un blob:, il modo classico |
| Artifact | quel link è **inerte** — il visualizzatore non concede mai a una pagina il permesso di scaricare, blob: e data: compresi. Serve la capacità `downloads`, che mostra una conferma all'utente e **può essere rifiutata** |

`downloadFile()` in `index.html` prova prima la capacità e ripiega sul link, così lo stesso
file serve tutte e tre le superfici. Tre dettagli che non si indovinano:

- **`.csv` sta nell'elenco esteso** delle estensioni ammesse e può non essere abilitato per
  una vista: in quel caso si riprova in `.txt` (sempre ammesso). Il contenuto è identico,
  cambia solo il nome, e il file resta importabile rinominandolo.
- **Il messaggio di riuscita viaggia col file.** Dentro l'Artifact il salvataggio passa da
  una conferma: annunciare "scaricato" al clic sarebbe una bugia se l'utente rifiuta.
- **Un rifiuto non si ripropone.** Si riprova solo quando l'estensione non è abilitata, che
  è una regola della vista, non una decisione di chi guarda.

Quando si ripubblica l'Artifact **va passata la capacità**: `capabilities: {downloads: true}`.
Ometterla in un redeploy la conserva; passare `{}` la cancella e i download tornano rotti.

```bash
node tools/prova-download.mjs
```

Esegue `downloadFile` su entrambe le meccaniche e sui casi storti: estensione non abilitata,
utente che rifiuta, capacità non servita, `use()` che esplode. `prova-schermate.mjs` non li
copre — verifica che le schermate si disegnino, non che un file venga consegnato.

## Dopo ogni aggiornamento

1. `git add -A && git commit && git push` → il sito https://miramira-hub.github.io/fantahq/ si aggiorna da solo
2. Ripubblicare l'Artifact **allo stesso indirizzo**, altrimenti se ne crea uno nuovo e
   l'utente perde il link che ha salvato:
   `https://claude.ai/code/artifact/2a71bd11-d815-46e2-b44f-3ebf9cff9c2c`
   (generare il file con `node tools/build-artifact.mjs <out.html>` e pubblicarlo passando
   quell'URL come parametro `url`)
   **e passando `capabilities: {downloads: true}`**, altrimenti le esportazioni si rompono
3. Dire all'utente: **Ctrl+F5** e poi **🔄 Aggiorna al database** dal tab Impostazioni
   (allinea l'elenco giocatori conservando rosa, prezzi pagati, voti e obiettivi)

## Verifiche da fare sempre

- `node --check data/kb.js` e caricamento reale (il generatore già valida l'output)
- Titolarità: nessun consigliato con poche presenze o da riserva
- Prezzi: la somma dei prezzi dei giocatori assegnati deve avvicinarsi a `budget × squadre`
- `node tools/prova-schermate.mjs` e `node tools/prova-download.mjs` verdi
- Aprire l'app e girare tutti i tab senza errori in console
