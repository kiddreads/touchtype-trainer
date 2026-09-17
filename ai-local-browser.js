// In-browser AI Lesson Lab for static hosting (GitHub Pages has no backend,
// so server.js's /api/generate-lesson isn't reachable there). This runs a
// small open-source model entirely client-side via transformers.js — no
// server, no API key, no account. The visitor's own browser downloads and
// caches the model once (via the browser's HTTP cache / Cache API), then
// every generation after that runs locally.
//
// Deliberately a smaller model than the Node/local-server tier
// (server.js's default is onnx-community/Qwen2.5-1.5B-Instruct): running in
// a tab has a much tighter memory/bandwidth budget than a desktop Node
// process, so this trades some quality for something that actually loads
// on an average laptop or phone in a reasonable time.
'use strict';

// Xenova/LaMini-Flan-T5-77M — see getBrowserGenerator() below for why.
const BROWSER_MODEL_ID = 'Xenova/LaMini-Flan-T5-77M';

let browserGeneratorPromise = null;

async function getBrowserGenerator(onProgress) {
  if (!browserGeneratorPromise) {
    browserGeneratorPromise = (async () => {
      const { pipeline } = await import(
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4/dist/transformers.min.js'
      );
      // A real, small (77M-parameter), open-source, instruction-tuned
      // model — small enough (~150 MB quantized) to fetch and run in a
      // browser tab without WebGPU, still coherent enough for short
      // structured lists like this app needs.
      return pipeline('text2text-generation', BROWSER_MODEL_ID, {
        progress_callback: onProgress
      });
    })();
  }
  return browserGeneratorPromise;
}

// One prompt per kind, same reasoning as server.js's buildPrompt: a tiny
// model asked to interleave two formats in one response is unreliable
// (observed on the Node-side 0.5B model — it exploded a sentence into one
// array entry per word). Two clean, simple generations merged afterward is
// far more robust, and this model is smaller still, so it matters even more
// here.
function buildBrowserPrompt({ theme, allowedLetters, count, kind }) {
  const letterNote = allowedLetters && allowedLetters.length
    ? ` Only use these letters (plus spaces${kind === 'sentences' ? ', and . ! ?' : ''}): ${allowedLetters.join(' ')}.`
    : '';
  const spec = kind === 'sentences' ? 'short real English sentences' : 'real common English words';
  return `List exactly ${count} ${spec} for the theme "${theme}".${letterNote} ` +
    'Respond with ONLY a JSON array of strings, nothing else.';
}

function extractBrowserItems(text, allowedLetters) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Local model response did not contain a JSON array — try again or a shorter theme.');
  let items = JSON.parse(match[0]);
  items = items.filter((w) => typeof w === 'string' && w.trim().length > 0).map((w) => w.trim());
  if (allowedLetters && allowedLetters.length) {
    const allowedSet = new Set(allowedLetters.map((c) => c.toLowerCase()).concat([' ', '.', '!', '?', "'"]));
    items = items.filter((w) => [...w.toLowerCase()].every((ch) => !/[a-z]/.test(ch) || allowedSet.has(ch)));
  }
  return items;
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Mirrors server.js's response shape ({ theme, words }) so app.js's
// generateAiLesson() can call whichever backend is active without knowing
// which one it is.
async function generateLessonInBrowser({ theme, allowedLetters, count }, onProgress) {
  const generator = await getBrowserGenerator(onProgress);
  // ~72/28 words/sentences — matches the real curriculum's average
  // composition (0% sentences in early levels, up to 50% only in the
  // dedicated "Full Sentences" level; this sits at a representative
  // mid-point since an ad-hoc AI lesson isn't tied to one level).
  const wordCount = Math.max(1, Math.round(count * 0.72));
  const sentenceCount = Math.max(1, count - wordCount);

  const wordPrompt = buildBrowserPrompt({ theme, allowedLetters, count: wordCount, kind: 'words' });
  const sentencePrompt = buildBrowserPrompt({ theme, allowedLetters, count: sentenceCount, kind: 'sentences' });
  const [wordOutput, sentenceOutput] = await Promise.all([
    generator(wordPrompt, { max_new_tokens: 512 }),
    generator(sentencePrompt, { max_new_tokens: 512 })
  ]);
  const wordText = (wordOutput && wordOutput[0] && wordOutput[0].generated_text) || '';
  const sentenceText = (sentenceOutput && sentenceOutput[0] && sentenceOutput[0].generated_text) || '';

  const wordItems = extractBrowserItems(wordText, allowedLetters);
  let sentenceItems = [];
  try { sentenceItems = extractBrowserItems(sentenceText, allowedLetters); } catch (e) { /* words alone are enough */ }
  const words = shuffle(wordItems.concat(sentenceItems));
  if (words.length === 0) throw new Error('Local model returned no usable words after filtering.');
  return { theme, words };
}
