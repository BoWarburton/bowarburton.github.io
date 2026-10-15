// A game's page: play it solo, start a group, and see how everyone did.
import { backend, isDemo } from './backend.js';
import { typeOf } from './types/index.js';
import { introHTML, runGame } from './play.js';
import { startRoomFrom } from './team.js';
import { startSession } from './session.js';
import { $, app, esc, loadingHTML, toast, guard, go, onLeave, getName, rememberName } from './ui.js';

const VISIBILITY = { public: 'Public', link: 'Anyone with the link', invite: 'Invite only' };

// Loads a game, or renders why it can't be shown. Returns null if it rendered a notice.
export async function loadGame(id, back = '?browse') {
  let game;
  try {
    game = await backend.getGame(id);
  } catch (err) {
    if (err.code !== 'permission-denied') throw err;
    privateNotice(back);
    return null;
  }
  const type = game && typeOf(game.type);
  if (!type) {
    notice(back, "This game doesn't exist, or it was deleted.");
    return null;
  }
  const u = backend.user;
  if (game.visibility === 'invite' && game.ownerUid !== u.uid && !(game.invites || []).includes(u.email)) {
    privateNotice(back);
    return null;
  }
  return { game, type };
}

function notice(back, text, extra = '') {
  app.innerHTML = `
    <a class="back" href="${back}" data-link>← Back</a>
    <div class="card empty-state"><p>${text}</p>${extra}</div>`;
}

function privateNotice(back) {
  const u = backend.user;
  notice(back, u.google
    ? `This game is invite-only, and ${esc(u.email || 'your account')} isn't on the list. Ask whoever shared it to invite you.`
    : 'This game is invite-only. Sign in with the Google account you were invited with.',
    u.google ? '' : '<button class="btn" id="signin">Sign in with Google</button>');
  $('#signin')?.addEventListener('click', guard(async () => { await backend.signIn(); go(location.search, true); }));
}

// Returns markup asking the player to sign in, or '' when they may play.
export function loginGate(game) {
  if (!game.loginRequired || backend.user.google) return '';
  return `
    <section class="card signin">
      <h2>Sign in to play</h2>
      <p>The creator of this game asks players to sign in, so results can be tied to real accounts.</p>
      <button class="btn" id="signin">Sign in with Google</button>
      ${isDemo ? '<p class="meta">Demo mode: sign-in is simulated.</p>' : ''}
    </section>`;
}

export function wireLoginGate() {
  $('#signin')?.addEventListener('click', guard(async () => { await backend.signIn(); go(location.search, true); }));
}

export function gameHeader(game, type, eyebrowExtra = '') {
  const own = game.ownerUid === backend.uid;
  return `
    <header class="page-head" style="--c:${type.color}">
      <p class="eyebrow"><span class="type-badge">${esc(type.label)}</span>${eyebrowExtra}
        ${game.visibility !== 'public' ? ` · ${VISIBILITY[game.visibility]}` : ''}
        ${own ? ` · <a href="?edit=${game.id}" data-link>Edit</a>` : ''}</p>
      <h1>${esc(game.title)}</h1>
      ${game.description ? `<p class="lede">${esc(game.description)}</p>` : ''}
    </header>`;
}

export async function renderGame(id) {
  app.innerHTML = loadingHTML;
  const loaded = await loadGame(id);
  if (!loaded) return;
  const { game, type } = loaded;

  app.innerHTML = `
    <a class="back" href="?browse" data-link>← Browse</a>
    ${gameHeader(game, type, ` · ${game.plays || 0} ${game.plays === 1 ? 'play' : 'plays'}`)}
    <main id="play"></main>
    ${game.solo ? `
      <section class="card group leaderboard">
        <h2>${type.id === 'persona' ? 'How everyone sorted' : ['preference', 'group', 'decision'].includes(type.id) ? 'Everyone combined' : 'Leaderboard'}</h2>
        <div id="board"></div>
      </section>` : ''}`;
  const el = $('#play');

  const notReady = type.ready(game);
  if (notReady) {
    el.innerHTML = `<div class="card empty-state"><p>This game isn't ready to play yet. ${esc(notReady)}</p></div>`;
    return;
  }
  const gate = loginGate(game);
  if (gate) {
    el.innerHTML = gate;
    wireLoginGate();
    return;
  }

  let mine = game.solo ? await backend.getMyResult(id) : null, entries = [], retake = false;
  if (!el.isConnected) return;

  const actions = () => `
    ${game.solo ? `<button class="btn${mine ? ' ghost' : ' big'}" data-act="solo">${mine ? 'Play again' : 'Play solo'}</button>` : ''}
    ${game.group ? `<button class="btn ${game.solo ? 'ghost' : 'big'}" data-act="group">Start a group game</button>` : ''}
    ${game.group ? '<button class="btn ghost" data-act="live">Host a live session</button>' : ''}
    ${game.group && type.liveRoom ? '<button class="btn ghost" data-act="room">Host a live room</button>' : ''}`;

  const draw = () => {
    if (mine && !retake) {
      el.innerHTML = type.result(game, mine.summary) + `<div class="result-actions">${actions()}</div>`;
      type.wireResult?.(el, game, mine.summary);
    } else {
      el.innerHTML = introHTML(game, type, `
        <label class="nick">Your name${game.solo ? ' for the leaderboard' : ''}<input id="pname" maxlength="24" value="${esc(mine?.name || getName())}" placeholder="A nickname is fine"></label>
        ${game.group ? `<p class="meta"><b>Group game:</b> people play whenever they like from a shared code. <b>Live session:</b> you run it from the front and everyone starts at once.${type.liveRoom ? ' <b>Live room:</b> players propose their own words first.' : ''}</p>` : ''}`);
      $('.intro-actions', el).innerHTML = actions();
    }
    paintBoard();
  };

  const name = () => {
    const input = $('#pname');
    const n = (input ? input.value : mine?.name || getName()).trim();
    if (!n) { input?.focus(); toast('Enter your name first'); return ''; }
    rememberName(n);
    return n;
  };

  el.addEventListener('click', guard(async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'solo') {
      if (mine && !retake) { retake = true; return draw(); }
      const why = type.ready({ ...game, allowAdd: false });
      if (why) return toast(`Solo play needs more options: ${why}`);
      const n = name();
      if (!n) return;
      const summary = await runGame(el, game, type);
      if (!summary) return;
      try { await backend.saveResult(id, n, summary); }
      catch (err) { console.error(err); toast("Couldn't save to the leaderboard, but here's your result."); }
      mine = { name: n, summary };
      retake = false;
      draw();
    } else if (act === 'group' || act === 'live') {
      const n = name();
      if (n) await startSession(game, act === 'live', n);
    } else if (act === 'room') {
      await startRoomFrom(game);
    }
  }));

  const paintBoard = () => {
    const board = $('#board');
    if (board) board.innerHTML = type.board(game, entries.filter(e => e.summary), backend.uid);
  };
  if (game.solo) onLeave(backend.watchResults(id, r => { entries = r; paintBoard(); }, err => console.error(err)));
  draw();
}
