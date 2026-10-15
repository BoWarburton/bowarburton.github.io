// The built-in picture library. When a game turns on pictures, any item whose
// name matches a picture here is shown with it (e.g. "Lion" → animals/lion.svg).
// To add pictures, drop same-style 200×200 SVGs into a folder and list them below.
const LIBRARY = {
  animals: [
    'bat', 'bear', 'dolphin', 'elephant', 'giraffe', 'kangaroo', 'lion', 'monkey', 'pig', 'rabbit',
    'bee', 'butterfly', 'frog', 'lizard', 'owl', 'parrot', 'penguin', 'salamander', 'snake', 'turtle',
  ],
};

const lookup = new Map(Object.entries(LIBRARY).flatMap(([folder, names]) =>
  names.map(n => [n, `pictures/${folder}/${n}.svg`])));

export const pictureFor = text => lookup.get(String(text).trim().toLowerCase()) || null;
export const pictureNames = () => [...lookup.keys()];
