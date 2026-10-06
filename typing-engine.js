// TypeAloud — speed-test math and random word generation.
//
// The formulas follow the conventions Monkeytype popularised, so numbers
// here are comparable to what learners see on typing-test sites:
//   - WPM counts 5 characters as one word, per minute of typing time.
//   - Raw WPM counts every keystroke, right or wrong.
//   - Keystroke accuracy is right presses / all presses.
//   - Consistency is how steady raw speed is second to second.
//   - Burst is the speed of one word on its own.
// This is an independent implementation (no code taken from Monkeytype,
// which is GPL); only the published definitions are shared.
//
// Pure functions and small classes only: no DOM, no storage. app.js wires
// them in, and test/typing-engine.test.js runs them under Node.

// ---------- Speed ----------

function calculateWpm(charCount, durationMs) {
  if (!(durationMs > 0)) return 0;
  return (charCount / 5) / (durationMs / 60000);
}

// Typing time with the gaps cut out. Runs while the learner is actually
// typing a line, stops while a finished line waits for Enter/Space, so a
// pause to read the result never drags the speed down.
class ActiveClock {
  constructor() {
    this.accumulatedMs = 0;
    this.runningSince = null;
  }
  get running() { return this.runningSince !== null; }
  start(now) {
    if (this.runningSince === null) this.runningSince = now;
  }
  stop(now) {
    if (this.runningSince === null) return;
    this.accumulatedMs += Math.max(0, now - this.runningSince);
    this.runningSince = null;
  }
  elapsed(now) {
    return this.accumulatedMs + (this.runningSince === null ? 0 : Math.max(0, now - this.runningSince));
  }
}

// Keystrokes bucketed by second of typing time, for per-second raw speed
// and the consistency score.
class SecondBuckets {
  constructor() {
    this.raw = [];
  }
  add(elapsedMs) {
    const s = Math.floor(Math.max(0, elapsedMs) / 1000);
    while (this.raw.length <= s) this.raw.push(0);
    this.raw[s]++;
  }
  // Raw WPM for each complete second. The trailing partial second is left
  // out: half a second of typing scaled up to a full second is noise.
  rawWpmPerSecond(elapsedMs) {
    const full = Math.floor(Math.max(0, elapsedMs) / 1000);
    const out = [];
    for (let s = 0; s < full; s++) out.push((this.raw[s] || 0) * 12); // n chars/sec = n/5 words × 60
    return out;
  }
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function stdDev(values) {
  if (!values.length) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) * (v - m), 0) / values.length);
}

// Maps a coefficient of variation (0 = perfectly steady) onto 0-100%,
// falling smoothly toward 0 as the variation grows. Same curve as the
// consistency score on Monkeytype.
function kogasa(cov) {
  return 100 * (1 - Math.tanh(cov + Math.pow(cov, 3) / 3 + Math.pow(cov, 5) / 5));
}

// Null until there are at least two full seconds to compare.
function consistency(perSecondValues) {
  if (perSecondValues.length < 2) return null;
  const m = mean(perSecondValues);
  if (m === 0) return 0;
  return Math.round(kogasa(stdDev(perSecondValues) / m));
}

function keystrokeAccuracy(correctPresses, wrongPresses) {
  const total = correctPresses + wrongPresses;
  return total > 0 ? Math.round((correctPresses / total) * 100) : 100;
}

// ---------- Word generation ----------

// A pool of words to draw from. randomWord() samples with replacement;
// shuffledWord() deals the whole pool once in random order before
// repeating anything.
class Wordset {
  constructor(words, rng = Math.random) {
    this.words = words.slice();
    this.rng = rng;
    this.bag = [];
  }
  get length() { return this.words.length; }
  randomWord() {
    return this.words[Math.floor(this.rng() * this.words.length)];
  }
  shuffledWord() {
    if (this.bag.length === 0) {
      this.bag = this.words.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.words[this.bag.pop()];
  }
}

// The bare word under any punctuation/capitals, for repeat checks.
function bareWord(word) {
  return word === undefined ? undefined : word.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

const SENTENCE_END = /[.?!]$/;

// Adds punctuation and capitals to one word, using only characters in
// `allowed` — a learner is never asked for a key they haven't been taught.
// `isLast` closes the final sentence of a fixed-length test.
function punctuateWord(previousWord, word, index, isLast, allowed, rng = Math.random) {
  // Any taught capital means Shift is taught, so every capital is fair.
  const canCapitalize = [...allowed].some((c) => c >= 'A' && c <= 'Z');
  const lastChar = previousWord ? previousWord[previousWord.length - 1] : undefined;
  const afterPunct = lastChar === ',' || lastChar === '.' || lastChar === ';' || lastChar === ':';
  const enders = ['.', '?', '!'].filter((c) => allowed.has(c));

  let out = word;
  const startsSentence = index === 0 || (lastChar !== undefined && SENTENCE_END.test(lastChar));
  if (startsSentence && canCapitalize) {
    out = word[0].toUpperCase() + word.slice(1);
  }
  if (startsSentence && !isLast) return out;

  if (enders.length && (isLast || (rng() < 0.1 && !afterPunct))) {
    // Mostly full stops, with the occasional question or exclamation.
    const r = rng();
    const pick = r < 0.8 || enders.length === 1 ? enders[0] : enders[1 + Math.floor(rng() * (enders.length - 1))];
    return out + pick;
  }
  if (afterPunct) return out;

  // Fixed bands, so a mark that isn't taught yet leaves a plain word
  // rather than handing its share to the next mark.
  const r = rng();
  if (r < 0.06) return allowed.has(',') ? out + ',' : out;
  if (r < 0.07) return allowed.has('"') ? `"${out}"` : out;
  if (r < 0.08) return allowed.has('(') && allowed.has(')') ? `(${out})` : out;
  if (r < 0.09) return allowed.has(';') ? out + ';' : out;
  if (r < 0.10) return allowed.has(':') ? out + ':' : out;
  return out;
}

// A number of 1-4 digits built only from taught digits, never with a
// leading zero.
function randomNumber(allowed, rng = Math.random) {
  const digits = [...'0123456789'].filter((d) => allowed.has(d));
  if (!digits.length) return null;
  const nonZero = digits.filter((d) => d !== '0');
  if (!nonZero.length) return '0';
  const len = 1 + Math.floor(rng() * 4);
  let s = nonZero[Math.floor(rng() * nonZero.length)];
  for (let i = 1; i < len; i++) s += digits[Math.floor(rng() * digits.length)];
  return s;
}

// An endless (or fixed-length) stream of test words. Each word is drawn at
// random and re-drawn if it matches either of the two before it, so the
// same word never comes up back to back.
class WordStream {
  constructor({ words, allowed, punctuation = false, numbers = false, limit = null, rng = Math.random }) {
    this.wordset = new Wordset(words, rng);
    this.allowed = allowed;
    this.punctuation = punctuation;
    this.numbers = numbers && randomNumber(allowed, () => 0) !== null;
    this.limit = limit;
    this.rng = rng;
    this.index = 0;
    this.previous = undefined;
    this.previous2 = undefined;
  }
  get done() { return this.limit !== null && this.index >= this.limit; }
  next() {
    if (this.done) return null;
    let word;
    if (this.numbers && this.rng() < 0.08) {
      word = randomNumber(this.allowed, this.rng);
    } else {
      word = this.wordset.randomWord();
      const prev = bareWord(this.previous);
      const prev2 = bareWord(this.previous2);
      for (let tries = 0; tries < 100 && (word === prev || word === prev2); tries++) {
        word = this.wordset.randomWord();
      }
    }
    if (this.punctuation) {
      const isLast = this.limit !== null && this.index === this.limit - 1;
      word = punctuateWord(this.previous, word, this.index, isLast, this.allowed, this.rng);
    }
    this.previous2 = this.previous;
    this.previous = word;
    this.index++;
    return word;
  }
  // The next line of up to `maxWords` words, or null when a fixed-length
  // stream has run out.
  nextLine(maxWords) {
    const words = [];
    while (words.length < maxWords && !this.done) words.push(this.next());
    return words.length ? words.join(' ') : null;
  }
}

// Builds a speed-test word pool from curriculum levels 1..levelId: every
// plain word taught so far, plus the set of characters taught so far
// (which decides what punctuation, capitals and digits may appear).
function speedTestSource(levels, levelId) {
  const allowed = new Set([' ']);
  const words = new Set();
  levels.filter((l) => l.id <= levelId).forEach((level) => {
    level.lessons.forEach((lesson) => {
      lesson.words.forEach((item) => {
        for (const ch of item) allowed.add(ch);
        item.split(' ').forEach((part) => {
          if (/^[a-z]+$/.test(part)) words.add(part);
        });
      });
    });
  });
  return { words: [...words], allowed };
}
