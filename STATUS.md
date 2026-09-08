# Status: QuizNCC
Ultimo aggiornamento: 2026-09-08 13:05

## Stato attuale
Pubblicata su GitHub Pages. Aggiunta la **simulazione della prova scritta di Milano**
(16 quiz 4+4+4+4, 30 minuti, soglia 12 e 2 per argomento) dopo aver verificato le regole
sulle fonti ufficiali. Le 845 domande non di lingua sono classificate per argomento.
Verificato con Puppeteer: composizione, le tre vie di bocciatura, tempo scaduto, zero errori JS.

Fatto il giro di frontend: identità visiva costruita sulle targhe milanesi e sulla mappa
del trasporto. Verificata a 390x844 in chiaro e scuro, e la logica ha ripassato tutti i test.

## Prossimi passi
1. Far provare l'app all'amico su telefono; raccogliere cosa manca
2. Dominio vero quando c'è (CNAME su Pages)
3. Eventuale contatore visite (GoatCounter) se interessa

## Bug noti
- Tedesco e spagnolo non sono nel file: chi sceglie quelle lingue non è coperto.
- Classificazione per argomento fatta a mano su un file che non la dichiara: qualche domanda
  di confine (aeroporti tra legislazione e regolamento) può stare nell'altro gruppo.
- I dati sono del 2019: tariffe aeroportuali e regolamento comunale possono essere invecchiati.

## Decisioni tecniche
- Web e non nativa: gli aspiranti NCC usano Android quanto iPhone, e il link non passa da store.
- Nessun backend: i progressi stanno in localStorage, un utente solo, non serve sync.
- Service worker "rete prima, cache se offline": un deploy arriva al primo ricaricamento online.
- In simulazione nessun riscontro dopo la risposta: l'esame vero non lo dà e non ammette correzioni.
  Il riscontro immediato resta in tutte le modalità di allenamento.
