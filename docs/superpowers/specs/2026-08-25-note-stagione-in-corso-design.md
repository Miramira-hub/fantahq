# Note sulla stagione in corso e cercatore di colpi

**Data:** 25 agosto 2026 — siamo alla 2ª giornata, la 1ª è stata giocata.

## Il problema

I dati della stagione 2026-27 entrano nel **motore** ma non nel **testo**.

`build-kb.mjs` legge `data/statistiche-2026-27.json` in `ST_ORA` e lo usa per due cose:
correggere la titolarità (`tit`, fuso con `PESO_CAMPO = min(0.80, giornate/12)`) e riempire
le colonne 21-25 della riga kb (`pvOra, golOra, assOra, fmOra, mvOra`). Poi si ferma.

La nota di ogni giocatore è invece `[injNote, baseNote, signal]`, dove:

- `injNote` viene da `INJURY`, scritta a mano, con frasi tarate sull'attesa della 1ª giornata
  ("in dubbio per la 1ª", "atteso per la 1ª", "nel derby amichevole");
- `baseNote` viene da `MERCATO_NOTE` (229 voci) o `NOTE` (36 voci), scritte fra il 6 e il 12
  agosto con la cornice dell'asta addosso;
- `signal` è generato, ma **solo dal 2025-26**: Understat (xG, xA, tiri, passaggi chiave) e
  statistiche ufficiali dell'anno scorso (media voto, cartellini, dischetto, traiettoria).

Risultato misurato sul `kb.js` attuale: 282 giocatori hanno una nota, 20 parlano ancora di
amichevoli o di asta, e decine dicono "titolare nelle probabili" di gente che una partita
vera l'ha già giocata. Dragusin ha giocato la 1ª e la sua nota dice "titolare nelle
probabili della Fiorentina". Malen ha fatto tripletta e la sua nota parla di un attacco
influenzale che gli avrebbe potuto far saltare la 1ª.

`XI_STATUS`, `INJURY`, `MERCATO_UNC` e il listone **sono già aggiornati** alla 1ª giornata
(commit `34b0e07`, 29 valutazioni corrette sulle formazioni vere). Manca solo il testo.

## Vincoli

1. **A settembre si rifà un'asta completa** a mercato chiuso. La cornice d'asta non è morta:
   torna, e i "colpi giusti" sono il deliverable che conta.
2. **La prossima scansione di notizie a mano è a fine gennaio**, alla chiusura del mercato di
   riparazione. Quindi da qui a gennaio tutto quello che cambia settimana per settimana deve
   uscire **dai file di dati**, senza riscrittura a mano.
3. **Una sola giornata giocata.** Ogni media di quest'anno è rumore. Il testo può riportare
   fatti, non trarre conclusioni.
4. **Presenza non è titolarità.** Nelle statistiche ufficiali `Pv` conta chi ha preso voto,
   subentrati compresi. L'informazione su chi è *partito* titolare sta solo in `XI_STATUS`,
   curata a mano sulle formazioni vere. Il testo deve dire "ha preso voto" / "è stato in
   campo", mai "è partito titolare", a meno che non sia `XI_STATUS` a dirlo.

## Cosa si costruisce

### 1. `campoNote()` — blocco della stagione in corso (`tools/build-kb.mjs`)

Genera il testo dai dati di quest'anno incrociando `ST_ORA`, `XI_STATUS`, `INJURY` e
`GIORNATE`. Esce **in testa** alla nota, subito dopo `injNote`.

Al massimo una frase di **stato** più una di **produzione**.

Stato (la prima che si applica vince):

| Condizione | Testo |
|---|---|
| `XI = T`, `pv = GIORNATE` | `🟢 Confermato dal campo: in campo in tutte e N le giornate.` |
| `XI` riserva (`R`/`B-`), `pv >= 1` | `🔥 Promosso dal campo: dato riserva ad agosto, ha già preso voto N volte su M.` |
| `XI = T`, `pv = 0`, `inj < 2` | `⚠️ Dato titolare ma non ha ancora preso voto: gerarchia da verificare.` |
| `0 < pv < GIORNATE` | `🔄 N presenze su M: rotazione, non titolare fisso.` |

Produzione:

- gol e assist di quest'anno, come conteggio;
- **rigori calciati quest'anno** (`rplus`/`rminus` di `ST_ORA`): confermano la gerarchia dal
  dischetto meglio di qualunque fonte di agosto;
- media voto e fantamedia di quest'anno **solo da `GIORNATE >= 5`**, mai prima.

Sotto le 4 giornate ogni riga di produzione porta con sé la dichiarazione del campione:
"su N giornate è un fatto, non ancora una tendenza".

### 2. Filtro automatico e retrocessione delle note d'asta

Le 265 voci a mano restano nel builder (servono a settembre e la fonte è quella), ma passano
da un filtro che lavora **per frase**, non per voce. Si scarta una frase se contiene un
marcatore di cornice pre-stagione:

- probabili: `nelle probabili`, `probabili formazioni`, `formazioni tipo`, `XI probabile`
- amichevoli: `amichevol`, `Perth`, `precampionato`, `ritiro`
- attesa della 1ª: `per la 1ª`, `in dubbio fino alla`, `prima dell'asta`, `verifica prima`
- prezzi inchiodati: `a quota <numero>`, `quota <numero>` — col listone del 25 agosto sono
  cambiate 85 quote, e l'app mostra comunque quella viva

Quel che resta è contesto ancora valido (chi tira i rigori per decisione dell'allenatore, da
dove arriva un giocatore, profilo xG) e viene **retrocesso in coda** alla nota, dietro il
prefisso `· Ad agosto:` così si legge come storia e non come stato attuale. Se dopo il filtro
non resta nulla, la voce sparisce.

**Infortuni spenti.** Se `INJURY[nome][0] === 0` (acciacco senza giornate di stop) e il
giocatore ha già preso voto quest'anno, `injNote` non si stampa: il dubbio si è sciolto sul
campo. È la regola che si mantiene da sola fino a gennaio.

### 3. `tools/occasioni.mjs` — il cercatore di colpi

Report a console sullo stile di `scovatore.mjs` e `backtest.mjs`: legge `data/kb.js` e le
mappe del builder, non tocca l'app. Ordina per **scarto fra quello che dice il campo e quello
che dice il prezzo**, in quattro famiglie:

1. **Titolare a due lire** — quota bassa, `XI = T`, presente in tutte le giornate. È il
   profilo che `scovatore.mjs` ha già misurato come il più affidabile (53% di riuscita contro
   il 19% medio).
2. **Promosso dal campo** — ad agosto era dato riserva, il campo lo sta usando.
3. **Promosso da un infortunio** — ha davanti un compagno di reparto con `INJURY >= 4`
   giornate (Bowie con Pinamonti fuori).
4. **Trappole** — dato titolare e non ancora visto in campo: da non pagare a settembre.

Per ciascuno: ruolo, nome, squadra, quota, FM attesa, il dato di campo e il motivo in una riga.

### 4. Due tag nel Listone (`index.html`)

Calcolati dai campi già presenti in `KBI`, nessun dato nuovo da caricare, visibili solo se
`GIORNATE_GIOCATE > 0`:

- `Confermato dal campo` (buono) — presente in tutte le giornate finora
- `Non ancora visto` (cattivo) — `tit >= 70`, `pvOra = 0`, non infortunato

Entrambi filtrabili, in `TAGS_MORE`.

## Il limite, dichiarato

`scovatore.mjs` ha misurato su tre stagioni che "era già titolare l'anno prima" predice le
esplosioni da pochi crediti (53% contro 19% medio). **"Ha giocato la 1ª giornata" non è stato
misurato**: i file storici contengono solo aggregati di stagione, non giornata per giornata,
quindi non esiste il dato per fare quel backtest.

Perciò il blocco campo è un **indizio col campione dichiarato**, non un peso calibrato, e il
testo lo dice apertamente. Il motore continua a trattarlo con la prudenza che aveva già:
`PESO_CAMPO` vale 0.08 alla 1ª giornata e 0.33 alla 4ª. All'asta di settembre saranno 3-4
giornate: l'indizio sarà più solido, ma resta un indizio.

## Come si verifica

- `node tools/build-kb.mjs` senza avvisi ⚠️ nuovi, `node --check data/kb.js`
- nessuna nota contiene più `amichevol`, `nelle probabili`, `prima dell'asta`
- i giocatori con nota infortunio da 0 giornate che hanno giocato non hanno più il ⚕️
- `node tools/occasioni.mjs` elenca almeno una voce per famiglia
- `node tools/prova-schermate.mjs` verde su tutte e 10 le schermate
