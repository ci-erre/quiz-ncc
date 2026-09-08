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
const MODE_LABEL = { esame: 'Simulazione d\'esame', quiz: 'Allenamento', errori: 'Ripasso errori', nuove: 'Domande nuove',
  geo: 'Geografia', leg: 'Legislazione', reg: 'Regolamento comunale', lingua: 'Lingua' };
const DB = {};
let ST = loadState();
let SESSION = null; // stato in memoria della prova in corso
let TIMER = null;

// ---------- Stato persistente ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { sessions: s.sessions || [], q: s.q || {}, p: s.p || {}, f: s.f || {}, lang: s.lang || 'en' };
  } catch (e) { return { sessions: [], q: {}, p: {}, f: {}, lang: 'en' }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch (e) { /* quota o privato: si continua senza memoria */ } }
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
function temaLabel(d) { return TEMA[d.t] || ''; }
function stopTimer() { if (TIMER) { clearInterval(TIMER); TIMER = null; } }

// ---------- Home ----------
function viewHome() {
  const viste = Object.keys(ST.q).length;
  const sbagliate = Object.values(ST.q).filter(s => s.wrong > 0).length;
  const perc = Object.values(ST.p).filter(s => s.seen > 0).length;
  const esami = ST.sessions.filter(s => s.mode === 'esame');
  const passati = esami.filter(s => s.pass).length;
  const nLang = DB.domande.filter(d => d.t === ST.lang).length;
  const count = t => DB.domande.filter(d => d.t === t).length;
  render(`
    <h1>Esame di Milano</h1>
    <div class="menu">
      <a href="#/esame"><strong>Simulazione d'esame</strong><span>16 quiz in 30 minuti, come la prova scritta.${esami.length ? ` Superate ${passati} su ${esami.length}.` : ''}</span></a>
    </div>
    <h2>Allenamento scritto</h2>
    <div class="menu">
      <a href="#/quiz"><strong>Tutto misto</strong><span>${N_QUIZ} domande a caso su ${DB.domande.length}</span></a>
      <a href="#/geo"><strong>Geografia</strong><span>${count('geo')} domande: statali, laghi, fiumi, abitanti</span></a>
      <a href="#/leg"><strong>Legislazione</strong><span>${count('leg')} domande: legge 21/92, leggi regionali, aeroporti</span></a>
      <a href="#/reg"><strong>Regolamento comunale</strong><span>${count('reg')} domande: doveri, turni, tariffe, controlli</span></a>
      <a href="#/lingua"><strong>${TEMA[ST.lang]}</strong><span>${nLang} domande di lingua, livello A2</span></a>
      <a href="#/errori"><strong>Ripassa gli errori</strong><span>${sbagliate ? sbagliate + ' domande sbagliate almeno una volta' : 'Ancora nessun errore registrato'}</span></a>
      <a href="#/nuove"><strong>Domande mai viste</strong><span>${DB.domande.length - viste} ancora da vedere</span></a>
    </div>
    <div class="chips" style="margin-top:12px"><span class="muted small" style="align-self:center">Lingua scelta all'esame:</span>
      <button data-lang="en" class="${ST.lang === 'en' ? 'on' : ''}">Inglese</button><button data-lang="fr" class="${ST.lang === 'fr' ? 'on' : ''}">Francese</button></div>
    <h2>Orale</h2>
    <div class="menu">
      <a href="#/percorsi"><strong>Percorsi</strong><span>${DB.percorsi.length} itinerari via per via, ${perc} già provati</span></a>
      <a href="#/confluenze"><strong>Confluenze</strong><span>${DB.confluenze.length} piazze e le vie che vi arrivano</span></a>
      <a href="#/cosadove"><strong>Cosa e dove</strong><span>${DB.cosadove.length} luoghi e il loro indirizzo</span></a>
    </div>
    <p class="muted small" style="margin-top:24px">Quesiti della Camera di Commercio di Milano, edizione 22/11/2019. Regole d'esame dal Programma della Città Metropolitana di Milano 2026. I progressi restano su questo dispositivo.</p>
  `);
  on('[data-lang]', 'click', e => { ST.lang = e.currentTarget.dataset.lang; save(); viewHome(); });
}

// ---------- Quiz ----------
function pickQuestions(mode) {
  const all = DB.domande;
  if (mode === 'esame') {
    // 4 per argomento, nell'ordine della prova: geografia, legislazione, regolamento, lingua
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
    const msg = mode === 'errori' ? 'Nessun errore da ripassare. Fai un allenamento prima.' : 'Le hai viste tutte.';
    return render(`<div class="empty"><p>${msg}</p></div><a class="btn" href="#/">Torna all'inizio</a>`);
  }
  SESSION = { kind: 'quiz', mode, items, i: 0, ok: 0, wrong: [], answered: null, answers: [], deadline: mode === 'esame' ? Date.now() + ESAME.minuti * 60000 : null };
  if (mode === 'esame') {
    TIMER = setInterval(() => {
      const el = document.getElementById('clock'); if (!el || !SESSION) return;
      const left = (SESSION.deadline - Date.now()) / 1000;
      el.textContent = mmss(left);
      if (left <= 60) el.classList.add('late');
      if (left <= 0) finishQuiz(true);
    }, 500);
  }
  viewQuestion();
}
function viewQuestion() {
  const s = SESSION, d = s.items[s.i];
  // All'esame vero non c'è riscontro e non si correggono le risposte: si tocca e si va avanti.
  const done = s.mode !== 'esame' && s.answered !== null;
  const head = s.mode === 'esame'
    ? `<span>${temaLabel(d)}</span><span>${s.i + 1} / ${s.items.length} · <b id="clock">${mmss((s.deadline - Date.now()) / 1000)}</b></span>`
    : `<span>${MODE_LABEL[s.mode]}</span><span>${s.i + 1} / ${s.items.length} · esatte ${s.ok}</span>`;
  render(`
    <div class="progress">${head}</div>
    <div class="bar"><i style="width:${pct(s.i + (done ? 1 : 0), s.items.length)}%"></i></div>
    <p class="muted small">${s.mode === 'esame' ? 'Domanda' : temaLabel(d) + ' · domanda'} n. ${d.n}</p>
    <div class="question">${esc(d.q)}</div>
    <div class="answers">
      ${d.a.map((a, k) => `<button data-k="${k}" ${done ? 'disabled' : ''} class="${done && k === d.ok ? 'ok' : done && k === s.answered ? 'no' : ''}">${esc(a)}</button>`).join('')}
    </div>
    ${done ? `<div class="verdict ${s.answered === d.ok ? 'ok' : 'no'}">${s.answered === d.ok ? 'Esatto.' : 'Sbagliato.'}</div>
      <div class="actions"><button id="next">${s.i + 1 < s.items.length ? 'Avanti' : 'Vedi il risultato'}</button></div>` : ''}
    ${s.mode === 'esame' ? '<p class="muted small" style="margin-top:24px">Tocca la risposta: si passa avanti e non si torna indietro.</p>' : ''}
    <p style="margin-top:${s.mode === 'esame' ? '8' : '24'}px"><a href="#/" class="muted small">Interrompi</a></p>
  `);
  if (!done) on('.answers button', 'click', e => answer(+e.currentTarget.dataset.k));
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
function finishQuiz(timeout) {
  const s = SESSION; if (!s) return;
  stopTimer(); SESSION = null;
  if (s.mode === 'esame') return viewEsito(s, timeout);
  addSession(s.mode, s.items.length, s.ok);
  const p = pct(s.ok, s.items.length);
  render(`
    <h1>${p >= 80 ? 'Bene.' : p >= 60 ? 'Quasi.' : 'Da rifare.'}</h1>
    <div class="kpis">
      <div class="kpi"><b>${s.ok}</b><span>esatte</span></div>
      <div class="kpi"><b>${s.items.length - s.ok}</b><span>errate</span></div>
      <div class="kpi"><b>${p}%</b><span>riuscita</span></div>
    </div>
    ${daRivedere(s.wrong)}
    <div class="actions"><button id="again">Un'altra</button><a class="btn secondary" href="#/">Inizio</a></div>
  `);
  on('#again', 'click', () => startQuiz(s.mode));
}
function daRivedere(wrong) {
  if (!wrong.length) return '';
  return `<h2>Da rivedere</h2><div class="list">${wrong.map(d => `
    <div class="card"><p class="muted small">${temaLabel(d)} · domanda n. ${d.n}</p><p><strong>${esc(d.q)}</strong></p><p class="verdict ok" style="margin-top:6px">${esc(d.a[d.ok])}</p></div>`).join('')}</div>`;
}
function viewEsito(s, timeout) {
  // Le domande non raggiunte contano come errate: "l'omessa risposta equivale ad errore".
  const perTema = {};
  ESAME.temi.forEach(t => perTema[t] = { ok: 0, tot: 0 });
  s.items.forEach((d, i) => { const t = temaDi(d); perTema[t].tot++; if (s.answers[i] === d.ok) perTema[t].ok++; });
  const okTot = s.ok;
  const deboli = ESAME.temi.filter(t => perTema[t].ok < ESAME.minTema);
  const pass = okTot >= ESAME.minTot && deboli.length === 0;
  addSession('esame', s.items.length, okTot, { pass, temi: perTema });
  const label = t => t === 'lingua' ? TEMA[ST.lang] : TEMA[t];
  const motivo = pass ? 'Almeno 12 su 16 e almeno 2 per ogni argomento.'
    : okTot < ESAME.minTot && deboli.length ? `Sotto 12 su 16, e meno di 2 in ${deboli.map(label).join(', ')}.`
    : okTot < ESAME.minTot ? 'Sotto 12 su 16.' : `Meno di 2 risposte giuste in ${deboli.map(label).join(', ')}, anche se il totale basta.`;
  render(`
    <h1 class="${pass ? 'pass' : 'fail'}">${pass ? 'Superato.' : 'Non superato.'}</h1>
    ${timeout ? '<p class="verdict no">Tempo scaduto: le domande non raggiunte contano come errate.</p>' : ''}
    <div class="kpis">
      <div class="kpi"><b>${okTot}</b><span>esatte su 16</span></div>
      <div class="kpi"><b>${mmss((s.deadline - Date.now()) / 1000)}</b><span>tempo rimasto</span></div>
      <div class="kpi"><b>${pct(okTot, 16)}%</b><span>riuscita</span></div>
    </div>
    <p>${motivo}</p>
    <div class="card"><table class="temi">${ESAME.temi.map(t => `<tr class="${perTema[t].ok < ESAME.minTema ? 'no' : ''}"><td>${label(t)}</td><td>${perTema[t].ok} / ${perTema[t].tot}</td></tr>`).join('')}</table></div>
    ${daRivedere(s.items.filter((d, i) => s.answers[i] !== d.ok))}
    <div class="actions"><button id="again">Un'altra simulazione</button><a class="btn secondary" href="#/">Inizio</a></div>
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
    <div class="list">${items.map(p => {
      const st = ST.p[p.n];
      const badge = !st || !st.seen ? '' : st.wrong === 0 && st.ok > 0 ? `<span class="badge ok">senza errori</span>` : `<span class="badge no">${st.wrong} err.</span>`;
      return `<a class="row" href="#/percorso/${p.n}"><span class="n">${p.n}</span><span class="t">${esc(p.titolo)}<br><span class="muted small">${p.passi.length} vie</span></span>${badge}</a>`;
    }).join('') || '<div class="empty">Nessun percorso con questo nome.</div>'}</div>
  `);
  const q = document.getElementById('q');
  q.addEventListener('input', () => {
    const v = q.value; const pos = q.selectionStart;
    viewPercorsi(v); const nq = document.getElementById('q'); nq.focus(); nq.setSelectionRange(pos, pos);
  });
}
function viewPercorso(n, mode, state) {
  const p = DB.percorsi.find(x => x.n === n);
  if (!p) return go('#/percorsi');
  mode = mode || 'studia';
  if (mode === 'studia') {
    state = state || { shown: 0 };
    render(`
      <p class="small"><a href="#/percorsi">Percorsi</a></p>
      <h1>${esc(p.titolo)}</h1>
      <div class="chips"><button class="on">Studia</button><button id="verifica">Verifica</button></div>
      <ol class="steps">${p.passi.slice(0, state.shown).map(s => `<li>${esc(s)}</li>`).join('')}
        ${state.shown < p.passi.length ? `<li class="next">${p.passi.length - state.shown} vie ancora nascoste</li>` : ''}</ol>
      <div class="actions">
        ${state.shown < p.passi.length ? `<button id="more">Prossima via</button><button id="all" class="secondary">Mostra tutto</button>` : `<button id="verifica2">Ora verifica</button>`}
      </div>
    `);
    on('#more', 'click', () => viewPercorso(n, 'studia', { shown: state.shown + 1 }));
    on('#all', 'click', () => viewPercorso(n, 'studia', { shown: p.passi.length }));
    on('#verifica, #verifica2', 'click', () => viewPercorso(n, 'verifica'));
    return;
  }
  if (!state) state = { i: 0, errors: 0, chosen: null, opts: null, wrongSteps: [] };
  if (state.i >= p.passi.length) {
    const st = stat(ST.p, n); st.seen++; if (state.errors === 0) st.ok++; st.wrong += state.errors;
    addSession('percorso', p.passi.length, p.passi.length - state.errors, { ref: n }); save();
    return render(`
      <p class="small"><a href="#/percorsi">Percorsi</a></p>
      <h1>${state.errors === 0 ? 'Percorso pulito.' : state.errors + (state.errors === 1 ? ' errore.' : ' errori.')}</h1>
      <p class="muted">${esc(p.titolo)}, ${p.passi.length} vie.</p>
      <ol class="steps">${p.passi.map((s, k) => `<li class="${state.wrongSteps.includes(k) ? 'no' : ''}">${esc(s)}</li>`).join('')}</ol>
      <div class="actions"><button id="again">Rifai</button><a class="btn secondary" href="#/percorsi">Percorsi</a></div>
    `), on('#again', 'click', () => viewPercorso(n, 'verifica'));
  }
  if (!state.opts) state.opts = makeOptions(p, state.i);
  const done = state.chosen !== null, correct = p.passi[state.i];
  render(`
    <p class="small"><a href="#/percorsi">Percorsi</a></p>
    <h1>${esc(p.titolo)}</h1>
    <div class="chips"><button id="studia">Studia</button><button class="on">Verifica</button></div>
    <div class="progress"><span>Via ${state.i + 1} di ${p.passi.length}</span><span>errori ${state.errors}</span></div>
    <div class="bar"><i style="width:${pct(state.i, p.passi.length)}%"></i></div>
    ${state.i ? `<ol class="steps">${p.passi.slice(Math.max(0, state.i - 3), state.i).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    <div class="question">${state.i === 0 ? 'Da dove si parte?' : 'Qual è la prossima via?'}</div>
    <div class="answers">${state.opts.map(o => `<button data-o="${esc(o)}" ${done ? 'disabled' : ''} class="${done && o === correct ? 'ok' : done && o === state.chosen ? 'no' : ''}">${esc(o)}</button>`).join('')}</div>
    ${done ? `<div class="actions"><button id="next">Avanti</button></div>` : ''}
  `);
  on('#studia', 'click', () => viewPercorso(n, 'studia'));
  if (!done) on('.answers button', 'click', e => {
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

// ---------- Flashcard: confluenze e cosa/dove ----------
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
  const title = isConf ? 'Confluenze' : 'Cosa e dove';
  const chips = isConf ? '' : `
    <div class="chips">${cats.map(k => `<button data-cat="${esc(k)}" class="${k === state.cat ? 'on' : ''}">${esc(k === 'Tutte' ? 'Tutte' : k.toLowerCase())}</button>`).join('')}</div>
    <div class="chips"><button data-dir="cosa" class="${state.dir === 'cosa' ? 'on' : ''}">Luogo, chiedo l'indirizzo</button><button data-dir="dove" class="${state.dir === 'dove' ? 'on' : ''}">Indirizzo, chiedo il luogo</button></div>`;
  render(`
    <h1>${title}</h1>${chips}
    <div class="progress"><span>Carta ${state.i + 1} di ${state.deck.length}</span><span>sapevo ${state.ok} / ${state.tot}</span></div>
    <div class="card flash" id="flash">
      <div class="front">${esc(c.front)}</div>
      ${state.flipped ? `<div class="back">${c.back.length > 1 ? `<ul>${c.back.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p>${esc(c.back[0])}</p>`}</div>` : `<div class="hint">Tocca per girare</div>`}
    </div>
    ${state.flipped ? `<div class="actions"><button id="no" class="danger">Non lo sapevo</button><button id="ok">Lo sapevo</button></div>` : ''}
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
      return render(`<h1>Mazzo finito.</h1><p>Sapevi ${state.ok} carte su ${state.tot}.</p>
        <div class="actions"><button id="again">Ricomincia</button><a class="btn secondary" href="#/">Inizio</a></div>`),
        on('#again', 'click', () => viewFlash(kind, { ...state, deck: null, ok: 0, tot: 0 }));
    }
    viewFlash(kind, state);
  };
  on('#ok', 'click', () => judge(true)); on('#no', 'click', () => judge(false));
}

// ---------- Statistiche ----------
function viewStats() {
  const esami = ST.sessions.filter(s => s.mode === 'esame');
  const qs = ST.sessions.filter(s => s.mode in MODE_LABEL);
  const viste = Object.keys(ST.q).length, tot = DB.domande.length;
  const sbagliate = Object.entries(ST.q).filter(([, s]) => s.wrong > 0);
  const percProvati = Object.values(ST.p).filter(s => s.seen).length;
  const percPuliti = Object.values(ST.p).filter(s => s.ok > 0).length;
  const last = qs.slice(-20);
  const topWrong = sbagliate.sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 10)
    .map(([n, s]) => ({ d: DB.domande.find(x => x.n === +n), s })).filter(x => x.d);
  // riuscita per argomento, su tutte le risposte date
  const perTema = {};
  for (const [n, s] of Object.entries(ST.q)) {
    const d = DB.domande.find(x => x.n === +n); if (!d) continue;
    const k = d.t; perTema[k] = perTema[k] || { ok: 0, seen: 0 }; perTema[k].ok += s.ok; perTema[k].seen += s.seen;
  }
  const temiRows = ['geo', 'leg', 'reg', 'en', 'fr'].filter(t => perTema[t]).map(t => {
    const p = pct(perTema[t].ok, perTema[t].seen);
    return `<tr class="${p < 60 ? 'no' : ''}"><td>${TEMA[t]}</td><td>${p}%</td><td class="muted small">${perTema[t].seen} risposte</td></tr>`;
  }).join('');
  render(`
    <h1>Statistiche</h1>
    <div class="kpis">
      <div class="kpi"><b>${esami.length}</b><span>simulazioni</span></div>
      <div class="kpi"><b>${esami.filter(s => s.pass).length}</b><span>superate</span></div>
      <div class="kpi"><b>${esami.length ? esami[esami.length - 1].ok + '/16' : '–'}</b><span>ultima</span></div>
    </div>
    ${temiRows ? `<h2>Riuscita per argomento</h2><div class="card"><table class="temi">${temiRows}</table>
      <p class="muted small">Sotto il 60% è il punto debole: all'esame servono almeno 2 giuste su 4 in ogni argomento.</p></div>` : ''}
    <h2>Ultime prove</h2>
    ${last.length ? `<div class="card"><div class="chart">${last.map(s => `<i style="height:${pct(s.ok, s.tot)}%" class="${pct(s.ok, s.tot) < 75 ? 'low' : ''}" title="${fmtDate(s.t)}: ${s.ok}/${s.tot}"></i>`).join('')}</div>
      <p class="muted small">${fmtDate(last[0].t)} → ${fmtDate(last[last.length - 1].t)}, altezza = percentuale di risposte esatte. Rosso sotto il 75%, la soglia di 12 su 16.</p></div>` : '<div class="empty">Nessuna prova ancora.</div>'}
    <h2>Copertura</h2>
    <div class="kpis">
      <div class="kpi"><b>${viste}</b><span>domande viste su ${tot}</span></div>
      <div class="kpi"><b>${sbagliate.length}</b><span>sbagliate almeno una volta</span></div>
      <div class="kpi"><b>${percPuliti}/${percProvati}</b><span>percorsi puliti / provati</span></div>
    </div>
    ${topWrong.length ? `<h2>Sbagliate più spesso</h2><div class="list">${topWrong.map(({ d, s }) => `
      <div class="card"><p class="muted small">${temaLabel(d)} · domanda n. ${d.n} · sbagliata ${s.wrong} su ${s.seen}</p><p><strong>${esc(d.q)}</strong></p><p class="verdict ok" style="margin-top:6px">${esc(d.a[d.ok])}</p></div>`).join('')}</div>` : ''}
    <h2>Dati</h2>
    <div class="card"><p class="small muted">Tutto resta in questo browser. Se cancelli i dati del sito, riparti da zero.</p>
      <div class="actions"><button id="reset" class="danger">Azzera i progressi</button></div></div>
  `);
  on('#reset', 'click', () => { if (confirm('Cancellare tutte le statistiche?')) { ST = { sessions: [], q: {}, p: {}, f: {}, lang: ST.lang }; save(); viewStats(); } });
}

// ---------- Router ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  stopTimer(); SESSION = null;
  switch (parts[0]) {
    case '': return viewHome();
    case 'esame': case 'quiz': case 'errori': case 'nuove': case 'geo': case 'leg': case 'reg': case 'lingua': return startQuiz(parts[0]);
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
    return render(`<div class="empty"><p>Non riesco a caricare i quesiti.</p><p class="small">Controlla la connessione e ricarica.</p></div>`);
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
main();
