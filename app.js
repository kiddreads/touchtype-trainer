// TypeAloud — core practice engine.
// Multi-sensory loop: speak the word/sentence aloud, show it on screen
// (or hide it in Listen & Type mode), the learner types it, mistakes are
// blocked in place and the word is queued again later in the session.

const SETTINGS_KEY = 'typealoud_settings_v1';
const PROGRESS_KEY = 'typealoud_progress_v1';
const LIFETIME_STATS_KEY = 'typealoud_lifetime_stats_v1';
const AI_LESSONS_KEY = 'typealoud_ai_lessons_v1';

const state = {
  levelId: null,
  lessonId: null,
  customLesson: null, // {title, words} — set when practicing an AI-generated lesson
  queue: [],
  currentWord: '',
  expectedIndex: 0,
  currentWordHadError: false,
  active: false,
  mode: 'see', // 'see' | 'listen'
  stats: { correct: 0, total: 0, startTime: null, wordsCompleted: 0, totalWords: 0 },
  wordMisses: {}
};

let settings = { rate: 0.9, voiceURI: null, contrast: false, easyRead: false, autoSpeak: true, showLiveStats: true };
let errorFlashTimer = null;
let fingerTapTimer = null;

function loadSettings() {
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  catch (e) { /* ignore corrupt settings */ }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (e) { return {}; }
}
function saveProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
}
function loadLifetimeStats() {
  try {
    return Object.assign({
      totalSessions: 0, totalKeystrokes: 0, totalCorrect: 0, totalErrors: 0,
      totalTimeMs: 0, bestWpmEver: 0, bestAccuracyEver: 0, history: []
    }, JSON.parse(localStorage.getItem(LIFETIME_STATS_KEY) || '{}'));
  } catch (e) {
    return { totalSessions: 0, totalKeystrokes: 0, totalCorrect: 0, totalErrors: 0, totalTimeMs: 0, bestWpmEver: 0, bestAccuracyEver: 0, history: [] };
  }
}
function saveLifetimeStats(s) {
  try { localStorage.setItem(LIFETIME_STATS_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
function loadAiLessons() {
  try { return JSON.parse(localStorage.getItem(AI_LESSONS_KEY) || '[]'); } catch (e) { return []; }
}
function saveAiLessons(list) {
  try { localStorage.setItem(AI_LESSONS_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Speech ----------

function populateVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  const select = document.getElementById('voiceSelect');
  select.innerHTML = '';
  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = v.name;
    select.appendChild(opt);
  });
  if (settings.voiceURI && voices.some(v => v.voiceURI === settings.voiceURI)) {
    select.value = settings.voiceURI;
  }
}

function speak(text) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  // A speech failure (missing voices, an autoplay-policy throw, etc.) must
  // never block the rest of word setup (highlighting, stats) that follows
  // this call — that would look exactly like "Start does nothing."
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = settings.rate;
    const voice = speechSynthesis.getVoices().find(v => v.voiceURI === settings.voiceURI);
    if (voice) utter.voice = voice;
    speechSynthesis.speak(utter);
  } catch (e) { /* speech is a bonus channel, not a requirement to keep practicing */ }
}

// ---------- Keyboard + finger-position hands ----------

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(ch => rowEl.appendChild(makeKeyEl(ch)));
    kb.appendChild(rowEl);
  });
  const spaceRow = document.createElement('div');
  spaceRow.className = 'kb-row';
  const spaceKey = makeKeyEl(' ');
  spaceKey.classList.add('space');
  spaceKey.textContent = 'space';
  spaceRow.appendChild(spaceKey);
  kb.appendChild(spaceRow);
}

function makeKeyEl(ch) {
  const el = document.createElement('div');
  const finger = FINGER_MAP[ch] || 'thumb';
  el.className = `key f-${finger}`;
  el.dataset.key = ch;
  el.textContent = ch === ' ' ? '' : ch;
  return el;
}

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

function keyElFor(char) {
  return document.querySelector(`.key[data-key="${cssEscape(char.toLowerCase())}"]`);
}

function fingerElsFor(fingerName) {
  return document.querySelectorAll(`.finger[data-finger="${cssEscape(fingerName)}"]`);
}

function clearActiveKeys() {
  document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}

function clearReadyFingers() {
  document.querySelectorAll('.finger.ready').forEach(f => f.classList.remove('ready'));
}

// Steady "press this next" glow on both the key and the finger that should press it.
function highlightKey(char) {
  clearActiveKeys();
  clearReadyFingers();
  if (char === undefined) return;
  const keyEl = keyElFor(char);
  if (keyEl) keyEl.classList.add('active');
  const finger = FINGER_MAP[char.toLowerCase()] || 'thumb';
  fingerElsFor(finger).forEach(f => f.classList.add('ready'));
  if (char !== char.toLowerCase() && char !== ' ') {
    // Uppercase letter: nudge the opposite pinky toward Shift too.
    const shiftSide = finger.startsWith('l-') ? 'r-pinky' : 'l-pinky';
    fingerElsFor(shiftSide).forEach(f => f.classList.add('ready-shift'));
    clearTimeout(fingerTapTimer);
    fingerTapTimer = setTimeout(() => {
      document.querySelectorAll('.finger.ready-shift').forEach(f => f.classList.remove('ready-shift'));
    }, 400);
  }
}

// Brief "tap" animation on the finger that just pressed a correct key.
function tapFinger(char) {
  const finger = FINGER_MAP[char.toLowerCase()] || 'thumb';
  fingerElsFor(finger).forEach(f => {
    f.classList.add('tap');
    setTimeout(() => f.classList.remove('tap'), 160);
  });
}

function flashErrorKey(char) {
  const keyEl = keyElFor(char);
  if (keyEl) {
    keyEl.classList.add('error');
    clearTimeout(errorFlashTimer);
    errorFlashTimer = setTimeout(() => keyEl.classList.remove('error'), 300);
  }
  const finger = FINGER_MAP[char.toLowerCase()] || 'thumb';
  fingerElsFor(finger).forEach(f => {
    f.classList.add('tap-error');
    setTimeout(() => f.classList.remove('tap-error'), 300);
  });
}

function renderLegend() {
  const legend = document.getElementById('fingerLegend');
  legend.innerHTML = '';
  Object.keys(FINGER_LABELS).forEach(key => {
    const span = document.createElement('span');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = `var(--f-${key})`;
    span.appendChild(swatch);
    span.appendChild(document.createTextNode(FINGER_LABELS[key]));
    legend.appendChild(span);
  });
}

// ---------- Level / lesson selection ----------

function populateLevelSelect() {
  const select = document.getElementById('levelSelect');
  select.innerHTML = '';
  LEVELS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `Level ${l.id}: ${l.title}`;
    select.appendChild(opt);
  });
}

function populateLessonSelectForLevel(levelId) {
  const level = LEVELS.find(l => l.id === levelId);
  const select = document.getElementById('lessonSelect');
  select.innerHTML = '';
  level.lessons.forEach((lesson, i) => {
    const opt = document.createElement('option');
    opt.value = lesson.id;
    opt.textContent = `Lesson ${i + 1}`;
    select.appendChild(opt);
  });
}

function currentLevel() {
  return LEVELS.find(l => l.id === state.levelId);
}

// ---------- Lesson flow ----------

function startLesson(levelId, lessonId) {
  state.levelId = levelId;
  state.lessonId = lessonId;
  state.customLesson = null;
  const level = currentLevel();
  const lesson = level.lessons.find(l => l.id === lessonId);
  beginSession(lesson.words, `Level ${level.id} · Lesson ${lessonId}: ${level.title}`, level.description);
}

function startCustomLesson(lessonMeta) {
  state.levelId = null;
  state.lessonId = null;
  state.customLesson = lessonMeta;
  beginSession(lessonMeta.words, `AI Lesson: ${lessonMeta.title}`, 'Generated on this machine — not part of the core curriculum.');
}

function beginSession(words, titleText, descText) {
  state.queue = shuffle(words);
  state.wordMisses = {};
  state.stats = { correct: 0, total: 0, startTime: Date.now(), wordsCompleted: 0, cleanWords: 0, totalWords: words.length };
  state.active = true;
  document.getElementById('lessonTitle').textContent = titleText;
  document.getElementById('lessonDesc').textContent = descText;
  document.getElementById('startBtn').hidden = true;
  document.getElementById('pauseBtn').hidden = false;
  document.getElementById('typeCapture').focus();
  nextWord();
}

function pauseLesson() {
  state.active = false;
  document.getElementById('startBtn').hidden = false;
  document.getElementById('pauseBtn').hidden = true;
  document.getElementById('wordDisplay').textContent = 'Paused. Press Start to resume.';
}

function nextWord() {
  if (state.queue.length === 0) {
    finishSession();
    return;
  }
  state.currentWord = state.queue.shift();
  state.expectedIndex = 0;
  state.currentWordHadError = false;
  state.currentCharErrored = false;
  state.awaitingAdvance = false;
  document.getElementById('advanceHint').hidden = true;
  renderWord();
  if (settings.autoSpeak) speak(state.currentWord);
  highlightKey(state.currentWord[0]);
  updateStatsUI();
}

function renderWord() {
  const el = document.getElementById('wordDisplay');
  const listenHint = document.getElementById('listenHint');
  const isListen = state.mode === 'listen';
  listenHint.hidden = !isListen;
  el.innerHTML = state.currentWord.split('').map((c, i) => {
    const classes = ['ch'];
    if (i < state.expectedIndex) classes.push('done');
    if (i === state.expectedIndex) classes.push('current');
    let shown = c;
    if (c === ' ') shown = '\u00A0';
    else if (isListen && i >= state.expectedIndex) shown = '•';
    return `<span class="${classes.join(' ')}">${shown}</span>`;
  }).join('');
}

function shakeCurrentChar() {
  const current = document.querySelector('#wordDisplay .ch.current');
  if (!current) return;
  current.classList.add('shake');
  setTimeout(() => current.classList.remove('shake'), 250);
}

function completeWord() {
  const word = state.currentWord;
  state.stats.wordsCompleted++;
  const clean = !state.currentWordHadError;
  if (clean) state.stats.cleanWords++;
  let retiredAfterMisses = false;
  if (!clean) {
    state.wordMisses[word] = (state.wordMisses[word] || 0) + 1;
    // Cap it at 3 misses — endless re-queuing of the same stuck word/sentence
    // is discouraging, not helpful. After the 3rd miss it moves on instead;
    // it's still recorded as unmastered so it can come back next session.
    if (state.wordMisses[word] < 3) {
      const insertAt = Math.min(state.queue.length, 3);
      state.queue.splice(insertAt, 0, word);
    } else {
      retiredAfterMisses = true;
    }
  }
  if (!state.customLesson) recordWordResult(word, clean);
  // Wait for the learner to press Enter instead of auto-advancing — gives
  // them a moment to see the result rather than getting swept into the
  // next word/sentence. Space isn't used for this since many items
  // (multi-word phrases, full sentences) contain real space characters.
  state.awaitingAdvance = true;
  const hint = document.getElementById('advanceHint');
  hint.textContent = retiredAfterMisses
    ? "Moving on — you'll see this one again next session. Press Enter ↵ or Space to continue."
    : 'Press Enter ↵ or Space to continue.';
  hint.hidden = false;
}

// The live/recorded "accuracy" is completion-based (clean words ÷ words
// attempted), like TTRS describes its own scoring ("based on completion
// rates and accuracy, not speed"). A raw keystroke ratio would let one
// missed letter you mash at repeatedly tank the whole session and never
// recover — completion-based accuracy only costs you that one word.
function wordAccuracy() {
  return state.stats.wordsCompleted > 0
    ? Math.round((state.stats.cleanWords / state.stats.wordsCompleted) * 100)
    : 100;
}
function rawKeystrokeAccuracy() {
  return state.stats.total > 0 ? Math.round((state.stats.correct / state.stats.total) * 100) : 100;
}

function finishSession() {
  const minutes = (Date.now() - state.stats.startTime) / 60000;
  const wpm = minutes > 0 ? Math.round(state.stats.wordsCompleted / minutes) : 0;
  const accuracy = wordAccuracy();

  // Recorded unconditionally, regardless of whether live stats are shown.
  recordLifetimeSession({ wpm, accuracy, rawAccuracy: rawKeystrokeAccuracy(), durationMs: Date.now() - state.stats.startTime, wordsCompleted: state.stats.wordsCompleted });
  if (!state.customLesson) saveSessionResult(state.levelId, state.lessonId, wpm, accuracy);

  document.getElementById('wordDisplay').innerHTML =
    `<span class="session-message">Lesson complete! ${wpm} WPM, ${accuracy}% accuracy 🎉</span>`;
  document.getElementById('listenHint').hidden = true;
  clearActiveKeys();
  clearReadyFingers();
  state.active = false;
  document.getElementById('startBtn').hidden = false;
  document.getElementById('pauseBtn').hidden = true;
  renderDashboard();
}

function updateStatsUI() {
  const accuracy = wordAccuracy();
  const minutes = (Date.now() - state.stats.startTime) / 60000;
  const wpm = minutes > 0 ? Math.round(state.stats.wordsCompleted / minutes) : 0;
  // Stats are always computed here; only the DOM section's visibility is toggled by settings.showLiveStats.
  document.getElementById('accuracyStat').textContent = `${accuracy}%`;
  document.getElementById('wpmStat').textContent = `${wpm}`;
  document.getElementById('queueStat').textContent = `${state.queue.length + 1}`;
  if (state.stats.totalWords) {
    const pct = Math.round((state.stats.wordsCompleted / state.stats.totalWords) * 100);
    document.getElementById('progressFill').style.width = `${pct}%`;
  }
}

// ---------- Progress / mastery / lifetime-stats persistence ----------

function recordWordResult(word, clean) {
  const progress = loadProgress();
  const key = `${state.levelId}:${state.lessonId}`;
  progress[key] = progress[key] || { words: {}, sessions: [] };
  const w = progress[key].words[word] || { cleanStreak: 0, mastered: false, attempts: 0 };
  w.attempts++;
  if (clean) {
    w.cleanStreak++;
    if (w.cleanStreak >= 2) w.mastered = true;
  } else {
    w.cleanStreak = 0;
  }
  progress[key].words[word] = w;
  saveProgress(progress);
}

function saveSessionResult(levelId, lessonId, wpm, accuracy) {
  const progress = loadProgress();
  const key = `${levelId}:${lessonId}`;
  progress[key] = progress[key] || { words: {}, sessions: [] };
  progress[key].sessions.push({ wpm, accuracy, date: Date.now() });
  saveProgress(progress);
}

function recordLifetimeSession({ wpm, accuracy, rawAccuracy, durationMs, wordsCompleted }) {
  const s = loadLifetimeStats();
  s.totalSessions++;
  s.totalKeystrokes += state.stats.total;
  s.totalCorrect += state.stats.correct;
  s.totalErrors += (state.stats.total - state.stats.correct);
  s.totalTimeMs += durationMs;
  s.bestWpmEver = Math.max(s.bestWpmEver, wpm);
  s.bestAccuracyEver = Math.max(s.bestAccuracyEver, accuracy);
  // rawAccuracy (raw keystroke ratio) is kept for detailed/future reference
  // only — it is never what's shown live, since it's unfairly punishing.
  s.history.push({ date: Date.now(), levelId: state.levelId, lessonId: state.lessonId, wpm, accuracy, rawAccuracy, wordsCompleted, durationMs });
  if (s.history.length > 200) s.history = s.history.slice(-200);
  saveLifetimeStats(s);
}

function renderDashboard() {
  const progress = loadProgress();
  const table = document.getElementById('dashboardTable');
  const rows = ['<tr><th>Level</th><th>Lessons with mastery</th><th>Best WPM</th><th>Best accuracy</th></tr>'];
  LEVELS.forEach(level => {
    let masteredLessons = 0, bestWpm = 0, bestAcc = 0, any = false;
    level.lessons.forEach(lesson => {
      const data = progress[`${level.id}:${lesson.id}`];
      if (!data) return;
      any = true;
      const allMastered = lesson.words.length > 0 && lesson.words.every(w => data.words[w] && data.words[w].mastered);
      if (allMastered) masteredLessons++;
      data.sessions.forEach(s => { bestWpm = Math.max(bestWpm, s.wpm); bestAcc = Math.max(bestAcc, s.accuracy); });
    });
    rows.push(`<tr><td>${level.id}. ${level.title}</td><td>${masteredLessons}/${level.lessons.length}</td><td>${any ? bestWpm : '—'}</td><td>${any ? bestAcc + '%' : '—'}</td></tr>`);
  });
  table.innerHTML = rows.join('');

  const lifetime = loadLifetimeStats();
  document.getElementById('lifetimeSummary').textContent =
    lifetime.totalSessions > 0
      ? `Lifetime: ${lifetime.totalSessions} sessions, best ${lifetime.bestWpmEver} WPM, best ${lifetime.bestAccuracyEver}% accuracy, ${Math.round(lifetime.totalTimeMs / 60000)} min practiced.`
      : 'No sessions recorded yet.';
}

// ---------- Input handling ----------

function handleKeydown(e) {
  if (!state.active || !state.currentWord) return;
  const active = document.activeElement;
  if (active && (active.tagName === 'SELECT' || active.tagName === 'INPUT' && active.id !== 'typeCapture')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Shift' || e.key === 'Tab') return;

  if (state.awaitingAdvance) {
    // Once a word/sentence is complete there's nothing left to type, so
    // Space is no longer ambiguous with "part of the word" here — accept
    // it alongside Enter, since plenty of fast typists reflexively hit
    // Space between words out of habit.
    e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ') nextWord();
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); return; }
  if (e.key.length !== 1 && e.key !== ' ') { e.preventDefault(); return; }
  e.preventDefault();

  const expectedChar = state.currentWord[state.expectedIndex];
  if (e.key === expectedChar) {
    state.expectedIndex++;
    state.stats.total++;
    state.stats.correct++;
    state.currentCharErrored = false;
    tapFinger(e.key);
    if (state.expectedIndex >= state.currentWord.length) {
      renderWord();
      completeWord();
    } else {
      renderWord();
      highlightKey(state.currentWord[state.expectedIndex]);
    }
  } else {
    // Only the first wrong press on a given letter counts — mashing the
    // same wrong key five times while distracted counts as one mistake,
    // not five.
    if (!state.currentCharErrored) {
      state.stats.total++;
      state.currentCharErrored = true;
    }
    state.currentWordHadError = true;
    flashErrorKey(e.key);
    shakeCurrentChar();
  }
  updateStatsUI();
}

// ---------- AI Lesson Lab (localhost only) ----------

let aiAvailable = false;

async function checkAiAvailability() {
  try {
    const resp = await fetch('/api/health', { cache: 'no-store' });
    if (!resp.ok) return;
    const data = await resp.json();
    aiAvailable = true;
    document.getElementById('aiLab').hidden = false;
    document.getElementById('aiLabStatus').textContent = data.aiAvailable
      ? 'AI lesson generation is enabled on this server.'
      : 'Server is running, but no ANTHROPIC_API_KEY / OPENAI_API_KEY is set — generation will fail until one is configured and the server restarted.';
    document.getElementById('aiGenerateBtn').disabled = !data.aiAvailable;
  } catch (e) {
    // No backend (GitHub Pages, or a plain static file server) — feature stays hidden.
  }
}

async function generateAiLesson() {
  const theme = document.getElementById('aiTheme').value.trim() || 'general practice';
  const sentence = document.getElementById('aiSentenceMode').checked;
  const btn = document.getElementById('aiGenerateBtn');
  const resultBox = document.getElementById('aiLabResult');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  resultBox.hidden = true;
  try {
    const resp = await fetch('/api/generate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, count: 18, sentence })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    state.lastAiLesson = { title: theme, words: data.words };
    document.getElementById('aiLabWords').textContent = data.words.join('  •  ');
    resultBox.hidden = false;
  } catch (err) {
    document.getElementById('aiLabWords').textContent = `Error: ${err.message}`;
    resultBox.hidden = false;
  } finally {
    btn.disabled = !aiAvailable;
    btn.textContent = 'Generate lesson';
  }
}

function renderAiLessonList() {
  const list = loadAiLessons();
  const container = document.getElementById('aiLessonList');
  if (list.length === 0) { container.innerHTML = '<p class="muted">No saved AI lessons yet.</p>'; return; }
  container.innerHTML = list.map((l, i) =>
    `<button class="ai-saved-lesson" data-index="${i}">${l.title} (${l.words.length})</button>`
  ).join('');
  container.querySelectorAll('.ai-saved-lesson').forEach(btn => {
    btn.addEventListener('click', () => {
      const lesson = loadAiLessons()[Number(btn.dataset.index)];
      if (lesson) startCustomLesson(lesson);
    });
  });
}

// ---------- Settings UI wiring ----------

function applySettingsToUI() {
  document.body.classList.toggle('contrast', settings.contrast);
  document.body.classList.toggle('easy-read', settings.easyRead);
  document.getElementById('contrastToggle').classList.toggle('active', settings.contrast);
  document.getElementById('easyReadToggle').classList.toggle('active', settings.easyRead);
  document.getElementById('statsToggle').classList.toggle('active', settings.showLiveStats);
  document.getElementById('stats').classList.toggle('hidden', !settings.showLiveStats);
  document.getElementById('rateSlider').value = settings.rate;
}

function init() {
  loadSettings();
  buildKeyboard();
  renderLegend();
  populateLevelSelect();
  populateLessonSelectForLevel(Number(document.getElementById('levelSelect').value) || LEVELS[0].id);
  applySettingsToUI();
  renderDashboard();
  renderAiLessonList();
  checkAiAvailability();

  if ('speechSynthesis' in window) {
    populateVoices();
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  document.getElementById('levelSelect').addEventListener('change', (e) => {
    populateLessonSelectForLevel(Number(e.target.value));
  });
  document.getElementById('startBtn').addEventListener('click', () => {
    const levelId = Number(document.getElementById('levelSelect').value) || LEVELS[0].id;
    const lessonId = Number(document.getElementById('lessonSelect').value) || 1;
    startLesson(levelId, lessonId);
  });
  document.getElementById('pauseBtn').addEventListener('click', pauseLesson);
  document.getElementById('replayBtn').addEventListener('click', () => {
    if (state.currentWord) speak(state.currentWord);
  });
  document.getElementById('modeToggle').addEventListener('click', () => {
    state.mode = state.mode === 'see' ? 'listen' : 'see';
    document.getElementById('modeToggle').textContent = state.mode === 'see' ? '👁️ See & Type' : '👂 Listen & Type';
    document.getElementById('modeToggle').classList.toggle('active', state.mode === 'listen');
    if (state.currentWord) renderWord();
  });
  document.getElementById('contrastToggle').addEventListener('click', () => {
    settings.contrast = !settings.contrast;
    applySettingsToUI();
    saveSettings();
  });
  document.getElementById('easyReadToggle').addEventListener('click', () => {
    settings.easyRead = !settings.easyRead;
    applySettingsToUI();
    saveSettings();
  });
  document.getElementById('statsToggle').addEventListener('click', () => {
    settings.showLiveStats = !settings.showLiveStats;
    applySettingsToUI();
    saveSettings();
  });
  document.getElementById('rateSlider').addEventListener('input', (e) => {
    settings.rate = Number(e.target.value);
    saveSettings();
  });
  document.getElementById('voiceSelect').addEventListener('change', (e) => {
    settings.voiceURI = e.target.value;
    saveSettings();
  });
  document.getElementById('resetProgressBtn').addEventListener('click', () => {
    if (confirm('Clear all saved progress and lifetime stats on this device?')) {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(LIFETIME_STATS_KEY);
      renderDashboard();
    }
  });
  document.getElementById('aiGenerateBtn').addEventListener('click', generateAiLesson);
  document.getElementById('aiUseLessonBtn').addEventListener('click', () => {
    if (state.lastAiLesson) startCustomLesson(state.lastAiLesson);
  });
  document.getElementById('aiSaveLessonBtn').addEventListener('click', () => {
    if (!state.lastAiLesson) return;
    const list = loadAiLessons();
    list.push(state.lastAiLesson);
    saveAiLessons(list);
    renderAiLessonList();
  });

  window.addEventListener('keydown', handleKeydown);
  document.getElementById('typeCapture').addEventListener('blur', () => {
    if (state.active) document.getElementById('typeCapture').focus();
  });
}

document.addEventListener('DOMContentLoaded', init);
