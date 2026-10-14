# blnqr

A multiplayer, crowd-sourced sorting hat.

1. **Propose.** A host creates a room with 2–8 categories (e.g. the four Hogwarts houses). Players join with a 5-letter code and add words that fit each category. They can also tap other people's words to back them.
2. **Sort.** The host starts Phase 2. Each player gets a rapid run of forced-choice pairs: two words from *different* categories, a short timer, and the instruction to pick the one that's more *you* (keys `F`/`←` and `J`/`→`, or tap).
3. **Reveal.** Each player sees their ipsative profile, a percentage for every category, along with their fastest picks ("words that gave you away") and how the whole room sorted.

## Moderation

- A built-in profanity filter rejects bad words when they're submitted ([filter.js](filter.js)).
- The host sees a × on every word and can remove it (or restore it with ↺).
- A word only enters the quiz once enough players have backed it. The host chooses 1, 2 or 3 backers.

## Scoring

Rounds cycle through every pairing of categories so each category appears equally often. A category's score is its win rate: times picked divided by times shown. The scores are then normalized so they sum to 100%. Timed-out pairs are skipped and don't count. Because every choice trades one category against another, the result is *ipsative*. It shows your relative preferences, not absolute amounts.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styling |
| `app.js` | All screens: home, room setup, Phase 1 board, host controls, quiz, results |
| `quiz.js` | Pure logic: word validation, pair building, scoring |
| `filter.js` | Profanity filter |
| `backend.js` | Data layer: Firebase, or a localStorage demo |
| `firebase-config.js` | Your Firebase config (empty = demo mode) |
| `firestore.rules` | Security rules to paste into Firebase |

## Running locally

ES modules don't load from `file://`, so serve the folder:

```sh
python -m http.server 8000      # from the repo root
# open http://localhost:8000/blnqr/
```

With no Firebase config, the app runs in **demo mode**. Data is stored in this browser's localStorage, and each tab is a separate player, so you can host in one tab and join from others.

## Connecting Firebase (for real multiplayer)

1. Go to <https://console.firebase.google.com>, then **Add project**. Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method**: enable **Anonymous**.
3. **Authentication → Settings → Authorized domains**: add `bowarburton.github.io`. `localhost` is already listed.
4. **Build → Firestore Database → Create database**. Pick any location and start in **production mode**.
5. **Firestore → Rules**: replace the contents with [firestore.rules](firestore.rules) and click **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`)**: register an app, then copy the `firebaseConfig` object into [firebase-config.js](firebase-config.js).

The web config is meant to be public. Access is controlled by the security rules. The free Spark plan covers classroom-sized use comfortably.

Each browser gets one anonymous identity. To test several players on one machine with Firebase, use separate browser profiles or private windows.
