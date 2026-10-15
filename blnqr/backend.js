// All data access lives here. Firebase when configured, otherwise a localStorage
// demo that behaves the same way (tabs in one browser act as separate players).
//
// Data shape (Firestore paths, mirrored in the demo):
//   games/{id}                     { type, title, description, ownerUid, visibility: 'public'|'link'|'invite', invites: [email],
//                                    loginRequired, solo, group, question, verdict, seconds, rounds, topK, feedback, repeat,
//                                    content: {...type-specific}, plays }
//   games/{id}/results/{uid}       { name, summary, at }                 solo plays, one per player
//   sessions/{code}                { gameId, title, type, hostUid, live, phase: 'lobby'|'play'|'reveal', round }
//                                    group play (6-letter code); live sessions are run by the host
//   sessions/{code}/players/{uid}  { name, status?: 'playing', round?, summary?, at? }
//   sessions/{code}/options/{key}  { text, by }                         options players added (Group pick)
//   rooms/{code}                   live "You are a…" rooms where players propose words (5-letter code)
//   rooms/{code}/words/{cat~txt}   { cat, text, voters: [uid], removed, by }
//   rooms/{code}/players/{uid}     { name, result? }
//
// Players sign in anonymously unless a game requires login. Making games needs
// a Google sign-in so people can edit them from any device.
import { firebaseConfig } from './firebase-config.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(length) {
  return Array.from(crypto.getRandomValues(new Uint32Array(length)), n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}
const wordId = (cat, text) => `${cat}~${text}`;
// Added options are keyed by their lowercased text, so duplicates collide.
const optionKey = text => 'o:' + text.toLowerCase().replace(/\//g, '-').slice(0, 100);

export const isDemo = !firebaseConfig;
export const backend = isDemo ? createDemo() : await createFirebase(firebaseConfig);


async function createFirebase(config) {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  await new Promise(resolve => {
    const stop = A.onAuthStateChanged(auth, () => { stop(); resolve(); });
  });
  if (!auth.currentUser) await A.signInAnonymously(auth);
  const me = () => auth.currentUser.uid;

  const db = F.getFirestore(app);
  const ms = t => t?.toMillis?.() ?? 0;
  const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const withAt = snap => snap.docs.map(d => ({ ...d.data(), id: d.id, at: ms(d.data().at) }));

  const roomRef = code => F.doc(db, 'rooms', code);
  const wordRef = (code, id) => F.doc(db, 'rooms', code, 'words', id);
  const playerRef = (code, id) => F.doc(db, 'rooms', code, 'players', id);
  const gameRef = id => F.doc(db, 'games', id);
  const resultRef = (id, uid) => F.doc(db, 'games', id, 'results', uid);
  const sessionRef = code => F.doc(db, 'sessions', code);
  const memberRef = (code, uid) => F.doc(db, 'sessions', code, 'players', uid);
  const optionRef = (code, key) => F.doc(db, 'sessions', code, 'options', key);
  const gameOut = d => ({ ...d.data(), id: d.id, updated: ms(d.data().updatedAt) });
  const getGames = async (...where) =>
    (await F.getDocs(F.query(F.collection(db, 'games'), ...where.map(w => F.where(...w))))).docs.map(gameOut);

  // Claims a fresh random code for a new room or session document.
  async function claimCode(ref, length, data) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode(length);
      const free = await F.runTransaction(db, async tx => {
        if ((await tx.get(ref(code))).exists()) return false;
        tx.set(ref(code), { ...data, hostUid: me(), createdAt: F.serverTimestamp() });
        return true;
      });
      if (free) return code;
    }
    throw new Error('Could not find a free code. Try again.');
  }

  return {
    get uid() { return me(); },
    get user() {
      const u = auth.currentUser;
      return { uid: u.uid, google: !u.isAnonymous, name: u.displayName || u.email || 'you', email: (u.email || '').toLowerCase() };
    },
    signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    async signOut() {
      await A.signOut(auth);
      await A.signInAnonymously(auth);
    },

    /* Games */
    listPublicGames: () => getGames(['visibility', '==', 'public']),
    listMyGames: () => getGames(['ownerUid', '==', me()]),
    async getGame(id) {
      const s = await F.getDoc(gameRef(id));
      return s.exists() ? gameOut(s) : null;
    },
    async saveGame(id, data) {
      if (id) {
        await F.updateDoc(gameRef(id), { ...data, updatedAt: F.serverTimestamp() });
        return id;
      }
      const ref = await F.addDoc(F.collection(db, 'games'), {
        ...data, ownerUid: me(), plays: 0, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
      });
      return ref.id;
    },
    async deleteGame(id) {
      const results = await F.getDocs(F.collection(db, 'games', id, 'results'));
      await Promise.all(results.docs.map(d => F.deleteDoc(d.ref)));
      await F.deleteDoc(gameRef(id));
    },
    watchResults: (id, cb, onError) =>
      F.onSnapshot(F.collection(db, 'games', id, 'results'), s => cb(withAt(s)), onError),
    async getMyResult(id) {
      const s = await F.getDoc(resultRef(id, me()));
      return s.exists() ? s.data() : null;
    },
    async saveResult(id, name, summary) {
      const ref = resultRef(id, me());
      const isNew = !(await F.getDoc(ref)).exists();
      const batch = F.writeBatch(db);
      batch.set(ref, { name, summary, at: F.serverTimestamp() });
      if (isNew) batch.update(gameRef(id), { plays: F.increment(1) });
      await batch.commit();
    },

    /* Any-time group sessions */
    createSession: (game, live) => claimCode(sessionRef, 6, {
      gameId: game.id, title: game.title, type: game.type, live, phase: live ? 'lobby' : 'play', round: 1,
    }),
    async getSession(code) {
      const s = await F.getDoc(sessionRef(code));
      return s.exists() ? { code, ...s.data() } : null;
    },
    watchSession: (code, cb, onError) =>
      F.onSnapshot(sessionRef(code), s => cb(s.exists() ? { code, ...s.data() } : null), onError),
    updateSession: (code, patch) => F.updateDoc(sessionRef(code), patch),
    setMember: (code, patch) => F.setDoc(memberRef(code, me()), patch, { merge: true }),
    watchOptions: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'sessions', code, 'options'), s => cb(docs(s)), onError),
    addOption(code, text) {
      const ref = optionRef(code, optionKey(text));
      return F.runTransaction(db, async tx => {
        if ((await tx.get(ref)).exists()) return 'exists';
        tx.set(ref, { text, by: me() });
        return 'added';
      });
    },
    removeOption: (code, key) => F.deleteDoc(optionRef(code, key)),
    watchMembers: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'sessions', code, 'players'), s => cb(withAt(s)), onError),
    async getMember(code) {
      const s = await F.getDoc(memberRef(code, me()));
      return s.exists() ? s.data() : null;
    },
    joinSession: (code, name) => F.setDoc(memberRef(code, me()), { name }, { merge: true }),
    async saveSessionResult(code, gameId, summary, round = 1) {
      const ref = memberRef(code, me());
      const isNew = !(await F.getDoc(ref)).data()?.summary;
      const batch = F.writeBatch(db);
      batch.set(ref, { summary, round, status: 'done', at: F.serverTimestamp() }, { merge: true });
      if (isNew) batch.update(gameRef(gameId), { plays: F.increment(1) });
      await batch.commit();
    },

    /* Live rooms */
    async getRoom(code) {
      const s = await F.getDoc(roomRef(code));
      return s.exists() ? { code, ...s.data() } : null;
    },
    createRoom: room => claimCode(roomRef, 5, { ...room, phase: 'propose' }),
    updateRoom: (code, patch) => F.updateDoc(roomRef(code), patch),
    watchRoom: (code, cb, onError) =>
      F.onSnapshot(roomRef(code), s => cb(s.exists() ? { code, ...s.data() } : null), onError),
    watchWords: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'rooms', code, 'words'), s => cb(docs(s)), onError),
    watchPlayers: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'rooms', code, 'players'), s => cb(docs(s)), onError),
    async getPlayer(code) {
      const s = await F.getDoc(playerRef(code, me()));
      return s.exists() ? s.data() : null;
    },
    joinRoom: (code, name) => F.setDoc(playerRef(code, me()), { name }, { merge: true }),
    propose(code, cat, text) {
      const ref = wordRef(code, wordId(cat, text));
      return F.runTransaction(db, async tx => {
        const s = await tx.get(ref);
        if (!s.exists()) {
          tx.set(ref, { cat, text, voters: [me()], removed: false, by: me() });
          return 'added';
        }
        const w = s.data();
        if (w.removed) return 'removed';
        if (w.voters.includes(me())) return 'already';
        tx.update(ref, { voters: F.arrayUnion(me()) });
        return 'voted';
      });
    },
    setVote: (code, id, on) => F.updateDoc(wordRef(code, id), { voters: on ? F.arrayUnion(me()) : F.arrayRemove(me()) }),
    setRemoved: (code, id, removed) => F.updateDoc(wordRef(code, id), { removed }),
    saveRoomResult: (code, result) => F.setDoc(playerRef(code, me()), { result }, { merge: true }),
  };
}

function createDemo() {
  const KEY = 'blnqr-demo';
  let uid = sessionStorage.getItem('blnqr-demo-uid');
  if (!uid) sessionStorage.setItem('blnqr-demo-uid', (uid = 'u' + makeCode(5).toLowerCase()));
  const setUid = id => { uid = id; sessionStorage.setItem('blnqr-demo-uid', id); };

  const blank = () => ({ rooms: {}, games: {}, sessions: {} });
  const load = () => {
    try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); }
  };
  const listeners = new Set();
  const emit = () => listeners.forEach(f => f());
  addEventListener('storage', e => { if (e.key === KEY) emit(); });

  const mutate = fn => {
    const data = load();
    const out = fn(data);
    localStorage.setItem(KEY, JSON.stringify(data));
    emit();
    return out;
  };
  const watch = (read, cb) => {
    const f = () => cb(read(load()));
    listeners.add(f);
    queueMicrotask(f);
    return () => listeners.delete(f);
  };
  const without = (obj, ...keys) => {
    if (!obj) return null;
    const copy = { ...obj };
    keys.forEach(k => delete copy[k]);
    return copy;
  };
  const entries = obj => Object.entries(obj || {}).map(([id, v]) => ({ ...v, id }));
  const gameList = keep => entries(load().games).map(g => without(g, 'results')).filter(keep);
  const newCode = (taken, length) => { let c; do c = makeCode(length); while (taken[c]); return c; };

  return {
    get uid() { return uid; },
    get user() { return { uid, google: uid === 'owner', name: 'Demo host', email: uid === 'owner' ? 'demo@example.com' : '' }; },
    // Demo sign-in: every signed-in tab shares one "owner" identity.
    signIn: async () => setUid('owner'),
    signOut: async () => setUid('u' + makeCode(5).toLowerCase()),

    /* Games */
    listPublicGames: async () => gameList(g => g.visibility === 'public'),
    listMyGames: async () => gameList(g => g.ownerUid === uid),
    getGame: async id => { const g = load().games[id]; return g ? { ...without(g, 'results'), id } : null; },
    saveGame: async (id, data) => mutate(d => {
      if (id) Object.assign(d.games[id], data, { updated: Date.now() });
      else d.games[(id = makeCode(12).toLowerCase())] = { ...data, ownerUid: uid, plays: 0, updated: Date.now(), results: {} };
      return id;
    }),
    deleteGame: async id => mutate(d => { delete d.games[id]; }),
    watchResults: (id, cb) => watch(d => entries(d.games[id]?.results), cb),
    getMyResult: async id => load().games[id]?.results[uid] ?? null,
    saveResult: async (id, name, summary) => mutate(d => {
      const g = d.games[id];
      if (!g.results[uid]) g.plays++;
      g.results[uid] = { name, summary, at: Date.now() };
    }),

    /* Any-time group sessions */
    createSession: async (game, live) => mutate(d => {
      const code = newCode(d.sessions, 6);
      d.sessions[code] = {
        gameId: game.id, title: game.title, type: game.type, hostUid: uid,
        live, phase: live ? 'lobby' : 'play', round: 1, players: {}, options: {},
      };
      return code;
    }),
    getSession: async code => { const s = load().sessions[code]; return s ? { code, ...without(s, 'players', 'options') } : null; },
    watchSession: (code, cb) => watch(d => d.sessions[code] ? { code, ...without(d.sessions[code], 'players', 'options') } : null, cb),
    updateSession: async (code, patch) => mutate(d => Object.assign(d.sessions[code], patch)),
    setMember: async (code, patch) => mutate(d => Object.assign(d.sessions[code].players[uid], patch)),
    watchOptions: (code, cb) => watch(d => entries(d.sessions[code]?.options), cb),
    addOption: async (code, text) => mutate(d => {
      const opts = (d.sessions[code].options ??= {}), key = optionKey(text);
      if (opts[key]) return 'exists';
      opts[key] = { text, by: uid };
      return 'added';
    }),
    removeOption: async (code, key) => mutate(d => { delete d.sessions[code].options[key]; }),
    watchMembers: (code, cb) => watch(d => entries(d.sessions[code]?.players), cb),
    getMember: async code => load().sessions[code]?.players[uid] ?? null,
    joinSession: async (code, name) => mutate(d => {
      const players = d.sessions[code].players;
      players[uid] = { ...players[uid], name };
    }),
    saveSessionResult: async (code, gameId, summary, round = 1) => mutate(d => {
      const p = d.sessions[code].players[uid];
      if (!p.summary && d.games[gameId]) d.games[gameId].plays++;
      Object.assign(p, { summary, round, status: 'done', at: Date.now() });
    }),

    /* Live rooms */
    getRoom: async code => { const r = load().rooms[code]; return r ? { code, ...without(r, 'words', 'players') } : null; },
    createRoom: async room => mutate(d => {
      const code = newCode(d.rooms, 5);
      d.rooms[code] = { ...room, hostUid: uid, phase: 'propose', words: {}, players: {} };
      return code;
    }),
    updateRoom: async (code, patch) => mutate(d => Object.assign(d.rooms[code], patch)),
    watchRoom: (code, cb) => watch(d => d.rooms[code] ? { code, ...without(d.rooms[code], 'words', 'players') } : null, cb),
    watchWords: (code, cb) => watch(d => entries(d.rooms[code]?.words), cb),
    watchPlayers: (code, cb) => watch(d => entries(d.rooms[code]?.players), cb),
    getPlayer: async code => load().rooms[code]?.players[uid] ?? null,
    joinRoom: async (code, name) => mutate(d => {
      const players = d.rooms[code].players;
      players[uid] = { ...players[uid], name };
    }),
    propose: async (code, cat, text) => mutate(d => {
      const room = d.rooms[code];
      if (room.phase !== 'propose') throw new Error('Proposals are closed');
      const id = wordId(cat, text), w = room.words[id];
      if (!w) {
        room.words[id] = { cat, text, voters: [uid], removed: false, by: uid };
        return 'added';
      }
      if (w.removed) return 'removed';
      if (w.voters.includes(uid)) return 'already';
      w.voters.push(uid);
      return 'voted';
    }),
    setVote: async (code, id, on) => mutate(d => {
      const w = d.rooms[code].words[id];
      w.voters = w.voters.filter(v => v !== uid);
      if (on) w.voters.push(uid);
    }),
    setRemoved: async (code, id, removed) => mutate(d => { d.rooms[code].words[id].removed = removed; }),
    saveRoomResult: async (code, result) => mutate(d => { d.rooms[code].players[uid].result = result; }),
  };
}
