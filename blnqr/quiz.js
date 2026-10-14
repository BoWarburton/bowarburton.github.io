// Pure logic: word cleanup, building balanced forced-choice pairs, and ipsative scoring.
import { isBlocked } from './filter.js';

export const WORD_MAX = 24;

export function normalizeWord(raw) {
  return raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function validWord(word) {
  return word.length <= WORD_MAX && /^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(word);
}

// Words that made it into Phase 2, grouped by category id.
export function qualifiedWords(words, categories, minVotes) {
  const byCat = Object.fromEntries(categories.map(c => [c.id, []]));
  for (const w of words) {
    if (!w.removed && w.voters.length >= minVotes && byCat[w.cat] && !isBlocked(w.text)) byCat[w.cat].push(w.text);
  }
  return byCat;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Every round pits two different categories against each other. We cycle through
// shuffled blocks of all category pairings so each matchup (and so each category)
// shows up equally often, and deal words from per-category decks to limit repeats.
export function buildRounds(byCat, count) {
  const cats = Object.keys(byCat).filter(c => byCat[c].length);
  const matchups = [];
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) matchups.push([cats[i], cats[j]]);
  }
  if (!matchups.length) return [];

  const decks = {};
  const deal = cat => {
    if (!decks[cat]?.length) decks[cat] = shuffle([...byCat[cat]]);
    return decks[cat].pop();
  };

  const rounds = [];
  let prev = null;
  while (rounds.length < count) {
    const block = shuffle([...matchups]);
    if (prev && block.length > 1 && block[0] === prev) block.push(block.shift());
    for (const m of block) {
      if (rounds.length >= count) break;
      const [a, b] = m;
      const wa = deal(a);
      let wb = deal(b);
      if (wa === wb && byCat[b].length > 1) wb = deal(b);
      const sideA = { cat: a, text: wa }, sideB = { cat: b, text: wb };
      rounds.push(Math.random() < 0.5 ? { left: sideA, right: sideB } : { left: sideB, right: sideA });
      prev = m;
    }
  }
  return rounds;
}

// Ipsative scoring: each category's win rate (wins / times shown), normalized so the
// profile sums to 100. Skipped (timed-out) rounds count for nothing.
export function scoreRounds(rounds, answers, categories) {
  const wins = {}, seen = {};
  for (const c of categories) wins[c.id] = seen[c.id] = 0;

  const picks = [];
  rounds.forEach((r, i) => {
    const a = answers[i];
    if (!a?.pick) return;
    seen[r.left.cat]++;
    seen[r.right.cat]++;
    wins[r[a.pick].cat]++;
    picks.push({ ...r[a.pick], ms: a.ms });
  });

  const rate = Object.fromEntries(categories.map(c => [c.id, seen[c.id] ? wins[c.id] / seen[c.id] : 0]));
  const total = Object.values(rate).reduce((s, x) => s + x, 0) || 1;
  const scores = Object.fromEntries(categories.map(c => [c.id, Math.round((1000 * rate[c.id]) / total) / 10]));
  const top = categories.map(c => c.id).sort((x, y) => rate[y] - rate[x])[0];

  // The fastest picks are the "tells": the words you grabbed without thinking.
  const tells = [];
  for (const p of picks.sort((x, y) => x.ms - y.ms)) {
    if (tells.length === 3) break;
    if (!tells.some(t => t.text === p.text)) tells.push({ text: p.text, cat: p.cat });
  }

  const answered = picks.length;
  return {
    scores,
    top,
    tells,
    answered,
    skipped: rounds.length - answered,
    avgMs: answered ? Math.round(picks.reduce((s, p) => s + p.ms, 0) / answered) : 0,
  };
}
