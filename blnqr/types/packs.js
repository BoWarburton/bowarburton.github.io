// Ready-made games: presets for the editors, and starter packs that add a set of
// games to your account in one click from Setup.
import { PALETTE } from '../ui.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ---------- Times tables: "Which is a multiple of n?" ---------- */

// Right answers are n×1 … n×10. Wrong answers are near misses, one either side of
// a multiple, so they can't be spotted just by how they look.
export function multiplesGame(n) {
  const multiples = range(1, 10).map(k => n * k);
  const near = [...new Set(multiples.flatMap(m => [m - 1, m + 1]))].filter(x => x > 0 && x % n);
  return {
    type: 'categorizer',
    title: `Multiples of ${n}`,
    description: `Count by ${n}s: ${multiples.slice(0, 4).join(', ')}… Two numbers pop up. Tap the one that is a multiple of ${n}!`,
    question: `Which is a multiple of ${n}?`,
    verdict: `Multiples of ${n}`,
    content: {
      categories: [
        { id: 'm', name: `multiple of ${n}`, color: PALETTE[(n - 2) % PALETTE.length], items: multiples.map(String) },
        { id: 'x', name: 'not a multiple', color: '#94a3b8', items: near.map(String) },
      ],
    },
    seconds: 8, rounds: 10, feedback: true, askFirst: true, speak: true, pictures: false,
  };
}

/* ---------- Subitizing: how many dots, at a glance? ---------- */

// Each card's wrong answer is one more or one less: the hardest to tell apart.
const dotCards = (names, max) => names.map(([pic, n]) => [pic, String(n), ...[n - 1, n + 1].filter(x => x >= 1 && x <= max).map(String)]);

export const SUBITIZING = [
  {
    name: 'Quick Dots (1 to 6)',
    description: 'Dots flash up for just a second. How many? Don’t count: just know! Practice seeing small groups at a glance.',
    question: 'How many dots?',
    verdict: 'Dots spotted',
    settings: { seconds: 6, rounds: 12, flash: 1, feedback: true, repeat: true, pictures: true, speak: true },
    rows: dotCards(range(1, 6).flatMap(n => ['dice', 'scatter a', 'scatter b'].map(s => [`dots ${n} ${s}`, n])), 6),
  },
  {
    name: 'Ten-Frame Flash (1 to 10)',
    description: 'A ten-frame flashes up. How many counters? Look for the full row of 5 to help you!',
    question: 'How many counters?',
    verdict: 'Ten-frames spotted',
    settings: { seconds: 6, rounds: 0, flash: 1.5, feedback: true, repeat: true, pictures: true, speak: true },
    rows: dotCards(range(1, 10).map(n => [`ten frame ${n}`, n]), 10),
  },
];

const flashcardGame = p => ({
  type: 'flashcard',
  title: p.name, description: p.description, question: p.question, verdict: p.verdict,
  content: { cards: p.rows.map(([prompt, answer, ...wrong]) => ({ prompt, answer, wrong })) },
  ...p.settings,
});

/* ---------- Starter packs ---------- */

export const PACKS = [
  {
    id: 'times',
    name: 'Times tables: multiples of 2 to 9',
    blurb: 'Eight Categorizer games, one per number, for students just starting their times tables. Big numbers, 8 seconds a choice, and the question read aloud.',
    games: () => range(2, 9).map(multiplesGame),
  },
  {
    id: 'subitize',
    name: 'Subitizing: Quick Dots and Ten-Frame Flash',
    blurb: 'Two Flashcard games. A dot card flashes for a moment, and students pick how many: knowing small amounts at a glance, without counting.',
    games: () => SUBITIZING.map(flashcardGame),
  },
];

// Fills in everything a saved game needs, with the pack's choices on top.
export function packGame(g, visibility) {
  return {
    description: '', question: '', verdict: '',
    visibility, invites: [], loginRequired: false, solo: true, group: true,
    seconds: 0, rounds: 0, topK: 0, flash: 0,
    feedback: true, repeat: false, allowAdd: false, askFirst: false, pictures: false, speak: false,
    ...g,
  };
}
