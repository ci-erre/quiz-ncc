// app.js — QuizNCC
//
// Webapp statica per prepararsi all'esame di iscrizione al ruolo conducenti taxi/NCC
// della Città Metropolitana di Milano. Dati in data/*.json, progressi in localStorage.
// Navigazione a hash: #/esame, #/quiz, #/geo, #/leg, #/reg, #/lingua, #/errori, #/nuove,
// #/percorsi, #/percorso/12, #/confluenze, #/cosadove, #/stats.

'use strict';

const N_QUIZ = 30;
const STORE_KEY = 'quizncc.v1';
// Prova scritta di Milano: 16 quiz, 4 per argomento, 30 minuti, si passa con 12 e almeno 2 per argomento.
const ESAME = { perTema: 4, minuti: 30, minTot: 12, minTema: 2, temi: ['geo', 'leg', 'reg', 'lingua'] };
const TEMA = { geo: 'Geografia', leg: 'Legislazione', reg: 'Regolamento comunale', en: 'Inglese', fr: 'Francese' };
const MODO = { esame: 'Prova d\'esame', quiz: 'Tutto misto', errori: 'Ripasso degli errori', nuove: 'Domande nuove',
  geo: 'Geografia', leg: 'Legislazione', reg: 'Regolamento comunale', lingua: 'Lingua' };
const CLASSE = { geo: 'sez-geo', leg: 'sez-leg', reg: 'sez-reg', en: 'sez-lin', fr: 'sez-lin' };
const DB = {};
let ST = loadState();
let SESSION = null;
let TIMER = null;

// ---------- Stato persistente ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { sessions: s.sessions || [], q: s.q || {}, p: s.p || {}, f: s.f || {}, lang: s.lang || 'en' };
  } catch (e) { return { sessions: [], q: {}, p: {}, f: {}, lang: 'en' }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch (e) { /* quota o navigazione privata: si continua senza memoria */ } }
function stat(map, key) { return map[key] || (map[key] = { seen: 0, ok: 0, wrong: 0 }); }
function addSession(mode, tot, ok, extra) {
  ST.sessions.push({ t: Date.now(), mode, tot, ok, ...(extra || {}) });
  if (ST.sessions.length > 500) ST.sessions.splice(0, ST.sessions.length - 500);
  save();
}

// ---------- Utilità ----------
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pct(ok, tot) { return tot ? Math.round(100 * ok / tot) : 0; }
function fmtDate(t) { return new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); }
function mmss(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function render(html) { document.getElementById('app').innerHTML = html; window.scrollTo(0, 0); }
function on(sel, ev, fn) { document.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn)); }
function go(hash) { location.hash = hash; }
function temaDi(d) { return d.t === 'en' || d.t === 'fr' ? 'lingua' : d.t; }
function nomeTema(t) { return t === 'lingua' ? TEMA[ST.lang] : TEMA[t]; }
function stopTimer() { if (TIMER) { clearInterval(TIMER); TIMER = null; } }
// I titoli dei percorsi nel file sono tutti in maiuscolo e portano "(1 SOLUZIONE)" in coda.
// Qui diventano leggibili: nome in tondo, e la soluzione come nota a parte.
const MINUSCOLE = new Set(['di','del','della','dello','dei','degli','delle','da','dal','dalla','a','al','allo','alla','ai','agli','alle','e','ed','in','nel','nella','su','sul','per','con','il','lo','la','i','gli','le','un','uno','una']);
const SIGLE = new Set(['SS','SP','MM','FS','FNM','IEO','ATM','S.','II','III','IV','VI','VII','VIII','IX','XI','XII','XX','XXII','XXIV','XXV']);
const ABBR = { 'V.LE': 'V.le', 'P.ZA': 'P.za', 'P.LE': 'P.le', 'C.SO': 'C.so' };
function parola(w, primo) {
  if (!/[a-zà-ÿ]/i.test(w)) return w;
  const up = w.toUpperCase();
  if (ABBR[up]) return ABBR[up];
  if (SIGLE.has(up)) return up;
  const low = w.toLowerCase();
  if (!primo && MINUSCOLE.has(low)) return low;
  return low.replace(/^([a-zà-ÿ]+)('|’)?([a-zà-ÿ]*)/i, (m, a, ap, b) =>
    ap ? a + ap + (b ? b.charAt(0).toUpperCase() + b.slice(1) : '')
       : a.charAt(0).toUpperCase() + a.slice(1)) + w.slice(low.length);
}
function titola(s) {
  return s.split(/(\s*[–-]\s*)/).map(seg => {
    if (/^\s*[–-]\s*$/.test(seg)) return ' – ';
    let primo = true;
    return seg.trim().split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : (r => (primo = false, r))(parola(w, primo))).join('');
  }).join('');
}
function nomePercorso(p) {
  const m = p.titolo.match(/^(.*?)\s*\((\d)\s*SOLUZIONE\)\s*$/i);
  return m ? { nome: titola(m[1]), nota: `soluzione ${m[2]}` } : { nome: titola(p.titolo), nota: '' };
}
function caselle(marks, mini) {
  return `<span class="caselle${mini ? ' mini' : ''}">${marks.map(m => `<i class="casella ${m ? 'si' : 'no'}"></i>`).join('')}</span>`;
}

// ---------- Home ----------
function viewHome() {
  const conta = t => DB.domande.filter(d => d.t === t).length;
  const sbagliate = Object.values(ST.q).filter(s => s.wrong > 0).length;
  const nuove = DB.domande.length - Object.keys(ST.q).length;
  const provati = Object.values(ST.p).filter(s => s.seen > 0).length;
  const esami = ST.sessions.filter(s => s.mode === 'esame');
  const ultimo = esami[esami.length - 1];
  const marks = ultimo && ultimo.marks ? ESAME.temi.flatMap(t => ultimo.marks[t] || []) : null;
  render(`
    <section class="prova">
      <h2>Prova d'esame</h2>
      <p class="quando">16 domande in 30 minuti, quattro per argomento. Si passa con dodici risposte esatte e almeno due per argomento.</p>
      ${marks ? `<div class="esito-scorso">${caselle(marks, true)}
        <span class="small">Ultima prova: ${ultimo.ok} su 16, ${ultimo.pass ? 'superata' : 'non superata'}.</span></div>` : ''}
      <button id="inizia">Inizia la prova</button>
    </section>

    <h2>Allenamento</h2>
    <div class="righe">
      ${[['geo', 'Geografia', 'Statali, laghi, valli, abitanti, monumenti'],
         ['leg', 'Legislazione', 'Legge 21/92, leggi regionali, aeroporti'],
         ['reg', 'Regolamento comunale', 'Doveri in servizio, turni, tariffe, controlli']]
        .map(([k, nome, sub]) => `<a class="riga sez ${CLASSE[k]}" href="#/${k}">
          <span class="tit">${nome}<span class="sub">${sub}</span></span><span class="cifra">${conta(k)}</span></a>`).join('')}
      <a class="riga sez ${CLASSE[ST.lang]}" href="#/lingua"><span class="tit">${TEMA[ST.lang]}
        <span class="sub">Livello A2, la lingua che porti all'esame</span></span><span class="cifra">${conta(ST.lang)}</span></a>
      <div class="riga cambio"><span class="tit sub" style="display:block">All'esame porti</span>
        <span class="scelte" style="margin:0">
          <button data-lang="en" class="${ST.lang === 'en' ? 'on' : ''}">Inglese</button>
          <button data-lang="fr" class="${ST.lang === 'fr' ? 'on' : ''}">Francese</button>
        </span></div>
    </div>
    <div class="righe" style="margin-top:12px">
      <a class="riga" href="#/quiz"><span class="tit">Tutto misto<span class="sub">Trenta domande da tutti gli argomenti</span></span></a>
      <a class="riga" href="#/errori"><span class="tit">Gli errori<span class="sub">${sbagliate ? `${sbagliate} domande sbagliate almeno una volta` : 'Nessun errore ancora: fai una prova'}</span></span></a>
      <a class="riga" href="#/nuove"><span class="tit">Mai viste<span class="sub">${nuove} domande ancora da incontrare</span></span></a>
    </div>

    <h2>Orale</h2>
    <div class="righe">
      <a class="riga" href="#/percorsi"><span class="tit">Percorsi<span class="sub">${DB.percorsi.length} itinerari via per via, ${provati} già provati</span></span></a>
      <a class="riga" href="#/confluenze"><span class="tit">Confluenze<span class="sub">${DB.confluenze.length} piazze e le vie che vi arrivano</span></span></a>
      <a class="riga" href="#/cosadove"><span class="tit">Cosa e dove<span class="sub">${DB.cosadove.length} luoghi di Milano e il loro indirizzo</span></span></a>
    </div>

    <p class="muted small" style="margin-top:28px">Quesiti della Camera di Commercio di Milano, edizione 22 novembre 2019.
    Regole d'esame dal programma della Città Metropolitana di Milano. I progressi restano su questo telefono.</p>
  `);
  on('#inizia', 'click', () => go('#/esame'));
  on('[data-lang]', 'click', e => { ST.lang = e.currentTarget.dataset.lang; save(); viewHome(); });
}

// ---------- Domande ----------
function pickQuestions(mode) {
  const all = DB.domande;
  if (mode === 'esame') {
    return ESAME.temi.flatMap(t => shuffle(all.filter(d => temaDi(d) === t && (t !== 'lingua' || d.t === ST.lang))).slice(0, ESAME.perTema));
  }
  if (mode === 'errori') {
    const wrong = all.filter(d => (ST.q[d.n] || {}).wrong > 0);
    return shuffle(wrong).sort((a, b) => ST.q[b.n].wrong - ST.q[a.n].wrong).slice(0, N_QUIZ);
  }
  if (mode === 'nuove') return shuffle(all.filter(d => !ST.q[d.n])).slice(0, N_QUIZ);
  if (mode === 'lingua') return shuffle(all.filter(d => d.t === ST.lang)).slice(0, N_QUIZ);
  if (mode in TEMA) return shuffle(all.filter(d => d.t === mode)).slice(0, N_QUIZ);
  return shuffle(all).slice(0, N_QUIZ);
}
function startQuiz(mode) {
  const items = pickQuestions(mode);
  if (!items.length) {
    const msg = mode === 'errori' ? 'Non hai ancora sbagliato niente. Fai una prova o un allenamento.' : 'Le hai viste tutte.';
    return render(`<div class="vuoto"><p>${msg}</p></div><a class="btn" href="#/">Torna all'inizio</a>`);
  }
  SESSION = { mode, items, i: 0, ok: 0, wrong: [], answered: null, answers: [],
    deadline: mode === 'esame' ? Date.now() + ESAME.minuti * 60000 : null };
  if (mode === 'esame') {
    TIMER = setInterval(() => {
      const el = document.querySelector('.clock'); if (!el || !SESSION) return;
      const left = (SESSION.deadline - Date.now()) / 1000;
      el.textContent = mmss(left);
      if (left <= 60) el.classList.add('tardi');
      if (left <= 0) finishQuiz(true);
    }, 500);
  }
  viewQuestion();
}
function rotaia(i) {
  // 16 segmenti in quattro gruppi: si vede a che punto si è e in quale sezione
  let out = '';
  for (let k = 0; k < 16; k++) {
    if (k && k % 4 === 0) out += '<i class="gap"></i>';
    out += `<i class="${k < i ? 'fatto' : k === i ? 'qui' : ''}"></i>`;
  }
  return `<div class="rotaia">${out}</div>`;
}
function viewQuestion() {
  const s = SESSION, d = s.items[s.i];
  // All'esame vero non c'è riscontro e non si correggono le risposte: si tocca e si va avanti.
  const done = s.mode !== 'esame' && s.answered !== null;
  const esame = s.mode === 'esame';
  render(`
    <div class="testata">
      <span>${esame ? nomeTema(temaDi(d)) : MODO[s.mode]}</span>
      ${esame ? `<span class="clock num">${mmss((s.deadline - Date.now()) / 1000)}</span>`
              : `<span class="num">${s.i + 1} di ${s.items.length}, esatte ${s.ok}</span>`}
    </div>
    ${esame ? rotaia(s.i) : `<div class="barra"><i style="width:${pct(s.i + (done ? 1 : 0), s.items.length)}%"></i></div>`}
    <p class="domanda">${esc(d.q)}</p>
    <div class="risposte">
      ${d.a.map((a, k) => `<button data-k="${k}" ${done ? 'disabled' : ''} class="${done && k === d.ok ? 'si' : done && k === s.answered ? 'no' : ''}">${esc(a)}</button>`).join('')}
    </div>
    ${done ? `<p class="verdetto ${s.answered === d.ok ? 'si' : 'no'}">${s.answered === d.ok ? 'Esatto.' : 'Sbagliato.'}</p>
      <div class="azioni"><button id="next">${s.i + 1 < s.items.length ? 'Avanti' : 'Vedi il risultato'}</button></div>` : ''}
    ${esame ? '<p class="muted small" style="margin-top:26px">Tocca la risposta: si passa avanti e non si torna indietro.</p>' : ''}
    <p style="margin-top:${esame ? 8 : 26}px"><a href="#/" class="muted small">Interrompi</a></p>
  `);
  if (!done) on('.risposte button', 'click', e => answer(+e.currentTarget.dataset.k));
  else on('#next', 'click', nextQuestion);
}
function answer(k) {
  const s = SESSION, d = s.items[s.i], st = stat(ST.q, d.n);
  s.answered = k; s.answers[s.i] = k; st.seen++;
  if (k === d.ok) { s.ok++; st.ok++; } else { st.wrong++; s.wrong.push(d); }
  save();
  if (s.mode === 'esame') return nextQuestion();
  viewQuestion();
}
function nextQuestion() {
  const s = SESSION;
  s.i++; s.answered = null;
  if (s.i < s.items.length) return viewQuestion();
  finishQuiz(false);
}
function ripasso(items) {
  if (!items.length) return '';
  return `<h2>Da rivedere</h2>${items.map(d => `
    <div class="ripasso ${CLASSE[d.t]}" style="--sez: var(--${d.t === 'en' || d.t === 'fr' ? 'lin' : d.t})">
      <p class="capo">${TEMA[d.t]}, domanda ${d.n}</p>
      <p class="q">${esc(d.q)}</p>
      <p class="giusta">${esc(d.a[d.ok])}</p></div>`).join('')}`;
}
function finishQuiz(timeout) {
  const s = SESSION; if (!s) return;
  stopTimer(); SESSION = null;
  if (s.mode === 'esame') return viewEsito(s, timeout);
  addSession(s.mode, s.items.length, s.ok);
  const p = pct(s.ok, s.items.length);
  render(`
    <h1>${p >= 80 ? 'Bene.' : p >= 60 ? 'Ci sei quasi.' : 'Da rifare.'}</h1>
    <div class="cifre">
      <div class="cifra-box"><b>${s.ok}</b><span>esatte</span></div>
      <div class="cifra-box"><b>${s.items.length - s.ok}</b><span>errate</span></div>
      <div class="cifra-box"><b>${p}%</b><span>riuscita</span></div>
    </div>
    ${ripasso(s.wrong)}
    <div class="azioni"><button id="again">Un altro giro</button><a class="btn secondario" href="#/">Torna all'inizio</a></div>
  `);
  on('#again', 'click', () => startQuiz(s.mode));
}
function viewEsito(s, timeout) {
  // Le domande non raggiunte contano come errate: "l'omessa risposta equivale ad errore".
  const marks = {}; ESAME.temi.forEach(t => marks[t] = []);
  s.items.forEach((d, i) => marks[temaDi(d)].push(s.answers[i] === d.ok));
  const conta = t => marks[t].filter(Boolean).length;
  const deboli = ESAME.temi.filter(t => conta(t) < ESAME.minTema);
  const pass = s.ok >= ESAME.minTot && !deboli.length;
  addSession('esame', s.items.length, s.ok, { pass, marks });
  const elenco = deboli.map(nomeTema).join(', ');
  const motivo = pass ? 'Dodici risposte esatte o più, e almeno due in ogni argomento.'
    : s.ok < ESAME.minTot && deboli.length ? `Sotto le dodici esatte, e meno di due in ${elenco}.`
    : s.ok < ESAME.minTot ? 'Sotto le dodici risposte esatte.'
    : `Il totale basterebbe, ma servono almeno due risposte esatte in ${elenco}.`;
  render(`
    <h1 class="esito-tit ${pass ? 'passa' : 'no'}">${pass ? 'Superata.' : 'Non superata.'}</h1>
    ${timeout ? '<p class="verdetto no" style="margin-top:-8px">Tempo scaduto. Le domande non raggiunte contano come errate.</p>' : ''}
    <div class="pagella">
      ${ESAME.temi.map(t => `<div class="r ${conta(t) < ESAME.minTema ? 'sotto' : ''}">
        <span class="nome">${nomeTema(t)}</span>${caselle(marks[t])}</div>`).join('')}
    </div>
    <p>${s.ok} risposte esatte su 16. ${motivo}</p>
    ${ripasso(s.items.filter((d, i) => s.answers[i] !== d.ok))}
    <div class="azioni"><button id="again">Un'altra prova</button><a class="btn secondario" href="#/">Torna all'inizio</a></div>
  `);
  on('#again', 'click', () => startQuiz('esame'));
}

// ---------- Percorsi ----------
function viewPercorsi(filter) {
  filter = (filter || '').trim().toLowerCase();
  const items = DB.percorsi.filter(p => !filter || p.titolo.toLowerCase().includes(filter));
  render(`
    <h1>Percorsi</h1>
    <input type="search" id="q" placeholder="Cerca partenza o arrivo" value="${esc(filter)}" autocomplete="off">
    <div class="righe">${items.map(p => {
      const st = ST.p[p.n];
      const stato = !st || !st.seen ? '' : st.wrong === 0 && st.ok > 0 ? '<span class="stato si">pulito</span>'
        : `<span class="stato no">${st.wrong} err.</span>`;
      const { nome, nota } = nomePercorso(p);
      return `<a class="riga" href="#/percorso/${p.n}">
        <span class="tit">${esc(nome)}<span class="sub">${p.passi.length} vie${nota ? ', ' + nota : ''}</span></span>${stato}</a>`;
    }).join('') || '<div class="vuoto">Nessun percorso con questo nome.</div>'}</div>
  `);
  const q = document.getElementById('q');
  q.addEventListener('input', () => {
    const v = q.value, pos = q.selectionStart;
    viewPercorsi(v);
    const nq = document.getElementById('q'); nq.focus(); nq.setSelectionRange(pos, pos);
  });
}
function capo(p) {
  const { nome, nota } = nomePercorso(p);
  return `<a class="torna" href="#/percorsi">Tutti i percorsi</a>
    <h1 class="titolo-percorso">${esc(nome)}</h1>${nota ? `<p class="dove">${nota}</p>` : ''}`;
}
function viewPercorso(n, mode, state) {
  const p = DB.percorsi.find(x => x.n === n);
  if (!p) return go('#/percorsi');
  mode = mode || 'studia';
  if (mode === 'studia') {
    state = state || { shown: 0, appena: false };
    const restano = p.passi.length - state.shown;
    render(`
      ${capo(p)}
      <p class="dove">${p.passi.length} vie, ${state.shown === 0 ? 'nessuna scoperta' : state.shown === p.passi.length ? 'tutte scoperte' : state.shown + ' scoperte'}</p>
      <div class="scelte"><button class="on">Studia</button><button id="verifica">Mettiti alla prova</button></div>
      <ol class="linea">
        ${p.passi.slice(0, state.shown).map((s, k) => `<li class="${k === 0 ? 'capolinea ' : k === p.passi.length - 1 ? 'capolinea ' : ''}${state.appena && k === state.shown - 1 ? 'nuova' : ''}"><span class="via">${esc(s)}</span></li>`).join('')}
        ${restano ? `<li class="attesa"><span class="via">${restano === 1 ? 'Manca un\'ultima via' : `Mancano ${restano} vie`}</span></li>` : ''}
      </ol>
      <div class="azioni">
        ${restano ? `<button id="more">Prossima via</button><button id="all" class="secondario">Mostra tutto</button>`
                  : `<button id="verifica2">Mettiti alla prova</button>`}
      </div>
    `);
    on('#more', 'click', () => viewPercorso(n, 'studia', { shown: state.shown + 1, appena: true }));
    on('#all', 'click', () => viewPercorso(n, 'studia', { shown: p.passi.length, appena: false }));
    on('#verifica, #verifica2', 'click', () => viewPercorso(n, 'verifica'));
    return;
  }
  if (!state) state = { i: 0, errors: 0, chosen: null, opts: null, wrongSteps: [] };
  if (state.i >= p.passi.length) {
    const st = stat(ST.p, n); st.seen++; if (state.errors === 0) st.ok++; st.wrong += state.errors;
    addSession('percorso', p.passi.length, p.passi.length - state.errors, { ref: n }); save();
    render(`
      ${capo(p)}
      <p class="dove">${state.errors === 0 ? 'Percorso rifatto senza errori.' : state.errors === 1 ? 'Un errore.' : state.errors + ' errori.'}</p>
      <ol class="linea">${p.passi.map((s, k) => `<li class="${k === 0 || k === p.passi.length - 1 ? 'capolinea ' : ''}${state.wrongSteps.includes(k) ? 'errata' : ''}"><span class="via">${esc(s)}</span></li>`).join('')}</ol>
      <div class="azioni"><button id="again">Rifallo</button><a class="btn secondario" href="#/percorsi">Tutti i percorsi</a></div>
    `);
    return on('#again', 'click', () => viewPercorso(n, 'verifica'));
  }
  if (!state.opts) state.opts = makeOptions(p, state.i);
  const done = state.chosen !== null, correct = p.passi[state.i];
  const scia = p.passi.slice(Math.max(0, state.i - 3), state.i);
  render(`
    ${capo(p)}
    <div class="scelte"><button id="studia">Studia</button><button class="on">Mettiti alla prova</button></div>
    <div class="testata"><span>Via ${state.i + 1} di ${p.passi.length}</span><span class="num">${state.errors ? state.errors + ' errori' : 'nessun errore'}</span></div>
    <div class="barra"><i style="width:${pct(state.i, p.passi.length)}%"></i></div>
    <ol class="linea">
      ${scia.map(s => `<li><span class="via">${esc(s)}</span></li>`).join('')}
      <li class="attesa"><span class="via">${state.i === 0 ? 'Da dove si parte?' : 'Qual è la prossima via?'}</span></li>
    </ol>
    <div class="risposte">${state.opts.map(o => `<button data-o="${esc(o)}" ${done ? 'disabled' : ''} class="${done && o === correct ? 'si' : done && o === state.chosen ? 'no' : ''}">${esc(o)}</button>`).join('')}</div>
    ${done ? `<div class="azioni"><button id="next">Avanti</button></div>` : ''}
  `);
  on('#studia', 'click', () => viewPercorso(n, 'studia'));
  if (!done) on('.risposte button', 'click', e => {
    state.chosen = e.currentTarget.dataset.o;
    if (state.chosen !== correct) { state.errors++; state.wrongSteps.push(state.i); }
    viewPercorso(n, 'verifica', state);
  });
  else on('#next', 'click', () => viewPercorso(n, 'verifica', { ...state, i: state.i + 1, chosen: null, opts: null }));
}
let STREET_POOL = null;
function makeOptions(p, i) {
  if (!STREET_POOL) STREET_POOL = [...new Set(DB.percorsi.flatMap(x => x.passi))];
  const correct = p.passi[i], avoid = new Set(p.passi);
  const opts = [correct];
  while (opts.length < 3) {
    const c = STREET_POOL[Math.floor(Math.random() * STREET_POOL.length)];
    if (!avoid.has(c) && !opts.includes(c)) opts.push(c);
  }
  return shuffle(opts);
}

// ---------- Carte: confluenze e cosa/dove ----------
function viewFlash(kind, state) {
  const isConf = kind === 'confluenze';
  const cats = isConf ? [] : ['Tutte', ...new Set(DB.cosadove.map(x => x.cat))];
  state = state || { cat: 'Tutte', dir: 'cosa', deck: null, i: 0, flipped: false, ok: 0, tot: 0 };
  if (!state.deck) {
    const src = isConf ? DB.confluenze.map(c => ({ key: 'c' + c.n, front: c.titolo, back: c.passi }))
      : DB.cosadove.filter(x => state.cat === 'Tutte' || x.cat === state.cat)
          .map((x, k) => ({ key: 'd' + k, front: state.dir === 'cosa' ? x.cosa : x.dove, back: [state.dir === 'cosa' ? x.dove : x.cosa] }));
    state.deck = shuffle(src).sort((a, b) => rank(b) - rank(a));
    state.i = 0; state.flipped = false;
  }
  function rank(c) { const s = ST.f[c.key]; return !s ? 1 : s.wrong > s.ok ? 2 : 0; }
  const c = state.deck[state.i];
  const scelte = isConf ? '' : `
    <div class="scelte">${cats.map(k => `<button data-cat="${esc(k)}" class="${k === state.cat ? 'on' : ''}">${esc(k === 'Tutte' ? 'Tutte' : k.toLowerCase())}</button>`).join('')}</div>
    <div class="scelte"><button data-dir="cosa" class="${state.dir === 'cosa' ? 'on' : ''}">Dammi il luogo</button><button data-dir="dove" class="${state.dir === 'dove' ? 'on' : ''}">Dammi l'indirizzo</button></div>`;
  render(`
    <h1>${isConf ? 'Confluenze' : 'Cosa e dove'}</h1>${scelte}
    <div class="testata"><span>Carta ${state.i + 1} di ${state.deck.length}</span><span class="num">${state.tot ? `sapevo ${state.ok} su ${state.tot}` : ''}</span></div>
    <div class="carta" id="flash">
      <p class="fronte">${esc(c.front)}</p>
      ${state.flipped ? `<div class="retro">${c.back.length > 1 ? `<ul>${c.back.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p style="margin:0">${esc(c.back[0])}</p>`}</div>`
                      : `<p class="gira">Tocca per girare</p>`}
    </div>
    ${state.flipped ? `<div class="azioni"><button id="no" class="rosso">Non lo sapevo</button><button id="ok">Lo sapevo</button></div>` : ''}
  `);
  on('#flash', 'click', () => { if (!state.flipped) { state.flipped = true; viewFlash(kind, state); } });
  on('[data-cat]', 'click', e => viewFlash(kind, { ...state, cat: e.currentTarget.dataset.cat, deck: null }));
  on('[data-dir]', 'click', e => viewFlash(kind, { ...state, dir: e.currentTarget.dataset.dir, deck: null }));
  const judge = knew => {
    const s = stat(ST.f, c.key); s.seen++; knew ? s.ok++ : s.wrong++; save();
    state.tot++; if (knew) state.ok++;
    state.flipped = false; state.i++;
    if (state.i >= state.deck.length) {
      addSession(kind, state.tot, state.ok);
      render(`<h1>Mazzo finito.</h1><p>Sapevi ${state.ok} carte su ${state.tot}.</p>
        <div class="azioni"><button id="again">Ricomincia</button><a class="btn secondario" href="#/">Torna all'inizio</a></div>`);
      return on('#again', 'click', () => viewFlash(kind, { ...state, deck: null, ok: 0, tot: 0 }));
    }
    viewFlash(kind, state);
  };
  on('#ok', 'click', () => judge(true)); on('#no', 'click', () => judge(false));
}

// ---------- Statistiche ----------
function viewStats() {
  const esami = ST.sessions.filter(s => s.mode === 'esame');
  const prove = ST.sessions.filter(s => s.mode in MODO);
  const viste = Object.keys(ST.q).length;
  const sbagliate = Object.entries(ST.q).filter(([, s]) => s.wrong > 0);
  const provati = Object.values(ST.p).filter(s => s.seen).length;
  const puliti = Object.values(ST.p).filter(s => s.ok > 0).length;
  const ultime = prove.slice(-20);
  const peggiori = sbagliate.sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 8)
    .map(([n]) => DB.domande.find(x => x.n === +n)).filter(Boolean);
  const perTema = {};
  for (const [n, s] of Object.entries(ST.q)) {
    const d = DB.domande.find(x => x.n === +n); if (!d) continue;
    perTema[d.t] = perTema[d.t] || { ok: 0, seen: 0 };
    perTema[d.t].ok += s.ok; perTema[d.t].seen += s.seen;
  }
  const righeTema = ['geo', 'leg', 'reg', 'en', 'fr'].filter(t => perTema[t]).map(t => {
    const p = pct(perTema[t].ok, perTema[t].seen);
    return `<div class="riga sez ${CLASSE[t]}"><span class="tit">${TEMA[t]}<span class="sub">${perTema[t].seen} risposte date</span></span>
      <span class="cifra" style="${p < 60 ? 'color:var(--rosso);font-weight:600' : ''}">${p}%</span></div>`;
  }).join('');
  render(`
    <h1>Statistiche</h1>
    <div class="cifre">
      <div class="cifra-box"><b>${esami.length}</b><span>prove d'esame</span></div>
      <div class="cifra-box"><b>${esami.filter(s => s.pass).length}</b><span>superate</span></div>
      <div class="cifra-box"><b>${esami.length ? esami[esami.length - 1].ok : '–'}</b><span>esatte nell'ultima</span></div>
    </div>
    ${righeTema ? `<h2>Come vai per argomento</h2><div class="righe">${righeTema}</div>
      <p class="muted small">All'esame servono almeno due risposte esatte su quattro in ogni argomento: sotto il 60 per cento è lì che rischi.</p>` : ''}
    <h2>Le ultime prove</h2>
    ${ultime.length ? `<div class="grafico">${ultime.map(s => `<i style="height:${Math.max(4, pct(s.ok, s.tot))}%" class="${pct(s.ok, s.tot) < 75 ? 'basso' : ''}" title="${fmtDate(s.t)}, ${s.ok} su ${s.tot}"></i>`).join('')}</div>
      <p class="muted small">Dal ${fmtDate(ultime[0].t)} al ${fmtDate(ultime[ultime.length - 1].t)}. In rosso le prove sotto il 75 per cento, cioè sotto le dodici risposte su sedici.</p>`
      : '<div class="vuoto">Ancora nessuna prova.</div>'}
    <h2>Quanto hai visto</h2>
    <div class="cifre">
      <div class="cifra-box"><b>${viste}</b><span>domande viste su ${DB.domande.length}</span></div>
      <div class="cifra-box"><b>${sbagliate.length}</b><span>sbagliate almeno una volta</span></div>
      <div class="cifra-box"><b>${puliti} su ${provati}</b><span>percorsi rifatti senza errori</span></div>
    </div>
    ${peggiori.length ? `<h2>Quelle che sbagli più spesso</h2>${peggiori.map(d => `
      <div class="ripasso ${CLASSE[d.t]}" style="--sez: var(--${d.t === 'en' || d.t === 'fr' ? 'lin' : d.t})">
        <p class="capo">${TEMA[d.t]}, sbagliata ${ST.q[d.n].wrong} volt${ST.q[d.n].wrong === 1 ? 'a' : 'e'} su ${ST.q[d.n].seen} tentativ${ST.q[d.n].seen === 1 ? 'o' : 'i'}</p>
        <p class="q">${esc(d.q)}</p><p class="giusta">${esc(d.a[d.ok])}</p></div>`).join('')}` : ''}
    <h2>I dati</h2>
    <p class="muted small">Restano in questo browser. Se cancelli i dati del sito, riparti da zero.</p>
    <div class="azioni"><button id="reset" class="rosso">Azzera i progressi</button></div>
  `);
  on('#reset', 'click', () => {
    if (confirm('Cancellare tutte le statistiche?')) { ST = { sessions: [], q: {}, p: {}, f: {}, lang: ST.lang }; save(); viewStats(); }
  });
}

// ---------- Router ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  stopTimer(); SESSION = null;
  switch (parts[0]) {
    case '': return viewHome();
    case 'esame': case 'quiz': case 'errori': case 'nuove':
    case 'geo': case 'leg': case 'reg': case 'lingua': return startQuiz(parts[0]);
    case 'percorsi': return viewPercorsi();
    case 'percorso': return viewPercorso(+parts[1]);
    case 'confluenze': return viewFlash('confluenze');
    case 'cosadove': return viewFlash('cosadove');
    case 'stats': return viewStats();
    default: return go('#/');
  }
}

async function main() {
  try {
    const names = ['domande', 'percorsi', 'confluenze', 'cosadove'];
    const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
    names.forEach((n, i) => DB[n] = res[i]);
  } catch (e) {
    return render(`<div class="vuoto"><p>Non riesco a caricare i quesiti.</p><p class="small">Controlla la connessione e ricarica la pagina.</p></div>`);
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
main();
