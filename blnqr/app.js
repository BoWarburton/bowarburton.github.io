import { backend, isDemo } from './backend.js';
import { WORD_MAX, normalizeWord, validWord, qualifiedWords, buildRounds, scoreRounds } from './quiz.js';
import { isBlocked } from './filter.js';

const PALETTE = ['#dc2626', '#ca8a04', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];
const PRESETS = [
  { name: 'Hogwarts Houses', cats: [['Gryffindor', '#b91c1c'], ['Hufflepuff', '#ca8a04'], ['Ravenclaw', '#1d4ed8'], ['Slytherin', '#15803d']] },
  { name: 'Classical Elements', cats: [['Fire', '#dc2626'], ['Water', '#0284c7'], ['Earth', '#65a30d'], ['Air', '#8b9bb4']] },
  { name: 'Seasons', cats: [['Spring', '#16a34a'], ['Summer', '#eab308'], ['Autumn', '#ea580c'], ['Winter', '#0ea5e9']] },
];
const DEFAULTS = { minVotes: 2, rounds: 30, seconds: 2.5 };
const OPTIONS = {
  minVotes: [[1, 'Just 1 (anything goes)'], [2, '2 people'], [3, '3 people']],
  rounds: [[20, '20 (quick)'], [30, '30'], [40, '40 (thorough)']],
  seconds: [[1.5, '1.5 s (pure gut)'], [2.5, '2.5 s'], [4, '4 s (relaxed)']],
};
const LABELS = { minVotes: 'Backers a word needs', rounds: 'Choices per player', seconds: 'Time per choice' };

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const listOf = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// Room state, kept in sync by the backend watchers.
const S = { code: null, room: null, words: [], players: [], unsubs: [], layout: null, quiz: false, retake: false };
const isHost = () => S.room?.hostUid === backend.uid;
const me = () => S.players.find(p => p.id === backend.uid);
const catById = id => S.room.categories.find(c => c.id === id);

let savedName = '';
try { savedName = localStorage.getItem('blnqr-name') || ''; } catch {}
function rememberName(name) {
  savedName = name;
  try { localStorage.setItem('blnqr-name', name); } catch {}
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// Wraps async handlers so failures show up as a toast instead of vanishing.
const guard = fn => async e => {
  try { await fn(e); } catch (err) {
    console.error(err);
    toast(err.code === 'permission-denied' ? "That isn't allowed right now" : err.message || 'Something went wrong');
  }
};

/* ---------- Home ---------- */

function renderHome(code = '') {
  leaveRoom();
  history.replaceState(null, '', code ? `?room=${code}` : location.pathname);
  app.innerHTML = `
    <section class="hero">
      <h1 class="wordmark">blnqr</h1>
      <p class="tagline">A crowd-sourced sorting hat. First, everyone decides which words belong to which house. Then you sort yourself, one split-second choice at a time.</p>
    </section>
    <div class="split">
      <form class="card" id="join">
        <h2>Join a room</h2>
        <label>Room code<input name="code" class="code-input" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(code)}"></label>
        <label>Your name<input name="name" required maxlength="24" autocomplete="nickname" value="${esc(savedName)}"></label>
        <button class="btn">Join</button>
      </form>
      <div class="card host-card">
        <h2>Host a room</h2>
        <p>Choose the categories, share the code, and run both phases from your screen. Great on a projector.</p>
        <button class="btn ghost" id="to-create">Set up a sort →</button>
      </div>
    </div>
    <ol class="how">
      <li><b>Propose.</b> Everyone adds words that fit each category and backs each other's best ones.</li>
      <li><b>Sort.</b> Two words flash up. Pick the one that's more <em>you</em>, before the timer runs out.</li>
      <li><b>Reveal.</b> See your blend of categories, the words that gave you away, and how the room sorted.</li>
    </ol>`;

  $('#join').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const code = f.get('code').trim().toUpperCase(), name = f.get('name').trim();
    if (!name) return toast('Enter your name');
    if (!(await backend.getRoom(code))) return toast(`No room with code ${code}`);
    rememberName(name);
    await backend.joinRoom(code, name);
    enterRoom(code);
  }));
  $('#to-create').onclick = renderCreate;
  $(code ? '#join [name=name]' : '#join [name=code]').focus();
}

function settingsFields(values) {
  return Object.keys(OPTIONS).map(k => `
    <label>${LABELS[k]}<select name="${k}">${OPTIONS[k]
      .map(([v, text]) => `<option value="${v}"${+values[k] === v ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`).join('');
}

function renderCreate() {
  app.innerHTML = `
    <button class="back" id="back">← Back</button>
    <form class="card create" id="create">
      <h2>Set up a sort</h2>
      <div class="presets"><span>Start from</span>${PRESETS.map((p, i) => `<button type="button" class="pill" data-preset="${i}">${esc(p.name)}</button>`).join('')}</div>
      <label>Name of the sort<input name="name" required maxlength="40" placeholder="e.g. Hogwarts Houses"></label>
      <fieldset>
        <legend>Categories <small>2 to 8</small></legend>
        <ol id="cats" class="cat-edit"></ol>
        <button type="button" class="btn ghost small" id="add-cat">+ Add category</button>
      </fieldset>
      <fieldset><legend>Rules <small>you can change these until sorting starts</small></legend><div class="settings">${settingsFields(DEFAULTS)}</div></fieldset>
      <label>Your name<input name="host" required maxlength="24" value="${esc(savedName)}"></label>
      <button class="btn">Create room</button>
    </form>`;

  let cats = [{ name: '', color: PALETTE[0] }, { name: '', color: PALETTE[1] }];
  const drawCats = () => {
    $('#cats').innerHTML = cats.map((c, i) => `
      <li style="--c:${c.color}">
        <span class="dot"></span>
        <input data-i="${i}" value="${esc(c.name)}" maxlength="24" required placeholder="Category ${i + 1}" aria-label="Category ${i + 1}">
        <button type="button" class="x" data-del="${i}" ${cats.length <= 2 ? 'disabled' : ''} aria-label="Remove category">×</button>
      </li>`).join('');
    $('#add-cat').disabled = cats.length >= 8;
  };
  $('#cats').oninput = e => { if (e.target.dataset.i) cats[e.target.dataset.i].name = e.target.value; };
  $('#cats').onclick = e => {
    const i = e.target.closest('[data-del]')?.dataset.del;
    if (i) { cats.splice(+i, 1); drawCats(); }
  };
  $('#add-cat').onclick = () => {
    cats.push({ name: '', color: PALETTE.find(p => !cats.some(c => c.color === p)) ?? PALETTE[0] });
    drawCats();
    $('#cats li:last-child input').focus();
  };
  $('.presets').onclick = e => {
    const p = PRESETS[e.target.dataset.preset];
    if (!p) return;
    $('#create [name=name]').value = p.name;
    cats = p.cats.map(([name, color]) => ({ name, color }));
    drawCats();
  };
  $('#back').onclick = () => renderHome();
  $('#create').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const names = cats.map(c => c.name.trim());
    if (names.some(n => !n)) return toast('Every category needs a name');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast('Category names must all be different');
    const host = f.get('host').trim();
    rememberName(host);
    const code = await backend.createRoom({
      name: f.get('name').trim(),
      categories: cats.map((c, i) => ({ id: `c${i}`, name: names[i], color: c.color })),
      minVotes: +f.get('minVotes'),
      rounds: +f.get('rounds'),
      seconds: +f.get('seconds'),
    });
    await backend.joinRoom(code, host);
    enterRoom(code);
  }));
  drawCats();
}

/* ---------- Room ---------- */

function enterRoom(code) {
  leaveRoom();
  S.code = code;
  history.replaceState(null, '', `?room=${code}`);
  app.innerHTML = '<p class="loading">Opening room…</p>';
  const onError = err => { console.error(err); toast('Lost connection to the room'); };
  S.unsubs = [
    backend.watchRoom(code, r => { S.room = r; refresh(); }, onError),
    backend.watchWords(code, w => { S.words = w; refresh(); }, onError),
    backend.watchPlayers(code, p => { S.players = p; refresh(); }, onError),
  ];
}

function leaveRoom() {
  S.unsubs.forEach(stop => stop());
  Object.assign(S, { code: null, room: null, words: [], players: [], unsubs: [], layout: null, retake: false });
}

// Rebuild the page only when the layout changes; otherwise patch the live parts
// so typing in an input isn't interrupted by other people's updates.
function refresh() {
  if (!S.room || S.quiz) return;
  const view = S.room.phase === 'sort' ? (me()?.result && !S.retake ? 'result' : 'intro') : 'propose';
  const layout = `${view}|${isHost()}`;
  if (layout !== S.layout) {
    S.layout = layout;
    renderRoom(view);
  }
  if (isHost()) paintHost();
  if (view === 'propose') paintBoard();
  if (view === 'result') paintGroup();
}

function renderRoom(view) {
  const r = S.room;
  app.innerHTML = `
    <header class="room-head">
      <div>
        <p class="eyebrow">Room <b class="code">${r.code}</b> · ${view === 'propose' ? 'Phase 1: Propose' : 'Phase 2: Sort'}</p>
        <h1>${esc(r.name)}</h1>
      </div>
      <button class="btn ghost small" id="leave">Leave</button>
    </header>
    ${isHost() ? hostPanel() : ''}
    <main id="phase">${view === 'propose' ? proposeView() : view === 'intro' ? introView() : resultView()}</main>`;

  $('#leave').onclick = () => renderHome();
  if (isHost()) wireHost();
  const phase = $('#phase');
  if (view === 'propose') {
    phase.addEventListener('submit', guard(onPropose));
    phase.addEventListener('click', guard(onBoardClick));
  } else if (view === 'intro') {
    $('#begin').onclick = runQuiz;
  } else {
    $('#retake').onclick = () => { S.retake = true; refresh(); };
  }
}

function hostPanel() {
  const r = S.room;
  return `
    <section class="card host">
      <div class="host-share">
        <p class="eyebrow">You're hosting. Players join with</p>
        <p class="big-code">${r.code}</p>
        <button class="link" id="copy">Copy invite link</button>
      </div>
      <div class="host-ctl">
        ${r.phase === 'propose' ? `
          <form id="settings" class="settings">${settingsFields(r)}</form>
          <div class="go"><button class="btn" id="go-sort">Start sorting →</button><p class="why" id="why"></p></div>` : `
          <p class="progress" id="progress"></p>
          <button class="btn ghost" id="go-propose">← Reopen proposals</button>`}
      </div>
      <details class="players"><summary>Players <span id="pcount"></span></summary><ul id="plist"></ul></details>
    </section>`;
}

function wireHost() {
  const link = `${location.origin}${location.pathname}?room=${S.code}`;
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
    catch { prompt('Copy this link:', link); }
  };
  $('#settings')?.addEventListener('change', guard(e => backend.updateRoom(S.code, { [e.target.name]: +e.target.value })));
  $('#go-sort')?.addEventListener('click', guard(() => backend.updateRoom(S.code, { phase: 'sort' })));
  $('#go-propose')?.addEventListener('click', guard(() => backend.updateRoom(S.code, { phase: 'propose' })));
}

function paintHost() {
  const r = S.room;
  const players = [...S.players].sort((a, b) => a.name.localeCompare(b.name));
  $('#pcount').textContent = `(${players.length})`;
  $('#plist').innerHTML = players.map(p => `
    <li><span>${esc(p.name)}${p.id === backend.uid ? ' <small>(you)</small>' : ''}</span>
    ${p.result && catById(p.result.top) ? `<span class="tag" style="--c:${catById(p.result.top).color}">${esc(catById(p.result.top).name)}</span>` : ''}</li>`).join('');

  if (r.phase === 'propose') {
    const byCat = qualifiedWords(S.words, r.categories, r.minVotes);
    const empty = r.categories.filter(c => !byCat[c.id].length).map(c => c.name);
    const thin = r.categories.filter(c => byCat[c.id].length && byCat[c.id].length < 3).map(c => c.name);
    const total = Object.values(byCat).reduce((s, w) => s + w.length, 0);
    $('#go-sort').disabled = empty.length > 0;
    $('#why').textContent = empty.length ? `Waiting for qualifying words in ${listOf(empty)}.`
      : thin.length ? `Ready, though ${listOf(thin)} could use a few more words.`
      : `Ready: ${total} words qualify.`;
  } else {
    $('#progress').textContent = `${players.filter(p => p.result).length} of ${players.length} players sorted`;
  }
}

/* ---------- Phase 1: propose ---------- */

function proposeView() {
  return `
    <p class="lede">Add words that feel like each category, and tap other people's words to back them. A word needs <b id="need"></b> to make it into the sort.</p>
    <div class="board">${S.room.categories.map(c => `
      <section class="cat" style="--c:${c.color}">
        <h2>${esc(c.name)}</h2>
        <form class="add" data-cat="${c.id}">
          <input maxlength="${WORD_MAX}" placeholder="Add a word…" aria-label="Add a word for ${esc(c.name)}" autocomplete="off">
          <button class="btn small">Add</button>
        </form>
        <ul class="chips" data-cat="${c.id}"></ul>
      </section>`).join('')}
    </div>`;
}

async function onPropose(e) {
  e.preventDefault();
  const input = e.target.querySelector('input'), cat = e.target.dataset.cat;
  const text = normalizeWord(input.value);
  if (!text) return;
  if (!validWord(text)) return toast('Letters, numbers, spaces, hyphens and apostrophes only');
  if (isBlocked(text)) return toast("Let's keep it friendly. Try another word.");
  const outcome = await backend.propose(S.code, cat, text);
  input.value = '';
  input.focus();
  if (outcome === 'removed') toast('The host removed that word');
  else if (outcome === 'already') toast("You've already backed that one");
  else if (outcome === 'voted') toast(`Someone already said “${text}”, so you backed it`);
}

async function onBoardClick(e) {
  const vote = e.target.closest('[data-vote]'), remove = e.target.closest('[data-remove]');
  const w = S.words.find(w => w.id === (vote ?? remove)?.dataset[vote ? 'vote' : 'remove']);
  if (!w) return;
  if (vote) await backend.setVote(S.code, w.id, !w.voters.includes(backend.uid));
  else await backend.setRemoved(S.code, w.id, !w.removed);
}

function paintBoard() {
  const r = S.room, host = isHost();
  $('#need').textContent = r.minVotes === 1 ? 'just 1 backer' : `${r.minVotes} backers`;
  for (const c of r.categories) {
    const words = S.words
      .filter(w => w.cat === c.id && w.voters.length && (host || !w.removed) && !isBlocked(w.text))
      .sort((a, b) => a.removed - b.removed || b.voters.length - a.voters.length || a.text.localeCompare(b.text));
    $(`.chips[data-cat="${c.id}"]`).innerHTML = words.length ? words.map(w => {
      const n = w.voters.length, mine = w.voters.includes(backend.uid), ok = n >= r.minVotes;
      return `
        <li class="${w.removed ? 'removed' : ''}">
          <button class="chip${mine ? ' mine' : ''}${ok ? '' : ' pending'}" data-vote="${esc(w.id)}" aria-pressed="${mine}"
            ${w.removed ? 'disabled' : ''} title="${ok ? 'In the sort' : `Needs ${r.minVotes - n} more`}">${esc(w.text)}<span class="n">${n}</span></button>
          ${host ? `<button class="x" data-remove="${esc(w.id)}" aria-label="${w.removed ? 'Restore' : 'Remove'} ${esc(w.text)}" title="${w.removed ? 'Restore' : 'Remove'}">${w.removed ? '↺' : '×'}</button>` : ''}
        </li>`;
    }).join('') : '<li class="empty">No words yet</li>';
  }
}

/* ---------- Phase 2: sort ---------- */

function introView() {
  const r = S.room;
  return `
    <section class="card intro">
      <h2>Sort yourself</h2>
      <p>Two words will flash up. Pick the one that's more <em>you</em>. Don't overthink it: you have ${r.seconds} seconds, and if time runs out the pair is skipped.</p>
      <ul class="keys">
        <li><kbd>←</kbd> or <kbd>F</kbd> picks the left word</li>
        <li><kbd>→</kbd> or <kbd>J</kbd> picks the right word</li>
        <li>On a phone or tablet, tap the word</li>
      </ul>
      <p class="meta">${r.rounds} choices · under ${Math.ceil((r.rounds * (r.seconds + 0.3) + 2) / 60)} min</p>
      <button class="btn big" id="begin">I'm ready</button>
    </section>`;
}

async function runQuiz() {
  const r = S.room;
  const rounds = buildRounds(qualifiedWords(S.words, r.categories, r.minVotes), r.rounds);
  if (!rounds.length) return toast('There are not enough words to sort with yet');

  S.quiz = true;
  document.body.classList.add('quizzing');
  $('#phase').innerHTML = `
    <section class="quiz">
      <div class="quiz-top"><span id="qn"></span><span class="hint"><kbd>F</kbd> <kbd>←</kbd> &nbsp;or&nbsp; <kbd>→</kbd> <kbd>J</kbd></span></div>
      <div class="timer"><span id="tbar"></span></div>
      <div class="pair blank" id="pair">
        <button class="opt" id="optL"></button>
        <span class="or">or</span>
        <button class="opt" id="optR"></button>
      </div>
      <p class="flash" id="flash" aria-live="polite"></p>
    </section>`;
  try {
    for (const n of ['3', '2', '1']) { $('#flash').textContent = n; await sleep(600); }
    const answers = [];
    for (let i = 0; i < rounds.length; i++) {
      answers.push(await ask(rounds[i], i, rounds.length, r.seconds * 1000));
      await sleep(200);
    }
    await backend.saveResult(S.code, scoreRounds(rounds, answers, r.categories));
  } catch (err) {
    console.error(err);
    toast("Couldn't save your result. Try sorting again.");
  } finally {
    document.body.classList.remove('quizzing');
    S.quiz = false;
    S.retake = false;
    S.layout = null;
    refresh();
  }
}

// Shows one pair and resolves with { pick: 'left' | 'right' | null, ms }.
function ask(round, i, n, limit) {
  const pair = $('#pair'), L = $('#optL'), R = $('#optR'), bar = $('#tbar'), flash = $('#flash');
  L.textContent = round.left.text;
  R.textContent = round.right.text;
  $('#qn').textContent = `${i + 1} / ${n}`;
  flash.textContent = '';
  pair.classList.remove('blank');
  bar.style.transition = 'none';
  bar.style.transform = 'scaleX(1)';
  bar.getBoundingClientRect();
  bar.style.transition = `transform ${limit}ms linear`;
  bar.style.transform = 'scaleX(0)';
  const t0 = performance.now();

  return new Promise(resolve => {
    let over = false;
    const finish = pick => {
      if (over) return;
      over = true;
      const ms = Math.round(performance.now() - t0);
      clearTimeout(timer);
      removeEventListener('keydown', onKey);
      L.onclick = R.onclick = null;
      bar.style.transform = getComputedStyle(bar).transform;
      bar.style.transition = 'none';
      if (pick) (pick === 'left' ? L : R).classList.add('picked');
      else flash.textContent = 'Too slow, skipped';
      setTimeout(() => {
        L.classList.remove('picked');
        R.classList.remove('picked');
        pair.classList.add('blank');
        resolve({ pick, ms });
      }, pick ? 160 : 600);
    };
    const onKey = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'f') { e.preventDefault(); finish('left'); }
      else if (k === 'arrowright' || k === 'j') { e.preventDefault(); finish('right'); }
    };
    const timer = setTimeout(() => finish(null), limit);
    addEventListener('keydown', onKey);
    L.onclick = () => finish('left');
    R.onclick = () => finish('right');
  });
}

function bars(items, max) {
  return `<ol class="bars">${items.map(it => `
    <li style="--c:${it.color}">
      <span class="lbl">${esc(it.label)}</span>
      <span class="track"><span class="fill" style="width:${max ? (100 * it.value) / max : 0}%"></span></span>
      <span class="val">${it.text}</span>
    </li>`).join('')}</ol>`;
}

function resultView() {
  const res = me().result, top = catById(res.top);
  const ranked = [...S.room.categories].sort((a, b) => res.scores[b.id] - res.scores[a.id]);
  const best = Math.max(...ranked.map(c => res.scores[c.id]));
  return `
    <section class="card result" style="--c:${top?.color ?? 'var(--accent)'}">
      <p class="eyebrow">You sorted into</p>
      <h2 class="verdict">${esc(top?.name ?? '?')}</h2>
      ${bars(ranked.map(c => ({ label: c.name, color: c.color, value: res.scores[c.id], text: `${Math.round(res.scores[c.id])}%` })), best)}
      ${res.tells?.length ? `<p class="tells">Words that gave you away: ${res.tells.map(t => `<b style="--c:${catById(t.cat)?.color}">${esc(t.text)}</b>`).join(' ')}</p>` : ''}
      <p class="meta">${res.answered} of ${res.answered + res.skipped} answered · ${res.avgMs} ms per choice on average</p>
      <button class="btn ghost small" id="retake">Sort again</button>
    </section>
    <section class="card group">
      <h2>How the room sorted</h2>
      <p class="meta" id="gmeta"></p>
      <div id="gbars"></div>
    </section>`;
}

function paintGroup() {
  const cats = S.room.categories, done = S.players.filter(p => p.result);
  const counts = Object.fromEntries(cats.map(c => [c.id, []]));
  done.forEach(p => counts[p.result.top]?.push(p.name));
  $('#gmeta').textContent = `${done.length} of ${S.players.length} players sorted so far`;
  $('#gbars').innerHTML = bars(
    cats.map(c => ({ label: c.name, color: c.color, value: counts[c.id].length, text: counts[c.id].length })),
    Math.max(1, ...cats.map(c => counts[c.id].length)),
  ) + `<ul class="who">${cats.filter(c => counts[c.id].length).map(c => `
      <li style="--c:${c.color}"><b>${esc(c.name)}</b> ${counts[c.id].map(esc).join(', ')}</li>`).join('')}</ul>`;
}

/* ---------- Start ---------- */

if (isDemo) $('#demo').hidden = false;
const startCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
if (startCode) {
  const [room, player] = await Promise.all([backend.getRoom(startCode), backend.getPlayer(startCode)]);
  if (room && player) enterRoom(startCode);
  else {
    renderHome(room ? startCode : '');
    if (!room) toast(`No room with code ${startCode}`);
  }
} else {
  renderHome();
}
