// Generates curriculum-data.js: 10 levels x 24 lessons, deterministically
// built from wordbank.js. No randomness (so output is reproducible and
// testable) — words/sentences are drawn from a sorted-by-difficulty pool
// and windowed so lesson 1 of a level is easiest, lesson 24 is hardest.
//
// Run: node build-curriculum.js
'use strict';

const fs = require('fs');
const path = require('path');

const bankCode = fs.readFileSync(path.join(__dirname, 'wordbank.js'), 'utf8') + '\nmodule.exports = { COMMON_WORDS };';
const bankMod = { exports: {} };
new Function('module', 'exports', bankCode)(bankMod, bankMod.exports);
const { COMMON_WORDS } = bankMod.exports;

const PLAIN_WORDS = [...new Set(COMMON_WORDS.filter(w => /^[a-z]+$/.test(w)))];

function scoreOf(item) {
  return item.length + (item.includes(' ') ? 3 : 0);
}

function sortByDifficulty(pool) {
  return pool.slice().sort((a, b) => scoreOf(a) - scoreOf(b) || String(a).localeCompare(String(b)));
}

// Sliding window across a difficulty-sorted pool: lesson 0 sits at the easy
// end, the last lesson sits at the hard end, lessons in between overlap and
// slide, so difficulty rises smoothly across a level's 24 lessons.
function windowLessons(pool, count, windowMin, windowMax) {
  const sorted = sortByDifficulty(pool);
  const n = sorted.length;
  const window = Math.max(windowMin, Math.min(windowMax, n));
  const lessons = [];
  for (let i = 0; i < count; i++) {
    let start = n <= window ? 0 : Math.round((i * (n - window)) / (count - 1));
    let slice = sorted.slice(start, start + window);
    if (slice.length < windowMin) {
      slice = slice.concat(sorted.slice(0, windowMin - slice.length));
    }
    lessons.push(slice);
  }
  return lessons;
}

function wordsWithOnlyLetters(pool, allowedLetters) {
  return pool.filter(w => [...w].every(ch => allowedLetters.has(ch)));
}

// ---------- Level-specific pool builders ----------

function buildNumberPool() {
  const nouns = ['cats', 'dogs', 'books', 'pens', 'days', 'hours', 'minutes', 'miles', 'stars', 'apples', 'chairs', 'friends'];
  const places = ['page', 'room', 'level', 'chapter', 'unit', 'lesson', 'floor', 'aisle'];
  const tokens = new Set();
  for (let i = 1; i <= 40; i++) tokens.add(String(i));
  for (let i = 1; i <= 24; i++) {
    const suffix = (i % 10 === 1 && i !== 11) ? 'st' : (i % 10 === 2 && i !== 12) ? 'nd' : (i % 10 === 3 && i !== 13) ? 'rd' : 'th';
    tokens.add(`${i}${suffix}`);
  }
  [3, 5, 7, 9, 10, 12, 24, 60, 100].forEach(n => {
    nouns.forEach((noun, idx) => { if ((n + idx) % 3 === 0) tokens.add(`${n} ${noun}`); });
    places.forEach((place, idx) => { if ((n + idx) % 4 === 0) tokens.add(`${place} ${n}`); });
  });
  ['2020', '2021', '2022', '2023', '2024', '2025', '2026'].forEach(y => tokens.add(y));
  return [...tokens];
}

function buildBasicSentencePool() {
  // Hand-written, natural, one-clause sentences — no mad-libs templates.
  return [
    'The sun rose over the quiet hills.',
    'My dog loves to chase the ball.',
    'We built a sandcastle on the beach.',
    'The kitten curled up by the fire.',
    'Can you hear the birds singing?',
    'She painted a picture of the sea.',
    'The children laughed at the funny clown.',
    'A gentle breeze moved through the trees.',
    'He rode his bike to the park.',
    'The stars sparkled in the night sky.',
    'We shared a pizza after the game.',
    'The old clock ticked in the hallway.',
    'Rain tapped softly on the window.',
    'The garden was full of bright flowers.',
    'Our team won the final match!',
    'The baby giggled at the puppet show.',
    'Snow covered the entire village overnight.',
    'The chef stirred a pot of soup.',
    'They watched the sunset from the hill.',
    'The library was calm and quiet today.',
    'A rainbow appeared after the storm.',
    'The farmer fed the hungry chickens.',
    'We packed our bags for the trip.',
    'The music filled the whole room.',
    'Is that a shooting star?',
    'The waves crashed against the rocks.',
    'Grandma baked cookies for the party.',
    'The train pulled into the station.'
  ];
}

function buildPunctuationSentencePool() {
  // Hand-written so every sentence is real, grammatical English — no
  // templated contraction ever gets glued into a sentence it doesn't fit.
  return [
    'We packed apples; oranges; and pears.',
    'She said, "Hello there, friend."',
    'The dog (a small, scruffy one) ran fast.',
    'The well-known author signed our books.',
    'My favorite colors are: red, blue, and green.',
    'He asked, "Are you ready to go?"',
    'The old house (built in 1920) is for sale.',
    'Bring these: a coat, boots, and gloves.',
    "It's a well-earned afternoon off.",
    'The bakery (just around the corner) smells wonderful.',
    "I don't know the answer yet.",
    "She can't find her missing keys.",
    "It won't take long to finish.",
    "That isn't the right way home.",
    "We aren't ready for the surprise.",
    "He wasn't home when we called.",
    "It's already later than I thought.",
    "That's a genuinely great idea.",
    "We're heading to the park after lunch.",
    "They're painting the fence this weekend.",
    "I'm almost done with my homework.",
    "Let's try that recipe again.",
    "He didn't hear the doorbell ring.",
    "I couldn't quite open the stubborn jar.",
    "You shouldn't skip breakfast before school.",
    "We wouldn't miss the fireworks for anything.",
    'The chef announced, "Dinner is ready!"',
    'Pack light: one bag, one coat, and good shoes.',
    'My best friend (who lives next door) is visiting.',
    'The relay race - fast, loud, and fun - ended in a tie.'
  ];
}

function buildDigraphPool() {
  const digraphs = ['th', 'sh', 'ch', 'wh', 'ee', 'ea', 'oo', 'ou', 'ai', 'ph', 'qu'];
  return PLAIN_WORDS.filter(w => digraphs.some(d => w.includes(d)));
}

function buildDigraphSentencePool() {
  return [
    'The three sheep ran through the green field.',
    'She caught a fish near the shore.',
    'We cheered when the team scored.',
    'The teacher read a story about a queen.',
    'Please wash your hands before we eat.',
    'A chilly wind blew through the trees.',
    'He reached for the last cookie.',
    'The children played outside all afternoon.',
    'A moose walked slowly through the woods.',
    'The choir sang a cheerful song.',
    'We watched the moon rise over the sea.',
    'The school bus stopped at the corner.',
    'She wore a bright yellow raincoat.',
    'The chef cooked up a delicious feast.',
    'The train sped through the misty valley.',
    'Bright green leaves covered the path.',
    'The puppy chewed on an old shoe.',
    'We counted the sheep in the meadow.',
    'The cart wheel squeaked with every turn.',
    'A quiet stream ran beside the road.'
  ];
}

function buildLongWordPool() {
  return PLAIN_WORDS.filter(w => w.length >= 8);
}

function buildLongSentencePool() {
  return [
    'The astronaut described her incredible journey to the stars.',
    'Our teacher explained why understanding history matters.',
    'The scientist discovered something truly extraordinary.',
    'Everyone admired the beautiful architecture downtown.',
    'The orchestra performed a wonderful, unforgettable concert.',
    'Her imagination created an entire fantastical world.',
    'The neighborhood celebrated its anniversary together.',
    'The engineer designed an impressive suspension bridge.',
    'We learned about photosynthesis in science class.',
    'The documentary explored the mysteries of the universe.',
    'His grandmother shared an unforgettable family story.',
    'The organization raised money for environmental conservation.',
    'The gymnast performed an incredible acrobatic routine.',
    'The librarian recommended an extraordinary adventure novel.',
    'The chef prepared a spectacular three-course dinner.',
    'The photographer captured a breathtaking mountain sunset.',
    'The archaeologist uncovered an ancient underground chamber.',
    'The volunteers organized a wonderful charity event.',
    'The professor discussed an interesting theory in class.',
    'The explorer navigated through the dense rainforest.'
  ];
}

function buildFullSentencePool() {
  const clausesA = [
    'After school', 'Before dinner', 'During the storm', 'Once the sun rose',
    'While we waited', 'Because it rained', 'Since the game ended', 'Although it was late',
    'As the fog lifted', 'Just before sunrise', 'When the bell rang', 'Once the music stopped'
  ];
  const clausesB = [
    'we walked to the park', 'the dog ran across the yard', 'everyone cheered loudly',
    'the children played outside', 'she finished her homework', 'we watched the stars',
    'the team celebrated together', 'he read his favorite book', 'the campers packed their tents',
    'the sailors steadied the boat', 'the crowd slowly went quiet', 'the puppy fell fast asleep'
  ];
  const set = new Set();
  clausesA.forEach((a, i) => {
    for (let offset = 0; offset < 3; offset++) {
      const b = clausesB[(i + offset) % clausesB.length];
      set.add(`${a}, ${b}.`);
    }
  });
  return [...set];
}

// Interleave two difficulty-progressing pools into `countEach * 2` lessons:
// even lesson slots (0, 2, 4...) come from poolA, odd slots from poolB —
// e.g. a plain-word lesson followed by a full-sentence lesson, alternating,
// each side getting harder across the level on its own track.
function interleaveLessons(poolA, poolB, countEach, winA, winB) {
  const listA = windowLessons(poolA, countEach, winA.min, winA.max);
  const listB = windowLessons(poolB, countEach, winB.min, winB.max);
  const lessons = [];
  for (let i = 0; i < countEach; i++) {
    lessons.push(listA[i]);
    lessons.push(listB[i]);
  }
  return lessons;
}

// ---------- Level definitions ----------

const HOME_ROW = new Set(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']);
const TOP_ROW_ADDED = new Set([...HOME_ROW, 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']);

const digraphPool = buildDigraphPool();
const digraphSentencePool = buildDigraphSentencePool();
const longWordPool = buildLongWordPool();
const longSentencePool = buildLongSentencePool();
const fullSentencePool = buildFullSentencePool();
const basicSentencePool = buildBasicSentencePool();
const punctuationSentencePool = buildPunctuationSentencePool();
const CONTRACTION_WORDS = [...new Set(COMMON_WORDS.filter(w => w.includes("'")))];

const LESSON_COUNT = 24;
const HALF = LESSON_COUNT / 2;

const LEVEL_DEFS = [
  {
    id: 1, title: 'Home Row', newKeys: [...HOME_ROW],
    description: 'Rest your fingers on a s d f  j k l. "a" is the only vowel on home row, so it will glow constantly here — that is expected, not a bug.',
    pool: wordsWithOnlyLetters(PLAIN_WORDS, HOME_ROW), windowMin: 8, windowMax: 14
  },
  {
    id: 2, title: 'Top Row', newKeys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    description: 'Reach up to the row above home row without looking down. e, i, o and u finally join a as vowels.',
    pool: wordsWithOnlyLetters(PLAIN_WORDS, TOP_ROW_ADDED), windowMin: 10, windowMax: 16
  },
  {
    id: 3, title: 'Bottom Row', newKeys: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
    description: 'The whole alphabet is unlocked. Curl your fingers down to the bottom row for z x c v b n m.',
    pool: PLAIN_WORDS, windowMin: 12, windowMax: 18
  },
  {
    id: 4, title: 'Numbers', newKeys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    description: 'Reach for the number row while keeping your other fingers anchored on home row.',
    pool: buildNumberPool(), windowMin: 10, windowMax: 16
  },
  {
    id: 5, title: 'Capitals & End Punctuation', newKeys: ['Shift', '.', ',', '!', '?'],
    description: 'Hold Shift with your opposite pinky to capitalize the first letter of a sentence, and reach for . , ! ? to end it. Plain-word lessons alternate with full-sentence lessons.',
    poolA: PLAIN_WORDS, poolB: basicSentencePool,
    windowA: { min: 12, max: 18 }, windowB: { min: 8, max: 12 }
  },
  {
    id: 6, title: 'More Punctuation & Contractions', newKeys: [';', ':', "'", '"', '(', ')', '-'],
    description: 'Semicolons, colons, quotes, parentheses, hyphens, and apostrophes for contractions — standalone-word lessons alternate with full-sentence lessons.',
    poolA: CONTRACTION_WORDS, poolB: punctuationSentencePool,
    windowA: { min: 8, max: 16 }, windowB: { min: 8, max: 12 }
  },
  {
    id: 7, title: 'Tricky Letter Teams', newKeys: [],
    description: 'Letter teams like th, sh, ch, ee, oo and ou show up constantly in English. Word lessons alternate with sentences built from the same letter teams.',
    poolA: digraphPool, poolB: digraphSentencePool,
    windowA: { min: 10, max: 16 }, windowB: { min: 8, max: 12 }
  },
  {
    id: 8, title: 'Long Words', newKeys: [],
    description: 'Longer, multi-syllable words alternating with sentences that use them. Keep your rhythm steady instead of speeding up and slowing down.',
    poolA: longWordPool, poolB: longSentencePool,
    windowA: { min: 8, max: 12 }, windowB: { min: 8, max: 12 }
  },
  {
    id: 9, title: 'Full Sentences', newKeys: [],
    description: 'Simple one-clause sentences alternate with longer two-clause sentences — the closest thing here to real writing.',
    poolA: basicSentencePool, poolB: fullSentencePool,
    windowA: { min: 8, max: 12 }, windowB: { min: 8, max: 12 }
  },
  {
    id: 10, title: 'Mixed Speed Review', newKeys: [],
    description: 'Everything at once: long words and letter teams alternating with the hardest sentences, for a final speed-and-accuracy review.',
    poolA: [...new Set([...longWordPool, ...digraphPool])],
    poolB: [...new Set([...fullSentencePool, ...punctuationSentencePool, ...digraphSentencePool, ...longSentencePool])],
    windowA: { min: 12, max: 18 }, windowB: { min: 10, max: 16 }
  }
];

const LEVELS = LEVEL_DEFS.map(def => {
  const lessonWordSets = def.poolA
    ? interleaveLessons(def.poolA, def.poolB, HALF, def.windowA, def.windowB)
    : windowLessons(def.pool, LESSON_COUNT, def.windowMin, def.windowMax);
  return {
    id: def.id,
    title: def.title,
    newKeys: def.newKeys,
    description: def.description,
    lessons: lessonWordSets.map((words, i) => ({
      id: i + 1,
      title: `${def.title} ${i + 1}`,
      words
    }))
  };
});

const header = `// AUTO-GENERATED by build-curriculum.js — do not hand-edit.
// Regenerate with: node build-curriculum.js
// ${LEVELS.length} levels x ${LESSON_COUNT} lessons, built deterministically from wordbank.js.
`;

const out = header + `\nconst LEVELS = ${JSON.stringify(LEVELS, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, 'curriculum-data.js'), out);

const totalLessons = LEVELS.reduce((sum, l) => sum + l.lessons.length, 0);
const totalItems = LEVELS.reduce((sum, l) => sum + l.lessons.reduce((s, les) => s + les.words.length, 0), 0);
console.log(`Wrote curriculum-data.js: ${LEVELS.length} levels, ${totalLessons} lessons, ${totalItems} word/sentence slots.`);
