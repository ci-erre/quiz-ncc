# Status: QuizNCC
Ultimo aggiornamento: 2026-09-08 10:40

## Stato attuale
Prima versione completa e pubblicata su GitHub Pages. Tutte le modalità funzionano,
giro completo verificato con Puppeteer senza errori JS, tema chiaro e scuro.

## Prossimi passi
1. Far provare l'app all'amico su telefono; raccogliere cosa manca
2. Dominio vero quando c'è (CNAME su Pages)
3. Eventuale contatore visite (GoatCounter) se interessa

## Bug noti
- Nessuno noto. I dati sono del 2019: se il questionario regionale è cambiato, l'xlsm va sostituito.

## Decisioni tecniche
- Web e non nativa: gli aspiranti NCC usano Android quanto iPhone, e il link non passa da store.
- Nessun backend: i progressi stanno in localStorage, un utente solo, non serve sync.
- Service worker "rete prima, cache se offline": un deploy arriva al primo ricaricamento online.
