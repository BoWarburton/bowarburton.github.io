// All data access lives here. Firebase when configured, otherwise a localStorage
// demo that behaves the same way (tabs in one browser act as separate players).
//
// Data shape (Firestore paths, mirrored in the demo):
//   rooms/{code}                 { name, categories: [{id, name, color}], hostUid, phase, minVotes, rounds, seconds }
//   rooms/{code}/words/{cat~txt} { cat, text, voters: [uid], removed, by }
//   rooms/{code}/players/{uid}   { name, result? }
import { firebaseConfig } from './firebase-config.js';

export const isDemo = !firebaseConfig;
export const backend = isDemo ? createDemo() : await createFirebase(firebaseConfig);

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode() {
  return Array.from(crypto.getRandomValues(new Uint32Array(5)), n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}
const wordId = (cat, text) => `${cat}~${text}`;

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
  const uid = (auth.currentUser ?? (await A.signInAnonymously(auth)).user).uid;

  const db = F.getFirestore(app);
  const roomRef = code => F.doc(db, 'rooms', code);
  const wordRef = (code, id) => F.doc(db, 'rooms', code, 'words', id);
  const playerRef = (code, id) => F.doc(db, 'rooms', code, 'players', id);
  const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    uid,
    async getRoom(code) {
      const s = await F.getDoc(roomRef(code));
      return s.exists() ? { code, ...s.data() } : null;
    },
    async createRoom(room) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode();
        const free = await F.runTransaction(db, async tx => {
          if ((await tx.get(roomRef(code))).exists()) return false;
          tx.set(roomRef(code), { ...room, hostUid: uid, phase: 'propose', createdAt: F.serverTimestamp() });
          return true;
        });
        if (free) return code;
      }
      throw new Error('Could not find a free room code. Try again.');
    },
    updateRoom: (code, patch) => F.updateDoc(roomRef(code), patch),
    watchRoom: (code, cb, onError) =>
      F.onSnapshot(roomRef(code), s => cb(s.exists() ? { code, ...s.data() } : null), onError),
    watchWords: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'rooms', code, 'words'), s => cb(docs(s)), onError),
    watchPlayers: (code, cb, onError) =>
      F.onSnapshot(F.collection(db, 'rooms', code, 'players'), s => cb(docs(s)), onError),
    async getPlayer(code) {
      const s = await F.getDoc(playerRef(code, uid));
      return s.exists() ? s.data() : null;
    },
    joinRoom: (code, name) => F.setDoc(playerRef(code, uid), { name }, { merge: true }),
    propose(code, cat, text) {
      const ref = wordRef(code, wordId(cat, text));
      return F.runTransaction(db, async tx => {
        const s = await tx.get(ref);
        if (!s.exists()) {
          tx.set(ref, { cat, text, voters: [uid], removed: false, by: uid });
          return 'added';
        }
        const w = s.data();
        if (w.removed) return 'removed';
        if (w.voters.includes(uid)) return 'already';
        tx.update(ref, { voters: F.arrayUnion(uid) });
        return 'voted';
      });
    },
    setVote: (code, id, on) => F.updateDoc(wordRef(code, id), { voters: on ? F.arrayUnion(uid) : F.arrayRemove(uid) }),
    setRemoved: (code, id, removed) => F.updateDoc(wordRef(code, id), { removed }),
    saveResult: (code, result) => F.setDoc(playerRef(code, uid), { result }, { merge: true }),
  };
}

function createDemo() {
  const KEY = 'blnqr-demo';
  let uid = sessionStorage.getItem('blnqr-demo-uid');
  if (!uid) sessionStorage.setItem('blnqr-demo-uid', (uid = 'u' + makeCode().toLowerCase()));

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { rooms: {} }; } catch { return { rooms: {} }; }
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
  const roomOnly = (r, code) => {
    if (!r) return null;
    const { words, players, ...rest } = r;
    return { code, ...rest };
  };
  const entries = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

  return {
    uid,
    getRoom: async code => roomOnly(load().rooms[code], code),
    createRoom: async room => {
      let code;
      do code = makeCode(); while (load().rooms[code]);
      mutate(d => { d.rooms[code] = { ...room, hostUid: uid, phase: 'propose', words: {}, players: {} }; });
      return code;
    },
    updateRoom: async (code, patch) => mutate(d => Object.assign(d.rooms[code], patch)),
    watchRoom: (code, cb) => watch(d => roomOnly(d.rooms[code], code), cb),
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
    saveResult: async (code, result) => mutate(d => { d.rooms[code].players[uid].result = result; }),
  };
}
