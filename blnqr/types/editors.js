// Content editors the game types build their Setup forms from. Each returns
// { html, wire(root), read() }: read() returns clean content or throws an Error
// whose message is shown to the creator.
import { $, esc, PALETTE } from '../ui.js';
import { isBlocked } from '../filter.js';

let nextId = 0;
export const newId = prefix => `${prefix}${Date.now().toString(36)}${(nextId++).toString(36)}`;

// Tidies one piece of creator text, rejecting anything too long or unfriendly.
export function clean(raw, max) {
  const text = String(raw).replace(/\s+/g, ' ').trim();
  if (text.length > max) throw new Error(`“${text.slice(0, 30)}…” is too long (${max} characters max)`);
  if (text && isBlocked(text)) throw new Error(`“${text}” isn't allowed`);
  return text;
}

/* ---------- Categories, each with a list of items ---------- */

export function categoryEditor(initial, { presets = [], itemsHint = 'one per line, or separated by commas' } = {}) {
  const blank = (i, name = '', color = PALETTE[i % PALETTE.length], items = []) =>
    ({ id: newId('c'), name, color, text: items.join('\n') });
  let cats = initial?.length
    ? initial.map(c => ({ ...c, text: (c.items || []).join('\n') }))
    : [blank(0), blank(1)];
  let root;

  const html = `
    ${presets.length ? `<div class="presets"><span>Start from</span>${presets.map((p, i) => `<button type="button" class="pill" data-preset="${i}">${esc(p.name)}</button>`).join('')}</div>` : ''}
    <fieldset>
      <legend>Categories <small>2 to 8, each with its items (${esc(itemsHint)})</small></legend>
      <div class="cat-edit" data-cats></div>
      <button type="button" class="btn ghost small" data-add-cat>+ Add category</button>
    </fieldset>`;

  const items = text => text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const draw = () => {
    $('[data-cats]', root).innerHTML = cats.map((c, i) => `
      <div class="cat-row" style="--c:${c.color}">
        <div class="cat-line">
          <input type="color" class="swatch" data-color="${i}" value="${c.color}" aria-label="Color for category ${i + 1}">
          <input data-name="${i}" value="${esc(c.name)}" maxlength="30" placeholder="Category ${i + 1}" aria-label="Category ${i + 1}">
          <button type="button" class="x" data-del="${i}" ${cats.length <= 2 ? 'disabled' : ''} aria-label="Remove category">×</button>
        </div>
        <textarea class="words" data-items="${i}" rows="3" placeholder="Items for this category">${esc(c.text)}</textarea>
        <p class="count" data-count="${i}"></p>
      </div>`).join('');
    cats.forEach((_, i) => count(i));
    $('[data-add-cat]', root).disabled = cats.length >= 8;
  };
  const count = i => {
    const n = items(cats[i].text).length, el = $(`[data-count="${i}"]`, root);
    el.textContent = `${n} ${n === 1 ? 'item' : 'items'}${n ? '' : ' · needs at least one'}`;
    el.classList.toggle('warn', !n);
  };

  function wire(el) {
    root = el;
    const box = $('[data-cats]', root);
    box.addEventListener('input', e => {
      const d = e.target.dataset;
      if (d.name) cats[d.name].name = e.target.value;
      if (d.items) { cats[d.items].text = e.target.value; count(+d.items); }
      if (d.color) { cats[d.color].color = e.target.value; e.target.closest('.cat-row').style.setProperty('--c', e.target.value); }
    });
    box.addEventListener('click', e => {
      const i = e.target.closest('[data-del]')?.dataset.del;
      if (i) { cats.splice(+i, 1); draw(); }
    });
    $('[data-add-cat]', root).onclick = () => {
      cats.push(blank(cats.length, '', PALETTE.find(p => !cats.some(c => c.color === p)) ?? PALETTE[0]));
      draw();
      $('.cat-row:last-child [data-name]', root).focus();
    };
    root.addEventListener('click', e => {
      const p = presets[e.target.dataset.preset];
      if (!p) return;
      cats = p.cats.map(([name, color, list], i) => blank(i, name, color, list || []));
      // Fill in the preset's title and wording wherever the creator hasn't typed their own.
      const fill = (name, value) => {
        const field = root.querySelector(`[name=${name}]`);
        if (field && value && (!field.value || field.value === field.placeholder || field.dataset.preset === 'y')) {
          field.value = value;
          field.dataset.preset = 'y';
        }
      };
      fill('title', p.name);
      fill('description', p.description);
      fill('question', p.question);
      fill('verdict', p.verdict);
      for (const [name, value] of Object.entries(p.settings || {})) {
        const field = root.querySelector(`[name=${name}]`);
        if (!field) continue;
        if (field.type === 'checkbox') field.checked = !!value;
        else field.value = String(value);
      }
      draw();
    });
    draw();
  }

  function read() {
    const names = cats.map(c => clean(c.name, 30));
    if (names.some(n => !n)) throw new Error('Every category needs a name');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new Error('Category names must all be different');
    return {
      categories: cats.map((c, i) => ({
        id: c.id, name: names[i], color: c.color,
        items: [...new Set(items(c.text).map(t => clean(t, 60)).filter(Boolean))],
      })),
    };
  }

  return { html, wire, read };
}

/* ---------- A table typed (or pasted from a spreadsheet) one row per line ---------- */

// Columns are separated by | or a tab, so rows copied from Google Sheets or Excel paste straight in.
export function linesEditor(rows, { label, hint, placeholder, minCols = 1, maxLen = 80, unique = true }) {
  let root;
  const html = `
    <label>${esc(label)} <small>${esc(hint)}</small>
      <textarea class="lines" data-lines rows="9" placeholder="${esc(placeholder)}">${esc((rows || []).map(r => r.filter(Boolean).join(' | ')).join('\n'))}</textarea>
    </label>
    <p class="count" data-lines-count></p>`;

  const parse = () => $('[data-lines]', root).value.split('\n')
    .map(line => line.split(/\t|\|/).map(s => s.trim()))
    .filter(cols => cols.some(Boolean));
  const count = () => {
    const n = parse().length;
    $('[data-lines-count]', root).textContent = `${n} ${n === 1 ? 'row' : 'rows'}`;
  };

  function wire(el) {
    root = el;
    $('[data-lines]', root).addEventListener('input', count);
    count();
  }

  function read() {
    const out = parse().map((cols, i) => {
      const cells = cols.map(c => clean(c, maxLen));
      if (cells.filter(Boolean).length < minCols) throw new Error(`Line ${i + 1} needs at least ${minCols} columns separated by |`);
      return cells;
    });
    if (unique) {
      const seen = new Set();
      for (const r of out) {
        const key = r[0].toLowerCase();
        if (seen.has(key)) throw new Error(`“${r[0]}” is listed twice`);
        seen.add(key);
      }
    }
    return out;
  }

  return { html, wire, read };
}

/* ---------- Criteria with importance sliders (decision maker) ---------- */

export function criteriaEditor(initial) {
  let crits = initial?.length ? initial.map(c => ({ ...c })) : [
    { id: newId('k'), name: '', weight: 5 },
    { id: newId('k'), name: '', weight: 5 },
  ];
  let root;
  const html = `
    <fieldset>
      <legend>Criteria <small>slide to set how much each one matters in the final ranking</small></legend>
      <div class="crit-edit" data-crits></div>
      <button type="button" class="btn ghost small" data-add-crit>+ Add criterion</button>
    </fieldset>`;

  const draw = () => {
    $('[data-crits]', root).innerHTML = crits.map((c, i) => `
      <div class="crit-row" style="--c:${PALETTE[i % PALETTE.length]}">
        <span class="dot"></span>
        <input data-cname="${i}" value="${esc(c.name)}" maxlength="30" placeholder="e.g. Price" aria-label="Criterion ${i + 1}">
        <input type="range" min="0" max="10" step="1" data-weight="${i}" value="${c.weight}" aria-label="Importance of criterion ${i + 1}">
        <output data-wout="${i}">${c.weight}</output>
        <button type="button" class="x" data-cdel="${i}" ${crits.length <= 1 ? 'disabled' : ''} aria-label="Remove criterion">×</button>
      </div>`).join('');
    $('[data-add-crit]', root).disabled = crits.length >= 8;
  };

  function wire(el) {
    root = el;
    const box = $('[data-crits]', root);
    box.addEventListener('input', e => {
      const d = e.target.dataset;
      if (d.cname) crits[d.cname].name = e.target.value;
      if (d.weight) { crits[d.weight].weight = +e.target.value; $(`[data-wout="${d.weight}"]`, root).textContent = e.target.value; }
    });
    box.addEventListener('click', e => {
      const i = e.target.closest('[data-cdel]')?.dataset.cdel;
      if (i) { crits.splice(+i, 1); draw(); }
    });
    $('[data-add-crit]', root).onclick = () => {
      crits.push({ id: newId('k'), name: '', weight: 5 });
      draw();
      $('.crit-row:last-child [data-cname]', root).focus();
    };
    draw();
  }

  function read() {
    const names = crits.map(c => clean(c.name, 30));
    if (names.some(n => !n)) throw new Error('Every criterion needs a name');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new Error('Criterion names must all be different');
    return crits.map((c, i) => ({ id: c.id, name: names[i], weight: c.weight }));
  }

  return { html, wire, read };
}
