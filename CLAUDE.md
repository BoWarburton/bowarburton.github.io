# CLAUDE.md

Mr. Warburton's GitHub Pages site (`bowarburton.github.io`). The repo root is a small Jekyll portfolio and classroom demo. Most of the real work happens in **`blnqr/`**, a static web app of rapid two-choice games.

## Layout

| Path | What it is |
| --- | --- |
| `index.md`, `about.md`, `notebook.md`, `game.md`, `_config.yml` | Jekyll portfolio (theme `jekyll-theme-slate`), built by GitHub Pages. Keep it simple. |
| `blnqr/` | The blnqr app. See below, plus [blnqr/README.md](blnqr/README.md) and [blnqr/ROADMAP.md](blnqr/ROADMAP.md). |
| `j/index.html` | Short join address `/j?CODE`, which redirects to `blnqr/?join=CODE`. |
| `ap-robot-simulator.html` | A single-file AP CSP robot pseudocode simulator that works offline. |
| `chemistryfrog/` | A single-file chemistry game (Tailwind CDN). |
| `game/` | Retro Tank Shooter: `main.py` is the pygame source; `index.html`, `game.apk` and `game.tar.gz` are pygbag build output. `game.md` embeds it in an iframe. |
| `java-projects/`, `python-projects/` | Small classroom examples. `youtube-classroom-player/` is a local FastAPI LAN app with its own readme and `.venv`. |

## Ground rules

- **No build step, no npm, no bundler, no test suite.** Everything is plain HTML, CSS and native ES modules served as static files. Keep it that way; don't add dependencies or tooling.
- To test, serve the repo root with `python -m http.server 8000` and open `http://localhost:8000/blnqr/` in a browser.
- **Running locally hits production.** `blnqr/firebase-config.js` holds the live config (project `blnqr-eff97`), so local runs read and write real Firestore data. For throwaway testing, temporarily set `firebaseConfig = null` (demo mode, which uses localStorage, and where each tab is a separate player) and **don't commit that change**.
- **ROADMAP.md is the plan of record.** When a requirement, decision or feature changes, update [blnqr/ROADMAP.md](blnqr/ROADMAP.md) in the same change (status key ✅ 🚧 ⏳ 💭, and add dated rows to the decisions log). Update the README's tables when pages, files or types change.

## blnqr architecture

- **Routing:** single page. `app.js` maps query strings (`?g=ID`, `?s=CODE`, `?room=CODE`, `?join`, `?browse`, `?setup`, `?new`, `?edit=ID`) to page renderers. Internal links use `<a data-link>` and `go()` from `ui.js` (pushState + re-render). Pages render by setting `app.innerHTML` to template strings.
- **Live listeners:** any Firestore watch a page opens must be registered with `onLeave(unsubscribe)`. `leavePage()` tears them down on every navigation.
- **Data layer:** `backend.js` exports one `backend` object with **two implementations of the same API**: `createFirebase()` (Firestore + Auth via the gstatic CDN, v10.12.2) and `createDemo()` (localStorage). Any new backend method or data change must go into **both**. The data shape is documented in the header comment of `backend.js`. Keep it current.
- **Auth:** players sign in anonymously; creating and editing games requires Google sign-in. Codes come from an unambiguous alphabet: sessions use 6 letters and rooms use 5.
- **Security rules:** `blnqr/firestore.rules` mirrors the data shape and validation. Rules are deployed **by pasting the file into the Firebase console** (Firestore → Rules → Publish); there is no Firebase CLI. Whenever the rules change, remind the user to re-publish them. New fields on games, sessions or words may need rule changes (e.g. `keys().hasOnly(...)`, `affectedKeys()`).
- **Runner:** `play.js` `runGame(el, game, type)` shows the countdown, then calls `type.play(game, ask)`. `ask({ prompt, left, right, correct, n, total, approx })` resolves with `{ pick: 'left'|'right'|null, ms }`. A `null` pick means the timer ran out. It handles keys (F/← and J/→), the timer bar, right/wrong feedback, pictures, flash prompts and read-aloud.
- **Game types:** `types/<id>.js` each default-export a module with `id, label, blurb, example, color, defaults, options` (which Setup fields to show) and the functions `ready(game)` (an error string, or `''`), `estimate`, `play`, `result`, `board` and `editor(game)` (which returns `{ html, wire, read }`). Some types add `liveRoom` and `wireResult` (persona). `group.js` shows reuse by spreading another type.
- **Shared helpers:** `types/kit.js` has `mergeSort` and top-K driven by async comparisons, `comparer`, `quizRounds`, consensus ranking and score/leaderboard markup. `types/editors.js` has the category, line (pipe- or tab-separated, with presets) and criteria editors. `types/packs.js` holds the starter packs and presets.
- **Adding a game type:** write `types/<id>.js` → add it to `TYPES` in `types/index.js` → **add the id to `validGame()`'s type list in `firestore.rules`** → remind the user to re-publish the rules → update the README and ROADMAP.
- **Pictures:** `pictures/index.js` maps lowercase names to SVGs (`"ten frame 3"` → `pictures/dots/ten-frame-3.svg`). New pictures must be listed there. `make_animals.py` and `make_dots.py` generate same-style 200×200 SVGs.

## Code style

Match what's already there:
- 2-space indent, single quotes, semicolons, compact arrow functions, and HTML in template literals.
- **Always escape user text with `esc()`** before putting it into HTML.
- Wrap async event handlers in `guard()`, so errors show up as a toast.
- Give each function a short, plain-English comment explaining its purpose, as the existing code does.
- Wrap `localStorage` and `speechSynthesis` access in `try {} catch {}`.
- User-facing copy is plain, short and friendly, and suits classrooms with young players (some presets target ages 6–8). Profanity filtering lives in `filter.js`.
