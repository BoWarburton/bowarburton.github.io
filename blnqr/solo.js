// Solo play: the public list of blnqrs, and playing one on your own.
import { backend } from './backend.js';
import { buildRounds, scoreRounds } from './quiz.js';
import { introHTML, runQuiz } from './play.js';
import {
  $, app, esc, loadingHTML, toast, guard, onLeave, getName, rememberName,
  swatches, resultCard, tallyBars, averageBars,
} from './ui.js';

export const playable = s => s.categories.length >= 2 && s.categories.every(c => c.words?.length);
const wordsByCat = s => Object.fromEntries(s.categories.map(c => [c.id, c.words || []]));

export async function renderPublic() {
  app.innerHTML = `
    <a class="back" href="./" data-link>← Home</a>
    <header class="page-head">
      <h1>Public sorts &amp; challenges</h1>
      <p class="lede">Each of these is a <b>blnqr</b> (say “blinker”): a few dozen split-second choices that sort you, rank a list, or settle a decision. See where you land, then see how everyone else did.</p>
    </header>
    <div id="public-list" class="sort-grid">${loadingHTML}</div>`;

  const sorts = (await backend.listPublicSorts())
    .filter(playable)
    .sort((a, b) => (b.plays || 0) - (a.plays || 0) || b.updated - a.updated);
  const list = $('#public-list');
  if (!list) return;
  list.innerHTML = sorts.length ? sorts.map(s => `
    <a class="card sort-card" href="?sort=${s.id}" data-link>
      <h2>${esc(s.name)}</h2>
      ${s.description ? `<p>${esc(s.description)}</p>` : ''}
      ${swatches(s.categories)}
      <p class="meta"><span>${s.plays || 0} ${s.plays === 1 ? 'player' : 'players'}</span><span class="play">Play →</span></p>
    </a>`).join('') : `
    <div class="card empty-state">
      <p>No public blnqrs yet.</p>
      <a class="btn" href="?setup" data-link>Make one in Setup</a>
    </div>`;
}

export async function renderSolo(id) {
  app.innerHTML = loadingHTML;
  const [sort, saved] = await Promise.all([backend.getSort(id), backend.getMyResult(id)]);
  if (!sort || sort.mode !== 'solo' || !playable(sort)) {
    app.innerHTML = `
      <a class="back" href="?play" data-link>← All blnqrs</a>
      <div class="card empty-state"><p>This blnqr doesn't exist or isn't ready to play yet.</p></div>`;
    return;
  }

  let mine = saved, results = [], retake = false;
  app.innerHTML = `
    <a class="back" href="?play" data-link>← All blnqrs</a>
    <header class="page-head">
      <p class="eyebrow">blnqr</p>
      <h1>${esc(sort.name)}</h1>
      ${sort.description ? `<p class="lede">${esc(sort.description)}</p>` : ''}
    </header>
    <main id="solo"></main>
    <section class="card group leaderboard">
      <h2>How everyone sorted</h2>
      <p class="meta" id="lb-meta"></p>
      <div id="lb-bars"></div>
      <h3>Everyone's average</h3>
      <div id="lb-avg"></div>
      <h3>Recent players</h3>
      <ul class="recent" id="lb-recent"></ul>
    </section>`;

  const cat = cid => sort.categories.find(c => c.id === cid);

  const draw = () => {
    const el = $('#solo');
    if (mine && !retake) {
      el.innerHTML = resultCard(mine, sort.categories, sort.verdict) + '<p class="you-vs" id="you-vs"></p>';
      $('#retake').onclick = () => { retake = true; draw(); };
      paintBoard();
    } else {
      el.innerHTML = introHTML(sort.rounds, sort.seconds, sort.question, `
        <label class="nick">Your name for the leaderboard<input id="pname" maxlength="24" value="${esc(mine?.name || getName())}" placeholder="A nickname is fine"></label>`);
      $('#begin').onclick = guard(play);
    }
  };

  const play = async () => {
    const name = $('#pname').value.trim();
    if (!name) { $('#pname').focus(); return toast('Enter a name for the leaderboard'); }
    rememberName(name);
    const rounds = buildRounds(wordsByCat(sort), sort.rounds);
    const answers = await runQuiz($('#solo'), rounds, sort.seconds, sort.question);
    if (!answers) return;
    const result = scoreRounds(rounds, answers, sort.categories);
    try {
      await backend.saveSoloResult(id, name, result);
    } catch (err) {
      console.error(err);
      toast("Couldn't save to the leaderboard, but here's your result.");
    }
    mine = { name, ...result };
    retake = false;
    draw();
  };

  const paintBoard = () => {
    if (!$('#lb-meta')) return;
    const n = results.length;
    $('#lb-meta').textContent = n ? `${n} ${n === 1 ? 'person has' : 'people have'} taken this blnqr` : 'Nobody has taken this blnqr yet. Be the first!';
    $('#lb-bars').innerHTML = tallyBars(sort.categories, results);
    $('#lb-avg').innerHTML = averageBars(sort.categories, results);
    $('#lb-recent').innerHTML = [...results].sort((a, b) => b.at - a.at).slice(0, 15).map(r => `
      <li${r.id === backend.uid ? ' class="me"' : ''}><span>${esc(r.name)}</span>
      ${cat(r.top) ? `<span class="tag" style="--c:${cat(r.top).color}">${esc(cat(r.top).name)}</span>` : ''}</li>`).join('');
    const vs = $('#you-vs');
    if (vs && mine && cat(mine.top)) {
      const same = results.filter(r => r.top === mine.top).length;
      vs.textContent = n > 1 ? `You're one of ${same} out of ${n} people (${Math.round((100 * same) / n)}%) who landed in ${cat(mine.top).name}.` : '';
    }
  };

  onLeave(backend.watchResults(id, r => { results = r; paintBoard(); }, err => console.error(err)));
  draw();
}
