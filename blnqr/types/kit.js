// Building blocks shared by the game types: sorting by comparisons, consensus
// rankings, quiz rounds, and the markup for scores and leaderboards.
import { esc, bars } from '../ui.js';
import { pictureFor } from '../pictures/index.js';

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (m, k) => values[k] ?? m);
export const mean = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

/* ---------- Sorting by comparisons ---------- */

// Merge sort driven by an async comparison. With k, only the top k are found,
// which takes far fewer comparisons (the top k of a merge come from the top k
// of each half).
export async function mergeSort(items, before, k = Infinity) {
  if (items.length <= 1) return items.slice(0, k);
  const mid = items.length >> 1;
  const left = await mergeSort(items.slice(0, mid), before, k);
  const right = await mergeSort(items.slice(mid), before, k);
  const out = [];
  while (out.length < k && left.length && right.length) out.push((await before(left[0], right[0])) ? left.shift() : right.shift());
  while (out.length < k && left.length) out.push(left.shift());
  while (out.length < k && right.length) out.push(right.shift());
  return out;
}

// Worst-case number of comparisons mergeSort makes, for progress display.
export function sortCost(n, k = Infinity) {
  if (n <= 1) return 0;
  const a = n >> 1, b = n - a;
  return sortCost(a, k) + sortCost(b, k) + Math.min(Math.min(a, k) + Math.min(b, k) - 1, k);
}

// Wraps the runner's ask() as a comparison for mergeSort. A timeout asks again,
// since a sort can't skip a comparison. Share a counter to number choices
// across several sorts.
export function comparer(ask, { prompt, total, counter = { n: 0 }, log }) {
  return async (a, b) => {
    for (;;) {
      const flip = Math.random() < 0.5;
      const [left, right] = flip ? [b, a] : [a, b];
      const res = await ask({ prompt, left: { text: left }, right: { text: right }, n: ++counter.n, total, approx: true });
      if (!res.pick) continue;
      log?.push(res.ms);
      return (res.pick === 'left') !== flip;
    }
  };
}

// Fraction of item pairs that two orders put the same way round (1 = identical).
export function pairAgreement(order, reference) {
  const pos = new Map(reference.map((x, i) => [x, i]));
  const xs = order.filter(x => pos.has(x));
  let agree = 0, total = 0;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      total++;
      if (pos.get(xs[i]) < pos.get(xs[j])) agree++;
    }
  }
  return total ? agree / total : 1;
}

// Combines many rankings (best first, possibly only the top few) into one,
// Borda style. Returns [{ key, score 0..1 }] best first.
export function consensus(rankings, keys) {
  const n = keys.length, total = Object.fromEntries(keys.map(k => [k, 0]));
  const worth = pos => (n > 1 ? (n - 1 - pos) / (n - 1) : 1);
  for (const r of rankings) {
    const ranked = r.filter(k => k in total);
    ranked.forEach((k, pos) => { total[k] += worth(pos); });
    // Unranked items share the average of the positions left over.
    const rest = keys.filter(k => !ranked.includes(k));
    const leftover = n > 1 ? (n - 1 - ranked.length) / 2 / (n - 1) : 0;
    rest.forEach(k => { total[k] += leftover; });
  }
  return keys
    .map(key => ({ key, score: rankings.length ? total[key] / rankings.length : 0 }))
    .sort((a, b) => b.score - a.score);
}

/* ---------- Right-or-wrong quiz rounds (flashcard, categorizer) ---------- */

// rounds: [{ prompt, answer, wrong, cat? }]. Missed rounds can come back once at
// the end; only first attempts count toward the score.
export async function quizRounds(rounds, ask, { repeat = false } = {}) {
  const queue = [...rounds], log = [];
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i], left = Math.random() < 0.5;
    const res = await ask({
      prompt: r.prompt,
      left: { text: left ? r.answer : r.wrong },
      right: { text: left ? r.wrong : r.answer },
      correct: left ? 'left' : 'right',
      n: i + 1,
      total: queue.length,
    });
    const ok = res.pick === (left ? 'left' : 'right');
    if (!r.retry) log.push({ ...r, ok, pick: res.pick, ms: res.ms });
    if (!ok && repeat && !r.retry) queue.push({ ...r, retry: true });
  }
  const answered = log.filter(l => l.pick);
  const byCat = {};
  for (const l of log) {
    if (!l.cat) continue;
    byCat[l.cat] ??= [0, 0];
    byCat[l.cat][1]++;
    if (l.ok) byCat[l.cat][0]++;
  }
  return {
    correct: log.filter(l => l.ok).length,
    total: log.length,
    avgMs: Math.round(mean(answered.map(l => l.ms))),
    missed: log.filter(l => !l.ok).map(l => ({ prompt: l.prompt, answer: l.answer, chose: l.pick ? l.wrong : null })),
    ...(Object.keys(byCat).length ? { byCat } : {}),
  };
}

export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function scoreHTML(game, s, extra = '') {
  return `
    <section class="card result">
      <p class="eyebrow">${esc(game.verdict || 'Your score')}</p>
      <h2 class="verdict">${s.correct} / ${s.total}</h2>
      <p class="meta">${pct(s.correct, s.total)}% correct · ${s.avgMs} ms per choice on average</p>
      ${extra}
      ${s.missed.length ? `
        <h3>To review</h3>
        <ul class="missed">${s.missed.map(m => `
          <li>${m.prompt ? `<span class="q">${esc(m.prompt)}</span>` : ''}
            ${game.pictures && pictureFor(m.answer) ? `<img class="thumb" src="${pictureFor(m.answer)}" alt="">` : ''}<b>${esc(m.answer)}</b>${m.chose ? ` <span class="meta">(you chose ${esc(m.chose)})</span>` : ' <span class="meta">(too slow)</span>'}</li>`).join('')}
        </ul>` : '<p class="tells">A perfect run!</p>'}
    </section>`;
}

// Ranked table of players, best first. rows: [{ id, name, value, detail }]
export function leaderboard(rows, me, valueLabel) {
  if (!rows.length) return '<p class="meta">Nobody has played yet. Be the first!</p>';
  return `
    <ol class="leaders">${rows.slice(0, 20).map((r, i) => `
      <li${r.id === me ? ' class="me"' : ''}><span class="rank">${i + 1}</span><span class="who-name">${esc(r.name)}</span>
        <span class="score">${r.value}<small>${esc(valueLabel)}</small></span><span class="meta">${esc(r.detail || '')}</span></li>`).join('')}
    </ol>`;
}

export function quizBoard(entries, me) {
  const rows = entries.map(e => ({
    id: e.id, name: e.name, acc: e.summary.correct / (e.summary.total || 1), ms: e.summary.avgMs,
    value: `${pct(e.summary.correct, e.summary.total)}%`, detail: `${e.summary.avgMs} ms`,
  })).sort((a, b) => b.acc - a.acc || a.ms - b.ms);
  return `<p class="meta">${entries.length} ${entries.length === 1 ? 'player' : 'players'} · average ${pct(
    entries.reduce((s, e) => s + e.summary.correct, 0), entries.reduce((s, e) => s + e.summary.total, 0))}% correct</p>`
    + leaderboard(rows, me, ' correct');
}

// A numbered ranking with score bars, used for preference and decision results.
export function rankingHTML(rows) {
  return `<ol class="ranking">${rows.map((r, i) => `
    <li style="--c:${r.color || 'var(--accent)'}">
      <span class="rank">${i + 1}</span>
      <span class="item">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span>
      ${r.value != null ? `<span class="track"><span class="fill" style="width:${Math.round(100 * r.value)}%"></span></span>` : ''}
    </li>`).join('')}</ol>`;
}

export { bars };
