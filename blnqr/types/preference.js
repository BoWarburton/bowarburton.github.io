// 5. Preference sorter: pick between two until a clear order emerges.
// Also the engine behind 6. Group pick.
import { esc } from '../ui.js';
import { shuffle, mergeSort, sortCost, comparer, consensus, pairAgreement, mean, rankingHTML } from './kit.js';
import { linesEditor } from './editors.js';

const texts = g => g.content.items.map(i => i.text);

export function groupRanking(game, entries) {
  const ranked = consensus(entries.map(e => e.summary.order), texts(game));
  const order = ranked.map(r => r.key);
  const agreement = mean(entries.map(e => pairAgreement(e.summary.order, order)));
  return { ranked, agreement };
}

const preference = {
  id: 'preference',
  label: 'Preference sorter',
  blurb: 'Pick the one you prefer, two at a time, until your full ranking (or just your top few) is clear.',
  example: 'Rank your favorite movies, choose which photos to keep',
  color: '#db2777',
  defaults: { question: 'Which do you prefer?', verdict: 'Your ranking', seconds: 0, topK: 0, solo: true, group: true },
  options: ['seconds', 'topK'],

  ready: g => (g.content?.items?.length >= 2 ? '' : 'Needs at least 2 options.'),
  estimate: g => sortCost(g.content.items.length, g.topK || Infinity),

  async play(game, ask) {
    const all = texts(game), k = game.topK && game.topK < all.length ? game.topK : Infinity, times = [];
    const before = comparer(ask, { prompt: game.question || 'Which do you prefer?', total: sortCost(all.length, k), log: times });
    const order = await mergeSort(shuffle([...all]), before, k);
    return { order, n: all.length, k: Number.isFinite(k) ? k : 0, avgMs: Math.round(mean(times)) };
  },

  result(game, s) {
    return `
      <section class="card result">
        <p class="eyebrow">${esc(game.verdict || 'Your ranking')}</p>
        <h2 class="verdict">${esc(s.order[0])}</h2>
        <p class="meta">${s.k ? `Your top ${s.k} of ${s.n}` : `All ${s.n}, ranked`} · ${s.avgMs} ms per choice on average</p>
        ${rankingHTML(s.order.map(label => ({ label })))}
      </section>`;
  },

  board(game, entries, me) {
    if (!entries.length) return '<p class="meta">Nobody has played yet. Be the first!</p>';
    const { ranked, agreement } = groupRanking(game, entries);
    const mine = entries.find(e => e.id === me);
    return `
      <p class="meta">Combined from ${entries.length} ${entries.length === 1 ? 'ranking' : 'rankings'} · ${Math.round(agreement * 100)}% agreement</p>
      ${mine && entries.length > 1 ? `<p class="you-vs">You agree with the group on ${Math.round(pairAgreement(mine.summary.order, ranked.map(r => r.key)) * 100)}% of pairs.</p>` : ''}
      ${rankingHTML(ranked.map(r => ({ label: r.key, value: r.score })))}`;
  },

  editor(game) {
    const lines = linesEditor((game.content?.items || []).map(i => [i.text]), {
      label: 'Options',
      hint: 'one per line, or paste a column from a spreadsheet',
      placeholder: 'Pizza\nTacos\nSushi\nPho',
    });
    return {
      html: lines.html,
      wire: lines.wire,
      read: () => ({ items: lines.read().map(([text]) => ({ text })) }),
    };
  },
};

export default preference;
