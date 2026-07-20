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
| **Listone** | Tutti i giocatori con FM 2025-26, FM attesa, scheda dettaglio; import del listone ufficiale via copia-incolla |
| **Strategia** | Budget, slot e ripartizione crediti con preset |
| **Asta live** | Banco d'asta con verdetto del motore, max offerta, inflazione reale, undo |
| **Rosa** | Spesa per reparto vs piano, qualità rosa |
| **Formazione** | Titolari consigliati per modulo + difficoltà avversari |
| **Scambi** | Confronto FM attese di uno scambio |
| **Guida** | Strategie d'asta e spiegazione del motore |

## Il motore

La **FM attesa 2026-27** parte dalla fantamedia reale 2025-26 e la corregge per: minuti giocati, forza squadra/allenatore 2026-27, status di rigorista, età, infortuni, titolarità e incertezze di mercato.

## Aggiornare il database

Tutti i dati stanno in **`data/kb.js`** (il formato è documentato in testa al file). Per aggiornare il motore dopo una giornata o una sessione di mercato si modifica solo quel file — l'app non va toccata. I giocatori sono agganciati per *nome + ruolo*, quindi i dati personali dell'utente (voti, rosa, acquisti) sopravvivono a qualsiasi aggiornamento.

Modi per aggiornarlo:
1. **Chiedere a Claude** ("aggiorna il database FantaHQ"): ricerca web sulle ultime giornate/mercato e commit di `data/kb.js`.
2. **Routine programmata Claude** (agente cloud schedulato, es. ogni lunedì in stagione) che fa la stessa cosa in automatico.
3. **Manualmente**, seguendo il formato documentato nel file.

## Struttura

```
fantahq/
├── index.html      # l'app completa (HTML+CSS+JS, zero dipendenze)
├── data/
│   └── kb.js       # database giocatori/squadre — l'unico file da aggiornare
└── README.md
```

---
*Database aggiornato al: vedi `date` in `data/kb.js` (mostrata anche nell'app).*
