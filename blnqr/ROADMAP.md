# blnqr roadmap

The plan of record for blnqr. When a new requirement or decision comes up, add it here in the same change, so nothing lives only in a chat.

Status key: ✅ done · 🚧 in progress · ⏳ planned · 💭 idea / later

## Principles

- Every game is a series of rapid, two-option choices ("say *blinker*"). Each game type plugs into one shared engine: which pair to show next, when to stop, and how to score.
- Every type offers solo and group play, and group play can be synchronous (live) or asynchronous (any time), unless a type says otherwise.
- Every game can be public, secret-link or invite-only, and can require login or not.

## Stage 1: Foundation ✅

- ✅ Shared two-choice runner: optional timer, progress, right/wrong feedback.
- ✅ Seven game types:
  1. **You are a…** (personality, spirit animal, sorting hat)
  2. **Flashcards**
  3. **Categorizer** ("Which is a square?")
  4. **Sequencer** ("Which came first?"; the player's answers sort the list)
  5. **Preference sorter** (stops when the order is clear, or after the top K)
  6. **Group pick** (baby names, where to eat, best photo)
  7. **Decision maker** (options × criteria, with importance sliders)
- ✅ Solo play with leaderboards and combined results.
- ✅ Any-time group games (6-letter code or link), with group results that update live.
- ✅ Visibility (public / secret link / invite-only by email) and login-required, set per game.
- ✅ Home page that promotes popular games and has a "Play now" call to action. Browse with search and a type filter.
- ✅ Setup: Google sign-in, one editor per type, and rows pasted from a spreadsheet.
- ✅ Live rooms for "You are a…" where players propose words first (5-letter code).

## Stage 2: Live sessions ✅

- ✅ Live (synchronous) sessions for every type:
  - The host opens a session and players join with a code or link.
  - The host starts it, and everyone plays their own run at the same time.
  - Results build up live, and the host reveals the group results.
  - The host can play along and start new rounds; results are kept per round.
  - Decided: **live session**, not lockstep Kahoot-style.
- ✅ **Players can add options**, a yes/no setup option on Group pick. In a live session players add options in the lobby; in any-time group games they can add them whenever. The host can remove any added option.
  - 💭 Later: make adding a permissioned action (e.g. only some players), and/or limit how many options each player can add.

## Stage 3: Media, data, new modes ⏳

- ✅ **Built-in picture library** (`pictures/`): 20 animals drawn as flat vector SVGs in one shared style. Any game can show a picture next to an item whose name matches one in the library. More can be added with `pictures/make_animals.py`.
- ✅ **Categorizer: ask about only the first category** (the other categories supply the wrong answers), e.g. "Which is a mammal?" every round.
- ✅ **Read questions aloud** (browser speech) for early readers.
- ✅ Preset: **Which Is a Mammal?** for ages 6–8: 10 mammals vs. 10 birds, reptiles, amphibians and insects, with pictures, read-aloud and an 8-second timer.

- ⏳ **Photos.**
  - Decided: in solo play, photos stay on the device and are never uploaded.
  - Decided: in group play, photos are shrunk to about 100 KB thumbnails and stored in Firestore, so the free plan still works.
  - Main use: choosing which photos from your phone to keep, and picking the best photo as a group.
- ⏳ **Spreadsheet file upload** (CSV/XLSX) for creating games. Pasting rows already works.
- ⏳ **Type 8: Tournament.** Bracket and league formats from the pairwise-comparison literature:
  - single elimination
  - double elimination
  - round robin
  - Swiss system: pair players with similar records, so a clear winner emerges in about log₂ n rounds
  - ladder / king of the hill: challengers try to dethrone the current leader
  - seeded vs. random brackets, with byes when the number of entrants isn't a power of 2
  - possible scoring/aggregation options: Elo, Bradley–Terry, Copeland (count of pairwise wins), Condorcet winner, Schulze, Ranked Pairs, Kemeny
- ⏳ **Referee Improvement Machine (RIM).** A live-session mode where everyone watches the same thing (e.g. a sporting event). When a signal fires, every player must give a gut thumbs-up or thumbs-down within a few seconds. It's for any shared moment, not just refereeing.
  - Open questions: who triggers the signal (host button, schedule, or an external feed)? Should players see the crowd's split right away or after a delay? Should individual calls be scored against an "official" call?

## Later 💭

- 💭 More ending algorithms: stop on confidence or stability, a fixed budget, or adaptive top-K.
- 💭 Adaptive, machine-learning pair selection and difficulty, e.g. spaced repetition for flashcards and information-gain pair choice for rankings. Criteria could also adapt (decision maker).
- 💭 Better search and discovery: tags, categories, server-side search.
- 💭 Kahoot-style lockstep mode, deferred in favor of live sessions.

## Decisions log

| Date | Decision |
| --- | --- |
| 2026-10-14 | Firebase (Firestore + Auth) backend. Players sign in anonymously; creators use Google sign-in. |
| 2026-10-14 | A solo sort is called a **blnqr** ("blinker"). |
| 2026-10-14 | Private = the creator chooses either a secret link or an email invite list (login required). |
| 2026-10-14 | Synchronous group play = live session, where each player runs their own sequence at the same time. |
| 2026-10-14 | Build in stages and check in between them. |
| 2026-10-14 | Requirements and plans are tracked in this file, not just in chat. |
