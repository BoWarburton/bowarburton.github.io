// The home page (popular games, call to action) and the browse/search page.
import { backend } from './backend.js';
import { TYPES, typeOf } from './types/index.js';
import { $, app, esc, guard, go, toast } from './ui.js';

// Public games that can actually be played, most played first.
async function playablePublicGames() {
  return (await backend.listPublicGames())
    .filter(g => typeOf(g.type) && !typeOf(g.type).ready(g) && (g.solo || g.group))
    .sort((a, b) => (b.plays || 0) - (a.plays || 0) || b.updated - a.updated);
}

export function gameCard(g) {
  const t = typeOf(g.type), plays = g.plays || 0;
  const modes = [g.solo && 'solo', g.group && 'group'].filter(Boolean).join(' or ');
  return `
    <a class="card game-card" href="?g=${g.id}" data-link style="--c:${t.color}">
      <p class="eyebrow"><span class="type-badge">${esc(t.label)}</span></p>
      <h3>${esc(g.title)}</h3>
      ${g.description ? `<p class="desc">${esc(g.description)}</p>` : ''}
      <p class="meta"><span>${plays} ${plays === 1 ? 'play' : 'plays'} · ${modes}</span><span class="play">Play →</span></p>
    </a>`;
}

const typeCards = () => TYPES.map(t => `
  <a class="card type-card" href="?browse&type=${t.id}" data-link style="--c:${t.color}">
    <h3>${esc(t.label)}</h3>
    <p>${esc(t.blurb)}</p>
    <p class="meta">e.g. ${esc(t.example)}</p>
  </a>`).join('');

export async function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1 class="wordmark">blnqr</h1>
      <p class="tagline">Say “blinker”. Two choices, a split second, your gut decides. Find out who you are, test what you know, or settle what to pick, alone or with a group.</p>
      <div class="cta" id="cta">
        <a class="btn big" href="?browse" data-link>Play a game</a>
        <a class="btn big ghost" href="?setup" data-link>Make your own</a>
      </div>
      <form class="code-join" id="code-join">
        <label for="hc">Have a code?</label>
        <input id="hc" class="code-input" maxlength="6" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn small">Join</button>
      </form>
    </section>
    <section class="home-section" id="popular-wrap" hidden>
      <div class="section-head"><h2>Popular right now</h2><a href="?browse" data-link>See all →</a></div>
      <div class="game-grid" id="popular"></div>
    </section>
    <section class="home-section">
      <div class="section-head"><h2>Seven ways to play</h2></div>
      <div class="type-grid">${typeCards()}</div>
    </section>
    <section class="card make-cta">
      <div>
        <h2>Make a blnqr in minutes</h2>
        <p>Type or paste your words, pick a game type, and share the link. Keep it private for your class or family, or publish it for everyone.</p>
      </div>
      <a class="btn" href="?setup" data-link>Start making →</a>
    </section>`;

  $('#code-join').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('#hc').value.trim().toUpperCase();
    if (code.length < 5) return toast('Codes are 5 or 6 letters');
    go(`?join=${code}`);
  });

  const games = await playablePublicGames();
  if (!$('#popular')) return;
  const featured = games.find(g => g.solo) || games[0];
  if (featured) {
    $('#cta').innerHTML = `
      <a class="btn big" href="?g=${featured.id}" data-link>▶ Play now: ${esc(featured.title)}</a>
      <a class="btn big ghost" href="?browse" data-link>Browse all games</a>`;
    $('#popular').innerHTML = games.slice(0, 6).map(gameCard).join('');
    $('#popular-wrap').hidden = false;
  }
}

export async function renderBrowse(params) {
  let type = typeOf(params.get('type'))?.id || '', q = params.get('q') || '';
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <header class="page-head">
      <h1>Browse games</h1>
      <p class="lede">Every public blnqr. Play solo, or start a group and share the link.</p>
    </header>
    <div class="filters">
      <input type="search" id="q" placeholder="Search games…" value="${esc(q)}" aria-label="Search games">
      <div class="chips-row" id="type-filter">
        <button class="pill" data-type="">All</button>
        ${TYPES.map(t => `<button class="pill" data-type="${t.id}" style="--c:${t.color}">${esc(t.label)}</button>`).join('')}
      </div>
    </div>
    <div class="game-grid" id="results"><p class="loading">Loading…</p></div>`;

  const games = await playablePublicGames();
  if (!$('#results')) return;

  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = games.filter(g => (!type || g.type === type)
      && words.every(w => `${g.title} ${g.description || ''} ${typeOf(g.type).label}`.toLowerCase().includes(w)));
    $('#results').innerHTML = shown.length ? shown.map(gameCard).join('') : `
      <div class="card empty-state">
        <p>${games.length ? 'No games match that search.' : 'No public games yet.'}</p>
        <a class="btn" href="?setup" data-link>Make one</a>
      </div>`;
    document.querySelectorAll('#type-filter .pill').forEach(b => b.classList.toggle('on', b.dataset.type === type));
    const url = new URLSearchParams({ browse: '' });
    if (type) url.set('type', type);
    if (q) url.set('q', q);
    history.replaceState(null, '', `?${url.toString().replace('browse=', 'browse')}`);
  };
  $('#q').addEventListener('input', e => { q = e.target.value; draw(); });
  $('#type-filter').addEventListener('click', guard(async e => {
    if (e.target.dataset.type == null) return;
    type = e.target.dataset.type;
    draw();
  }));
  draw();
}
