// Checks for typing-engine.js. Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function loadExport(file, names) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + `\nmodule.exports = { ${names.join(', ')} };`;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

const E = loadExport('typing-engine.js', [
  'calculateWpm', 'ActiveClock', 'SecondBuckets', 'kogasa', 'consistency', 'keystrokeAccuracy',
  'Wordset', 'bareWord', 'punctuateWord', 'randomNumber', 'WordStream', 'speedTestSource'
]);
const { LEVELS } = loadExport('curriculum-data.js', ['LEVELS']);

// Deterministic generator so failures reproduce.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('WPM is 5 characters per word, per minute', () => {
  assert.strictEqual(E.calculateWpm(250, 60000), 50);
  assert.strictEqual(E.calculateWpm(50, 30000), 20);
  assert.strictEqual(E.calculateWpm(10, 0), 0);
});

test('active clock leaves out stopped time', () => {
  const c = new E.ActiveClock();
  c.start(1000);
  c.start(1500); // already running: no reset
  c.stop(3000);
  assert.strictEqual(c.elapsed(10000), 2000);
  c.start(10000);
  assert.strictEqual(c.elapsed(10500), 2500);
  c.stop(11000);
  c.stop(12000); // already stopped: no change
  assert.strictEqual(c.elapsed(20000), 3000);
});

test('per-second raw WPM uses full seconds only', () => {
  const b = new E.SecondBuckets();
  [100, 200, 300, 1100, 1900, 2100].forEach((ms) => b.add(ms));
  assert.deepStrictEqual(b.rawWpmPerSecond(2500), [36, 24]);
});

test('consistency: steady is 100, erratic is low, too short is null', () => {
  assert.strictEqual(E.consistency([60, 60, 60, 60]), 100);
  assert.ok(E.consistency([10, 120, 5, 140]) < 40);
  assert.strictEqual(E.consistency([60]), null);
  assert.strictEqual(E.consistency([0, 0]), 0);
  assert.ok(Math.abs(E.kogasa(0) - 100) < 1e-9);
});

test('keystroke accuracy counts every wrong press', () => {
  assert.strictEqual(E.keystrokeAccuracy(95, 5), 95);
  assert.strictEqual(E.keystrokeAccuracy(0, 0), 100);
});

test('shuffled words deal the whole pool before repeating', () => {
  const ws = new E.Wordset(['a', 'b', 'c', 'd'], seeded(1));
  const first = [1, 2, 3, 4].map(() => ws.shuffledWord()).sort();
  assert.deepStrictEqual(first, ['a', 'b', 'c', 'd']);
});

test('the stream never repeats either of the previous two words', () => {
  const s = new E.WordStream({ words: ['cat', 'dog', 'sun', 'hat'], allowed: new Set('cadoghsunt '), rng: seeded(7) });
  const out = Array.from({ length: 500 }, () => s.next());
  for (let i = 2; i < out.length; i++) {
    assert.notStrictEqual(out[i], out[i - 1]);
    assert.notStrictEqual(out[i], out[i - 2]);
  }
});

test('fixed-length stream stops at its limit and ends on a full stop', () => {
  const allowed = new Set('abcdefghijklmnopqrstuvwxyzAT.,? ');
  const s = new E.WordStream({ words: ['cat', 'dog', 'sun', 'hat'], allowed, punctuation: true, limit: 25, rng: seeded(3) });
  const lines = [];
  let line;
  while ((line = s.nextLine(6)) !== null) lines.push(line);
  const words = lines.join(' ').split(' ');
  assert.strictEqual(words.length, 25);
  assert.match(words[0], /^[A-Z]/);
  assert.match(words[24], /[.?]$/);
});

test('punctuation only uses taught characters', () => {
  const allowed = new Set('abcdefghijklmnopqrstuvwxyz. ');
  const rng = seeded(11);
  let prev;
  for (let i = 0; i < 2000; i++) {
    const w = E.punctuateWord(prev, 'cat', i, false, allowed, rng);
    assert.match(w, /^cat\.?$/); // no capitals, commas or quotes: only '.' is taught
    prev = w;
  }
});

test('capitals follow sentence ends once Shift is taught', () => {
  const allowed = new Set('abcdefghijklmnopqrstuvwxyzA.! ');
  assert.strictEqual(E.punctuateWord(undefined, 'big', 0, false, allowed, () => 0.5), 'Big');
  assert.strictEqual(E.punctuateWord('run.', 'big', 3, false, allowed, () => 0.5), 'Big');
  assert.strictEqual(E.punctuateWord('run', 'big', 3, false, allowed, () => 0.5), 'big');
});

test('numbers use taught digits with no leading zero', () => {
  const allowed = new Set('0129');
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const n = E.randomNumber(allowed, rng);
    assert.match(n, /^[129][0129]{0,3}$/);
  }
  assert.strictEqual(E.randomNumber(new Set('abc'), rng), null);
});

test('speed-test source only offers what each level has taught', () => {
  const home = E.speedTestSource(LEVELS, 1);
  assert.ok(home.words.length > 0);
  home.words.forEach((w) => assert.match(w, /^[asdfghjkl]+$/));
  assert.ok(![...'0123456789.'].some((c) => home.allowed.has(c)));

  const numbers = E.speedTestSource(LEVELS, 4);
  assert.ok(numbers.allowed.has('1'));
  assert.ok(!numbers.allowed.has('.'));

  const punct = E.speedTestSource(LEVELS, 6);
  assert.ok(punct.allowed.has(',') && punct.allowed.has('.') && punct.allowed.has('A'));
});
