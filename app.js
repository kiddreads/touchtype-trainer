// TypeAloud — core practice engine.
// Multi-sensory loop: speak the word/sentence aloud, show it on screen
// (or hide it in Listen & Type mode), the learner types it, mistakes are
// blocked in place and the word is queued again later in the session.

const PROGRESS_KEY = 'typealoud_progress_v1';
const SETTINGS_KEY = 'typealoud_settings_v1';

const state = {
  lessonId: null,
  queue: [],
  currentWord: '',
  expectedIndex: 0,
  currentWordHadError: false,
  active: false,
  mode: 'see', // 'see' | 'listen'
  stats: { correct: 0, total: 0, startTime: null, wordsCompleted: 0 },
  wordMisses: {}
};

let settings = { rate: 0.9, voiceURI: null, contrast: false, easyRead: false, autoSpeak: true };
let errorFlashTimer = null;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings = Object.assign(settings, saved);
  } catch (e) { /* ignore corrupt settings */ }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
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
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = settings.rate;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.voiceURI === settings.voiceURI);
  if (voice) utter.voice = voice;
  speechSynthesis.speak(utter);
}

// ---------- Keyboard ----------

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

function keyElFor(char) {
  const lower = char.toLowerCase();
  return document.querySelector(`.key[data-key="${cssEscape(lower)}"]`);
}

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

function clearActiveKeys() {
  document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}

function highlightKey(char) {
  clearActiveKeys();
  if (char === undefined) return;
  const el = keyElFor(char);
  if (el) el.classList.add('active');
  if (char !== char.toLowerCase() && char !== ' ') {
    // Uppercase letter: also nudge attention to Shift by flashing the
    // opposite pinky's home key isn't wired up as a real key; skip.
  }
}

function flashErrorKey(char) {
  const el = keyElFor(char);
  if (!el) return;
  el.classList.add('error');
  clearTimeout(errorFlashTimer);
  errorFlashTimer = setTimeout(() => el.classList.remove('error'), 300);
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

// ---------- Lesson flow ----------

function populateLessonSelect() {
  const select = document.getElementById('lessonSelect');
  select.innerHTML = '';
  LESSONS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `${l.id}. ${l.title}`;
    select.appendChild(opt);
  });
}

function currentLesson() {
  return LESSONS.find(l => l.id === state.lessonId);
}

function startLesson(lessonId) {
  state.lessonId = lessonId;
  const lesson = currentLesson();
  state.queue = shuffle(lesson.words);
  state.wordMisses = {};
  state.stats = { correct: 0, total: 0, startTime: Date.now(), wordsCompleted: 0, totalWords: lesson.words.length };
  state.active = true;
  document.getElementById('lessonTitle').textContent = `Lesson ${lesson.id}: ${lesson.title}`;
  document.getElementById('lessonDesc').textContent = lesson.description;
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
  const el = document.getElementById('wordDisplay');
  const current = el.querySelector('.ch.current');
  if (!current) return;
  current.classList.add('shake');
  setTimeout(() => current.classList.remove('shake'), 250);
}

function completeWord() {
  const word = state.currentWord;
  state.stats.wordsCompleted++;
  if (state.currentWordHadError) {
    state.wordMisses[word] = (state.wordMisses[word] || 0) + 1;
    const insertAt = Math.min(state.queue.length, 3);
    state.queue.splice(insertAt, 0, word);
    recordWordResult(word, false);
  } else {
    recordWordResult(word, true);
  }
  setTimeout(nextWord, 350);
}

function finishSession() {
  const lesson = currentLesson();
  const minutes = (Date.now() - state.stats.startTime) / 60000;
  const wpm = minutes > 0 ? Math.round(state.stats.wordsCompleted / minutes) : 0;
  const accuracy = state.stats.total > 0 ? Math.round((state.stats.correct / state.stats.total) * 100) : 100;
  saveSessionResult(lesson.id, wpm, accuracy);
  document.getElementById('wordDisplay').innerHTML =
    `<span class="session-message">Lesson complete! ${wpm} WPM, ${accuracy}% accuracy 🎉</span>`;
  document.getElementById('listenHint').hidden = true;
  clearActiveKeys();
  state.active = false;
  document.getElementById('startBtn').hidden = false;
  document.getElementById('pauseBtn').hidden = true;
  renderDashboard();
}

function updateStatsUI() {
  const accuracy = state.stats.total > 0 ? Math.round((state.stats.correct / state.stats.total) * 100) : 100;
  document.getElementById('accuracyStat').textContent = `${accuracy}%`;
  const minutes = (Date.now() - state.stats.startTime) / 60000;
  const wpm = minutes > 0 ? Math.round(state.stats.wordsCompleted / minutes) : 0;
  document.getElementById('wpmStat').textContent = `${wpm}`;
  document.getElementById('queueStat').textContent = `${state.queue.length + 1}`;
  const lesson = currentLesson();
  if (lesson) {
    const pct = Math.round((state.stats.wordsCompleted / state.stats.totalWords) * 100);
    document.getElementById('progressFill').style.width = `${pct}%`;
  }
}

// ---------- Progress / mastery persistence ----------

function recordWordResult(word, clean) {
  const progress = loadProgress();
  const lessonKey = String(state.lessonId);
  progress[lessonKey] = progress[lessonKey] || { words: {}, sessions: [] };
  const w = progress[lessonKey].words[word] || { cleanStreak: 0, mastered: false, attempts: 0 };
  w.attempts++;
  if (clean) {
    w.cleanStreak++;
    if (w.cleanStreak >= 2) w.mastered = true;
  } else {
    w.cleanStreak = 0;
  }
  progress[lessonKey].words[word] = w;
  saveProgress(progress);
}

function saveSessionResult(lessonId, wpm, accuracy) {
  const progress = loadProgress();
  const lessonKey = String(lessonId);
  progress[lessonKey] = progress[lessonKey] || { words: {}, sessions: [] };
  progress[lessonKey].sessions.push({ wpm, accuracy, date: Date.now() });
  saveProgress(progress);
}

function renderDashboard() {
  const progress = loadProgress();
  const table = document.getElementById('dashboardTable');
  const rows = ['<tr><th>Lesson</th><th>Mastered</th><th>Best WPM</th><th>Best accuracy</th></tr>'];
  LESSONS.forEach(lesson => {
    const data = progress[String(lesson.id)];
    const total = lesson.words.length;
    const mastered = data ? Object.values(data.words).filter(w => w.mastered).length : 0;
    const bestWpm = data && data.sessions.length ? Math.max(...data.sessions.map(s => s.wpm)) : '—';
    const bestAcc = data && data.sessions.length ? Math.max(...data.sessions.map(s => s.accuracy)) : '—';
    rows.push(`<tr><td>${lesson.id}. ${lesson.title}</td><td>${mastered}/${total}</td><td>${bestWpm}</td><td>${bestAcc === '—' ? '—' : bestAcc + '%'}</td></tr>`);
  });
  table.innerHTML = rows.join('');
}

// ---------- Input handling ----------

function handleKeydown(e) {
  if (!state.active || !state.currentWord) return;
  const active = document.activeElement;
  if (active && active.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Shift' || e.key === 'Tab') return;
  if (e.key.length !== 1) {
    if (e.key !== ' ') { e.preventDefault(); return; }
  }
  e.preventDefault();

  const expectedChar = state.currentWord[state.expectedIndex];
  if (e.key === expectedChar) {
    state.expectedIndex++;
    state.stats.total++;
    state.stats.correct++;
    if (state.expectedIndex >= state.currentWord.length) {
      renderWord();
      completeWord();
    } else {
      renderWord();
      highlightKey(state.currentWord[state.expectedIndex]);
    }
  } else {
    state.stats.total++;
    state.currentWordHadError = true;
    flashErrorKey(e.key);
    shakeCurrentChar();
  }
  updateStatsUI();
}

// ---------- Settings UI wiring ----------

function applySettingsToUI() {
  document.body.classList.toggle('contrast', settings.contrast);
  document.body.classList.toggle('easy-read', settings.easyRead);
  document.getElementById('contrastToggle').classList.toggle('active', settings.contrast);
  document.getElementById('easyReadToggle').classList.toggle('active', settings.easyRead);
  document.getElementById('rateSlider').value = settings.rate;
}

function init() {
  loadSettings();
  buildKeyboard();
  renderLegend();
  populateLessonSelect();
  applySettingsToUI();
  renderDashboard();

  if ('speechSynthesis' in window) {
    populateVoices();
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  document.getElementById('startBtn').addEventListener('click', () => {
    const lessonId = Number(document.getElementById('lessonSelect').value) || LESSONS[0].id;
    startLesson(lessonId);
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
  document.getElementById('rateSlider').addEventListener('input', (e) => {
    settings.rate = Number(e.target.value);
    saveSettings();
  });
  document.getElementById('voiceSelect').addEventListener('change', (e) => {
    settings.voiceURI = e.target.value;
    saveSettings();
  });
  document.getElementById('resetProgressBtn').addEventListener('click', () => {
    if (confirm('Clear all saved progress on this device?')) {
      localStorage.removeItem(PROGRESS_KEY);
      renderDashboard();
    }
  });

  window.addEventListener('keydown', handleKeydown);
  document.getElementById('typeCapture').addEventListener('blur', () => {
    if (state.active) document.getElementById('typeCapture').focus();
  });
}

document.addEventListener('DOMContentLoaded', init);
