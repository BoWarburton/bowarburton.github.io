// The rapid forced-choice quiz, shared by team rooms and solo sorts.
import { $, esc, sleep } from './ui.js';

export const DEFAULT_QUESTION = 'Which is more you?';

export function introHTML(rounds, seconds, question, extra = '') {
  return `
    <section class="card intro">
      <h2>Ready?</h2>
      <p class="question">${esc(question || DEFAULT_QUESTION)}</p>
      <p>Two words will flash up with that question. Go with your gut: you have ${seconds} seconds, and if time runs out the pair is skipped.</p>
      <ul class="keys">
        <li><kbd>←</kbd> or <kbd>F</kbd> picks the left word</li>
        <li><kbd>→</kbd> or <kbd>J</kbd> picks the right word</li>
        <li>On a phone or tablet, tap the word</li>
      </ul>
      <p class="meta">${rounds} choices · under ${Math.ceil((rounds * (seconds + 0.3) + 2) / 60)} min</p>
      ${extra}
      <button class="btn big" id="begin">I'm ready</button>
    </section>`;
}

// Runs the quiz inside `el`. Resolves with one answer per round, or null if the
// player navigated away part-way through.
export async function runQuiz(el, rounds, seconds, question) {
  document.body.classList.add('quizzing');
  el.innerHTML = `
    <section class="quiz">
      <div class="quiz-top"><span id="qn"></span><span class="hint"><kbd>F</kbd> <kbd>←</kbd> &nbsp;or&nbsp; <kbd>→</kbd> <kbd>J</kbd></span></div>
      <p class="question">${esc(question || DEFAULT_QUESTION)}</p>
      <div class="timer"><span id="tbar"></span></div>
      <div class="pair blank" id="pair">
        <button class="opt" id="optL"></button>
        <span class="or">or</span>
        <button class="opt" id="optR"></button>
      </div>
      <p class="flash" id="flash" aria-live="polite"></p>
    </section>`;
  try {
    for (const n of ['3', '2', '1']) {
      $('#flash').textContent = n;
      await sleep(600);
      if (!el.isConnected) return null;
    }
    const answers = [];
    for (let i = 0; i < rounds.length; i++) {
      answers.push(await ask(rounds[i], i, rounds.length, seconds * 1000));
      await sleep(200);
      if (!el.isConnected) return null;
    }
    return answers;
  } finally {
    document.body.classList.remove('quizzing');
  }
}

// Shows one pair and resolves with { pick: 'left' | 'right' | null, ms }.
function ask(round, i, n, limit) {
  const pair = $('#pair'), L = $('#optL'), R = $('#optR'), bar = $('#tbar'), flash = $('#flash');
  L.textContent = round.left.text;
  R.textContent = round.right.text;
  $('#qn').textContent = `${i + 1} / ${n}`;
  flash.textContent = '';
  pair.classList.remove('blank');
  bar.style.transition = 'none';
  bar.style.transform = 'scaleX(1)';
  bar.getBoundingClientRect();
  bar.style.transition = `transform ${limit}ms linear`;
  bar.style.transform = 'scaleX(0)';
  const t0 = performance.now();

  return new Promise(resolve => {
    let over = false;
    const finish = pick => {
      if (over) return;
      over = true;
      const ms = Math.round(performance.now() - t0);
      clearTimeout(timer);
      removeEventListener('keydown', onKey);
      L.onclick = R.onclick = null;
      bar.style.transform = getComputedStyle(bar).transform;
      bar.style.transition = 'none';
      if (pick) (pick === 'left' ? L : R).classList.add('picked');
      else flash.textContent = 'Too slow, skipped';
      setTimeout(() => {
        L.classList.remove('picked');
        R.classList.remove('picked');
        pair.classList.add('blank');
        resolve({ pick, ms });
      }, pick ? 160 : 600);
    };
    const onKey = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'f') { e.preventDefault(); finish('left'); }
      else if (k === 'arrowright' || k === 'j') { e.preventDefault(); finish('right'); }
    };
    const timer = setTimeout(() => finish(null), limit);
    addEventListener('keydown', onKey);
    L.onclick = () => finish('left');
    R.onclick = () => finish('right');
  });
}
