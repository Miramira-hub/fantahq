# Come aggiornare FantaHQ

Guida operativa per riprendere il lavoro in una sessione nuova.

## Struttura

```
fantahq/
├── index.html                     # l'app (HTML+CSS+JS, zero dipendenze)
├── data/
│   ├── kb.js                      # DATABASE USATO DALL'APP — generato, non modificare a mano
│   ├── listone-2026-27.json       # listone ufficiale convertito (fonte)
│   ├── understat-2025-26.json     # xG/xA/minuti reali 25-26 (fonte)
│   └── kb-2025-26-snapshot.js     # KB stagione precedente (fonte, immutabile)
├── tools/
│   ├── build-kb.mjs               # rigenera data/kb.js dalle fonti
│   ├── xlsx-to-json.mjs           # converte un .xlsx estratto in JSON
│   └── build-artifact.mjs         # genera la versione single-file per l'Artifact
└── research/pre-listone-2026-27.md  # metodologia, profili allenatore, log statistiche
```

## Aggiornare il listone (nuovo file da Fantacalcio.it)

L'utente scarica il file da **fantacalcio.it → Quotazioni → Scarica** (serve login).

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

## Dove si aggiornano i dati "di conoscenza"

Tutto dentro `tools/build-kb.mjs`:

| Cosa | Costante | Note |
|---|---|---|
| Note di mercato | `MERCATO_NOTE` | ha la precedenza su tutto, si aggiorna a ogni giro |
| Trattative aperte | `MERCATO_UNC` | 2 = futuro in bilico → "da monitorare"; azzerare a mercato chiuso |
| Probabili XI 2026-27 | `XI_STATUS` | T/B+/B-/R per giocatore; corregge la titolarità dai minuti vecchi |
| Infortunati attuali | `INJURY` | [giornate saltate, nota]; 4+ → inj=3, 2-3 → inj=2 |
| Minuti esteri nuovi | `EXTRA_US` | stesse colonne di understat; xG=gol dove non verificato (nessun segnale finto) |
| Rigoristi | `RIG` | 2 = primo, 1 = alternativa |
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

## Dopo ogni aggiornamento

1. `git add -A && git commit && git push` → il sito https://miramira-hub.github.io/fantahq/ si aggiorna da solo
2. Ripubblicare l'Artifact (stesso file, stesso URL)
3. Dire all'utente: **Ctrl+F5** e poi **🔄 Aggiorna al database** dal tab Listone
   (allinea l'elenco giocatori conservando rosa, prezzi pagati, voti e obiettivi)

## Verifiche da fare sempre

- `node --check data/kb.js` e caricamento reale (il generatore già valida l'output)
- Titolarità: nessun consigliato con poche presenze o da riserva
- Prezzi: la somma dei prezzi dei giocatori assegnati deve avvicinarsi a `budget × squadre`
- Aprire l'app e girare tutti i tab senza errori in console
