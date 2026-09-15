# TypeAloud

An open-source, multi-sensory touch-typing tutor for the browser, inspired by
[Touch-type Read and Spell (TTRS)](https://www.readandspell.com). No install,
no build step — just static HTML/CSS/JS.

## Why

TTRS teaches touch typing through three channels at once: the word is spoken
aloud, shown on screen, and then typed by the learner. It uses real, whole,
phonics-based words from lesson one instead of random letter drills, and it
adapts — words you get wrong come back around for another try. TypeAloud
reimplements that core loop as a small, free, open-source web app.

## Features

- **Multi-sensory loop** — every word is spoken aloud (Web Speech API), shown
  on screen, and typed by the learner.
- **Real words, not gibberish** — each lesson only uses words made of keys
  already taught, but they're always genuine, whole, phonics-friendly English
  words (or real short sentences by lesson 5) — never random letter strings.
- **Progressive curriculum** — home row → top row → bottom row → numbers →
  capitals & punctuation → mixed review, each lesson restricted to keys
  introduced so far (verified by `test/curriculum.test.js`).
- **On-screen keyboard with finger guide** — every key is color-coded by
  which finger should press it, with the next key glowing so learners build
  muscle memory instead of hunting for letters.
- **Listen & Type mode** — hides the word and shows only audio + a dot
  outline that reveals letters as you type them correctly, for dictation-style
  practice once a lesson feels easy.
- **Adaptive repetition** — a word typed with a mistake is requeued a few
  words later in the same session; it only counts as "mastered" after two
  clean back-to-back passes, tracked across sessions.
- **Distraction-free, adjustable UI** — high-contrast theme and an "Easy
  Read" mode (larger text, extra letter/line spacing) for learners who find
  the default look hard to read.
- **Progress dashboard** — words mastered, best WPM, and best accuracy per
  lesson, stored locally in the browser (`localStorage`), nothing sent
  anywhere.

## Running it

No build tools needed:

```sh
python3 -m http.server 8000
```

then open `http://localhost:8000`. Or just open `index.html` directly in a
browser (speech synthesis and everything else works from a `file://` URL too).

## How typing is checked

Wrong keystrokes are blocked in place rather than accepted and then corrected:
if you press the wrong key, the on-screen key and the current letter flash
red and nothing is added, so learners never end up staring at a garbled word.
The correct key must be pressed to advance. This is deliberately more
forgiving than a strict typing test — the goal is muscle memory, not speed
under pressure.

## Extending it

- Add more lessons or words in `words.js` — each lesson lists the new keys it
  introduces plus a `words` array; run `test/curriculum.test.js` to check new
  words don't use letters that haven't been taught yet.
- The finger/key color map is also in `words.js` (`FINGER_MAP`,
  `KEYBOARD_ROWS`), if you want a different keyboard layout (e.g. Dvorak or a
  non-US layout).
- All practice logic lives in `app.js`; there's no framework or build step.

## License

MIT — see `LICENSE`. Not affiliated with or endorsed by Touch-type Read and
Spell / Words Type Learning Ltd; this is an independent, from-scratch
implementation of the same teaching approach.
