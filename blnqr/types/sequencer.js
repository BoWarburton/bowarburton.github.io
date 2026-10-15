// 4. Sequencer: "Which came first?" Your answers sort the list; then see how
// close your order is to the real one.
import { esc } from '../ui.js';
import { shuffle, mergeSort, sortCost, comparer, pairAgreement, mean, pct, leaderboard } from './kit.js';
import { linesEditor } from './editors.js';

export default {
  id: 'sequencer',
  label: 'Sequencer',
  blurb: 'Two events, which came first? Keep choosing until the whole list is in order.',
  example: 'Order the US presidents, the planets by size, the steps of mitosis',
  color: '#ea580c',
  defaults: { question: 'Which came first?', verdict: 'Your order', seconds: 0, solo: true, group: true },
  options: ['seconds'],

  ready: g => (g.content?.items?.length >= 3 ? '' : 'Needs at least 3 items.'),
  estimate: g => sortCost(g.content.items.length),

  async play(game, ask) {
    const truth = game.content.items.map(i => i.text), times = [];
    const before = comparer(ask, { prompt: game.question || 'Which came first?', total: sortCost(truth.length), log: times });
    const order = await mergeSort(shuffle([...truth]), before);
    return {
      order,
      truth,
      agree: pairAgreement(order, truth),
      exact: order.filter((t, i) => t === truth[i]).length,
      avgMs: Math.round(mean(times)),
    };
  },

  result(game, s) {
    const label = Object.fromEntries(game.content.items.map(i => [i.text, i.label]));
    return `
      <section class="card result">
        <p class="eyebrow">${esc(game.verdict || 'Your order')}</p>
        <h2 class="verdict">${Math.round(s.agree * 100)}% in order</h2>
        <p class="meta">${s.exact} of ${s.truth.length} in exactly the right spot · ${s.avgMs} ms per choice on average</p>
        <div class="compare">
          <div><h3>Your order</h3><ol>${s.order.map((t, i) => `<li class="${t === s.truth[i] ? 'ok' : 'off'}">${esc(t)}</li>`).join('')}</ol></div>
          <div><h3>Actual order</h3><ol>${s.truth.map(t => `<li>${esc(t)}${label[t] ? ` <small>${esc(label[t])}</small>` : ''}</li>`).join('')}</ol></div>
        </div>
      </section>`;
  },

  board(game, entries, me) {
    const rows = entries.map(e => ({ id: e.id, name: e.name, agree: e.summary.agree, ms: e.summary.avgMs,
      value: `${Math.round(e.summary.agree * 100)}%`, detail: `${e.summary.avgMs} ms` }))
      .sort((a, b) => b.agree - a.agree || a.ms - b.ms);
    return `<p class="meta">${entries.length} ${entries.length === 1 ? 'player' : 'players'}</p>` + leaderboard(rows, me, ' in order');
  },

  editor(game) {
    const lines = linesEditor((game.content?.items || []).map(i => [i.text, i.label || '']), {
      label: 'Items, in the correct order',
      hint: 'first to last, one per line. Optionally add | a label to reveal at the end, such as a date.',
      placeholder: 'Declaration of Independence | 1776\nUS Constitution signed | 1787\nLouisiana Purchase | 1803',
    });
    return {
      html: lines.html,
      wire: lines.wire,
      read: () => ({ items: lines.read().map(([text, label]) => ({ text, label: label || '' })) }),
    };
  },
};
