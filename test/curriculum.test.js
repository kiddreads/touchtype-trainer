// Zero-dependency checks for the generated curriculum. Run with:
//   node build-curriculum.js && node test/curriculum.test.js
const fs = require('fs');
const path = require('path');

function loadExport(file, names) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + `\nmodule.exports = { ${names.join(', ')} };`;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

const { LEVELS } = loadExport('curriculum-data.js', ['LEVELS']);

let failures = 0;
function fail(msg) { console.error(`FAIL: ${msg}`); failures++; }

// Structural checks
if (LEVELS.length !== 10) fail(`expected 10 levels, got ${LEVELS.length}`);
LEVELS.forEach(level => {
  if (level.lessons.length !== 24) fail(`level ${level.id} has ${level.lessons.length} lessons, expected 24`);
  level.lessons.forEach(lesson => {
    if (!lesson.words || lesson.words.length === 0) {
      fail(`level ${level.id} lesson ${lesson.id} has no words`);
    }
    lesson.words.forEach(w => {
      if (typeof w !== 'string' || w.trim() === '') fail(`level ${level.id} lesson ${lesson.id} has an empty/invalid item`);
    });
  });
});

// Letter-availability check for the pure key-introduction levels (1-3):
// every word must use only letters taught by that level or earlier.
const allowed = new Set([' ']);
LEVELS.slice(0, 3).forEach(level => {
  level.newKeys.forEach(k => { if (k.length === 1) allowed.add(k.toLowerCase()); });
  level.lessons.forEach(lesson => {
    lesson.words.forEach(word => {
      for (const ch of word.toLowerCase()) {
        if (/[a-z]/.test(ch) && !allowed.has(ch)) {
          fail(`level ${level.id} ("${level.title}") word "${word}" uses untaught letter "${ch}"`);
        }
      }
    });
  });
});

// Every character must be producible by a plain keydown on a US keyboard
// (what e.key actually returns) — smart quotes, em/en-dashes, ellipsis
// characters etc. would be silently untypable, since a real keyboard press
// never generates them. Caught a real "—" (em-dash) this way once already.
const TYPABLE = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?;:\'"()-/'.split(''));
LEVELS.forEach(level => {
  level.lessons.forEach(lesson => {
    lesson.words.forEach(word => {
      for (const ch of word) {
        if (!TYPABLE.has(ch)) {
          fail(`level ${level.id} lesson ${lesson.id} item "${word}" contains untypable character ${JSON.stringify(ch)} (not producible by a plain keydown)`);
        }
      }
    });
  });
});

// Difficulty should trend upward within each level (lesson 24 harder than lesson 1).
LEVELS.forEach(level => {
  const avgLen = words => words.reduce((s, w) => s + w.length, 0) / words.length;
  const first = avgLen(level.lessons[0].words);
  const last = avgLen(level.lessons[23].words);
  if (last < first) {
    fail(`level ${level.id} ("${level.title}") difficulty did not increase: lesson1 avgLen=${first.toFixed(1)}, lesson24 avgLen=${last.toFixed(1)}`);
  }
});

if (failures === 0) {
  const totalLessons = LEVELS.reduce((s, l) => s + l.lessons.length, 0);
  const totalItems = LEVELS.reduce((s, l) => s + l.lessons.reduce((ss, les) => ss + les.words.length, 0), 0);
  console.log(`PASS: ${LEVELS.length} levels, ${totalLessons} lessons, ${totalItems} word/sentence slots, all letter/structure/difficulty checks green.`);
  process.exit(0);
} else {
  console.error(`${failures} violation(s) found.`);
  process.exit(1);
}
