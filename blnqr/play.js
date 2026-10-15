// The rapid two-choice runner every game type plays through.
import { $, esc, sleep } from './ui.js';
import { pictureFor } from './pictures/index.js';

class Left extends Error {}

export function introHTML(game, type, extra = '') {
  const n = type.estimate(game), timed = game.seconds > 0;
  const approx = ['sequencer', 'preference', 'group', 'decision'].includes(type.id);
  return `
    <section class="card intro">
      <h2>Ready?</h2>
      ${game.question && !game.question.includes('{') ? `<p class="question">${esc(game.question)}</p>` : ''}
      <p>Two choices at a time. ${timed ? `Go with your gut: you have ${game.seconds} seconds for each.` : 'Take your time, though your first instinct is usually right.'}</p>
      <ul class="keys">
        <li><kbd>←</kbd> or <kbd>F</kbd> picks the left one</li>
        <li><kbd>→</kbd> or <kbd>J</kbd> picks the right one</li>
        <li>On a phone or tablet, just tap</li>
      </ul>
      ${n ? `<p class="meta">${approx ? 'Up to ' : ''}${n} choices${timed ? ` · under ${Math.max(1, Math.ceil((n * (game.seconds + 0.4) + 2) / 60))} min` : ''}</p>` : ''}
      ${extra}
      <div class="intro-actions"></div>
    </section>`;
}

// Plays a game inside `el`. Resolves with the type's summary, or null if the
// player navigated away part-way through.
export async function runGame(el, game, type) {
  document.body.classList.add('quizzing');
  el.innerHTML = `
    <section class="quiz">
      <div class="quiz-top"><span id="qn"></span><span class="hint"><kbd>F</kbd> <kbd>←</kbd> &nbsp;or&nbsp; <kbd>→</kbd> <kbd>J</kbd></span></div>
      <p class="question" id="qprompt"></p>
      <div class="timer${game.seconds > 0 ? '' : ' off'}"><span id="tbar"></span></div>
      <div class="pair blank" id="pair">
        <button class="opt" id="optL"></button>
        <span class="or">or</span>
        <button class="opt" id="optR"></button>
      </div>
      <p class="flash" id="flash" aria-live="polite"></p>
    </section>`;

  const check = () => { if (!el.isConnected) throw new Left(); };
  let spoken = '';
  const ask = async ({ prompt, left, right, correct, n, total, approx }) => {
    check();
    const question = prompt || game.question || type.defaults.question;
    $('#qn').textContent = total ? `${n} of ${approx ? 'up to ' : ''}${total}` : `${n}`;
    $('#qprompt').textContent = question;
    // Read the question aloud for early readers, whenever it changes.
    if (game.speak && question !== spoken) { say(question); spoken = question; }
    const res = await askPair(left.text, right.text, game.seconds * 1000, game.feedback === false ? null : correct, game.pictures);
    await sleep(180);
    check();
    return res;
  };

  try {
    for (const n of ['3', '2', '1']) {
      $('#flash').textContent = n;
      await sleep(600);
      check();
    }
    $('#flash').textContent = '';
    return await type.play(game, ask);
  } catch (err) {
    if (err instanceof Left) return null;
    throw err;
  } finally {
    document.body.classList.remove('quizzing');
  }
}

function say(text) {
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(text), { rate: 0.9 }));
  } catch {}
}

// An option's contents: its picture (if pictures are on and one matches) and its name.
export function optionHTML(text, pictures) {
  const pic = pictures && pictureFor(text);
  return pic ? `<img src="${pic}" alt=""><span class="cap">${esc(text)}</span>` : esc(text);
}

// Shows one pair and resolves with { pick: 'left' | 'right' | null, ms }.
// With `correct`, briefly shows whether the pick was right.
function askPair(leftText, rightText, limit, correct, pictures) {
  const pair = $('#pair'), L = $('#optL'), R = $('#optR'), bar = $('#tbar'), flash = $('#flash');
  L.innerHTML = optionHTML(leftText, pictures);
  R.innerHTML = optionHTML(rightText, pictures);
  pair.classList.toggle('pics', !!(pictures && (pictureFor(leftText) || pictureFor(rightText))));
  flash.textContent = '';
  pair.classList.remove('blank');
  if (limit) {
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    bar.getBoundingClientRect();
    bar.style.transition = `transform ${limit}ms linear`;
    bar.style.transform = 'scaleX(0)';
  }
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
      if (limit) {
        bar.style.transform = getComputedStyle(bar).transform;
        bar.style.transition = 'none';
      }
      const btn = side => (side === 'left' ? L : R);
      let hold = 160;
      if (correct) {
        btn(correct).classList.add('right');
        if (pick && pick !== correct) btn(pick).classList.add('wrong');
        hold = pick === correct ? 300 : 900;
      } else if (pick) {
        btn(pick).classList.add('picked');
      }
      if (!pick) { flash.textContent = 'Too slow'; hold = Math.max(hold, 700); }
      setTimeout(() => {
        [L, R].forEach(b => b.classList.remove('picked', 'right', 'wrong'));
        pair.classList.add('blank');
        resolve({ pick, ms });
      }, hold);
    };
    const onKey = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'f') { e.preventDefault(); finish('left'); }
      else if (k === 'arrowright' || k === 'j') { e.preventDefault(); finish('right'); }
    };
    const timer = limit ? setTimeout(() => finish(null), limit) : null;
    addEventListener('keydown', onKey);
    L.onclick = () => finish('left');
    R.onclick = () => finish('right');
  });
}
