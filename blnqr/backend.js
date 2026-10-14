// All data access lives here. Firebase when configured, otherwise a localStorage
// demo that behaves the same way (tabs in one browser act as separate players).
//
// Data shape (Firestore paths, mirrored in the demo):
//   rooms/{code}                   { name, categories: [{id, name, color}], hostUid, phase, minVotes, rounds, seconds, question, verdict }
//   rooms/{code}/words/{cat~txt}   { cat, text, voters: [uid], removed, by }
//   rooms/{code}/players/{uid}     { name, result? }
//   sorts/{id}                     { ownerUid, mode: 'team'|'solo', name, description, public, plays,
//                                    categories: [{id, name, color, words: [text]}], minVotes, rounds, seconds, question, verdict }
//   sorts/{id}/results/{uid}       { name, top, scores, tells, answered, skipped, avgMs, at }
//
// Players sign in anonymously. Setup needs a Google sign-in so people can edit
// their sorts from any device.
import { firebaseConfig } from './firebase-config.js';

export const isDemo = !firebaseConfig;
export const backend = isDemo ? createDemo() : await createFirebase(firebaseConfig);

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(length = 5) {
  return Array.from(crypto.getRandomValues(new Uint32Array(length)), n => CODE_CHARS[n % CODE_CHARS.length]).join('');
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
  if (!auth.currentUser) await A.signInAnonymously(auth);
  const me = () => auth.currentUser.uid;

  const db = F.getFirestore(app);
  const roomRef = code => F.doc(db, 'rooms', code);
  const wordRef = (code, id) => F.doc(db, 'rooms', code, 'words', id);
  const playerRef = (code, id) => F.doc(db, 'rooms', code, 'players', id);
  const sortRef = id => F.doc(db, 'sorts', id);
  const resultRef = (id, uid) => F.doc(db, 'sorts', id, 'results', uid);
  const ms = t => t?.toMillis?.() ?? 0;
  const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sortOut = d => ({ ...d.data(), id: d.id, updated: ms(d.data().updatedAt) });
  const getSorts = async (...where) =>
    (await F.getDocs(F.query(F.collection(db, 'sorts'), ...where.map(w => F.where(...w))))).docs.map(sortOut);

  return {
    get uid() { return me(); },
    get user() {
      const u = auth.currentUser;
      return { uid: u.uid, google: !u.isAnonymous, name: u.displayName || u.email || 'you' };
    },
    signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    async signOut() {
      await A.signOut(auth);
      await A.signInAnonymously(auth);
    },

    /* Team rooms */
    async getRoom(code) {
      const s = await F.getDoc(roomRef(code));
      return s.exists() ? { code, ...s.data() } : null;
    },
    async createRoom(room) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode();
        const free = await F.runTransaction(db, async tx => {
          if ((await tx.get(roomRef(code))).exists()) return false;
          tx.set(roomRef(code), { ...room, hostUid: me(), phase: 'propose', createdAt: F.serverTimestamp() });
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
    getRoomWords: async code => docs(await F.getDocs(F.collection(db, 'rooms', code, 'words'))),
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
    saveResult: (code, result) => F.setDoc(playerRef(code, me()), { result }, { merge: true }),

    /* Saved sorts and solo blnqrs */
    listPublicSorts: () => getSorts(['mode', '==', 'solo'], ['public', '==', true]),
    listMySorts: () => getSorts(['ownerUid', '==', me()]),
    async getSort(id) {
      const s = await F.getDoc(sortRef(id));
      return s.exists() ? sortOut(s) : null;
    },
    async saveSort(id, data) {
      if (id) {
        await F.updateDoc(sortRef(id), { ...data, updatedAt: F.serverTimestamp() });
        return id;
      }
      const ref = await F.addDoc(F.collection(db, 'sorts'), {
        ...data, ownerUid: me(), plays: 0, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
      });
      return ref.id;
    },
    async deleteSort(id) {
      const results = await F.getDocs(F.collection(db, 'sorts', id, 'results'));
      await Promise.all(results.docs.map(d => F.deleteDoc(d.ref)));
      await F.deleteDoc(sortRef(id));
    },
    watchResults: (id, cb, onError) =>
      F.onSnapshot(F.collection(db, 'sorts', id, 'results'), s => cb(s.docs.map(d => ({ ...d.data(), id: d.id, at: ms(d.data().at) }))), onError),
    async getMyResult(id) {
      const s = await F.getDoc(resultRef(id, me()));
      return s.exists() ? s.data() : null;
    },
    async saveSoloResult(id, name, result) {
      const ref = resultRef(id, me());
      const isNew = !(await F.getDoc(ref)).exists();
      const batch = F.writeBatch(db);
      batch.set(ref, { name, ...result, at: F.serverTimestamp() });
      if (isNew) batch.update(sortRef(id), { plays: F.increment(1) });
      await batch.commit();
    },
  };
}

function createDemo() {
  const KEY = 'blnqr-demo';
  let uid = sessionStorage.getItem('blnqr-demo-uid');
  if (!uid) sessionStorage.setItem('blnqr-demo-uid', (uid = 'u' + makeCode().toLowerCase()));
  const setUid = id => { uid = id; sessionStorage.setItem('blnqr-demo-uid', id); };

  const load = () => {
    try { return { rooms: {}, sorts: {}, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { rooms: {}, sorts: {} }; }
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
  const sortOnly = (s, id) => {
    if (!s) return null;
    const { results, ...rest } = s;
    return { ...rest, id };
  };
  const entries = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
  const sortList = keep => Object.entries(load().sorts).map(([id, s]) => sortOnly(s, id)).filter(keep);

  return {
    get uid() { return uid; },
    get user() { return { uid, google: uid === 'owner', name: 'Demo host' }; },
    // Demo sign-in: every signed-in tab shares one "owner" identity.
    signIn: async () => setUid('owner'),
    signOut: async () => setUid('u' + makeCode().toLowerCase()),

    /* Team rooms */
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
    getRoomWords: async code => entries(load().rooms[code]?.words),
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

    /* Saved sorts and solo blnqrs */
    listPublicSorts: async () => sortList(s => s.mode === 'solo' && s.public),
    listMySorts: async () => sortList(s => s.ownerUid === uid),
    getSort: async id => sortOnly(load().sorts[id], id),
    saveSort: async (id, data) => mutate(d => {
      if (id) Object.assign(d.sorts[id], data, { updated: Date.now() });
      else d.sorts[(id = makeCode(10).toLowerCase())] = { ...data, ownerUid: uid, plays: 0, updated: Date.now(), results: {} };
      return id;
    }),
    deleteSort: async id => mutate(d => { delete d.sorts[id]; }),
    watchResults: (id, cb) => watch(d => entries(d.sorts[id]?.results), cb),
    getMyResult: async id => load().sorts[id]?.results[uid] ?? null,
    saveSoloResult: async (id, name, result) => mutate(d => {
      const s = d.sorts[id];
      if (!s.results[uid]) s.plays++;
      s.results[uid] = { name, ...result, at: Date.now() };
    }),
  };
}
