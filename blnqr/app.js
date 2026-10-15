// Entry point: the router that picks a page from the URL.
import { isDemo } from './backend.js';
import { $, app, esc, setRouter, leavePage } from './ui.js';
import { renderHome, renderBrowse } from './home.js';
import { renderGame } from './game.js';
import { renderSession, renderJoin } from './session.js';
import { renderSetup, renderNew, renderEditor } from './setup.js';
import { openRoom } from './team.js';

function page(p) {
  if (p.has('g')) return renderGame(p.get('g'));
  if (p.has('s')) return renderSession(p.get('s'));
  if (p.has('room')) return openRoom(p.get('room'));
  if (p.has('join')) return renderJoin((p.get('join') || '').toUpperCase());
  if (p.has('browse')) return renderBrowse(p);
  if (p.has('setup')) return renderSetup();
  if (p.has('new')) return renderNew();
  if (p.has('edit')) return renderEditor(p.get('edit'), p.get('type'));
  return renderHome();
}

function route() {
  leavePage();
  scrollTo(0, 0);
  Promise.resolve(page(new URLSearchParams(location.search))).catch(err => {
    console.error(err);
    app.innerHTML = `
      <div class="card empty-state">
        <p>Something went wrong: ${esc(err.message || err)}</p>
        <a class="btn" href="./" data-link>Home</a>
      </div>`;
  });
}

if (isDemo) $('#demo').hidden = false;
setRouter(route);
addEventListener('popstate', route);
route();
