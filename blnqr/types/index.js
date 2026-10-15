// The game types, in the order they're shown.
import persona from './persona.js';
import flashcard from './flashcard.js';
import categorizer from './categorizer.js';
import sequencer from './sequencer.js';
import preference from './preference.js';
import group from './group.js';
import decision from './decision.js';

export const TYPES = [persona, flashcard, categorizer, sequencer, preference, group, decision];
export const typeOf = id => TYPES.find(t => t.id === id);
