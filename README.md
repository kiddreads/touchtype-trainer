# TypeAloud

An open-source, multi-sensory touch-typing tutor for the browser, inspired by
[Touch-type Read and Spell (TTRS)](https://www.readandspell.com). No build
step for the core app — just static HTML/CSS/JS, plus one optional local
Node server for AI-generated bonus lessons.

## Why

TTRS teaches touch typing through three channels at once: the word is spoken
aloud, shown on screen, and then typed by the learner. It uses real, whole,
phonics-based words from lesson one instead of random letter drills, it
adapts — words you get wrong come back around for another try — and its
scoring is completion- and accuracy-based rather than a punishing raw
keystroke count. TypeAloud reimplements that core loop as a small, free,
open-source web app.

## Features

- **Multi-sensory loop** — every word/sentence is spoken aloud (Web Speech
  API), shown on screen, and typed by the learner.
- **Real words and sentences, never gibberish** — the entire curriculum
  (10 levels × 24 lessons = 240 lessons, `curriculum-data.js`) is generated
  by `build-curriculum.js` by filtering a real English word bank
  (`wordbank.js`) and a set of hand-written, grammatically correct sentences
  — never invented on the fly. `test/curriculum.test.js` verifies structure,
  letter-availability, and difficulty progression on every regeneration.
- **Progressive curriculum**: Home Row → Top Row → Bottom Row → Numbers →
  Capitals & End Punctuation → More Punctuation & Contractions → Tricky
  Letter Teams (digraphs) → Long Words → Full Sentences → Mixed Speed
  Review. Levels 1–4 are pure key-introduction (each word only uses keys
  already taught). From level 5 on, every level **alternates** plain-word
  lessons with full-sentence lessons, and every level gets harder from its
  first lesson to its 24th.
- **On-screen keyboard *and* animated finger-position hands** — every key is
  color-coded by which finger should press it, and a schematic pair of
  hands below shows the actual finger lighting up and "tapping" in real
  time, so you're building muscle memory for hand position, not just
  memorizing key colors.
- **Listen & Type mode** — hides the word and shows only audio + a dot
  outline that reveals letters as you type them correctly, for dictation-
  style practice once a lesson feels easy.
- **Adaptive repetition** — a word/sentence typed with a mistake is requeued
  a few items later in the same session; it only counts as "mastered" after
  two clean back-to-back passes, tracked across sessions.
- **Fair, completion-based scoring** — accuracy is *clean words ÷ words
  attempted*, not a raw keystroke ratio, so getting stuck on one letter and
  pressing the wrong key several times before noticing only costs you that
  one word, not five separate strikes against you. It does not auto-advance
  to the next word/sentence — a fast typist's reflex tap of Space or Enter
  right after finishing a word would otherwise register as a wrong
  keystroke against whatever came next. You advance explicitly with
  **Enter or Space** once a word is complete (Space is only accepted here,
  after the word is done — mid-word it's still a normal character, since
  many items contain real spaces).
- **Stats are always recorded, display is optional** — WPM, accuracy, and
  full session history are saved to `localStorage` every time regardless of
  the "Live Stats" toggle; the toggle only hides the on-screen numbers while
  you type, for anyone who finds live numbers distracting.
- **Distraction-free, adjustable UI** — high-contrast theme and an "Easy
  Read" mode (larger text, extra letter/line spacing).
- **Progress dashboard** — lessons mastered per level, best WPM/accuracy,
  and lifetime totals, all local, nothing sent anywhere.
- **AI Lesson Lab (localhost only)** — generate extra themed lessons on the
  fly with an LLM. This only appears when the app is served by `server.js`
  *and* an API key is configured; it's absent from the GitHub Pages build
  and from a plain static file server, since neither can hold a secret key
  or call an AI API.

## Running it

**Core app, no AI features:**

```sh
python3 -m http.server 8000
```

then open `http://localhost:8000`. Or just open `index.html` directly.

**With the AI Lesson Lab enabled:**

```sh
ANTHROPIC_API_KEY=sk-ant-... node server.js
# or: OPENAI_API_KEY=sk-... node server.js
```

then open `http://localhost:8935` (or `$PORT`). Without a key set, `server.js`
still serves the full static app fine — the AI panel just checks
`GET /api/health` on load and stays hidden/disabled until a key exists.

## How typing is checked

Wrong keystrokes are blocked in place rather than accepted and then
corrected: press the wrong key and the on-screen key, the matching finger on
the hand graphic, and the current letter all flash red — nothing is added to
the word. The correct key must be pressed to advance, and repeatedly mashing
the same wrong key only counts once against your accuracy for that letter.
When you finish a word/sentence, it stays on screen until you press Enter,
so you always see the result before moving on.

## Regenerating or extending the curriculum

```sh
node build-curriculum.js   # rebuilds curriculum-data.js from wordbank.js
node test/curriculum.test.js
```

- Add words to `wordbank.js`, or edit the pools/sentences/templates in
  `build-curriculum.js`, then regenerate. Everything is deterministic (no
  randomness), so a given wordbank always produces the same curriculum.
- The finger/key color map and physical layout live in `keyboard.js`
  (`FINGER_MAP`, `KEYBOARD_ROWS`) — edit these for a different layout (e.g.
  Dvorak) or region.
- All practice/UI logic lives in `app.js`; the AI backend lives in
  `server.js`. Neither requires a build step or dependencies.

## License

MIT — see `LICENSE`. Not affiliated with or endorsed by Touch-type Read and
Spell / Words Type Learning Ltd; this is an independent, from-scratch
implementation of the same teaching approach.
