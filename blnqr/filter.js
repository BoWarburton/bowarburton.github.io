// A small client-side profanity filter. It is a first line of defense only;
// the host can remove anything it misses. Lists are ROT13-encoded so the source
// stays readable in a classroom.
const rot13 = s => s.replace(/[a-z]/g, c => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

// Blocked when they appear as a whole word (or plural).
const WORDS = new Set(
  'nff nffubyr onfgneq ovgpu obbo obbof pbpx phz qvpx qvyqb qlxr snt sntf wvmm xvxr puvax anmv cravf cvff cbea chffl encr encvfg ergneq ergneqrq fxnax fyhg fcvp gvgf genaal gjng intvan jnax jnaxre juber'
    .split(' ').map(rot13)
);

// Blocked at the start of any word, so compounds and suffixes are caught too.
const STEMS = 'shpx fuvg phag avttre avttn snttbg zbgures ovgpu juber'.split(' ').map(rot13);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

export function isBlocked(text) {
  const s = text.toLowerCase().replace(/[0134578@$!]/g, c => LEET[c] ?? c);
  const tokens = s.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some(t => WORDS.has(t) || (t.endsWith('s') && WORDS.has(t.slice(0, -1))))) return true;
  // Spaced-out letters ("f u c k") are squeezed back into one token.
  if (tokens.length > 1 && tokens.every(t => t.length === 1)) tokens.push(tokens.join(''));
  return tokens.some(t => STEMS.some(stem => t.startsWith(stem)));
}
