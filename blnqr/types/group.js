// 6. Group pick: everyone ranks the same options and the group's choice emerges.
import { esc } from '../ui.js';
import preference, { groupRanking } from './preference.js';
import { rankingHTML } from './kit.js';

export default {
  ...preference,
  id: 'group',
  label: 'Group pick',
  blurb: 'Decide together. Everyone compares the options, and the group’s favorite rises to the top.',
  example: 'Pick a baby name, a place to eat, the best photo',
  color: '#ca8a04',
  defaults: { ...preference.defaults, verdict: 'Your pick', solo: false, group: true, allowAdd: true },
  options: [...preference.options, 'addOptions'],

  // When players can add options, the game can start with few (or none) of its own.
  ready: g => (g.allowAdd ? '' : preference.ready(g)),

  board(game, entries, me) {
    if (!entries.length) return '<p class="meta">Nobody has voted yet. Share the link to get the group going.</p>';
    const { ranked, agreement } = groupRanking(game, entries);
    return `
      <div class="group-winner">
        <p class="eyebrow">The group’s pick so far</p>
        <p class="verdict">${esc(ranked[0].key)}</p>
        <p class="meta">${entries.length} ${entries.length === 1 ? 'person has' : 'people have'} weighed in · ${Math.round(agreement * 100)}% agreement</p>
      </div>
      ${rankingHTML(ranked.map(r => ({ label: r.key, value: r.score })))}
      <h3>Who's in</h3>
      <ul class="recent">${entries.map(e => `<li${e.id === me ? ' class="me"' : ''}><span>${esc(e.name)}</span><span class="meta">picked ${esc(e.summary.order[0])}</span></li>`).join('')}</ul>`;
  },
};
