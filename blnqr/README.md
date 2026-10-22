# blnqr

*Say "blinker".* A **blnqr** is a game made of rapid, two-at-a-time choices. Two options flash up, you pick one (often against a timer), and your picks add up to a result. It can reveal who you are, test what you know, or settle what to choose, either alone or with a group.

## Game types

| Type | Each choice | Ends when | Result |
| --- | --- | --- | --- |
| **You are a…** | Two items from different categories: "Which is more you?" | After N rounds | Your profile across the categories |
| **Flashcards** | A prompt, then the right answer vs. a wrong one | Every card is done (missed cards can come back) | Score, speed, cards to review |
| **Categorizer** | "Which is a {category}?" One item belongs, one doesn't | After N rounds | Score overall and per category |
| **Sequencer** | "Which came first?" Your answers sort the list | Your full order is built | Your order vs. the real one |
| **Preference sorter** | "Which do you prefer?" | Full ranking, or just the top K | Your ranking |
| **Group pick** | Same as the preference sorter, played by a group | Everyone has weighed in | The group's ranking and how much people agreed |
| **Decision maker** | "Which is better for {criterion}?" | Every criterion has been sorted | Weighted ranking. Players can re-slide the importance of each criterion |

Every game has these settings:
- **Who can play:** solo, groups, or both.
- **Visibility:** **Public** (listed on the site), **Secret link** (unlisted; anyone with the link can play) or **Invite only** (only the listed Google accounts can play).
- **Login:** whether players must sign in with Google.
- **Wording and timing:** the question shown to players, the result heading, the timer (or none) and the length.

**Group games** use a 6-letter code or link and come in two kinds, both started from any game's page:
- **Group game (any time):** people play whenever they like, and the group's results update live.
- **Live session:** the host runs it from the front. Players wait in a lobby, everyone's game starts at once when the host clicks **Start**, the host sees who's done and clicks **Reveal** to show everyone the group results, then can start a **New round**.

A Group pick can let players **add their own options** (a Setup checkbox). In a live session they add them in the lobby; in an any-time game they can add them whenever. The host can remove any added option.

**Live rooms (5-letter code):** "You are a…" games can also run as a live room. Players propose and back words first, then the host starts the sort.

## Pages

| URL | Page |
| --- | --- |
| `./` | Home: Play now, popular games, the seven types |
| `?browse&type=…&q=…` | Browse and search public games |
| `?g=ID` | A game: play solo, start a group, leaderboard |
| `?s=CODE` | A group game |
| `?join=CODE` | Join a group game or live room by code |
| `?room=CODE` | A live room |
| `?setup`, `?new`, `?edit=ID` | Your games, the type picker, the editor |

## Making games

In **Setup**, sign in with Google, choose **New game**, and pick a type.

Lists such as flashcards, sequence items and options are typed **one per line**, with columns separated by `|`. You can also copy rows from Google Sheets or Excel and paste them straight in, because tab-separated columns are recognized.

## Files

| File | What it does |
| --- | --- |
| `app.js` | Router |
| `home.js` | Home page, browse and search |
| `game.js` | Game page: solo play, leaderboard, start a group |
| `session.js` | Group games and the join page |
| `team.js` | Live rooms with word proposals |
| `setup.js` | Your games, the type picker, the editor |
| `play.js` | The two-choice runner shared by every type |
| `types/*.js` | One file per game type: how it plays, scores, shows results, combines results, and its editor |
| `types/kit.js` | Shared sorting (merge sort and top-K), consensus ranking, quiz rounds |
| `types/editors.js` | Category, line and criteria editors |
| `quiz.js`, `filter.js` | "You are a…" scoring; profanity filter |
| `backend.js` | Data layer: Firebase, or a localStorage demo |
| `firebase-config.js` | Your Firebase config (`null` = demo mode) |
| `firestore.rules` | Security rules to paste into Firebase |

To add a game type, write a module in `types/` with the same fields as the others, then list it in `types/index.js`. Also add its id to the type list in `validGame()` in [firestore.rules](firestore.rules) and re-publish the rules, or saving a game of the new type will be refused.

## Running locally

```sh
python -m http.server 8000      # from the repo root
# open http://localhost:8000/blnqr/
```

When `firebaseConfig` is `null`, the app runs in **demo mode**:
- Data stays in this browser, and each tab is a separate player.
- Sign-in is simulated, and every signed-in tab shares one owner account.

## Connecting Firebase

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. **Authentication → Sign-in method**: enable **Anonymous** and **Google**.
3. **Authentication → Settings → Authorized domains**: add `bowarburton.github.io`.
4. **Firestore Database → Create database**. Choose the Standard edition, keep the `(default)` ID, and start in production mode.
5. **Firestore → Rules**: paste [firestore.rules](firestore.rules) and click **Publish**. Re-publish whenever this file changes.
6. **Project settings → Your apps → Web**: copy the `firebaseConfig` into [firebase-config.js](firebase-config.js).

## Roadmap

Plans, requirements and decisions are tracked in [ROADMAP.md](ROADMAP.md).
