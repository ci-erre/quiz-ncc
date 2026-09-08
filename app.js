// app.js — QuizNCC
//
// Webapp statica per prepararsi all'esame di iscrizione al ruolo conducenti taxi/NCC
// (Camera di Commercio di Milano). Dati in data/*.json, progressi in localStorage.
// Navigazione a hash: #/quiz, #/errori, #/nuove, #/percorsi, #/percorso/12, #/confluenze,
// #/cosadove, #/stats.

'use strict';

const N_QUIZ = 30;
const STORE_KEY = 'quizncc.v1';
const DB = {};
let ST = loadState();
let SESSION = null; // stato in memoria della prova in corso

// ---------- Stato persistente ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { sessions: s.sessions || [], q: s.q || {}, p: s.p || {}, f: s.f || {} };
  } catch (e) { return { sessions: [], q: {}, p: {}, f: {} }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch (e) { /* quota o privato: si continua senza memoria */ } }
function stat(map, key) { return map[key] || (map[key] = { seen: 0, ok: 0, wrong: 0 }); }
function addSession(mode, tot, ok, ref) {
  ST.sessions.push({ t: Date.now(), mode, tot, ok, ref });
  if (ST.sessions.length > 500) ST.sessions.splice(0, ST.sessions.length - 500);
  save();
}

// ---------- Utilità ----------
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pct(ok, tot) { return tot ? Math.round(100 * ok / tot) : 0; }
function fmtDate(t) { return new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); }
function render(html) { document.getElementById('app').innerHTML = html; window.scrollTo(0, 0); }
function on(sel, ev, fn) { document.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn)); }
function go(hash) { location.hash = hash; }

// ---------- Home ----------
function viewHome() {
  const viste = Object.keys(ST.q).length;
  const sbagliate = Object.values(ST.q).filter(s => s.wrong > 0).length;
  const perc = Object.values(ST.p).filter(s => s.seen > 0).length;
  render(`
    <h1>Cosa vuoi fare?</h1>
    <div class="menu">
      <a href="#/quiz"><strong>Simulazione</strong><span>${N_QUIZ} domande a caso su ${DB.domande.length}</span></a>
      <a href="#/errori"><strong>Ripassa gli errori</strong><span>${sbagliate ? sbagliate + ' domande sbagliate almeno una volta' : 'Ancora nessun errore registrato'}</span></a>
      <a href="#/nuove"><strong>Domande mai viste</strong><span>${DB.domande.length - viste} ancora da vedere</span></a>
      <a href="#/en"><strong>Inglese</strong><span>${DB.domande.filter(d => d.lang === 'en').length} domande di lingua</span></a>
      <a href="#/fr"><strong>Francese</strong><span>${DB.domande.filter(d => d.lang === 'fr').length} domande di lingua</span></a>
      <a href="#/percorsi"><strong>Percorsi</strong><span>${DB.percorsi.length} itinerari via per via, ${perc} già provati</span></a>
      <a href="#/confluenze"><strong>Confluenze</strong><span>${DB.confluenze.length} piazze e le vie che vi arrivano</span></a>
      <a href="#/cosadove"><strong>Cosa e dove</strong><span>${DB.cosadove.length} luoghi e il loro indirizzo</span></a>
    </div>
    <p class="muted small" style="margin-top:24px">Quesiti della Camera di Commercio di Milano, edizione 22/11/2019. I progressi restano su questo dispositivo.</p>
  `);
}

// ---------- Quiz (simulazione, errori, nuove) ----------
function pickQuestions(mode) {
  const all = DB.domande;
  if (mode === 'errori') {
    const wrong = all.filter(d => (ST.q[d.n] || {}).wrong > 0);
    // prima le più sbagliate; a parità, ordine casuale
    return shuffle(wrong).sort((a, b) => ST.q[b.n].wrong - ST.q[a.n].wrong).slice(0, N_QUIZ);
  }
  if (mode === 'nuove') return shuffle(all.filter(d => !ST.q[d.n])).slice(0, N_QUIZ);
  if (mode === 'en' || mode === 'fr') return shuffle(all.filter(d => d.lang === mode)).slice(0, N_QUIZ);
  return shuffle(all).slice(0, N_QUIZ);
}
function startQuiz(mode) {
  const items = pickQuestions(mode);
  if (!items.length) {
    const msg = mode === 'errori' ? 'Nessun errore da ripassare. Fai una simulazione prima.' : 'Le hai viste tutte.';
    return render(`<div class="empty"><p>${msg}</p></div><a class="btn" href="#/">Torna all'inizio</a>`);
  }
  SESSION = { kind: 'quiz', mode, items, i: 0, ok: 0, wrong: [] , answered: null };
  viewQuestion();
}
const MODE_LABEL = { quiz: 'Simulazione', errori: 'Ripasso errori', nuove: 'Domande nuove', en: 'Inglese', fr: 'Francese' };
function viewQuestion() {
  const s = SESSION, d = s.items[s.i];
  const done = s.answered !== null;
  render(`
    <div class="progress"><span>${MODE_LABEL[s.mode]}</span><span>${s.i + 1} / ${s.items.length} · esatte ${s.ok}</span></div>
    <div class="bar"><i style="width:${pct(s.i + (done ? 1 : 0), s.items.length)}%"></i></div>
    <p class="muted small">Domanda n. ${d.n}</p>
    <div class="question">${esc(d.q)}</div>
    <div class="answers">
      ${d.a.map((a, k) => `<button data-k="${k}" ${done ? 'disabled' : ''} class="${done && k === d.ok ? 'ok' : done && k === s.answered ? 'no' : ''}">${esc(a)}</button>`).join('')}
    </div>
    ${done ? `<div class="verdict ${s.answered === d.ok ? 'ok' : 'no'}">${s.answered === d.ok ? 'Esatto.' : 'Sbagliato.'}</div>
      <div class="actions"><button id="next">${s.i + 1 < s.items.length ? 'Avanti' : 'Vedi il risultato'}</button></div>` : ''}
    <p style="margin-top:24px"><a href="#/" class="muted small">Interrompi</a></p>
  `);
  if (!done) on('.answers button', 'click', e => answer(+e.currentTarget.dataset.k));
  else on('#next', 'click', nextQuestion);
}
function answer(k) {
  const s = SESSION, d = s.items[s.i], st = stat(ST.q, d.n);
  s.answered = k; st.seen++;
  if (k === d.ok) { s.ok++; st.ok++; } else { st.wrong++; s.wrong.push(d); }
  save(); viewQuestion();
}
function nextQuestion() {
  const s = SESSION;
  s.i++; s.answered = null;
  if (s.i < s.items.length) return viewQuestion();
  addSession(s.mode, s.items.length, s.ok);
  const p = pct(s.ok, s.items.length);
  render(`
    <h1>${p >= 80 ? 'Bene.' : p >= 60 ? 'Quasi.' : 'Da rifare.'}</h1>
    <div class="kpis">
      <div class="kpi"><b>${s.ok}</b><span>esatte</span></div>
      <div class="kpi"><b>${s.items.length - s.ok}</b><span>errate</span></div>
      <div class="kpi"><b>${p}%</b><span>riuscita</span></div>
    </div>
    ${s.wrong.length ? `<h2>Da rivedere</h2><div class="list">${s.wrong.map(d => `
      <div class="card"><p class="muted small">Domanda n. ${d.n}</p><p><strong>${esc(d.q)}</strong></p><p class="verdict ok" style="margin-top:6px">${esc(d.a[d.ok])}</p></div>`).join('')}</div>` : ''}
    <div class="actions"><button id="again">Un'altra</button><a class="btn secondary" href="#/">Inizio</a></div>
  `);
  on('#again', 'click', () => startQuiz(s.mode));
  SESSION = null;
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
  // Verifica: a ogni passo, la via successiva fra tre.
  if (!state) state = { i: 0, errors: 0, chosen: null, opts: null, wrongSteps: [] };
  if (state.i >= p.passi.length) {
    const st = stat(ST.p, n); st.seen++; if (state.errors === 0) st.ok++; st.wrong += state.errors;
    addSession('percorso', p.passi.length, p.passi.length - state.errors, n); save();
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
    const src = isConf ? DB.confluenze.map((c, k) => ({ key: 'c' + c.n, front: c.titolo, back: c.passi }))
      : DB.cosadove.filter(x => state.cat === 'Tutte' || x.cat === state.cat)
          .map((x, k) => ({ key: 'd' + k, front: state.dir === 'cosa' ? x.cosa : x.dove, back: [state.dir === 'cosa' ? x.dove : x.cosa] }));
    // prima le carte sbagliate, poi le mai viste, poi il resto
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
  const qs = ST.sessions.filter(s => s.mode in MODE_LABEL);
  const viste = Object.keys(ST.q).length, tot = DB.domande.length;
  const sbagliate = Object.entries(ST.q).filter(([, s]) => s.wrong > 0);
  const percProvati = Object.values(ST.p).filter(s => s.seen).length;
  const percPuliti = Object.values(ST.p).filter(s => s.ok > 0).length;
  const last = qs.slice(-20);
  const topWrong = sbagliate.sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 10)
    .map(([n, s]) => ({ d: DB.domande.find(x => x.n === +n), s })).filter(x => x.d);
  const allOk = qs.reduce((a, s) => a + s.ok, 0), allTot = qs.reduce((a, s) => a + s.tot, 0);
  render(`
    <h1>Statistiche</h1>
    <div class="kpis">
      <div class="kpi"><b>${qs.length}</b><span>prove fatte</span></div>
      <div class="kpi"><b>${pct(allOk, allTot)}%</b><span>riuscita totale</span></div>
      <div class="kpi"><b>${last.length ? pct(last[last.length - 1].ok, last[last.length - 1].tot) + '%' : '–'}</b><span>ultima prova</span></div>
    </div>
    <h2>Ultime prove</h2>
    ${last.length ? `<div class="card"><div class="chart">${last.map(s => `<i style="height:${pct(s.ok, s.tot)}%" class="${pct(s.ok, s.tot) < 60 ? 'low' : ''}" title="${fmtDate(s.t)}: ${s.ok}/${s.tot}"></i>`).join('')}</div>
      <p class="muted small">${fmtDate(last[0].t)} → ${fmtDate(last[last.length - 1].t)}, altezza = percentuale di risposte esatte.</p></div>` : '<div class="empty">Nessuna prova ancora.</div>'}
    <h2>Copertura</h2>
    <div class="kpis">
      <div class="kpi"><b>${viste}</b><span>domande viste su ${tot}</span></div>
      <div class="kpi"><b>${sbagliate.length}</b><span>sbagliate almeno una volta</span></div>
      <div class="kpi"><b>${percPuliti}/${percProvati}</b><span>percorsi puliti / provati</span></div>
    </div>
    ${topWrong.length ? `<h2>Sbagliate più spesso</h2><div class="list">${topWrong.map(({ d, s }) => `
      <div class="card"><p class="muted small">Domanda n. ${d.n} · sbagliata ${s.wrong} su ${s.seen}</p><p><strong>${esc(d.q)}</strong></p><p class="verdict ok" style="margin-top:6px">${esc(d.a[d.ok])}</p></div>`).join('')}</div>` : ''}
    <h2>Dati</h2>
    <div class="card"><p class="small muted">Tutto resta in questo browser. Se cancelli i dati del sito, riparti da zero.</p>
      <div class="actions"><button id="reset" class="danger">Azzera i progressi</button></div></div>
  `);
  on('#reset', 'click', () => { if (confirm('Cancellare tutte le statistiche?')) { ST = { sessions: [], q: {}, p: {}, f: {} }; save(); viewStats(); } });
}

// ---------- Router ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  SESSION = null;
  switch (parts[0]) {
    case '': return viewHome();
    case 'quiz': case 'errori': case 'nuove': case 'en': case 'fr': return startQuiz(parts[0]);
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
