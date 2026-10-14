# blnqr

*Say "blinker".* A **blnqr** is a rapid run of gut-level, two-at-a-time choices. Each round flashes two words under a short timer, and you pick the one that fits a question ("Which is more you?") before you have time to think it over. Your picks add up to a profile across the categories.

Uses for a blnqr:

- **Sorting hat:** which Hogwarts house, element or season are you?
- **Ranking a list or making a decision:** make each option its own category. Your bars become your ranking, and "Everyone's average" becomes the group's.
- **Classroom:** "Which is more Baroque?" or "Which sounds more like the Federalists?"

## Three ways in

**Team play:** live rooms with two phases.
1. **Propose.** Players join with a 5-letter code. They add words that fit each category and tap other people's words to back them.
2. **Sort.** When the host starts Phase 2, each player takes the rapid quiz using the room's words.
3. **Reveal.** Each player sees their own result. The room sees how everyone sorted and the room average.

A host starts a room from a saved team sort, or creates a quick one-off room.

**Solo play:** the *Public sorts & challenges* page lists public blnqrs that anyone can take on their own. Each blnqr has a leaderboard showing:
- how everyone who took it sorted
- everyone's average
- recent players
- how many people share your result

**Setup:** sign in with Google to create and edit:
- **blnqrs (solo):** you write the words for each category, or import the qualifying words from a team room. They can be public or unlisted, and an unlisted blnqr can still be played from its link.
- **Team sorts:** reusable templates for live rooms (name, categories, rules).

Both kinds let you set the question shown to players and the heading on the result.

## Moderation

- A built-in profanity filter checks words as they're submitted, and also checks the words typed in Setup ([filter.js](filter.js)).
- In team rooms, the host can remove or restore any word. A word only enters the quiz once enough players have backed it (1, 2 or 3; the host chooses).

## Scoring

Rounds cycle through every pairing of categories, so each category appears equally often. A category's score is its win rate (times picked ÷ times shown). Scores are then normalized to sum to 100%. Timed-out pairs are skipped. Because every choice trades one category against another, the result is *ipsative*: it shows relative preference, not absolute amounts.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styling |
| `app.js` | Home page and router (`?team`, `?play`, `?sort=ID`, `?setup`, `?edit=ID`, `?room=CODE`) |
| `team.js` | Team play: join/host, rooms, Phase 1 board, host controls |
| `solo.js` | Public list and playing a blnqr, with its leaderboard |
| `setup.js` | Sign-in, your sorts, and the editor |
| `play.js` | The rapid quiz, shared by team and solo |
| `ui.js` | Shared helpers, presets and result markup |
| `quiz.js` | Pure logic: word validation, pair building, scoring |
| `filter.js` | Profanity filter |
| `backend.js` | Data layer: Firebase, or a localStorage demo |
| `firebase-config.js` | Your Firebase config (`null` = demo mode) |
| `firestore.rules` | Security rules to paste into Firebase |

## Running locally

ES modules don't load from `file://`, so serve the folder:

```sh
python -m http.server 8000      # from the repo root
# open http://localhost:8000/blnqr/
```

When `firebaseConfig` is `null`, the app runs in **demo mode**:
- Data is stored in this browser's localStorage, and each tab is a separate player.
- "Sign in" is simulated, and every signed-in tab shares one owner account.

## Connecting Firebase

1. Go to <https://console.firebase.google.com> and click **Add project**. Analytics isn't needed.
2. **Build → Authentication → Sign-in method**: enable **Anonymous** (for players) and **Google** (for Setup).
3. **Authentication → Settings → Authorized domains**: add `bowarburton.github.io`. `localhost` is already listed.
4. **Build → Firestore Database → Create database**. Choose the Standard edition, keep the `(default)` ID, and start in production mode.
5. **Firestore → Rules**: replace the contents with [firestore.rules](firestore.rules) and click **Publish**. Re-publish whenever this file changes.
6. **Project settings → General → Your apps → Web (`</>`)**: register an app, then copy its `firebaseConfig` object into [firebase-config.js](firebase-config.js).

The web config is meant to be public. Access is controlled by the security rules. The free Spark plan covers classroom-sized use comfortably.

Notes:

- Each browser gets one anonymous identity. To test several players on one machine, use separate browser profiles or private windows.
- Signing in or out of Google switches your identity. Do it before hosting a room, not partway through one.
