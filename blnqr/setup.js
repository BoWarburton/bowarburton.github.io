// Setup: sign in, list your games, pick a type, and create or edit a game.
import { backend, isDemo } from './backend.js';
import { TYPES, typeOf } from './types/index.js';
import { clean } from './types/editors.js';
import { $, app, esc, loadingHTML, toast, guard, go, settingsFields } from './ui.js';

const shareLink = id => `${location.origin}${location.pathname}?g=${id}`;
const VIS_LABEL = { public: 'Public', link: 'Secret link', invite: 'Invite only' };

function signInCard() {
  return `
    <section class="card signin">
      <h2>Sign in to make and edit games</h2>
      <p>Signing in with Google lets you edit your games from any device. Players only need to sign in if you ask them to.</p>
      <button class="btn" id="signin">Sign in with Google</button>
      ${isDemo ? '<p class="meta">Demo mode: sign-in is simulated, and every signed-in tab shares one account.</p>' : ''}
    </section>`;
}

export async function renderSetup() {
  const u = backend.user;
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <header class="page-head split-head">
      <div>
        <h1>Setup</h1>
        <p class="lede">Make games for yourself, your class, your family, or the whole world.</p>
      </div>
      ${u.google ? `<p class="who-am-i">Signed in as <b>${esc(u.name)}</b> · <button class="link" id="signout">Sign out</button></p>` : ''}
    </header>
    <div id="setup-body"></div>`;
  const body = $('#setup-body');

  if (!u.google) {
    body.innerHTML = signInCard();
    $('#signin').onclick = guard(async () => { await backend.signIn(); renderSetup(); });
    return;
  }
  $('#signout').onclick = guard(async () => { await backend.signOut(); renderSetup(); });

  body.innerHTML = `
    <div class="new-row"><a class="btn" href="?new" data-link>+ New game</a></div>
    <div id="my-games" class="my-sorts">${loadingHTML}</div>`;

  const games = (await backend.listMyGames()).sort((a, b) => b.updated - a.updated);
  const list = $('#my-games');
  if (!list) return;
  list.innerHTML = games.length ? games.map(g => {
    const t = typeOf(g.type), notReady = t?.ready(g);
    return `
      <article class="card sort-row" style="--c:${t?.color}">
        <div class="sort-info">
          <p class="eyebrow"><span class="type-badge">${esc(t?.label || g.type)}</span>
            ${VIS_LABEL[g.visibility] || ''}${g.loginRequired ? ' · login required' : ''} · ${g.plays || 0} ${g.plays === 1 ? 'play' : 'plays'}</p>
          <h2>${esc(g.title)}</h2>
          ${notReady ? `<p class="warn">Not playable yet: ${esc(notReady)}</p>` : ''}
        </div>
        <div class="actions">
          <a class="btn small ghost" href="?edit=${g.id}" data-link>Edit</a>
          <a class="btn small ghost" href="?g=${g.id}" data-link>Open</a>
          <button class="btn small ghost" data-copy="${g.id}">Copy link</button>
          <button class="btn small ghost danger" data-delete="${g.id}">Delete</button>
        </div>
      </article>`;
  }).join('') : '<div class="card empty-state"><p>You haven\'t made any games yet.</p><a class="btn" href="?new" data-link>Make your first</a></div>';

  list.onclick = guard(async e => {
    const b = e.target.closest('button');
    const g = games.find(g => g.id === (b?.dataset.copy || b?.dataset.delete));
    if (!g) return;
    if (b.dataset.copy) {
      try { await navigator.clipboard.writeText(shareLink(g.id)); toast('Link copied'); }
      catch { prompt('Copy this link:', shareLink(g.id)); }
      return;
    }
    if (!confirm(`Delete “${g.title}” and its results? This can't be undone.`)) return;
    await backend.deleteGame(g.id);
    toast('Deleted');
    renderSetup();
  });
}

export function renderNew() {
  if (!backend.user.google) return go('?setup', true);
  app.innerHTML = `
    <a class="back" href="?setup" data-link>← Setup</a>
    <header class="page-head"><h1>What kind of game?</h1></header>
    <div class="type-grid">${TYPES.map(t => `
      <a class="card type-card" href="?edit=new&type=${t.id}" data-link style="--c:${t.color}">
        <h3>${esc(t.label)}</h3>
        <p>${esc(t.blurb)}</p>
        <p class="meta">e.g. ${esc(t.example)}</p>
      </a>`).join('')}
    </div>`;
}

const templateHint = {
  categorizer: 'Use {category} where the category name goes.',
  decision: 'Use {criterion} where the criterion goes.',
  flashcard: 'Leave blank to show each card’s prompt.',
};

export async function renderEditor(param, typeParam) {
  if (!backend.user.google) return go('?setup', true);
  const isNew = param === 'new';
  let game;
  if (isNew) {
    const t = typeOf(typeParam);
    if (!t) return go('?new', true);
    game = {
      type: t.id, title: '', description: '', visibility: 'public', invites: [], loginRequired: false,
      rounds: 0, topK: 0, feedback: true, repeat: false, allowAdd: false, ...t.defaults, content: {},
    };
  } else {
    app.innerHTML = loadingHTML;
    game = await backend.getGame(param);
    if (!game || game.ownerUid !== backend.uid) {
      toast('You can only edit games you made');
      return go('?setup', true);
    }
  }
  const type = typeOf(game.type), editor = type.editor(game), has = k => type.options.includes(k);

  app.innerHTML = `
    <a class="back" href="?setup" data-link>← Setup</a>
    <form class="card create" id="editor" style="--c:${type.color}">
      <p class="eyebrow"><span class="type-badge">${esc(type.label)}</span></p>
      <h2>${isNew ? 'New game' : 'Edit game'}</h2>
      <label>Title<input name="title" required maxlength="60" value="${esc(game.title)}" placeholder="e.g. ${esc(type.example)}"></label>
      <label>Description <small>optional, shown to players</small><textarea name="description" rows="2" maxlength="300">${esc(game.description || '')}</textarea></label>

      ${editor.html}

      <fieldset>
        <legend>Wording</legend>
        <div class="settings">
          <label>Question players see <small>${esc(templateHint[type.id] || '')}</small><input name="question" maxlength="80" value="${esc(game.question || '')}" placeholder="${esc(type.defaults.question)}"></label>
          <label>Result heading<input name="verdict" maxlength="40" value="${esc(game.verdict || '')}" placeholder="${esc(type.defaults.verdict)}"></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Play</legend>
        <div class="settings">${settingsFields(game, ['seconds', 'rounds', 'cards', 'topK'].filter(has))}</div>
        ${has('feedback') ? `<label class="check"><input type="checkbox" name="feedback"${game.feedback !== false ? ' checked' : ''}> Show right and wrong answers as they play</label>` : ''}
        ${has('repeat') ? `<label class="check"><input type="checkbox" name="repeat"${game.repeat ? ' checked' : ''}> Bring missed cards back at the end</label>` : ''}
        ${has('addOptions') ? `<label class="check"><input type="checkbox" name="allowAdd"${game.allowAdd ? ' checked' : ''}> Players can add their own options in group games</label>` : ''}
      </fieldset>

      <fieldset>
        <legend>Who can play</legend>
        <div class="check-row">
          <label class="check"><input type="checkbox" name="solo"${game.solo ? ' checked' : ''}> Solo</label>
          <label class="check"><input type="checkbox" name="group"${game.group ? ' checked' : ''}> Groups</label>
        </div>
        <div class="seg seg3" role="radiogroup" aria-label="Visibility">
          ${[['public', 'Public', 'Listed on the site for anyone to find and play.'],
             ['link', 'Secret link', 'Not listed. Anyone you send the link to can play.'],
             ['invite', 'Invite only', 'Only the Google accounts you list can play.']].map(([v, l, d]) => `
            <label><input type="radio" name="visibility" value="${v}"${game.visibility === v ? ' checked' : ''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}
        </div>
        <label class="invites"${game.visibility === 'invite' ? '' : ' hidden'}>Invited emails <small>separated by commas or new lines</small>
          <textarea name="invites" rows="3" placeholder="student1@school.org, aunt.jo@gmail.com">${esc((game.invites || []).join('\n'))}</textarea></label>
        <label class="check"><input type="checkbox" name="loginRequired"${game.loginRequired || game.visibility === 'invite' ? ' checked' : ''}${game.visibility === 'invite' ? ' disabled' : ''}> Players must sign in with Google</label>
      </fieldset>

      <div class="form-actions">
        <button class="btn" name="after" value="list">Save</button>
        <button class="btn ghost" name="after" value="play">Save &amp; play</button>
      </div>
    </form>`;

  const form = $('#editor');
  editor.wire(form);

  form.addEventListener('change', e => {
    if (e.target.name !== 'visibility') return;
    const invite = e.target.value === 'invite', login = form.elements.loginRequired;
    $('.invites', form).hidden = !invite;
    login.disabled = invite;
    if (invite) login.checked = true;
  });

  form.addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(form), after = e.submitter?.value || 'list';
    let content;
    try { content = editor.read(); } catch (err) { return toast(err.message); }
    const visibility = f.get('visibility');
    const invites = visibility === 'invite'
      ? [...new Set(String(f.get('invites') || '').split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean))]
      : [];
    const badEmail = invites.find(s => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (badEmail) return toast(`“${badEmail}” doesn't look like an email address`);
    if (visibility === 'invite' && !invites.length) return toast('Add at least one email to invite');
    const solo = f.get('solo') === 'on', group = f.get('group') === 'on';
    if (!solo && !group) return toast('Allow solo play, groups, or both');

    let title, description, question, verdict;
    try {
      title = clean(f.get('title'), 60);
      description = clean(f.get('description') || '', 300);
      question = clean(f.get('question') || '', 80);
      verdict = clean(f.get('verdict') || '', 40);
    } catch (err) { return toast(err.message); }
    if (!title) return toast('Give your game a title');

    const data = {
      type: type.id, title, description, question, verdict, content,
      visibility, invites, loginRequired: visibility === 'invite' || f.get('loginRequired') === 'on',
      solo, group,
      seconds: +(f.get('seconds') ?? game.seconds ?? 0),
      rounds: +(f.get('rounds') ?? game.rounds ?? 0),
      topK: +(f.get('topK') ?? game.topK ?? 0),
      feedback: has('feedback') ? f.get('feedback') === 'on' : true,
      repeat: has('repeat') ? f.get('repeat') === 'on' : false,
      allowAdd: has('addOptions') && f.get('allowAdd') === 'on',
    };
    const id = await backend.saveGame(isNew ? null : game.id, data);
    toast('Saved');
    const notReady = type.ready(data);
    if (after === 'play') {
      if (notReady) {
        toast(`Saved, but not playable yet: ${notReady}`);
        return go(`?edit=${id}`, true);
      }
      return go(`?g=${id}`);
    }
    go('?setup');
  }));
}
