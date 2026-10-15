// 3. Categorizer: "Which is a square?" One item belongs, the other doesn't.
import { shuffle, pickOne, fill, quizRounds, scoreHTML, quizBoard, bars, pct } from './kit.js';
import { categoryEditor } from './editors.js';

const MAMMALS = ['elephant', 'giraffe', 'lion', 'rabbit', 'monkey', 'pig', 'bear', 'dolphin', 'bat', 'kangaroo'];

const PRESETS = [
  { name: 'Which Is a Mammal?',
    description: 'For ages 6 to 8. Two animals pop up: tap the mammal! Watch out for tricky ones.',
    question: 'Which is a mammal?',
    verdict: 'Mammals found',
    settings: { seconds: 8, rounds: 10, feedback: true, askFirst: true, pictures: true, speak: true },
    cats: [
      ['mammal', '#ea580c', MAMMALS],
      ['bird', '#2563eb', ['owl', 'penguin', 'parrot']],
      ['reptile', '#16a34a', ['turtle', 'snake', 'lizard']],
      ['amphibian', '#0891b2', ['frog', 'salamander']],
      ['insect', '#9333ea', ['butterfly', 'bee']],
    ] },
  { name: 'Animal classes', cats: [
    ['mammal', '#a16207', ['dolphin', 'bat', 'whale', 'horse', 'mouse']],
    ['reptile', '#15803d', ['snake', 'lizard', 'turtle', 'crocodile', 'gecko']],
    ['bird', '#2563eb', ['penguin', 'ostrich', 'eagle', 'owl', 'sparrow']],
    ['fish', '#0891b2', ['shark', 'salmon', 'tuna', 'eel', 'trout']],
  ] },
  { name: 'Parts of speech', cats: [
    ['noun', '#dc2626', ['table', 'happiness', 'river', 'teacher']],
    ['verb', '#2563eb', ['run', 'think', 'became', 'swim']],
    ['adjective', '#16a34a', ['blue', 'quiet', 'enormous', 'clever']],
    ['adverb', '#9333ea', ['quickly', 'often', 'very', 'softly']],
  ] },
];

export default {
  id: 'categorizer',
  label: 'Categorizer',
  blurb: '“Which is a mammal?” Spot the one that belongs before the timer runs out.',
  example: 'Mammal or reptile? Noun or verb?',
  color: '#16a34a',
  defaults: { question: 'Which is a {category}?', verdict: 'Your score', seconds: 2.5, rounds: 20, feedback: true, solo: true, group: true },
  options: ['seconds', 'rounds', 'feedback', 'askFirst'],

  ready: g => {
    const cats = g.content?.categories || [];
    return cats.length >= 2 && cats.every(c => c.items?.length) ? '' : 'Needs at least 2 categories, each with at least one item.';
  },
  estimate: g => g.rounds,

  play(game, ask) {
    const cats = game.content.categories;
    const decks = {};
    const deal = c => (decks[c.id]?.length ? decks[c.id] : (decks[c.id] = shuffle([...c.items]))).pop();
    const rounds = [];
    let targets = [], tries = 0;
    while (rounds.length < game.rounds && tries++ < game.rounds * 4) {
      if (!targets.length) targets = game.askFirst ? [cats[0]] : shuffle([...cats]);
      const target = targets.pop();
      const outside = cats.filter(c => c !== target).flatMap(c => c.items).filter(i => !target.items.includes(i));
      if (!outside.length) continue;
      rounds.push({ prompt: fill(game.question || 'Which is a {category}?', { category: target.name }), answer: deal(target), wrong: pickOne(outside), cat: target.id });
    }
    return quizRounds(rounds, ask);
  },

  result(game, s) {
    const cats = game.content.categories.filter(c => s.byCat?.[c.id]);
    const extra = cats.length ? bars(cats.map(c => {
      const [ok, n] = s.byCat[c.id];
      return { label: c.name, color: c.color, value: pct(ok, n), text: `${ok}/${n}` };
    }), 100) : '';
    return scoreHTML(game, s, extra);
  },
  board: (game, entries, me) => quizBoard(entries, me),

  editor: game => categoryEditor(game.content?.categories, { presets: PRESETS }),
};
