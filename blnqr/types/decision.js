// 7. Decision maker: compare the options on each criterion, then weight the
// criteria by importance for a final ranking.
import { $, esc, PALETTE } from '../ui.js';
import { shuffle, mergeSort, sortCost, comparer, fill, mean } from './kit.js';
import { linesEditor, criteriaEditor, clean } from './editors.js';

const active = g => g.content.criteria.filter(c => c.weight > 0);
const color = (g, id) => PALETTE[g.content.criteria.findIndex(c => c.id === id) % PALETTE.length];

// Each option's 0..1 standing on each criterion, from one or more players' orders.
function standings(game, summaries) {
  const opts = game.content.options.map(o => o.text), n = opts.length;
  const out = Object.fromEntries(opts.map(o => [o, {}]));
  for (const c of game.content.criteria) {
    for (const o of opts) {
      out[o][c.id] = mean(summaries.filter(s => s.perCrit[c.id]).map(s => {
        const pos = s.perCrit[c.id].indexOf(o);
        return pos < 0 ? 0.5 : n > 1 ? (n - 1 - pos) / (n - 1) : 1;
      }));
    }
  }
  return out;
}

// Weighted totals, best first: [{ text, total 0..1, parts: [{ id, share }] }]
function rank(game, stand, weights) {
  const crits = game.content.criteria.filter(c => weights[c.id] > 0);
  const sum = crits.reduce((s, c) => s + weights[c.id], 0) || 1;
  return Object.entries(stand).map(([text, by]) => {
    const parts = crits.map(c => ({ id: c.id, share: (weights[c.id] * (by[c.id] || 0)) / sum }));
    return { text, parts, total: parts.reduce((s, p) => s + p.share, 0) };
  }).sort((a, b) => b.total - a.total);
}

function rankingRows(game, rows) {
  return `<ol class="ranking">${rows.map((r, i) => `
    <li><span class="rank">${i + 1}</span><span class="item">${esc(r.text)}<small>${Math.round(r.total * 100)} / 100</small></span>
      <span class="track stack">${r.parts.map(p => `<span style="width:${p.share * 100}%;background:${color(game, p.id)}"></span>`).join('')}</span></li>`).join('')}</ol>`;
}

function legend(game) {
  return `<ul class="swatches">${game.content.criteria.map(c => `<li style="--c:${color(game, c.id)}">${esc(c.name)}</li>`).join('')}</ul>`;
}

const weightsOf = game => Object.fromEntries(game.content.criteria.map(c => [c.id, c.weight]));

export default {
  id: 'decision',
  label: 'Decision maker',
  blurb: 'List your options and what matters. Compare two at a time on each point, and get a weighted ranking.',
  example: 'Which job offer? Which laptop? Where to go on vacation?',
  color: '#2563eb',
  defaults: { question: 'Which is better for {criterion}?', verdict: 'Best choice', seconds: 0, solo: true, group: true },
  options: ['seconds'],

  ready: g => (g.content?.options?.length >= 2 && g.content.criteria?.some(c => c.weight > 0)
    ? '' : 'Needs at least 2 options and 1 criterion that matters.'),
  estimate: g => active(g).length * sortCost(g.content.options.length),

  async play(game, ask) {
    const opts = game.content.options.map(o => o.text), counter = { n: 0 };
    const total = active(game).length * sortCost(opts.length), perCrit = {};
    for (const c of shuffle(active(game))) {
      const before = comparer(ask, { prompt: fill(game.question || 'Which is better for {criterion}?', { criterion: c.name }), total, counter });
      perCrit[c.id] = await mergeSort(shuffle([...opts]), before);
    }
    return { perCrit };
  },

  result(game, s) {
    const rows = rank(game, standings(game, [s]), weightsOf(game));
    return `
      <section class="card result decision-result">
        <p class="eyebrow">${esc(game.verdict || 'Best choice')}</p>
        <h2 class="verdict" data-top>${esc(rows[0].text)}</h2>
        ${legend(game)}
        <div data-rows>${rankingRows(game, rows)}</div>
        <details class="reweigh"><summary>What if the criteria mattered differently?</summary>
          ${game.content.criteria.map(c => `
            <label class="crit-row" style="--c:${color(game, c.id)}"><span class="dot"></span><span>${esc(c.name)}</span>
              <input type="range" min="0" max="10" value="${c.weight}" data-rw="${c.id}"><output>${c.weight}</output></label>`).join('')}
        </details>
      </section>`;
  },

  // Lets players drag the importance sliders on their result and watch the ranking change.
  wireResult(root, game, s) {
    const weights = weightsOf(game), stand = standings(game, [s]);
    root.querySelector('.reweigh')?.addEventListener('input', e => {
      const id = e.target.dataset.rw;
      if (!id) return;
      weights[id] = +e.target.value;
      e.target.nextElementSibling.textContent = e.target.value;
      const rows = rank(game, stand, weights);
      $('[data-rows]', root).innerHTML = rankingRows(game, rows);
      $('[data-top]', root).textContent = rows[0].text;
    });
  },

  board(game, entries) {
    if (!entries.length) return '<p class="meta">Nobody has played yet. Be the first!</p>';
    const rows = rank(game, standings(game, entries.map(e => e.summary)), weightsOf(game));
    return `
      <p class="meta">Combined from ${entries.length} ${entries.length === 1 ? 'person' : 'people'}</p>
      ${legend(game)}
      ${rankingRows(game, rows)}`;
  },

  editor(game) {
    const options = linesEditor((game.content?.options || []).map(o => [o.text]), {
      label: 'Options',
      hint: 'one per line, or paste a column from a spreadsheet',
      placeholder: 'Job offer A\nJob offer B\nStay where I am',
    });
    const criteria = criteriaEditor(game.content?.criteria);
    return {
      html: options.html + criteria.html,
      wire: root => { options.wire(root); criteria.wire(root); },
      read: () => ({ options: options.read().map(([text]) => ({ text: clean(text, 80) })), criteria: criteria.read() }),
    };
  },
};
