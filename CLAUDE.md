# QuizNCC

Webapp statica per prepararsi all'esame di iscrizione al ruolo conducenti taxi/NCC
(Camera di Commercio di Milano). Fatta per un amico di Carlo; un solo utente.

## Stack

- **Piattaforma**: browser mobile (iPhone e Android), installabile come PWA
- **Hosting**: GitHub Pages, repo pubblico `ci-erre/quiz-ncc` → https://ci-erre.github.io/quiz-ncc/
- Vanilla HTML/CSS/JS, nessun build, nessun server, nessun account

## Struttura

QuizNCC/
├── index.html · style.css · app.js   la app (router a hash, viste come funzioni)
├── manifest.webmanifest · sw.js      PWA e cache offline
├── data/*.json                       quesiti estratti (domande, percorsi, confluenze, cosadove)
├── tools/estrai.py                   xlsm → JSON, con le correzioni a mano
├── tools/quiz-ccia-milano-2019.xlsm  sorgente originale (ed. 22/11/2019)
└── icons/                            PNG 180/192/512 generate con uno snippet PIL

## L'esame vero (Citta Metropolitana di Milano)

Prova scritta: **16 quiz** a 3 opzioni, **30 minuti**, quattro argomenti da 4 domande:
geografia della Lombardia · legislazione nazionale/regionale e disciplina aeroportuale ·
regolamento del Comune di Milano · **lingua straniera a scelta** (inglese, francese, tedesco,
spagnolo) livello **A2**. Si passa con **12 su 16 e almeno 2 per ogni argomento**.
Omessa risposta o correzione = errore. Poi orale su toponomastica di Milano e dei comuni
sopra i 50.000 abitanti, e **itinerari di collegamento**: sono i percorsi del file.
Fonte: Programma d'esame e Notizie utili della Citta Metropolitana, agg. 15/01/2026;
L.R. 6/2012 art. 25 come riscritto dalla L.R. 2 del 29/01/2026.

## Funzionalita

- **Simulazione d'esame**: 16 quiz 4+4+4+4, timer 30 minuti, esito con la regola dei 2 per argomento.
  Nessun riscontro durante la prova: si tocca e si va avanti, come all'esame.
- Allenamento per argomento (geografia, legislazione, regolamento, lingua), misto, errori, mai viste
- Lingua scelta dalla home (inglese o francese: tedesco e spagnolo non sono nel file)
- Percorsi: studio passo passo e verifica "qual è la prossima via" fra tre
- Flashcard confluenze e cosa/dove (entrambe le direzioni)
- Statistiche in localStorage: simulazioni superate, riuscita per argomento, andamento, copertura

## Sistema visivo

Riferimenti: le **targhe stradali** di Milano (capitali nere su smalto bianco) e la **mappa
del trasporto** (l'itinerario disegnato come una linea di fermate, con i capolinea ad anello).

| Ruolo | Valore |
|---|---|
| Fondo | `#e7e8ea` intonaco grigio freddo |
| Superfici | `#ffffff` smalto |
| Testo | `#000000` nero pieno, non un nero tinto |
| Errore, bocciatura | `#c8102e` rosso dello stemma di Milano |
| Sezioni d'esame | geo verde, leg blu, reg ocra, lingua viola: filetto di 4px |

- **Archivo** per l'interfaccia, **Bodoni Moda** per i nomi delle vie e i titoli dei percorsi.
  Offline ricade su Bodoni 72 / Didot, che su Apple sono di sistema.
- Le **capitali sono riservate ai nomi delle vie**: sono le targhe. Titoli e liste in tondo.
- Nessun raggio di curvatura, nessuna ombra: le superfici sono placche, non carte.
- Regole tenute: niente etichette maiuscole sopra i titoli, niente numeri d'ordine dove non
  c'è una sequenza, una sola animazione (la via che compare quando la scopri).

## Note Specifiche

- Nell'xlsm la X in colonna A è la risposta dell'ultimo utente, NON quella esatta: l'esatta è `ok` in colonna Y.
- Domanda 786 ha due `ok` nel foglio: override in `estrai.py`.
- Domande 869-949 inglese, 950-977 francese. Campo `t` nel JSON = argomento (`geo`/`leg`/`reg`/`en`/`fr`),
  assegnato da `tools/temi.py`: regole a parole chiave piu una tabella OVERRIDE decisa a mano
  rileggendo tutte le 845 domande. Ricontrollare gli OVERRIDE se si cambia il classificatore.
- Deploy: cambiare `VERSION` in `sw.js`, commit, push. Pages pubblica da `main` in 1-2 minuti.
- Verifica visiva: `python3 -m http.server 8765` + script Puppeteer a 390×844 (vedi memoria).
