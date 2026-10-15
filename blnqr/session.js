// Group games, from a shared 6-letter code or link, and the join page.
//  - Any-time sessions: people play whenever, and results update live.
//  - Live sessions: the host runs it from the front. Lobby → everyone plays at
//    once → the host reveals the group results → optionally a new round.
import { backend } from './backend.js';
import { introHTML, runGame } from './play.js';
import { loadGame, loginGate, wireLoginGate, gameHeader } from './game.js';
import { clean } from './types/editors.js';
import { $, app, esc, loadingHTML, toast, guard, go, onLeave, getName, rememberName } from './ui.js';

// 6-letter codes are group sessions; 5-letter codes are live word-proposal rooms.
export function renderJoin(code = '') {
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <form class="card join-card" id="join">
      <h2>Join a game</h2>
      <label>Code<input name="code" class="code-input" required minlength="5" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(code)}"></label>
      <label>Your name<input name="name" required maxlength="24" autocomplete="nickname" value="${esc(getName())}" placeholder="A nickname is fine"></label>
      <button class="btn">Join</button>
    </form>`;
  $('#join').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const c = f.get('code').trim().toUpperCase(), name = f.get('name').trim();
    if (!name) return toast('Enter your name');
    rememberName(name);
    if (c.length === 6) {
      if (!(await backend.getSession(c))) return toast(`No game with code ${c}`);
      await backend.joinSession(c, name);
      go(`?s=${c}`);
    } else {
      if (!(await backend.getRoom(c))) return toast(`No room with code ${c}`);
      await backend.joinRoom(c, name);
      go(`?room=${c}`);
    }
  }));
  $(code ? '#join [name=name]' : '#join [name=code]').focus();
}

// Starts a group session for a game and takes its creator (the host) into it.
export async function startSession(game, live, name) {
  const code = await backend.createSession(game, live);
  await backend.joinSession(code, name);
  go(`?s=${code}`);
}

export async function renderSession(code) {
  code = code.toUpperCase();
  app.innerHTML = loadingHTML;
  const [first, member] = await Promise.all([backend.getSession(code), backend.getMember(code)]);
  if (!first) {
    toast(`No game with code ${code}`);
    return go('?join', true);
  }
  if (!member) return go(`?join=${code}`, true);
  const loaded = await loadGame(first.gameId, './');
  if (!loaded) return;
  const { game, type } = loaded;

  const gate = loginGate(game);
  if (gate) {
    app.innerHTML = `<a class="back" href="./" data-link>← Home</a>${gameHeader(game, type)}${gate}`;
    wireLoginGate();
    return;
  }

  const S = { session: first, members: [], options: [], layout: null, playing: false, retake: false };
  const isHost = () => S.session.hostUid === backend.uid;
  const live = () => !!S.session.live;
  const round = () => S.session.round || 1;
  const me = () => S.members.find(m => m.id === backend.uid) || member;
  const inRound = m => m.summary && (!live() || (m.round || 1) === round());
  const myResult = () => (inRound(me()) ? me().summary : null);
  const link = `${location.origin}${location.pathname}?join=${code}`;

  // The game as played in this session: its own options plus any players added.
  const baseItems = () => game.content.items || [];
  const added = () => S.options.filter(o => !baseItems().some(i => i.text.toLowerCase() === o.text.toLowerCase()));
  const sessionGame = () => (game.allowAdd
    ? { ...game, content: { ...game.content, items: [...baseItems(), ...added().map(o => ({ text: o.text }))] } }
    : game);
  const notPlayable = () => type.ready({ ...sessionGame(), allowAdd: false });
  const canAdd = () => game.allowAdd && (!live() || S.session.phase === 'lobby');

  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    ${gameHeader(game, type, live() ? ' · Live session' : ' · Group game')}
    <section class="card share">
      <div><p class="eyebrow">${live() ? 'Join at this page with the code' : 'Invite people with the code'}</p><p class="big-code">${code}</p></div>
      <div class="share-actions">
        <button class="btn ghost small" id="copy">Copy invite link</button>
        <p class="meta">${live() ? 'Everyone starts together when the host says go.' : 'They can play any time, and results update live.'}</p>
      </div>
    </section>
    <div id="host-panel"></div>
    <div id="options-panel"></div>
    <main id="play"></main>
    <section class="card group leaderboard" id="board-card">
      <h2>How the group did</h2>
      <div id="board"></div>
      <p class="meta" id="waiting"></p>
    </section>`;

  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
    catch { prompt('Copy this link:', link); }
  };

  /* ---------- Host controls (live sessions) ---------- */

  const hostPanel = () => {
    const phase = S.session.phase;
    return `
      <section class="card host">
        <div class="host-ctl">
          <p class="eyebrow">You're the host · Round ${round()}</p>
          <p class="progress" id="host-progress"></p>
          <div class="go">
            ${phase === 'lobby' ? '<button class="btn" id="h-start">Start →</button>' : ''}
            ${phase === 'play' ? '<button class="btn" id="h-reveal">Reveal results</button><button class="btn ghost" id="h-play">Play along</button>' : ''}
            ${phase === 'reveal' ? '<button class="btn" id="h-again">New round</button>' : ''}
          </div>
          <p class="why" id="host-why"></p>
        </div>
        <details class="players" open><summary>Players <span id="pcount"></span></summary><ul id="plist"></ul></details>
      </section>`;
  };
  const wireHost = () => {
    $('#h-start')?.addEventListener('click', guard(() => backend.updateSession(code, { phase: 'play' })));
    $('#h-reveal')?.addEventListener('click', guard(() => backend.updateSession(code, { phase: 'reveal' })));
    $('#h-again')?.addEventListener('click', guard(() => backend.updateSession(code, { phase: 'lobby', round: round() + 1 })));
    $('#h-play')?.addEventListener('click', guard(startPlay));
  };
  const paintHost = () => {
    if (!$('#plist')) return;
    const ms = [...S.members].sort((a, b) => a.name.localeCompare(b.name));
    const status = m => inRound(m) ? 'done' : m.status === 'playing' && (m.round || 1) === round() ? 'playing…' : '';
    $('#pcount').textContent = `(${ms.length})`;
    $('#plist').innerHTML = ms.map(m => `<li><span>${esc(m.name)}${m.id === backend.uid ? ' <small>(you)</small>' : ''}</span><span class="meta">${status(m)}</span></li>`).join('');
    const done = ms.filter(inRound).length;
    const phase = S.session.phase;
    $('#host-progress').textContent = phase === 'lobby' ? `${ms.length} ${ms.length === 1 ? 'player' : 'players'} in the lobby`
      : phase === 'play' ? `${done} of ${ms.length} done` : 'Results revealed';
    const start = $('#h-start');
    if (start) {
      const why = notPlayable();
      start.disabled = !!why;
      $('#host-why').textContent = why ? `Not ready yet: ${why}` : '';
    }
  };

  /* ---------- Options players add (Group pick) ---------- */

  const optionsPanel = () => `
    <section class="card options-panel">
      <h2>Options</h2>
      <p class="meta">${live() ? 'Add your ideas before the host starts.' : 'Add your ideas. Anyone who already played can play again to rank new ones.'}</p>
      <form class="add" id="add-opt">
        <input maxlength="80" placeholder="Add an option…" aria-label="Add an option" autocomplete="off">
        <button class="btn small">Add</button>
      </form>
      <ul class="chips" id="opt-list"></ul>
    </section>`;
  const wireOptions = () => {
    $('#add-opt').addEventListener('submit', guard(async e => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      let text;
      try { text = clean(input.value, 80); } catch (err) { return toast(err.message); }
      if (!text) return;
      if (baseItems().some(i => i.text.toLowerCase() === text.toLowerCase())) return toast('That option is already on the list');
      const outcome = await backend.addOption(code, text);
      input.value = '';
      input.focus();
      if (outcome === 'exists') toast('Someone already added that');
    }));
    $('#opt-list').addEventListener('click', guard(async e => {
      const key = e.target.closest('[data-remove]')?.dataset.remove;
      if (key) await backend.removeOption(code, key);
    }));
  };
  const paintOptions = () => {
    if (!$('#opt-list')) return;
    const mine = o => o.by === backend.uid || isHost();
    $('#opt-list').innerHTML = [
      ...baseItems().map(i => `<li><span class="chip">${esc(i.text)}</span></li>`),
      ...added().map(o => `<li><span class="chip mine">${esc(o.text)}</span>${mine(o) ? `<button class="x" data-remove="${esc(o.id)}" aria-label="Remove ${esc(o.text)}">×</button>` : ''}</li>`),
    ].join('') || '<li class="empty">No options yet</li>';
  };

  /* ---------- Playing ---------- */

  async function startPlay() {
    if (S.playing) return;
    const g = sessionGame(), why = notPlayable();
    if (why) return toast(`Not ready yet: ${why}`);
    S.playing = true;
    const playingRound = round();
    try {
      await backend.setMember(code, { status: 'playing', round: playingRound });
      const summary = await runGame($('#play'), g, type);
      if (summary) await backend.saveSessionResult(code, game.id, summary, playingRound);
    } catch (err) {
      console.error(err);
      toast("Couldn't save your result to the group.");
    } finally {
      S.playing = false;
      S.retake = false;
      S.layout = null;
      refresh();
    }
  }

  const resultBlock = (extra = '') => {
    const s = myResult();
    return s ? type.result(sessionGame(), s) + extra : '';
  };

  function renderMain() {
    const el = $('#play'), phase = S.session.phase, mine = myResult();
    if (!live()) {
      if (mine && !S.retake) {
        el.innerHTML = resultBlock('<div class="result-actions"><button class="btn ghost" id="again">Play again</button></div>');
        type.wireResult?.(el, sessionGame(), mine);
        $('#again').onclick = () => { S.retake = true; S.layout = null; refresh(); };
      } else {
        el.innerHTML = introHTML(sessionGame(), type, `<p class="meta">Playing as <b>${esc(me().name)}</b></p>`);
        $('.intro-actions', el).innerHTML = '<button class="btn big" id="begin">I’m ready</button>';
        $('#begin').onclick = guard(startPlay);
      }
      return;
    }
    if (phase === 'lobby') {
      el.innerHTML = isHost() ? '' : `
        <section class="card intro waiting-card">
          <h2>You're in, ${esc(me().name)}!</h2>
          <p>Waiting for the host to start. Keep this page open: your game begins on its own.</p>
        </section>`;
    } else if (phase === 'play') {
      if (mine) {
        el.innerHTML = resultBlock('<p class="you-vs">Waiting for the host to reveal the group results…</p>');
        type.wireResult?.(el, sessionGame(), mine);
      } else if (isHost()) {
        el.innerHTML = '';
      } else {
        el.innerHTML = '<section class="card intro waiting-card"><h2>Here we go!</h2></section>';
        queueMicrotask(startPlay);
      }
    } else {
      el.innerHTML = mine ? resultBlock() : '';
      if (mine) type.wireResult?.(el, sessionGame(), mine);
    }
  }

  /* ---------- Keeping the page in sync ---------- */

  function refresh() {
    if (!S.session || S.playing || !$('#play')) return;
    const phase = S.session.phase;
    const layout = [live(), phase, round(), isHost(), !!myResult(), S.retake, canAdd()].join('|');
    if (layout !== S.layout) {
      S.layout = layout;
      $('#host-panel').innerHTML = live() && isHost() ? hostPanel() : '';
      if (live() && isHost()) wireHost();
      $('#options-panel').innerHTML = canAdd() ? optionsPanel() : '';
      if (canAdd()) wireOptions();
      renderMain();
    }
    $('#board-card').hidden = live() && phase !== 'reveal' && !isHost();
    paintHost();
    paintOptions();
    paintBoard();
  }

  const paintBoard = () => {
    if (!$('#board')) return;
    $('#board').innerHTML = type.board(sessionGame(), S.members.filter(inRound), backend.uid);
    const waiting = S.members.filter(m => !inRound(m)).map(m => m.name);
    $('#waiting').textContent = waiting.length ? `Still to play: ${waiting.join(', ')}` : '';
  };

  const onError = err => console.error(err);
  onLeave(backend.watchSession(code, s => { if (s) { S.session = s; refresh(); } }, onError));
  onLeave(backend.watchMembers(code, m => { S.members = m; refresh(); }, onError));
  if (game.allowAdd) onLeave(backend.watchOptions(code, o => { S.options = o; refresh(); }, onError));
  refresh();
}
