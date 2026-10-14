// Team play: live rooms where everyone proposes words, then sorts themselves.
import { backend } from './backend.js';
import { WORD_MAX, normalizeWord, validWord, qualifiedWords, buildRounds, scoreRounds } from './quiz.js';
import { isBlocked } from './filter.js';
import { introHTML, runQuiz } from './play.js';
import {
  $, app, esc, listOf, loadingHTML, toast, guard, go, onLeave, getName, rememberName, askHostName,
  settingsFields, resultCard, tallyBars, averageBars,
} from './ui.js';

// Room state, kept in sync by the backend watchers.
const S = { code: null, room: null, words: [], players: [], layout: null, quiz: false, retake: false };
const isHost = () => S.room?.hostUid === backend.uid;
const me = () => S.players.find(p => p.id === backend.uid);
const catById = id => S.room.categories.find(c => c.id === id);

/* ---------- Join / host ---------- */

export async function renderTeam(code = '') {
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <header class="page-head">
      <h1>Team play</h1>
      <p class="lede">Everyone in the room proposes words for each category together, then sorts themselves in a rapid-fire round.</p>
    </header>
    <div class="split">
      <form class="card" id="join">
        <h2>Join a room</h2>
        <label>Room code<input name="code" class="code-input" required minlength="5" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(code)}"></label>
        <label>Your name<input name="name" required maxlength="24" autocomplete="nickname" value="${esc(getName())}"></label>
        <button class="btn">Join</button>
      </form>
      <div class="card host-card">
        <h2>Host a room</h2>
        <div id="my-team-sorts"></div>
        <a class="btn ghost" href="?edit=quick" data-link>Quick one-off room →</a>
      </div>
    </div>`;

  $('#join').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const code = f.get('code').trim().toUpperCase(), name = f.get('name').trim();
    if (!name) return toast('Enter your name');
    if (!(await backend.getRoom(code))) return toast(`No room with code ${code}`);
    rememberName(name);
    await backend.joinRoom(code, name);
    go(`?room=${code}`);
  }));
  $(code ? '#join [name=name]' : '#join [name=code]').focus();

  const box = $('#my-team-sorts');
  if (!backend.user.google) {
    box.innerHTML = '<p><a href="?setup" data-link>Sign in to Setup</a> to save team sorts you can reuse, or start a one-off room.</p>';
    return;
  }
  box.innerHTML = loadingHTML;
  const sorts = (await backend.listMySorts()).filter(s => s.mode === 'team').sort((a, b) => b.updated - a.updated);
  if (!box.isConnected) return;
  box.innerHTML = sorts.length
    ? `<p>Start a room from one of your team sorts:</p><ul class="pick">${sorts.map(s => `
        <li><span>${esc(s.name)}</span><button class="btn small" data-start="${s.id}">Start room</button></li>`).join('')}</ul>`
    : '<p>You have no saved team sorts yet. <a href="?edit=new&mode=team" data-link>Create one in Setup</a>, or start a one-off room.</p>';
  box.onclick = guard(async e => {
    const s = sorts.find(s => s.id === e.target.dataset.start);
    if (s) await startRoomFrom(s);
  });
}

// Creates a live room from a saved (or unsaved) sort and takes the host into it.
export async function startRoomFrom(sort) {
  const name = askHostName();
  if (!name) return;
  const code = await backend.createRoom({
    name: sort.name,
    categories: sort.categories.map(({ id, name, color }) => ({ id, name, color })),
    minVotes: sort.minVotes,
    rounds: sort.rounds,
    seconds: sort.seconds,
    question: sort.question || '',
    verdict: sort.verdict || '',
    ...(sort.id ? { sortId: sort.id } : {}),
  });
  await backend.joinRoom(code, name);
  go(`?room=${code}`);
}

/* ---------- Room ---------- */

export async function openRoom(code) {
  code = code.toUpperCase();
  app.innerHTML = loadingHTML;
  const [room, player] = await Promise.all([backend.getRoom(code), backend.getPlayer(code)]);
  if (room && player) return enterRoom(code);
  history.replaceState(null, '', '?team');
  renderTeam(room ? code : '');
  if (!room) toast(`No room with code ${code}`);
}

function enterRoom(code) {
  Object.assign(S, { code, room: null, words: [], players: [], layout: null, retake: false });
  const onError = err => { console.error(err); toast('Lost connection to the room'); };
  const stops = [
    backend.watchRoom(code, r => { S.room = r; refresh(); }, onError),
    backend.watchWords(code, w => { S.words = w; refresh(); }, onError),
    backend.watchPlayers(code, p => { S.players = p; refresh(); }, onError),
  ];
  onLeave(() => { stops.forEach(stop => stop()); S.code = S.room = null; });
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
      <a class="btn ghost small" href="?team" data-link>Leave</a>
    </header>
    ${isHost() ? hostPanel() : ''}
    <main id="phase">${view === 'propose' ? proposeView() : view === 'intro' ? introHTML(r.rounds, r.seconds, r.question) : resultView()}</main>`;

  if (isHost()) wireHost();
  const phase = $('#phase');
  if (view === 'propose') {
    phase.addEventListener('submit', guard(onPropose));
    phase.addEventListener('click', guard(onBoardClick));
  } else if (view === 'intro') {
    $('#begin').onclick = startQuiz;
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
    <p class="lede">Add words that fit each category, and tap other people's words to back them. A word needs <b id="need"></b> to make it into the sort.</p>
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

async function startQuiz() {
  const r = S.room;
  const rounds = buildRounds(qualifiedWords(S.words, r.categories, r.minVotes), r.rounds);
  if (!rounds.length) return toast('There are not enough words to sort with yet');
  S.quiz = true;
  try {
    const answers = await runQuiz($('#phase'), rounds, r.seconds, r.question);
    if (answers) await backend.saveResult(S.code, scoreRounds(rounds, answers, r.categories));
  } catch (err) {
    console.error(err);
    toast("Couldn't save your result. Try sorting again.");
  } finally {
    S.quiz = false;
    S.retake = false;
    S.layout = null;
    refresh();
  }
}

function resultView() {
  return `
    ${resultCard(me().result, S.room.categories, S.room.verdict)}
    <section class="card group">
      <h2>How the room sorted</h2>
      <p class="meta" id="gmeta"></p>
      <div id="gbars"></div>
      <h3>Room average</h3>
      <div id="gavg"></div>
    </section>`;
}

function paintGroup() {
  const cats = S.room.categories, done = S.players.filter(p => p.result);
  $('#gmeta').textContent = `${done.length} of ${S.players.length} players sorted so far`;
  $('#gbars').innerHTML = tallyBars(cats, done.map(p => p.result)) + `<ul class="who">${cats.map(c => {
    const names = done.filter(p => p.result.top === c.id).map(p => esc(p.name));
    return names.length ? `<li style="--c:${c.color}"><b>${esc(c.name)}</b> ${names.join(', ')}</li>` : '';
  }).join('')}</ul>`;
  $('#gavg').innerHTML = averageBars(cats, done.map(p => p.result));
}
