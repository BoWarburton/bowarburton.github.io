// Setup: sign in, list your sorts, and create or edit team sorts and solo blnqrs.
import { backend, isDemo } from './backend.js';
import { normalizeWord, validWord, qualifiedWords } from './quiz.js';
import { isBlocked } from './filter.js';
import { DEFAULT_QUESTION } from './play.js';
import { startRoomFrom } from './team.js';
import { playable } from './solo.js';
import {
  $, app, esc, loadingHTML, toast, guard, go, PALETTE, PRESETS, DEFAULTS, DEFAULT_VERDICT,
  settingsFields, swatches,
} from './ui.js';

const shareLink = id => `${location.origin}${location.pathname}?sort=${id}`;

export async function renderSetup() {
  const u = backend.user;
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <header class="page-head split-head">
      <div>
        <h1>Setup</h1>
        <p class="lede">Make <b>blnqrs</b> anyone can play solo from the public page, and <b>team sorts</b> you can start live rooms from.</p>
      </div>
      ${u.google ? `<p class="who-am-i">Signed in as <b>${esc(u.name)}</b> · <button class="link" id="signout">Sign out</button></p>` : ''}
    </header>
    <div id="setup-body"></div>`;
  const body = $('#setup-body');

  if (!u.google) {
    body.innerHTML = `
      <section class="card signin">
        <h2>Sign in to make and edit sorts</h2>
        <p>Signing in with Google lets you edit your sorts from any device. Players never need to sign in.</p>
        <button class="btn" id="signin">Sign in with Google</button>
        ${isDemo ? '<p class="meta">Demo mode: sign-in is simulated, and every signed-in tab shares one account.</p>' : ''}
      </section>`;
    $('#signin').onclick = guard(async () => { await backend.signIn(); renderSetup(); });
    return;
  }
  $('#signout').onclick = guard(async () => { await backend.signOut(); renderSetup(); });

  body.innerHTML = `
    <div class="new-row">
      <a class="btn" href="?edit=new&mode=solo" data-link>+ New blnqr (solo)</a>
      <a class="btn ghost" href="?edit=new&mode=team" data-link>+ New team sort</a>
    </div>
    <div id="my-sorts" class="my-sorts">${loadingHTML}</div>`;

  const sorts = (await backend.listMySorts()).sort((a, b) => b.updated - a.updated);
  const list = $('#my-sorts');
  if (!list) return;
  list.innerHTML = sorts.length ? sorts.map(s => {
    const solo = s.mode === 'solo';
    return `
      <article class="card sort-row">
        <div class="sort-info">
          <p class="eyebrow"><span class="badge ${s.mode}">${solo ? 'blnqr' : 'Team'}</span>
            ${solo ? `${s.public ? 'Public' : 'Unlisted'} · ${s.plays || 0} ${s.plays === 1 ? 'player' : 'players'}` : `${s.minVotes} backers · ${s.rounds} choices`}</p>
          <h2>${esc(s.name)}</h2>
          ${swatches(s.categories)}
          ${solo && !playable(s) ? '<p class="warn">Some categories have no words yet, so this can\'t be played.</p>' : ''}
        </div>
        <div class="actions">
          <a class="btn small ghost" href="?edit=${s.id}" data-link>Edit</a>
          ${solo ? `
            <a class="btn small ghost" href="?sort=${s.id}" data-link>Play</a>
            <button class="btn small ghost" data-copy="${s.id}">Copy link</button>` : `
            <button class="btn small" data-start="${s.id}">Start room</button>`}
          <button class="btn small ghost danger" data-delete="${s.id}">Delete</button>
        </div>
      </article>`;
  }).join('') : '<div class="card empty-state"><p>You haven\'t made any sorts yet.</p></div>';

  list.onclick = guard(async e => {
    const b = e.target.closest('button');
    const s = sorts.find(s => s.id === (b?.dataset.copy || b?.dataset.start || b?.dataset.delete));
    if (!s) return;
    if (b.dataset.start) return startRoomFrom(s);
    if (b.dataset.copy) {
      try { await navigator.clipboard.writeText(shareLink(s.id)); toast('Link copied'); }
      catch { prompt('Copy this link:', shareLink(s.id)); }
      return;
    }
    if (!confirm(`Delete “${s.name}”${s.mode === 'solo' ? ' and its leaderboard' : ''}? This can't be undone.`)) return;
    await backend.deleteSort(s.id);
    toast('Deleted');
    renderSetup();
  });
}

/* ---------- Editor ---------- */

let nextCat = 0;
const newCat = (color, name = '', words = []) =>
  ({ id: `c${Date.now().toString(36)}${(nextCat++).toString(36)}`, name, color, words, text: words.join(', ') });

// Splits a word box into clean words, and reports any that aren't allowed.
function parseWords(text) {
  const words = [], bad = [];
  for (const raw of text.split(/[,\n]/)) {
    const w = normalizeWord(raw);
    if (!w) continue;
    if (!validWord(w) || isBlocked(w)) bad.push(raw.trim());
    else if (!words.includes(w)) words.push(w);
  }
  return { words, bad };
}

// param: a sort id, 'new' (with mode), or 'quick' for an unsaved one-off team room.
export async function renderEditor(param, modeParam) {
  const quick = param === 'quick', isNew = param === 'new';
  if (!quick && !backend.user.google) return go('?setup', true);

  let sort;
  if (quick || isNew) {
    sort = {
      mode: quick || modeParam === 'team' ? 'team' : 'solo', name: '', description: '', public: true,
      question: '', verdict: '', ...DEFAULTS, categories: [newCat(PALETTE[0]), newCat(PALETTE[1])],
    };
  } else {
    app.innerHTML = loadingHTML;
    sort = await backend.getSort(param);
    if (!sort || sort.ownerUid !== backend.uid) {
      toast('You can only edit sorts you made');
      return go('?setup', true);
    }
  }
  let cats = sort.categories.map(c => ({ ...c, words: c.words || [], text: (c.words || []).join(', ') }));

  app.innerHTML = `
    <a class="back" href="${quick ? '?team' : '?setup'}" data-link>← Back</a>
    <form class="card create" id="editor" data-mode="${sort.mode}">
      <h2>${quick ? 'Quick team room' : isNew ? 'New sort' : 'Edit sort'}</h2>
      ${quick ? '' : `
      <div class="seg" role="radiogroup" aria-label="Kind of sort">
        <label><input type="radio" name="mode" value="solo"${sort.mode === 'solo' ? ' checked' : ''}><span><b>blnqr</b><small>Played solo from the public page or a link. You write the words.</small></span></label>
        <label><input type="radio" name="mode" value="team"${sort.mode === 'team' ? ' checked' : ''}><span><b>Team sort</b><small>A template for live rooms. Players propose the words.</small></span></label>
      </div>`}
      <div class="presets"><span>Start from</span>${PRESETS.map((p, i) => `<button type="button" class="pill" data-preset="${i}">${esc(p.name)}</button>`).join('')}</div>
      <label>Name<input name="name" required maxlength="40" value="${esc(sort.name)}" placeholder="e.g. Hogwarts Houses, Best pizza topping, Which era?"></label>
      ${quick ? '' : `<label>Description <small>optional, shown on the public page</small><textarea name="description" rows="2" maxlength="200">${esc(sort.description || '')}</textarea></label>`}
      <fieldset>
        <legend>Categories <small>2 to 8. To rank options, make each option a category.</small></legend>
        <div id="cats" class="cat-edit"></div>
        <button type="button" class="btn ghost small" id="add-cat">+ Add category</button>
      </fieldset>
      <div class="import solo-only">
        <label>Import words from a team room<span class="inline"><input id="import-code" maxlength="5" placeholder="Room code" class="code-input small-code" autocapitalize="characters"><button type="button" class="btn ghost small" id="import">Import</button></span></label>
      </div>
      <fieldset>
        <legend>Wording</legend>
        <div class="settings">
          <label>Question players answer<input name="question" maxlength="60" value="${esc(sort.question || '')}" placeholder="${DEFAULT_QUESTION}"></label>
          <label>Result heading<input name="verdict" maxlength="40" value="${esc(sort.verdict || '')}" placeholder="${DEFAULT_VERDICT}"></label>
        </div>
      </fieldset>
      <fieldset><legend>Rules</legend><div class="settings">${settingsFields(sort)}</div></fieldset>
      <label class="check solo-only"><input type="checkbox" name="public"${sort.public !== false ? ' checked' : ''}> List on the public sorts page <small>(unlisted blnqrs can still be played by link)</small></label>
      <div class="form-actions">
        ${quick ? '<button class="btn" name="after" value="start">Start room</button>' : `
          <button class="btn" name="after" value="list">Save</button>
          <button class="btn ghost team-only" name="after" value="start">Save &amp; start a room</button>
          <button class="btn ghost solo-only" name="after" value="play">Save &amp; play</button>`}
      </div>
    </form>`;

  const form = $('#editor');
  const mode = () => (quick ? 'team' : form.elements.mode.value);

  const drawCats = () => {
    $('#cats').innerHTML = cats.map((c, i) => `
      <div class="cat-row" style="--c:${c.color}">
        <div class="cat-line">
          <input type="color" class="swatch" data-color="${i}" value="${c.color}" aria-label="Color for category ${i + 1}">
          <input data-name="${i}" value="${esc(c.name)}" maxlength="24" required placeholder="Category ${i + 1}" aria-label="Category ${i + 1}">
          <button type="button" class="x" data-del="${i}" ${cats.length <= 2 ? 'disabled' : ''} aria-label="Remove category">×</button>
        </div>
        <textarea class="solo-only words" data-words="${i}" rows="2" placeholder="Words for this category, separated by commas">${esc(c.text)}</textarea>
        <p class="solo-only count" data-count="${i}"></p>
      </div>`).join('');
    cats.forEach((_, i) => countWords(i));
    $('#add-cat').disabled = cats.length >= 8;
  };
  const countWords = i => {
    const { words, bad } = parseWords(cats[i].text);
    $(`[data-count="${i}"]`).textContent = `${words.length} ${words.length === 1 ? 'word' : 'words'}`
      + (bad.length ? ` · not allowed: ${bad.join(', ')}` : words.length === 0 ? ' · needs at least one' : '');
    $(`[data-count="${i}"]`).classList.toggle('warn', bad.length > 0 || words.length === 0);
  };

  $('#cats').addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.name) cats[d.name].name = e.target.value;
    if (d.words) { cats[d.words].text = e.target.value; countWords(+d.words); }
    if (d.color) { cats[d.color].color = e.target.value; e.target.closest('.cat-row').style.setProperty('--c', e.target.value); }
  });
  $('#cats').addEventListener('click', e => {
    const i = e.target.closest('[data-del]')?.dataset.del;
    if (i) { cats.splice(+i, 1); drawCats(); }
  });
  $('#add-cat').onclick = () => {
    cats.push(newCat(PALETTE.find(p => !cats.some(c => c.color === p)) ?? PALETTE[0]));
    drawCats();
    $('#cats .cat-row:last-child [data-name]').focus();
  };
  $('.presets').onclick = e => {
    const p = PRESETS[e.target.dataset.preset];
    if (!p) return;
    form.elements.name.value = p.name;
    cats = p.cats.map(([name, color]) => newCat(color, name));
    drawCats();
  };
  form.addEventListener('change', e => { if (e.target.name === 'mode') form.dataset.mode = e.target.value; });

  // Pull the qualifying words from a team room, matching categories by name.
  $('#import').onclick = guard(async () => {
    const code = $('#import-code').value.trim().toUpperCase();
    const room = code && await backend.getRoom(code);
    if (!room) return toast(`No room with code ${code}`);
    const byCat = qualifiedWords(await backend.getRoomWords(code), room.categories, room.minVotes);
    if (cats.every(c => !c.name.trim() && !c.text.trim())) {
      cats = room.categories.map(rc => newCat(rc.color, rc.name));
      if (!form.elements.name.value) form.elements.name.value = room.name;
    }
    let added = 0;
    for (const rc of room.categories) {
      const target = cats.find(c => c.name.trim().toLowerCase() === rc.name.toLowerCase());
      if (!target) continue;
      const have = parseWords(target.text).words;
      const fresh = byCat[rc.id].filter(w => !have.includes(w));
      target.text = [...have, ...fresh].join(', ');
      added += fresh.length;
    }
    drawCats();
    toast(added ? `Imported ${added} words` : 'No new words matched these category names');
  });

  form.addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = new FormData(form), after = e.submitter?.value || 'list';
    const names = cats.map(c => c.name.trim());
    if (names.some(n => !n)) return toast('Every category needs a name');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast('Category names must all be different');
    const parsed = cats.map(c => parseWords(c.text));
    if (mode() === 'solo') {
      const bad = parsed.flatMap(p => p.bad);
      if (bad.length) return toast(`Remove these words first: ${bad.join(', ')}`);
    }
    const data = {
      mode: mode(),
      name: f.get('name').trim(),
      description: (f.get('description') || '').trim(),
      public: mode() === 'solo' && f.get('public') === 'on',
      question: f.get('question').trim(),
      verdict: f.get('verdict').trim(),
      categories: cats.map((c, i) => ({ id: c.id, name: names[i], color: c.color, words: parsed[i].words })),
      minVotes: +f.get('minVotes'),
      rounds: +f.get('rounds'),
      seconds: +f.get('seconds'),
    };
    if (quick) return startRoomFrom(data);

    const id = await backend.saveSort(isNew ? null : sort.id, data);
    toast('Saved');
    if (after === 'start') return startRoomFrom({ ...data, id });
    if (after === 'play') {
      if (!playable(data)) {
        toast('Saved, but every category needs at least one word before it can be played');
        return go(`?edit=${id}`, true);
      }
      return go(`?sort=${id}`);
    }
    go('?setup');
  }));

  drawCats();
}
