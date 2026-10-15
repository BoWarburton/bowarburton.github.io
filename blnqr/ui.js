// Shared UI helpers, constants and navigation used by every page.

export const PALETTE = ['#dc2626', '#ca8a04', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];
export const DEFAULTS = { minVotes: 2, rounds: 30, seconds: 2.5 };
export const OPTIONS = {
  minVotes: [[1, 'Just 1 (anything goes)'], [2, '2 people'], [3, '3 people']],
  rounds: [[10, '10 (quick)'], [20, '20'], [30, '30'], [40, '40 (thorough)']],
  seconds: [[0, 'No timer'], [1.5, '1.5 s (pure gut)'], [2.5, '2.5 s'], [4, '4 s'], [8, '8 s (relaxed)']],
  cards: [[0, 'All cards'], [10, '10'], [20, '20'], [30, '30']],
  topK: [[0, 'Full ranking'], [1, 'Just the winner'], [3, 'Top 3'], [5, 'Top 5'], [10, 'Top 10']],
};
const LABELS = { minVotes: 'Backers a word needs', rounds: 'Choices per player', seconds: 'Time per choice', cards: 'Cards per play', topK: 'How much to rank' };

export const $ = (sel, root = document) => root.querySelector(sel);
export const app = $('#app');
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const listOf = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
export const loadingHTML = '<p class="loading">Loading…</p>';

let savedName = '';
try { savedName = localStorage.getItem('blnqr-name') || ''; } catch {}
export const getName = () => savedName;
export function rememberName(name) {
  savedName = name;
  try { localStorage.setItem('blnqr-name', name); } catch {}
}
export function askHostName() {
  const name = (savedName || prompt('Your name (shown to players)') || '').trim().slice(0, 24);
  if (name) rememberName(name);
  return name;
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// Wraps async handlers so failures show up as a toast instead of vanishing.
export const guard = fn => async e => {
  try { await fn(e); } catch (err) {
    console.error(err);
    toast(err.code === 'permission-denied' ? "That isn't allowed right now"
      : err.code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled'
      : err.message || 'Something went wrong');
  }
};

/* Navigation: pages are query strings (?team, ?play, ?sort=ID, ?setup, ?edit=ID, ?room=CODE). */

let router = () => {};
export function setRouter(fn) { router = fn; }
export function go(query, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](null, '', query || location.pathname);
  router();
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});

// Live listeners a page registers, torn down when navigating away.
const cleanups = [];
export function onLeave(fn) { cleanups.push(fn); }
export function leavePage() {
  while (cleanups.length) cleanups.pop()();
  document.body.classList.remove('quizzing');
}

/* Shared markup */

export function settingsFields(values, keys = ['minVotes', 'rounds', 'seconds']) {
  return keys.map(k => `
    <label${k === 'minVotes' ? ' class="team-only"' : ''}>${LABELS[k]}<select name="${k === 'cards' ? 'rounds' : k}">${OPTIONS[k]
      .map(([v, text]) => `<option value="${v}"${+values[k === 'cards' ? 'rounds' : k] === v ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`).join('');
}

export function bars(items, max) {
  return `<ol class="bars">${items.map(it => `
    <li style="--c:${it.color}">
      <span class="lbl">${esc(it.label)}</span>
      <span class="track"><span class="fill" style="width:${max ? (100 * it.value) / max : 0}%"></span></span>
      <span class="val">${it.text}</span>
    </li>`).join('')}</ol>`;
}

export const swatches = cats =>
  `<ul class="swatches">${cats.map(c => `<li style="--c:${c.color}">${esc(c.name)}</li>`).join('')}</ul>`;

// The personal result card for "You are a…" games.
export const DEFAULT_VERDICT = 'You sorted into';

export function resultCard(res, categories, verdict) {
  const cat = id => categories.find(c => c.id === id);
  const score = c => res.scores[c.id] ?? 0;
  const top = cat(res.top);
  const ranked = [...categories].sort((a, b) => score(b) - score(a));
  return `
    <section class="card result" style="--c:${top?.color ?? 'var(--accent)'}">
      <p class="eyebrow">${esc(verdict || DEFAULT_VERDICT)}</p>
      <h2 class="verdict">${esc(top?.name ?? '?')}</h2>
      ${bars(ranked.map(c => ({ label: c.name, color: c.color, value: score(c), text: `${Math.round(score(c))}%` })), Math.max(...ranked.map(score)))}
      ${res.tells?.length ? `<p class="tells">Words that gave you away: ${res.tells.map(t => `<b style="--c:${cat(t.cat)?.color}">${esc(t.text)}</b>`).join(' ')}</p>` : ''}
      <p class="meta">${res.answered} of ${res.answered + res.skipped} answered · ${res.avgMs} ms per choice on average</p>
    </section>`;
}

// The group's average profile: a shared ranking of the categories.
export function averageBars(categories, people) {
  const avg = c => people.length ? people.reduce((s, p) => s + (p.scores?.[c.id] ?? 0), 0) / people.length : 0;
  const ranked = [...categories].sort((a, b) => avg(b) - avg(a));
  return bars(ranked.map(c => ({ label: c.name, color: c.color, value: avg(c), text: `${Math.round(avg(c))}%` })), Math.max(1, ...ranked.map(avg)));
}

// Bars counting how many people landed in each category.
export function tallyBars(categories, people) {
  const counts = Object.fromEntries(categories.map(c => [c.id, 0]));
  people.forEach(p => { if (p.top in counts) counts[p.top]++; });
  return bars(
    categories.map(c => ({ label: c.name, color: c.color, value: counts[c.id], text: counts[c.id] })),
    Math.max(1, ...Object.values(counts)),
  );
}
