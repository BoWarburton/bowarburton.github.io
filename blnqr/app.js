// Entry point: the home page and the router that picks a page from the URL.
import { isDemo } from './backend.js';
import { $, app, esc, setRouter, leavePage } from './ui.js';
import { renderTeam, openRoom } from './team.js';
import { renderPublic, renderSolo } from './solo.js';
import { renderSetup, renderEditor } from './setup.js';

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1 class="wordmark">blnqr</h1>
      <p class="tagline">Say “blinker”. Rapid, gut-level, two-at-a-time choices that sort you into a house, rank a list, or settle a decision before your brain can argue.</p>
    </section>
    <nav class="modes">
      <a class="card mode" href="?team" data-link style="--c:#b91c1c">
        <h2>Team play</h2>
        <p>Join or host a live room. Everyone proposes words for each category together, then sorts themselves.</p>
        <span class="go-arrow">Join or host →</span>
      </a>
      <a class="card mode" href="?play" data-link style="--c:#1d4ed8">
        <h2>Solo play</h2>
        <p>Public sorts and challenges. Take a ready-made blnqr on your own and see how you compare with everyone else.</p>
        <span class="go-arrow">Browse blnqrs →</span>
      </a>
      <a class="card mode" href="?setup" data-link style="--c:#15803d">
        <h2>Setup</h2>
        <p>Make and edit solo blnqrs and team sorts: sorting hats, rankings, decisions, or classroom review.</p>
        <span class="go-arrow">Create &amp; edit →</span>
      </a>
    </nav>`;
}

function page(p) {
  if (p.has('room')) return openRoom(p.get('room'));
  if (p.has('team')) return renderTeam();
  if (p.has('play')) return renderPublic();
  if (p.has('sort')) return renderSolo(p.get('sort'));
  if (p.has('setup')) return renderSetup();
  if (p.has('edit')) return renderEditor(p.get('edit'), p.get('mode'));
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
