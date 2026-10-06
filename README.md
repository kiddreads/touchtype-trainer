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
- **On-screen keyboard *and* animated finger-position hands overlaid on it**
  — every key is color-coded by which finger should press it, and a
  schematic pair of hands rests directly on top of the keyboard at real
  home-row position (left pinky on A, right index on J, etc.). Only the one
  finger that needs the next key stretches out to reach it and "taps," then
  returns home — every other finger stays put, matching real touch-typing
  posture instead of just
  memorizing key colors.
- **Listen & Type mode** — hides the word and shows only audio + a dot
  outline that reveals letters as you type them correctly, for dictation-
  style practice once a lesson feels easy.
- **Drilled repetition, TTRS-style** — a single word is typed 3-4 times in
  a row on one line ("cat cat cat") instead of appearing once and moving
  on, to actually build muscle memory. Multi-word phrases/sentences are
  left as one line, not repeated.
- **Adaptive repetition** — a word/sentence typed with a mistake is requeued
  a few items later in the same session; it only counts as "mastered" after
  two clean back-to-back passes, tracked across sessions.
- **Fair, live accuracy** — accuracy is *first-try letter accuracy*: each
  letter counts once, either right the first time or missed, and pressing
  the wrong key several times on one letter is still just one miss. It
  updates on every keystroke — dips the instant you slip, climbs back as you
  keep going — and a mistake-free run reads exactly 100%. Things that
  aren't real typing attempts are never scored: held-key auto-repeat,
  keyboard switch chatter, a reflex double-tap of Space right after moving
  on, and wrong-case letters while Caps Lock is on (a warning shows
  instead). Hovering the accuracy stat shows how many letters it's based on
  and the likely range of your true accuracy (95% Wilson interval), since
  12 letters says far less than 400. Alongside it,
  **Perfect words** grades every word the moment you finish it (in drill
  lines and sentences alike).
- **Accuracy insights** on the dashboard: *trouble keys* ranked by recent
  accuracy (so keys you've improved on drop off, with ▲/▼ trend markers),
  *accuracy by finger* in each finger's own color, and *kinds of mistakes* —
  every slip is classified as a Shift slip, right finger/wrong key, wrong
  finger, wrong hand, or space slip, with a tip for each. Per-key and
  per-finger figures are smoothed toward a typical 95% so a couple of
  presses on a new key can't read as a misleading 0% or 100%.
- **Manual advance** — it does not auto-advance
  to the next word/sentence — a fast typist's reflex tap of Space or Enter
  right after finishing a word would otherwise register as a wrong
  keystroke against whatever came next. You advance explicitly with
  **Enter or Space** once a word is complete (Space is only accepted here,
  after the word is done — mid-word it's still a normal character, since
  many items contain real spaces).
- **Speed test** — pick *Speed test* in the Lesson menu for a 30- or
  60-second test, or a 25- or 50-word one, run the way typing-test sites
  run them: random words drawn from everything taught up to the chosen
  level, never the same word twice in a row. Punctuation, capitals and
  numbers join in only once their keys have been taught (numbers from
  level 4, punctuation and capitals from level 5). Speed tests measure;
  they don't drill, requeue, or touch lesson mastery.
- **Typing-test-standard speed stats** (`typing-engine.js`, conventions
  as popularised by [Monkeytype](https://monkeytype.com), independently
  implemented):
  - **WPM** — 5 characters = 1 word, per minute of *typing* time. The
    clock starts on your first keystroke and stops while a finished line
    waits for Enter/Space, so reading a result doesn't lower your speed.
  - **Raw WPM** — every keystroke, mistakes included; the gap to WPM is
    the speed mistakes cost you. Shown live next to WPM.
  - **Keystroke accuracy** — right presses out of all presses, every
    wrong press counted (the headline accuracy stays first-try letter
    accuracy).
  - **Consistency** — how steady your raw speed was second to second
    (coefficient of variation mapped onto 0–100%).
  - **Word burst** — each word's own speed; the session result shows your
    best.
  All of these are saved to the session history alongside WPM and
  accuracy.
- **Stats are always recorded, display is optional** — WPM, accuracy, and
  full session history are saved to `localStorage` every time regardless of
  the "Live Stats" toggle; the toggle only hides the on-screen numbers while
  you type, for anyone who finds live numbers distracting.
- **Distraction-free, adjustable UI** — high-contrast theme and an "Easy
  Read" mode (larger text, extra letter/line spacing).
- **Progress dashboard** — lessons mastered per level, best WPM/accuracy,
  and lifetime totals, all local, nothing sent anywhere.
- **AI Lesson Lab** — generate extra themed lessons on the fly, naturally
  mixing real words and real sentences (never all one or the other). No API
  key, no account, needed in either place it runs:
  - **`server.js` (localhost / self-hosted)** — ships with a real,
    open-source, local model
    ([Qwen2.5-1.5B-Instruct](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct),
    via [`@huggingface/transformers`](https://github.com/huggingface/transformers.js)).
    First generation after install downloads and caches it (~1 GB,
    one-time); every generation after that runs fully offline, no network
    call. Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` instead if you'd
    rather use a bigger hosted model.
  - **GitHub Pages / any static host** — has no backend to run a server-side
    model on, so it runs a smaller open-source model
    ([LaMini-Flan-T5-77M](https://huggingface.co/Xenova/LaMini-Flan-T5-77M))
    directly in your browser instead, via the same transformers.js library
    loaded from a CDN. First generation downloads it (~150 MB, cached by
    the browser after that).

## Running it

**Core app, no AI features:**

```sh
python3 -m http.server 8000
```

then open `http://localhost:8000`. Or just open `index.html` directly — the
AI Lesson Lab still works here too, via the in-browser model (see above).

**With the local-server AI Lesson Lab:**

```sh
npm install
node server.js
```

then open `http://localhost:8935` (or `$PORT`). No key needed — the first
lesson generation downloads the local model, then it's cached. To use a
bigger hosted model instead:

```sh
ANTHROPIC_API_KEY=sk-ant-... node server.js
# or: OPENAI_API_KEY=sk-... node server.js
```

Set `LOCAL_MODEL_ID` to swap the local model for a different size trade-off,
and `LOCAL_MODEL_CACHE_DIR` to change where weights are cached (defaults to
`./.cache/models/`, gitignored).

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
npm test                   # curriculum checks + typing-engine checks
```

- Add words to `wordbank.js`, or edit the pools/sentences/templates in
  `build-curriculum.js`, then regenerate. Everything is deterministic (no
  randomness), so a given wordbank always produces the same curriculum.
- The finger/key color map and physical layout live in `keyboard.js`
  (`FINGER_MAP`, `KEYBOARD_ROWS`) — edit these for a different layout (e.g.
  Dvorak) or region.
- All practice/UI logic lives in `app.js`; speed math and random word
  generation live in `typing-engine.js` (pure functions, tested under
  Node); the AI backend lives in `server.js`. Neither requires a build step or dependencies.

## License

MIT — see `LICENSE`. Not affiliated with or endorsed by Touch-type Read and
Spell / Words Type Learning Ltd; this is an independent, from-scratch
implementation of the same teaching approach.
