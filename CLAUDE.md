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

## Funzionalita

- Simulazione 30 domande, ripasso errori, domande mai viste, inglese, francese
- Percorsi: studio passo passo e verifica "qual è la prossima via" fra tre
- Flashcard confluenze e cosa/dove (entrambe le direzioni)
- Statistiche in localStorage: prove, andamento, copertura, domande più sbagliate

## Note Specifiche

- Nell'xlsm la X in colonna A è la risposta dell'ultimo utente, NON quella esatta: l'esatta è `ok` in colonna Y.
- Domanda 786 ha due `ok` nel foglio: override in `estrai.py`.
- Domande 869-949 inglese, 950-977 francese: campo `lang` nel JSON.
- Deploy: cambiare `VERSION` in `sw.js`, commit, push. Pages pubblica da `main` in 1-2 minuti.
- Verifica visiva: `python3 -m http.server 8765` + script Puppeteer a 390×844 (vedi memoria).
