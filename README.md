# ⚽ FantaHQ — Centro decisioni Fantacalcio

Dashboard completa per dominare le aste di fantacalcio Serie A: motore di consigli basato su dati reali, asta live, gestione rosa, formazione e scambi.

## Come si usa

**Online:** https://miramira-hub.github.io/fantahq/ — sempre aggiornato a ogni push, apribile e "installabile" sul telefono.

**Offline:** apri **`index.html`** nel browser (doppio clic): nessuna installazione, nessun server.

I tuoi dati (leghe, voti, obiettivi, rosa, acquisti) restano salvati solo nel tuo browser (localStorage): nessuno li vede, nemmeno con il sito pubblico. Per passarli da PC a telefono usa il **codice di sincronizzazione** nel tab Listone.

## Cosa fa

| Tab | Funzione |
|-----|----------|
| **Consigli** | Il motore classifica ogni giocatore: *Da prendere / Obiettivo / Scommessa / Usato sicuro / Da monitorare / Da evitare* |
| **Listone** | Tutti i giocatori con FM 2025-26, FM attesa, prezzo atteso e tetto d'asta; filtri per ruolo, squadra e **tag** (Rigorista, Titolare fisso, Attacco top…); import del listone ufficiale (.xlsx o copia-incolla) |
| **Strategia** | Budget, slot e ripartizione crediti; **rosa ideale** (il piano che sta nel budget) e **obiettivi automatici** con tetti d'asta |
| **Asta live** | Banco d'asta con verdetto del motore, max offerta, inflazione reale, undo |
| **Rosa** | Spesa per reparto vs piano, qualità rosa |
| **Formazione** | Titolari consigliati per modulo + difficoltà avversari |
| **Scambi** | Confronto FM attese di uno scambio |
| **Guida** | Strategie d'asta e spiegazione del motore |

## Il motore

**FM attesa 2026-27** — parte dalla **fantamedia ufficiale** 2025-26 (statistiche
Fantacalcio.it, agganciate per Id: 330 giocatori su 493 hanno il dato vero, per gli altri
una stima da regressione) e la corregge per: minuti giocati, forza squadra/allenatore,
rigoristi, età, infortuni, titolarità, incertezze di mercato e **regressione xG** (chi ha
segnato sopra le proprie occasioni attese viene scontato, chi ha raccolto meno di quanto
creato viene premiato). Le soglie e i pesi non sono a sensazione: sono calibrati sui
percentili reali con `tools/backtest.mjs`.

**Occasioni da pochi crediti** — `tools/scovatore.mjs` misura su tre stagioni cosa predice
davvero le esplosioni sotto i 10 crediti. Risultato: conta quasi solo **quanto giocava già**
(era titolare → 53% di riuscita contro il 19% medio; mai visto in Serie A → 8%), mentre il
mito "media voto alta e poco spazio" non regge. Da qui i tag **Occasione affidabile** e
**Mai in campo in A** nel Listone.

**Titolarità** — dai minuti realmente giocati, corretti con le **probabili formazioni 2026-27**
di tutte le 20 squadre e con gli **infortuni** in corso. Un titolare altrove che qui parte
riserva viene declassato, e viceversa.

**Prezzo atteso** — non la quota del listone, ma quanto andrà via davvero al tavolo: parte dal
FVM ufficiale riproporzionato sui crediti in circolazione nella tua lega (budget × squadre),
fuso con il **VORP** (quanto rende più dell'ultimo titolare disponibile) e corretto per
l'inflazione reale misurata durante la tua asta.

**Tetto d'asta** — il punto di indifferenza, non una percentuale fissa:

> tetto = prezzo del piano B + (quanto è più forte di lui) × (crediti per punto di FM nel reparto)

Oltre quella cifra conviene mollare, prendere l'alternativa e tenersi la differenza. Il tetto
può risultare **sotto** il prezzo atteso: significa che a prezzo di mercato quel giocatore, per
la tua ripartizione, non conviene. Si adatta ai crediti che ti restano: se hai risparmiato si
alza, se hai speso troppo si abbassa, e non supera mai quello che puoi davvero offrire. In ogni
scheda è spiegato in chiaro da dove esce il numero.

## Aggiornare il database

Le fonti stanno in `data/`, il database usato dall'app è **`data/kb.js`** — **generato**, non si
modifica a mano. Si rigenera con `node tools/build-kb.mjs`; le mappe da aggiornare a ogni giro
(mercato, probabili formazioni, infortuni, rigoristi) sono in testa a quel file e il builder
**valida i nomi** contro il listone, segnalando i refusi invece di perdere i dati in silenzio.

Procedura completa (nuovo listone, ricerca, verifiche, pubblicazione): **[AGGIORNARE.md](AGGIORNARE.md)**.

I giocatori sono agganciati per *nome + ruolo*, quindi rosa, voti e obiettivi sopravvivono a
qualsiasi aggiornamento: basta premere **🔄 Aggiorna al database** dal tab Listone.

Modi per aggiornarlo:
1. **Chiedere a Claude** ("aggiorniamo FantaHQ"): ricerca web su mercato/formazioni/infortuni e commit.
2. **Routine programmata Claude** (agente cloud schedulato, es. ogni lunedì in stagione).
3. **Manualmente**, seguendo AGGIORNARE.md.

## Struttura

```
fantahq/
├── index.html                     # l'app (HTML+CSS+JS, zero dipendenze)
├── data/
│   ├── kb.js                      # database usato dall'app — GENERATO, non modificare
│   ├── listone-2026-27.json       # listone ufficiale convertito (fonte)
│   ├── understat-2025-26.json     # xG/xA/minuti reali 25-26 (fonte)
│   └── kb-2025-26-snapshot.js     # KB stagione precedente (fonte, immutabile)
├── tools/
│   ├── build-kb.mjs               # rigenera data/kb.js dalle fonti
│   ├── backtest.mjs               # calibra i pesi del motore sul 2025-26
│   ├── xlsx-to-json.mjs           # converte l'xlsx delle quotazioni in JSON
│   └── build-artifact.mjs         # genera la versione single-file per l'Artifact
├── research/                      # metodologia e log delle statistiche
├── AGGIORNARE.md                  # guida operativa per gli aggiornamenti
└── README.md
```

---
*Database aggiornato al: vedi `date` in `data/kb.js` (mostrata anche nell'app).*
