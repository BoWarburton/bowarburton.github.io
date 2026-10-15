// 1. "You are a…": personality tests, spirit animals, sorting hats.
import { buildRounds, scoreRounds } from '../quiz.js';
import { esc, resultCard, tallyBars, averageBars } from '../ui.js';
import { categoryEditor } from './editors.js';

const PRESETS = [
  { name: 'Hogwarts Houses', cats: [
    ['Gryffindor', '#b91c1c', ['brave', 'daring', 'bold', 'chivalrous', 'reckless']],
    ['Hufflepuff', '#ca8a04', ['loyal', 'patient', 'kind', 'hardworking', 'fair']],
    ['Ravenclaw', '#1d4ed8', ['curious', 'witty', 'wise', 'creative', 'clever']],
    ['Slytherin', '#15803d', ['ambitious', 'cunning', 'resourceful', 'proud', 'determined']],
  ] },
  { name: 'Your element', cats: [
    ['Fire', '#dc2626', ['passionate', 'energetic', 'impulsive', 'fierce']],
    ['Water', '#0284c7', ['calm', 'intuitive', 'adaptable', 'deep']],
    ['Earth', '#65a30d', ['steady', 'practical', 'patient', 'grounded']],
    ['Air', '#8b9bb4', ['free', 'chatty', 'restless', 'inventive']],
  ] },
  { name: 'Spirit animal', cats: [
    ['Wolf', '#475569', ['loyal to the pack', 'protective', 'instinctive']],
    ['Owl', '#a16207', ['night owl', 'observant', 'quiet wisdom']],
    ['Dolphin', '#0891b2', ['playful', 'social', 'curious']],
    ['Fox', '#ea580c', ['clever', 'sly', 'adaptable']],
  ] },
];

export default {
  id: 'persona',
  label: 'You are a…',
  blurb: 'Personality tests, spirit animals and sorting hats. Your gut picks reveal which one you are.',
  example: 'Which Hogwarts house are you?',
  color: '#9333ea',
  defaults: { question: 'Which is more you?', verdict: 'You are', seconds: 2.5, rounds: 30, solo: true, group: true },
  options: ['seconds', 'rounds'],
  liveRoom: true,

  ready: g => {
    const cats = g.content?.categories || [];
    return cats.length >= 2 && cats.every(c => c.items?.length) ? '' : 'Needs at least 2 categories, each with at least one item.';
  },
  estimate: g => g.rounds,

  async play(game, ask) {
    const cats = game.content.categories;
    const rounds = buildRounds(Object.fromEntries(cats.map(c => [c.id, c.items])), game.rounds);
    const answers = [];
    for (const [i, r] of rounds.entries()) answers.push(await ask({ left: r.left, right: r.right, n: i + 1, total: rounds.length }));
    return scoreRounds(rounds, answers, cats);
  },

  result: (game, s) => resultCard(s, game.content.categories, game.verdict),

  board(game, entries, me) {
    const cats = game.content.categories, sums = entries.map(e => e.summary);
    const cat = id => cats.find(c => c.id === id);
    const mine = entries.find(e => e.id === me)?.summary;
    const same = mine ? sums.filter(s => s.top === mine.top).length : 0;
    return `
      <p class="meta">${entries.length} ${entries.length === 1 ? 'person has' : 'people have'} played</p>
      ${mine && entries.length > 1 && cat(mine.top) ? `<p class="you-vs">You're one of ${same} out of ${entries.length} (${Math.round((100 * same) / entries.length)}%) who got ${esc(cat(mine.top).name)}.</p>` : ''}
      ${tallyBars(cats, sums)}
      <h3>Everyone's average</h3>
      ${averageBars(cats, sums)}
      <h3>Recent players</h3>
      <ul class="recent">${[...entries].sort((a, b) => b.at - a.at).slice(0, 15).map(e => `
        <li${e.id === me ? ' class="me"' : ''}><span>${esc(e.name)}</span>
        ${cat(e.summary.top) ? `<span class="tag" style="--c:${cat(e.summary.top).color}">${esc(cat(e.summary.top).name)}</span>` : ''}</li>`).join('')}
      </ul>`;
  },

  editor: game => categoryEditor(game.content?.categories, { presets: PRESETS }),
};
