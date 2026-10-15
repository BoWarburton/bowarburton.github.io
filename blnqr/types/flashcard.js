// 2. Flashcards: a prompt, then the right answer against a wrong one.
import { shuffle, pickOne, quizRounds, scoreHTML, quizBoard } from './kit.js';
import { linesEditor } from './editors.js';

// Wrong answers come from the card itself, or else from other cards' answers.
const wrongsFor = (card, cards) => card.wrong?.length ? card.wrong
  : [...new Set(cards.map(c => c.answer))].filter(a => a !== card.answer);

export default {
  id: 'flashcard',
  label: 'Flashcards',
  blurb: 'See a prompt, then pick the right answer from two, fast. Missed cards come back at the end.',
  example: 'Spanish vocab, state capitals, times tables',
  color: '#0891b2',
  defaults: { question: '', verdict: 'Your score', seconds: 4, rounds: 0, feedback: true, repeat: true, solo: true, group: true },
  options: ['seconds', 'cards', 'feedback', 'repeat'],

  ready: g => {
    const cards = g.content?.cards || [];
    if (!cards.length) return 'Needs at least one card.';
    return cards.every(c => wrongsFor(c, cards).length) ? '' : 'Every card needs a wrong answer, or add more cards to borrow answers from.';
  },
  estimate: g => g.rounds || g.content.cards.length,

  play(game, ask) {
    const cards = game.content.cards;
    const deck = shuffle([...cards]).slice(0, game.rounds || cards.length);
    return quizRounds(deck.map(c => ({ prompt: c.prompt, answer: c.answer, wrong: pickOne(wrongsFor(c, cards)) })), ask, { repeat: game.repeat });
  },

  result: (game, s) => scoreHTML(game, s),
  board: (game, entries, me) => quizBoard(entries, me),

  editor(game) {
    const lines = linesEditor((game.content?.cards || []).map(c => [c.prompt, c.answer, ...(c.wrong || [])]), {
      label: 'Cards',
      hint: 'one per line: prompt | right answer | wrong answers (optional). Paste rows from a spreadsheet too.',
      placeholder: 'perro | dog | cat | horse\ngato | cat\n7 × 8 | 56 | 54 | 48',
      minCols: 2,
      maxLen: 120,
    });
    return {
      html: lines.html,
      wire: lines.wire,
      read: () => ({ cards: lines.read().map(([prompt, answer, ...wrong]) => ({ prompt, answer, wrong: wrong.filter(w => w && w !== answer) })) }),
    };
  },
};
