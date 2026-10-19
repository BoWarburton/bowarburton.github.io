// The built-in picture library. When a game turns on pictures, any item (or
// flashcard prompt) whose name matches a picture here is shown with it, e.g.
// "Lion" → animals/lion.svg, "dots 3 dice" → dots/dots-3-dice.svg.
// To add pictures, drop same-style 200×200 SVGs into a folder and list them below.
// `caption: false` hides the name under the picture (it would give the answer away).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const LIBRARY = {
  animals: {
    caption: true,
    names: [
      'bat', 'bear', 'dolphin', 'elephant', 'giraffe', 'kangaroo', 'lion', 'monkey', 'pig', 'rabbit',
      'bee', 'butterfly', 'frog', 'lizard', 'owl', 'parrot', 'penguin', 'salamander', 'snake', 'turtle',
    ],
  },
  dots: {
    caption: false,
    names: [
      ...range(1, 6).flatMap(n => [`dots ${n} dice`, `dots ${n} scatter a`, `dots ${n} scatter b`]),
      ...range(1, 10).map(n => `ten frame ${n}`),
    ],
  },
};

const lookup = new Map(Object.entries(LIBRARY).flatMap(([folder, { caption, names }]) =>
  names.map(n => [n, { src: `pictures/${folder}/${n.replace(/ /g, '-')}.svg`, caption }])));

const find = text => lookup.get(String(text).trim().toLowerCase()) || null;
export const pictureFor = text => find(text)?.src || null;
export const hasCaption = text => find(text)?.caption !== false;
export const pictureNames = () => [...lookup.keys()];
